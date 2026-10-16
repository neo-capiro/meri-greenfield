/** The recovered watermark: the ledger position through which the restorable database projection is known to hold every acknowledged
 * transition. It lives in the database (so a restore rolls it back with the projection) and only moves forward in ordinary operation:
 * every successful projection write advances it to the ledger sequence that write carries, and a completed reconciliation records the
 * exact ledger head (sequence and entry hash). Port: `read({exclusive})`,
 * `readProjection(key) -> {projection,watermark}` (one store snapshot under shared recovery exclusion),
 * `advanceProjection({key,projectionSha256,sequence,minimumSequence},{exclusive})` (exact projection proof and
 * advancement are atomic; blind sequence-only stores are refused), and
 * `record({sequence,entrySha256},{exclusive})` (exact, recovery only). The PostgreSQL adapter is `postgres-watermark.mjs`. */
import {fail,hash,own,data} from './boundary.mjs';
import {advanceProof,projectionSequence} from './projection-proof.mjs';
/** Test and contract store; `snapshot`/`restore` model a database backup taken and restored together with the journal. */
export function createMemoryWatermarkStore({journal}={}){
 if(typeof journal?.assertProjection!=='function'||typeof journal?.readProjection!=='function')fail('RETENTION_CONFIGURATION');
 let value={sequence:0,entrySha256:null};const faults={read:false,advance:false,record:false};
 const check=name=>{if(faults[name])fail('RETENTION_STORE_UNAVAILABLE');};
 return Object.freeze({
  async read(){check('read');return {...value};},
  readProjection(key){return journal.readProjection(key,()=>{check('read');return {...value};});},
  async advanceProjection(raw){check('advance');const proof=advanceProof(raw);
   // No await: the journal proof and watermark mutation form one memory-store step.
   if(journal.assertProjection(proof)!==true)fail('RETENTION_PROJECTION_UNVERIFIED');
   if(value.sequence<proof.minimumSequence)fail('RETENTION_WATERMARK_STALE');if(proof.sequence>value.sequence)value={sequence:proof.sequence,entrySha256:null};return {...value};},
  async record(position){check('record');if(!Number.isSafeInteger(position?.sequence)||position.sequence<0)fail('RETENTION_INVALID_REQUEST');value={sequence:position.sequence,entrySha256:position.entrySha256??null};return {...value};},
  faults,snapshot:()=>({...value}),restore(saved){value={...saved};},
 });
}
/** The journal every transition owner writes through: after the projection write succeeds, the watermark advances to the ledger
 * position it carries and the fence learns it; an advance whose outcome is unknown closes the fence (the projection itself stands,
 * and reconciliation re-proves the watermark before serving resumes). Ordinary reads require a store-owned atomic projection and
 * watermark snapshot; split reads cannot detect ABA across recovery owners. Exclusive recovery reads bypass the serving fence. */
export function watermarkedJournal({journal,watermark,fence}){
 if(typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof journal?.exclusive!=='function'||typeof watermark?.advanceProjection!=='function'||typeof watermark?.read!=='function'||typeof watermark?.readProjection!=='function'||['observe','disable','verify','state'].some(m=>typeof fence?.[m]!=='function'))fail('RETENTION_CONFIGURATION');
 async function get(key,options={}){
  if(options.exclusive===true)return journal.get(key,options);
  if(!fence.state().enabled)fail('RETENTION_RECOVERY_BARRIER');
  let snapshot;try{snapshot=own(data(await watermark.readProjection(key)),['projection','watermark']);
   if(snapshot.projection!==null&&(typeof snapshot.projection!=='object'||Array.isArray(snapshot.projection)))fail('RETENTION_WATERMARK_UNVERIFIED');
  }catch{fence.disable('RETENTION_WATERMARK_UNVERIFIED');fail('RETENTION_WATERMARK_UNVERIFIED');}
  await fence.verify(()=>snapshot.watermark);
  if(snapshot.projection!==null&&projectionSequence(snapshot.projection)>snapshot.watermark.sequence)fail('RETENTION_RECOVERY_BARRIER');
  return snapshot.projection;
 }
 async function set(key,row,options={}){
  const sequence=projectionSequence(row),projectionSha256=hash(row);
  // A restored database must be detected before this write can conceal its stale watermark.
  // Recovery owns the exclusive lock and rebuilds the projection with the fence closed.
  if(options.exclusive!==true)await fence.verify(()=>watermark.read());
  const result=await journal.set(key,row,options);
  // Prove the acknowledged row still exists while advancing, as well as the predecessor completeness floor.
  const minimumSequence=options.exclusive===true?0:Math.max(0,fence.state().highWater,sequence-1);
  try{await watermark.advanceProjection({key,projectionSha256,sequence,minimumSequence},{exclusive:options.exclusive===true});fence.observe(sequence);}catch(error){fence.disable(['RETENTION_WATERMARK_STALE','RETENTION_PROJECTION_UNVERIFIED'].includes(error?.code)?error.code:'RETENTION_WATERMARK_UNKNOWN');}return result;}
 return Object.freeze({get,set,keys:options=>journal.keys(options),exclusive:fn=>journal.exclusive(fn)});
}
/** The ledger every transition owner appends through: an append whose acknowledgement is missing may still be durable, so the decision
 * it carries is UNKNOWN to the projection; the fence closes until reconciliation replays the ledger. */
export function acknowledgedLedger({ledger,fence,watermark}){
 if(typeof ledger?.append!=='function'||typeof ledger?.replay!=='function'||typeof fence?.disable!=='function')fail('RETENTION_CONFIGURATION');
 async function append(value,{exclusive=false}={}){
  if(!exclusive)await fence.verify(()=>watermark.read());
  try{return await ledger.append(value);}catch(error){if(error?.code==='RETENTION_LEDGER_UNACKNOWLEDGED')fence.disable('RETENTION_LEDGER_UNKNOWN');throw error;}}
 return Object.freeze({append,replay:()=>ledger.replay(),latest:()=>ledger.latest()});
}
