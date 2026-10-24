import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationRetentionSweep} from '../sweep.mjs';
import {subjectKey} from '../boundary.mjs';
const s=n=>({tenantId:'tenant',kind:'conversation',subjectId:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ownerActorId:'owner'});
test('one bounded sweep nominates only canonical suppressed Trash and advances past holds/unknowns',async()=>{
 const entries=[{subject:s(1),state:'SUPPRESSED',reason:'administrative-hold',facts:{}},
  {subject:s(2),state:'SUPPRESSED',reason:'conversation-trash:request',facts:{}},
  {subject:s(3),state:'PURGE_BLOCKED',facts:{trash:{requestId:'retained'}}},
  {subject:s(4),state:'PURGE_EXECUTED',facts:{trash:{},coreFinalized:true}}];
 const visited=[];let serving=0;
 const sweep=createConversationRetentionSweep({startup:{ensureServing:async()=>{serving++;},ledger:{latest:async()=>new Map(entries.map(e=>[subjectKey(e.subject),e]))},
  purge:{async sweepSubject(subject,options){visited.push(subject);assert.ok(Number.isSafeInteger(options.deadlineMs));if(subject.subjectId===s(2).subjectId)return {state:'BLOCKED'};throw Error('unavailable');}}}});
 const first=await sweep();assert.deepEqual(first,{after:subjectKey(s(2)),more:true,outcome:'blocked'});assert.equal(visited.length,1);
 assert.deepEqual(await sweep({after:first.after}),{after:subjectKey(s(3)),more:false,outcome:'unknown'});assert.equal(visited.length,2);
 assert.deepEqual(await sweep({after:subjectKey(s(3))}),{after:null,more:false,outcome:'empty'});assert.equal(serving,3);
});
test('a closed serving fence or cancelled activity cannot start deletion',async()=>{
 let calls=0;const startup={ensureServing:async()=>{throw Error('RETENTION_RECOVERY_BARRIER');},ledger:{latest:async()=>{calls++;return new Map();}},purge:{sweepSubject:async()=>{calls++;}}};
 await assert.rejects(createConversationRetentionSweep({startup})(),/RETENTION_RECOVERY_BARRIER/);assert.equal(calls,0);
 const controller=new AbortController();controller.abort();await assert.rejects(createConversationRetentionSweep({startup})({signal:controller.signal}));assert.equal(calls,0);
});
