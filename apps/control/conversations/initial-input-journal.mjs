/** One original-input CAS, inside the existing ConversationStore conversation transaction. No independent lock/dispatcher. */
import {bounded,hash,same,fail,validateShape} from './boundary.mjs';
import {assertOriginalInputFacts,sameOriginalInputIdentity,assertOriginalInputAcceptance,assertOriginalInputActive,originalInputReceipt} from './initial-input-facts.mjs';
export function createOriginalInputJournal({tx,rowRun,now}){
 if(typeof tx!=='function'||typeof rowRun!=='function'||typeof now!=='function')fail('STORE_CONFIGURATION');
 const decode=row=>{
  if(!row||hash(row.allocation)!==row.allocation_sha256)fail('INITIAL_INPUT_CORRUPT');let facts;try{facts=assertOriginalInputFacts(row.allocation);}catch{fail('INITIAL_INPUT_CORRUPT');}const b=facts.binding;
  if(row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId||row.request_id!==facts.requestId||!['RESERVED','ACCEPTED'].includes(row.state)||(row.state==='ACCEPTED'?row.accepted_request_sha256!==facts.requestSha256:row.accepted_request_sha256!==null))fail('INITIAL_INPUT_CORRUPT');return {facts,state:row.state};
 };
 const active=f=>assertOriginalInputActive(f,now());
 async function readRow(c,b,check){const rows=(await c.query('SELECT * FROM meri_conversations.initial_inputs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows;check();if(rows.length>1)fail('INITIAL_INPUT_CORRUPT');return rows.length?decode(rows[0]):null;}
 async function runs(c,b,check,accepted=false){const rows=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2'+(accepted?' AND run_id=$3':'')+' LIMIT 2 FOR UPDATE',accepted?[b.tenantId,b.conversationId,b.runId]:[b.tenantId,b.conversationId])).rows;check();return rows;}
 function consistent(saved,rows){if(saved.state==='RESERVED'){if(rows.length)fail('INITIAL_INPUT_CORRUPT');return;}
  if(rows.length!==1)fail('INITIAL_INPUT_CORRUPT');const r=rowRun(rows[0]);assertOriginalInputAcceptance(saved.facts,{run:r.projection,request:r.request,selectedClientId:saved.facts.selectedClientId});
 }
 async function claim(raw,check){const proposed=assertOriginalInputFacts(raw),b=proposed.binding;let pinned=proposed;const callerCheck=check;check=()=>{callerCheck();active(pinned);};check();return tx(b,check,async c=>{
  const old=await readRow(c,b,check),existing=await runs(c,b,check,old?.state==='ACCEPTED');
  if(old){pinned=old.facts;check();if(!sameOriginalInputIdentity(old.facts,proposed))fail('INITIAL_INPUT_CONFLICT');consistent(old,existing);return originalInputReceipt(old.facts,old.state,false);}
  if(existing.length)fail('INITIAL_INPUT_ALREADY_EXISTS');
  const conversations=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows;check();
  const successors=(await c.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows;check();if(conversations.length||successors.length)fail('INITIAL_INPUT_ALREADY_EXISTS');
  const inserted=(await c.query("INSERT INTO meri_conversations.initial_inputs(tenant_id,conversation_id,run_id,request_id,allocation,allocation_sha256,state,accepted_request_sha256) VALUES($1,$2,$3,$4,$5,$6,'RESERVED',NULL) ON CONFLICT DO NOTHING RETURNING *",[b.tenantId,b.conversationId,b.runId,proposed.requestId,proposed,hash(proposed)])).rows;check();
  if(inserted.length!==1)fail('INITIAL_INPUT_CONFLICT');const ack=decode(inserted[0]),back=await readRow(c,b,check);active(proposed);
  if(!back||ack.state!=='RESERVED'||back.state!=='RESERVED'||!same(ack.facts,proposed)||!same(back.facts,proposed))fail('INITIAL_INPUT_CORRUPT');return originalInputReceipt(back.facts,'RESERVED',true);
 });}
 async function read(binding,check){const b=bounded(binding);validateShape('RunBinding',b);return tx(b,check,async c=>{const saved=await readRow(c,b,check);if(!saved)return null;if(!same(saved.facts.binding,b))fail('INITIAL_INPUT_CONFLICT');consistent(saved,await runs(c,b,check,saved.state==='ACCEPTED'));return bounded({facts:saved.facts,state:saved.state});});}
 /** Called only by the existing original accept body, on its SAME transaction client. */
 async function match(c,input,check){const saved=await readRow(c,input.run.binding,check);if(!saved)fail('INITIAL_INPUT_REQUIRED');active(saved.facts);assertOriginalInputAcceptance(saved.facts,input);return saved;}
 async function accepted(c,saved,check){if(saved.state!=='RESERVED')fail('INITIAL_INPUT_CORRUPT');active(saved.facts);const b=saved.facts.binding;
  const rows=(await c.query("UPDATE meri_conversations.initial_inputs SET state='ACCEPTED',accepted_request_sha256=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND allocation_sha256=$3 AND state='RESERVED' RETURNING *",[b.tenantId,b.conversationId,hash(saved.facts),saved.facts.requestSha256])).rows;check();
  if(rows.length!==1)fail('INITIAL_INPUT_CONFLICT');const ack=decode(rows[0]);if(ack.state!=='ACCEPTED'||!same(ack.facts,saved.facts))fail('INITIAL_INPUT_CORRUPT');
 }
 return Object.freeze({claim,read,match,accepted});
}
