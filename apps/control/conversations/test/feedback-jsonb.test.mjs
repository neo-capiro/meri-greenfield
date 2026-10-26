import test from 'node:test';
import assert from 'node:assert/strict';
import pgUtils from 'pg/lib/utils.js';
import {createFeedbackJournal} from '../feedback-journal.mjs';
import {hash} from '../boundary.mjs';
import {binding,scopes,id} from './store-fixture.mjs';

test('feedback JSONB survives driver serialization, append, readback and exact replay',async()=>{
 const at='2026-10-26T06:00:00.000Z',messageId=id(20),context={binding,scopes};
 const event={contractVersion:'0.1.0',eventId:id(21),binding,scopes,sequence:1,createdAt:at,type:'message.delta',data:{messageId,text:'Saved answer'}};
 const tuple={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId};
 const row={...tuple,projection:{binding,scopes,state:'completed'},last_sequence:1,feedback:null,feedback_sha256:null};
 const events=[{...tuple,event_id:event.eventId,sequence:1,event,event_sha256:hash(event)}];
 let writes=0,nextId=30;
 const client={async query(sql,p){
  if(sql.startsWith('SELECT * FROM meri_conversations.runs '))return {rows:[structuredClone(row)]};
  if(sql.startsWith('SELECT * FROM meri_conversations.events '))return {rows:events};
  assert.ok(sql.startsWith('UPDATE meri_conversations.runs SET feedback='));
  // The actual pg serializer chooses PostgreSQL arrays for JS arrays. JSONB needs JSON text.
  const decoded=JSON.parse(pgUtils.prepareValue(p[3]));
  assert.ok(Array.isArray(decoded));assert.equal(hash(decoded),p[4]);
  row.feedback=decoded;row.feedback_sha256=p[4];writes++;return {rows:[{feedback_sha256:p[4]}]};
 }};
 const journal=createFeedbackJournal({tx:async(_binding,_check,body)=>body(client),rowRun:value=>value,now:()=>Date.parse(at),newId:()=>id(nextId++)});
 const input={requestId:id(50),target:{kind:'message',runId:binding.runId,throughSequence:1,messageId},sourceEventId:null,signal:{kind:'factual_correction',proposedCorrection:'Keep "quotes", \\slashes,\nnewlines and café.'}};
 const first=await journal.record(context,input,()=>{});
 assert.equal(first.replayed,false);assert.deepEqual(row.feedback,[first.receipt]);
 assert.deepEqual(first.receipt.signal,input.signal);
 const second=await journal.record(context,{...input,requestId:id(51),signal:{kind:'preference',value:'helpful',note:null}},()=>{});
 assert.deepEqual(row.feedback,[first.receipt,second.receipt]);
 assert.deepEqual(await journal.read(context,{runId:binding.runId},()=>{}),{runId:binding.runId,receipts:row.feedback});
 assert.deepEqual(await journal.record(context,input,()=>{}),{receipt:first.receipt,replayed:true});
 assert.equal(writes,2);
});
