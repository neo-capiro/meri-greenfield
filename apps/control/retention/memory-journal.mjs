/** Database-side retention state, restorable to an earlier point: the test and contract adapter with the same port as the PostgreSQL
 * adapter. Every write is a compare-and-set on the projection hash the caller read (`expected`: null means the row must not exist).
 * Transitions take the shared side of a recovery lock and recovery takes the exclusive side, so a transition that started before
 * recovery completes first and none can interleave with a recovery pass. */
import {fail,hash} from './boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertExactProjection} from './projection-proof.mjs';
export function createRecoveryLock(){
 let readers=0,writer=false;const waiters=[];
 const wake=()=>{while(waiters.length){const w=waiters[0];if(w.exclusive?(readers===0&&!writer):!writer){waiters.shift();if(w.exclusive)writer=true;else readers++;w.resolve();}else break;}};
 const acquire=(exclusive,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted){reject(signal.reason);return;}
  const abort=()=>{const i=waiters.indexOf(waiter);if(i!==-1){waiters.splice(i,1);reject(signal.reason);wake();}},waiter={exclusive,resolve:()=>{signal?.removeEventListener('abort',abort);resolve();}};
  signal?.addEventListener('abort',abort,{once:true});waiters.push(waiter);wake();});
 return Object.freeze({
  async shared(fn,{signal}={}){await acquire(false,signal);try{return await fn();}finally{readers--;wake();}},
  async exclusive(fn,{signal}={}){await acquire(true,signal);try{return await fn();}finally{writer=false;wake();}},
  state:()=>({readers,writer,waiting:waiters.length})
 });
}
export function createMemoryRetentionJournal(){
 let state=new Map();const lock=createRecoveryLock(),transitions=new Map();
 const transitionFor=key=>{let transition=transitions.get(key);if(!transition){transition=createRecoveryLock();transitions.set(key,transition);}return transition;};
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
  /** Contract adapter for the PostgreSQL per-subject transition advisory lock. */
  withTransition(key,fn){if(typeof key!=='string'||!key||typeof fn!=='function')fail('RETENTION_INVALID_REQUEST');
   return transitionFor(key).exclusive(fn);},
  /** Shared subject transition locks span the whole page; one cancellation/deadline bounds acquisition and the callback. */
  async withServing(keys,fn,{signal,deadlineMs=Date.now()+10000}={}){if(!Array.isArray(keys)||keys.length>100||typeof fn!=='function'||keys.some(k=>typeof k!=='string'||!k))fail('RETENTION_INVALID_REQUEST');
   const life=createOperationLifetime({deadlineMs,now:Date.now,signal,errorFactory:()=>Object.assign(new Error('RETENTION_READ_UNAVAILABLE'),{code:'RETENTION_READ_UNAVAILABLE'})});
   const ordered=[...new Set(keys)].sort();const acquire=i=>i===ordered.length?life.run(fn):transitionFor(ordered[i]).shared(()=>acquire(i+1),{signal:life.signal});
   try{return await acquire(0);}finally{life.close();}},
  lock,
  /** A backup at this moment. */
  snapshot(){return copy(state);},
  /** A restore to that backup: everything decided after it is gone from the database. */
  restore(snapshot){state=copy(snapshot);},
 });
}
/** The compare-and-set token for a row the caller has read. */
export const projectionToken=row=>row?hash(row):null;
