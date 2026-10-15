/** Ordered, durably acknowledged retention transition history, outside the restored database's rollback boundary. The sink is a port
 * (the shipping owner's write-once evidence store in product; an in-memory sink in tests). Every transition is appended here first. */
import {own,data,fail,hash,subject,subjectKey,clock,text} from './boundary.mjs';
export const transitions=Object.freeze(['SUPPRESSED','RELEASED','PURGE_PLANNED','PURGE_BLOCKED','PURGE_UNKNOWN','PURGE_EXECUTED']);
export function createRetentionLedger({sink,now}){
 if(typeof sink?.append!=='function'||typeof sink?.read!=='function')fail('RETENTION_CONFIGURATION');const tick=clock(now);
 const entry=value=>{const e=own(data(value),['subject','state','facts'],['reason']);subject(e.subject);if(!transitions.includes(e.state))fail('RETENTION_INVALID_REQUEST');if(e.reason!==undefined)text(e.reason,1024);return e;};
 const receipt=(sequence,entrySha256)=>hash({sequence,entrySha256});
 /** Appends one transition; refuses to proceed without a verifiable durable acknowledgement. */
 async function append(value){
  const e=entry(value),atMs=tick(),record={...e,atMs},entrySha256=hash(record);
  let ack;try{ack=await sink.append({...record,entrySha256});}catch{fail('RETENTION_LEDGER_UNACKNOWLEDGED');}
  if(!ack||!Number.isSafeInteger(ack.sequence)||ack.sequence<1||ack.receiptSha256!==receipt(ack.sequence,entrySha256))fail('RETENTION_LEDGER_UNACKNOWLEDGED');
  return Object.freeze({...record,entrySha256,sequence:ack.sequence,receiptSha256:ack.receiptSha256});
 }
 /** Ordered replay with integrity: strictly increasing sequence, hash-consistent entries. */
 async function replay(){
  const rows=await sink.read();if(!Array.isArray(rows))fail('RETENTION_LEDGER_CORRUPT');let last=0;const out=[];
  for(const row of rows){const r=own(data(row),['subject','state','facts','atMs','entrySha256','sequence','receiptSha256'],['reason']);const {entrySha256,sequence,receiptSha256,...record}=r;
   if(hash(record)!==entrySha256||!Number.isSafeInteger(sequence)||sequence<=last||receiptSha256!==receipt(sequence,entrySha256))fail('RETENTION_LEDGER_CORRUPT');last=sequence;out.push(Object.freeze(r));}
  return Object.freeze(out);
 }
 /** Latest transition per subject, in first-seen subject order. */
 async function latest(){const byKey=new Map();for(const r of await replay())byKey.set(subjectKey(r.subject),r);return byKey;}
 return Object.freeze({append,replay,latest});
}
/** Test and contract sink: durable within the process, with switches for an unacknowledged append. */
export function createMemoryLedgerSink({acknowledge=true}={}){
 const rows=[];let silent=!acknowledge;
 return Object.freeze({
  async append(row){if(silent)return null;const sequence=rows.length+1,receiptSha256=hash({sequence,entrySha256:row.entrySha256});rows.push(Object.freeze({...row,sequence,receiptSha256}));return {sequence,receiptSha256};},
  async read(){return rows.slice();},
  silence(value){silent=value;},
  size(){return rows.length;}
 });
}
