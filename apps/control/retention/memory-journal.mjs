/** Database-side retention state, restorable to an earlier point: the test and contract adapter. The PostgreSQL adapter follows the
 * central migration allocation (draft DDL in schema/retention.draft.sql); the port is the same. */
import {fail} from './boundary.mjs';
export function createMemoryRetentionJournal(){
 let state=new Map();
 const copy=m=>new Map([...m].map(([k,v])=>[k,structuredClone(v)]));
 return Object.freeze({
  async get(key){const v=state.get(key);return v?structuredClone(v):null;},
  async set(key,value){if(typeof key!=='string'||!key||!value||typeof value!=='object')fail('RETENTION_INVALID_REQUEST');state.set(key,structuredClone(value));return structuredClone(value);},
  async keys(){return [...state.keys()];},
  /** A backup at this moment. */
  snapshot(){return copy(state);},
  /** A restore to that backup: everything decided after it is gone from the database. */
  restore(snapshot){state=copy(snapshot);},
 });
}
