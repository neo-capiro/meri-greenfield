/** Database-side retention state, restorable to an earlier point: the test and contract adapter. The PostgreSQL adapter implements the
 * same port over migrations 0010 and artifacts 0002. Every write is a compare-and-set on the projection hash the caller read
 * (`expected`: null means the row must not exist), so a stale decision can never overwrite a newer one. */
import {fail,hash} from './boundary.mjs';
export function createMemoryRetentionJournal(){
 let state=new Map();
 const copy=m=>new Map([...m].map(([k,v])=>[k,structuredClone(v)]));
 return Object.freeze({
  async get(key){const v=state.get(key);return v?structuredClone(v):null;},
  async set(key,value,{expected}={}){if(typeof key!=='string'||!key||!value||typeof value!=='object')fail('RETENTION_INVALID_REQUEST');
   const current=state.get(key)??null,token=current?hash(current):null;if(expected!==undefined&&expected!==token)fail('RETENTION_STALE_WRITE');
   state.set(key,structuredClone(value));return structuredClone(value);},
  async keys(){return [...state.keys()];},
  /** A backup at this moment. */
  snapshot(){return copy(state);},
  /** A restore to that backup: everything decided after it is gone from the database. */
  restore(snapshot){state=copy(snapshot);},
 });
}
/** The compare-and-set token for a row the caller has read. */
export const projectionToken=row=>row?hash(row):null;
