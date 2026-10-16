/** PostgreSQL adapter for the recovered-watermark port over the PROPOSED single-row table `meri_conversations.retention_recovery_watermark`
 * (source-only reserved migration0013; never applied here). It runs every statement through the retention journal's own bounded transaction
 * owner (`journal.tx`), so it inherits the DA-4 lease rules: a lease returns to the pool only after a confirmed COMMIT or ROLLBACK,
 * a lost COMMIT acknowledgement surfaces as RETENTION_COMMIT_UNKNOWN, and nothing here closes the borrowed pool. Ordinary reads and
 * advances take the shared side of the recovery lock; `exclusive` calls come from the recovery pass that already holds the exclusive
 * side on its own session. A missing row reads as position zero, which is behind any acknowledged transition. */
import {fail} from './boundary.mjs';
import {advanceProof} from './projection-proof.mjs';
const TABLE='meri_conversations.retention_recovery_watermark';
const decode=row=>{if(!row)return {sequence:0,entrySha256:null};const sequence=Number(row.sequence);if(!Number.isSafeInteger(sequence)||sequence<0||row.entry_sha256!==null&&!/^[a-f0-9]{64}$/u.test(row.entry_sha256))fail('RETENTION_STORE_CORRUPT');return {sequence,entrySha256:row.entry_sha256};};
export function createPostgresWatermarkStore({journal}){
 if(typeof journal?.tx!=='function'||typeof journal?.assertProjection!=='function'||typeof journal?.readProjection!=='function')fail('RETENTION_CONFIGURATION');
 const mode=options=>({exclusive:options?.exclusive===true});
 async function read(options){return journal.tx(async c=>decode((await c.query(`SELECT sequence,entry_sha256 FROM ${TABLE} WHERE singleton`)).rows[0]),mode(options));}
 /** The canonical journal supplies both values in ONE statement after its shared recovery lock is acquired. */
 async function readProjection(key){return journal.tx(async c=>{const snapshot=await journal.readProjection(c,key);
  return {projection:snapshot.projection,watermark:decode(snapshot.watermarkRow)};},{readCommitted:true});}
 /** Monotonic: a lower or equal position leaves the row unchanged; a higher one clears the recorded entry hash (only recovery records it). */
 async function advanceProjection(raw,options){const {key,projectionSha256,sequence,minimumSequence}=advanceProof(raw);
  return journal.tx(async c=>{
   // The exact subject projection stays locked until this transaction's advancement COMMIT.
   await journal.assertProjection(c,{key,projectionSha256,sequence,minimumSequence});
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended('meri_retention_watermark',0))");
   const current=decode((await c.query(`SELECT sequence,entry_sha256 FROM ${TABLE} WHERE singleton FOR UPDATE`)).rows[0]);
   if(current.sequence<minimumSequence)fail('RETENTION_WATERMARK_STALE');
   return decode((await c.query(`INSERT INTO ${TABLE}(singleton,sequence,entry_sha256) VALUES(true,$1,NULL) ON CONFLICT (singleton) DO UPDATE SET sequence=GREATEST(${TABLE}.sequence,EXCLUDED.sequence),entry_sha256=CASE WHEN EXCLUDED.sequence>${TABLE}.sequence THEN NULL ELSE ${TABLE}.entry_sha256 END RETURNING sequence,entry_sha256`,[sequence])).rows[0]);},mode(options));}
 /** Exact position recorded by a completed reconciliation pass. */
 async function record(position,options){if(!Number.isSafeInteger(position?.sequence)||position.sequence<0||position.entrySha256!==null&&!/^[a-f0-9]{64}$/u.test(position.entrySha256??''))fail('RETENTION_INVALID_REQUEST');
  return journal.tx(async c=>decode((await c.query(`INSERT INTO ${TABLE}(singleton,sequence,entry_sha256) VALUES(true,$1,$2) ON CONFLICT (singleton) DO UPDATE SET sequence=EXCLUDED.sequence,entry_sha256=EXCLUDED.entry_sha256 RETURNING sequence,entry_sha256`,[position.sequence,position.entrySha256])).rows[0]),mode(options));}
 return Object.freeze({read,readProjection,advanceProjection,record,table:TABLE});
}
