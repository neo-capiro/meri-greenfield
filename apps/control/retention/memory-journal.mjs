/** Database-side retention state, restorable to an earlier point: the test and contract adapter with the same port as the PostgreSQL
 * adapter. Every write is a compare-and-set on the projection hash the caller read (`expected`: null means the row must not exist).
 * Transitions take the shared side of a recovery lock and recovery takes the exclusive side, so a transition that started before
 * recovery completes first and none can interleave with a recovery pass. */
import {fail,hash} from './boundary.mjs';
import {assertExactProjection} from './projection-proof.mjs';
export function createRecoveryLock(){
 let readers=0,writer=false;const waiters=[];
 const wake=()=>{while(waiters.length){const w=waiters[0];if(w.exclusive?(readers===0&&!writer):!writer){waiters.shift();if(w.exclusive)writer=true;else readers++;w.resolve();}else break;}};
 const acquire=exclusive=>new Promise(resolve=>{waiters.push({exclusive,resolve});wake();});
 return Object.freeze({
  async shared(fn){await acquire(false);try{return await fn();}finally{readers--;wake();}},
  async exclusive(fn){await acquire(true);try{return await fn();}finally{writer=false;wake();}},
  state:()=>({readers,writer,waiting:waiters.length})
 });
}
export function createMemoryRetentionJournal(){
 let state=new Map();const lock=createRecoveryLock();
 const copy=m=>new Map([...m].map(([k,v])=>[k,structuredClone(v)]));
 return Object.freeze({
  async get(key){const v=state.get(key);return v?structuredClone(v):null;},
  /** The backing store captures both values without yielding, under the same recovery exclusion shared by every owner. */
  readProjection(key,readWatermark){return lock.shared(()=>{
   const projection=state.get(key)??null,watermark=readWatermark();
   return structuredClone({projection,watermark});});},
  async set(key,value,{expected,exclusive=false}={}){if(typeof key!=='string'||!key||!value||typeof value!=='object')fail('RETENTION_INVALID_REQUEST');
   const write=async()=>{const current=state.get(key)??null,token=current?hash(current):null;if(expected!==undefined&&expected!==token)fail('RETENTION_STALE_WRITE');state.set(key,structuredClone(value));return structuredClone(value);};
   return exclusive?write():lock.shared(write);},
  async keys(){return [...state.keys()];},
  /** Synchronous proof for the memory watermark's atomic check-and-advance; it must not yield between these steps. */
  assertProjection(proof){assertExactProjection(state.get(proof.key)??null,proof);return true;},
  /** Recovery runs here: every in-flight transition completes first and none starts until the pass ends. */
  exclusive(fn){return lock.exclusive(fn);},
  lock,
  /** A backup at this moment. */
  snapshot(){return copy(state);},
  /** A restore to that backup: everything decided after it is gone from the database. */
  restore(snapshot){state=copy(snapshot);},
 });
}
/** The compare-and-set token for a row the caller has read. */
export const projectionToken=row=>row?hash(row):null;
