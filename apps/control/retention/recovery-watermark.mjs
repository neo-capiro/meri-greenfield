/** The recovered watermark: the ledger position through which the restorable database projection is known to hold every acknowledged
 * transition. It lives in the database (so a restore rolls it back with the projection) and only moves forward in ordinary operation:
 * every successful projection write advances it to the ledger sequence that write carries, and a completed reconciliation records the
 * exact ledger head (sequence and entry hash). Port: `read({exclusive})`, `advance(sequence,{exclusive})` (monotonic) and
 * `record({sequence,entrySha256},{exclusive})` (exact, recovery only). The PostgreSQL adapter is `postgres-watermark.mjs`. */
import {fail} from './boundary.mjs';
const sequenceOf=row=>Math.max(Number.isSafeInteger(row?.ledgerSequence)?row.ledgerSequence:0,Number.isSafeInteger(row?.purge?.ledgerSequence)?row.purge.ledgerSequence:0);
/** Test and contract store; `snapshot`/`restore` model a database backup taken and restored together with the journal. */
export function createMemoryWatermarkStore(){
 let value={sequence:0,entrySha256:null};const faults={read:false,advance:false,record:false};
 const check=name=>{if(faults[name])fail('RETENTION_STORE_UNAVAILABLE');};
 return Object.freeze({
  async read(){check('read');return {...value};},
  async advance(sequence){check('advance');if(!Number.isSafeInteger(sequence)||sequence<0)fail('RETENTION_INVALID_REQUEST');if(sequence>value.sequence)value={sequence,entrySha256:null};return {...value};},
  async record(position){check('record');if(!Number.isSafeInteger(position?.sequence)||position.sequence<0)fail('RETENTION_INVALID_REQUEST');value={sequence:position.sequence,entrySha256:position.entrySha256??null};return {...value};},
  faults,snapshot:()=>({...value}),restore(saved){value={...saved};},
 });
}
/** The journal every transition owner writes through: after the projection write succeeds, the watermark advances to the ledger
 * position it carries and the fence learns it; an advance whose outcome is unknown closes the fence (the projection itself stands,
 * and reconciliation re-proves the watermark before serving resumes). Reads and recovery pass through unchanged. */
export function watermarkedJournal({journal,watermark,fence}){
 if(typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof journal?.exclusive!=='function'||typeof watermark?.advance!=='function'||typeof fence?.observe!=='function'||typeof fence?.disable!=='function')fail('RETENTION_CONFIGURATION');
 async function set(key,row,options={}){const result=await journal.set(key,row,options),sequence=sequenceOf(row);
  try{await watermark.advance(sequence,{exclusive:options.exclusive===true});fence.observe(sequence);}catch{fence.disable('RETENTION_WATERMARK_UNKNOWN');}return result;}
 return Object.freeze({get:(key,options)=>journal.get(key,options),set,keys:options=>journal.keys(options),exclusive:fn=>journal.exclusive(fn)});
}
/** The ledger every transition owner appends through: an append whose acknowledgement is missing may still be durable, so the decision
 * it carries is UNKNOWN to the projection; the fence closes until reconciliation replays the ledger. */
export function acknowledgedLedger({ledger,fence}){
 if(typeof ledger?.append!=='function'||typeof ledger?.replay!=='function'||typeof fence?.disable!=='function')fail('RETENTION_CONFIGURATION');
 async function append(value){try{return await ledger.append(value);}catch(error){if(error?.code==='RETENTION_LEDGER_UNACKNOWLEDGED')fence.disable('RETENTION_LEDGER_UNKNOWN');throw error;}}
 return Object.freeze({append,replay:()=>ledger.replay(),latest:()=>ledger.latest()});
}
