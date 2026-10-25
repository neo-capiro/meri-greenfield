/** Synthetic native-current and membership owners around the real governed producer and Core wire adapters.
 * No database, live Core, SDK or native execution authentication is qualified by these tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {normalizeMemoryProposeInput} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {createMemoryProducer} from '../producer.mjs';
import {createCoreReview} from '../core-review.mjs';
import {createCoreMemoryReads} from '../core-memory.mjs';
import {createMemoryCommandSource} from '../command-source.mjs';
import {createCoreDouble,createJournalDouble,principal,NOW,id,ids,CLIENT_A,CLIENT_B} from './fixtures.mjs';

const fault=(code,effect)=>error=>{assert.equal(error.code,code);if(effect!==undefined)assert.equal(error.effect,effect);return true;};
function setup({general=false,scope='personal',permissions=[]}={}){
 const binding={tenantId:'tenant-one',actorId:'actor-1',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const policyRevision='policy-1',selectedClientId=general?null:CLIENT_A;
 const scopes=[{tenantId:binding.tenantId,kind:general?'private-user':'client',resourceId:general?binding.actorId:CLIENT_A,policyRevision}];
 const commandContext={binding,conversationClientId:selectedClientId};
 const command={contractVersion:'0.1.0',commandId:id(5),idempotencyKey:id(6),binding,action:'memory.propose',
  arguments:normalizeMemoryProposeInput({content:'Remember this preference',scope},commandContext),attachments:[],scopes};
 const state={now:NOW,principal:principal({permissions}),ownerExpiresAtMs:NOW+10000,currentCalls:0,ownerCalls:0,producerCalls:[],rechecks:0};
 const journal=createJournalDouble(),core=createCoreDouble();
 const producer=createMemoryProducer({journal,review:createCoreReview({transport:core.transport}),memory:createCoreMemoryReads({transport:core.transport}),newId:ids(300),now:()=>state.now});
 const current=()=>({binding,scopes,selectedClientId,policyRevision,checkedAtMs:state.now,expiresAtMs:state.now+10000});
 const options={binding,scopes,selectedClientId,policyRevision,now:()=>state.now,maxRequestMs:9000,deadlineMs:NOW+15000,
  async readCurrent(value){state.currentCalls++;state.currentOptions=value;return state.readCurrent?state.readCurrent(value):structuredClone(current());},
  async producerFor(value){state.ownerCalls++;state.ownerOptions=value;const admitted=structuredClone(state.principal);
   return {principal:admitted,expiresAtMs:state.ownerExpiresAtMs,producer:{async proposeFromCommand(args){state.producerCalls.push(args);return state.produce?state.produce(args):producer.proposeFromCommand(args);}},
    async recheck(args){state.rechecks++;if(state.recheck)await state.recheck(args);await value.checkCurrent({signal:args.signal});
     if(canonicalSha256(admitted)!==canonicalSha256(state.principal))throw Object.assign(Error('Membership changed'),{code:'ACCESS_DENIED'});
    }};
  }};
 return {binding,scopes,selectedClientId,policyRevision,commandContext,command,state,journal,core,producer,current,options,source:createMemoryCommandSource(options)};
}

for(const general of [false,true])test(`${general?'General private-user':'selected client'} conversation produces a pending candidate with exact native provenance`,async()=>{
 const t=setup({general,scope:general?'personal':'client'}),result=await t.source.propose({command:t.command});
 assert.deepEqual(result,{candidateId:id(300),commandSha256:canonicalSha256(t.command),status:'pending'});
 const [row]=t.journal.rows.values();
 assert.deepEqual(row.candidate.origin,{kind:'conversation',conversationId:t.binding.conversationId,runId:t.binding.runId,commandId:t.command.commandId,commandSha256:result.commandSha256});
 assert.equal(row.candidate.clientId,general?null:CLIENT_A);assert.equal(row.candidate.scope,general?'personal':'client');
 assert.equal(row.submission.state,'SUBMITTED');assert.equal(t.core.reviews.size,1);assert.equal([...t.core.reviews.values()][0].status,'pending');
 assert.deepEqual(t.state.producerCalls[0].commandContext,t.commandContext);assert.equal(t.state.producerCalls[0].commandSha256,canonicalSha256(t.command));
 assert.equal(t.state.currentCalls,2);assert.equal(t.state.rechecks,1);
 assert.equal(JSON.stringify(result).includes(t.command.arguments.content),false);assert.equal(Object.hasOwn(result,'publishedMemoryId'),false);
});

test('General requires the exact actor private-user scope and never accepts a client command',async()=>{
 const t=setup({general:true});
 for(const scopes of [[{...t.scopes[0],resourceId:'another-actor'}],[{...t.scopes[0],kind:'tenant',resourceId:t.binding.tenantId}],
  [...t.scopes,{tenantId:t.binding.tenantId,kind:'client',resourceId:CLIENT_A,policyRevision:t.policyRevision}]]){
  assert.throws(()=>createMemoryCommandSource({...t.options,scopes}));
 }
 const command=structuredClone(t.command);command.arguments.scope='client';command.arguments.clientId=CLIENT_A;
 await assert.rejects(t.source.propose({command}),fault('INVALID_ARGUMENTS','none'));
 assert.equal(t.state.currentCalls,0);assert.equal(t.state.ownerCalls,0);
});

test('command binding, selected client, scope and normalized payload are checked before native or producer work',async()=>{
 const t=setup({scope:'client'}),changes=[
  c=>{c.binding.runId=id(90);},c=>{c.binding.writerFence++;},c=>{c.binding.actorId='another-actor';},
  c=>{c.arguments.clientId=CLIENT_B;},c=>{c.arguments.clientId=null;},c=>{c.arguments.content=' unnormalized ';},
  c=>{c.scopes[0].policyRevision='changed';},c=>{c.scopes[0].tenantId='another-tenant';},c=>{c.claims={capabilityId:id(99)};},
 ];
 for(const change of changes){const command=structuredClone(t.command);change(command);await assert.rejects(t.source.propose({command}),fault('INVALID_ARGUMENTS','none'));}
 assert.equal(t.state.currentCalls,0);assert.equal(t.state.producerCalls.length,0);assert.equal(t.journal.rows.size,0);
});

test('changed native binding, scope, selected client, policy and stale or expired receipts refuse before any candidate effect',async()=>{
 const changes=[r=>{r.binding.writerFence++;},r=>{r.binding.runId=id(90);},r=>{r.binding.tenantId='another-tenant';},
  r=>{r.scopes[0].resourceId=CLIENT_B;},r=>{r.selectedClientId=CLIENT_B;},r=>{r.policyRevision='changed';},
  r=>{r.checkedAtMs--;},r=>{r.checkedAtMs++;},r=>{r.expiresAtMs=NOW;}];
 for(const change of changes){const t=setup();t.state.readCurrent=()=>{const r=structuredClone(t.current());change(r);return r;};
  await assert.rejects(t.source.propose({command:t.command}),fault('ACCESS_DENIED','none'));
  assert.equal(t.state.ownerCalls,0);assert.equal(t.journal.rows.size,0);
 }
});

test('Core member identity and selected-client membership cannot be substituted by native scope facts',async()=>{
 for(const over of [{tenantId:'another-tenant'},{actorId:'another-actor'},{clientIds:[]}]){
  const t=setup();t.state.principal=principal(over);
  await assert.rejects(t.source.propose({command:t.command}),fault('ACCESS_DENIED','none'));assert.equal(t.state.producerCalls.length,0);
 }
});

test('firm proposals require the current Core membership permission even in General',async()=>{
 for(const general of [false,true]){
  const denied=setup({general,scope:'firm'});
  await assert.rejects(denied.source.propose({command:denied.command}),fault('REFUSED','none'));assert.equal(denied.state.producerCalls.length,0);
  const admitted=setup({general,scope:'firm',permissions:['memory.propose.firm']});
  assert.equal((await admitted.source.propose({command:admitted.command})).status,'pending');
  assert.equal([...admitted.journal.rows.values()][0].candidate.scope,'firm');
 }
});

test('an immutable command snapshot preserves the original content and hash through asynchronous authority checks',async()=>{
 const t=setup(),original=structuredClone(t.command);
 t.state.readCurrent=()=>{t.command.arguments.content='Mutated by caller';return structuredClone(t.current());};
 const result=await t.source.propose({command:t.command});
 assert.deepEqual(t.state.producerCalls[0].command,original);assert.equal(result.commandSha256,canonicalSha256(original));
 assert.equal([...t.journal.rows.values()][0].candidate.content,original.arguments.content);
});

test('the earliest current expiry bounds the producer and final recheck deadline',async()=>{
 const t=setup();t.state.readCurrent=()=>({...structuredClone(t.current()),expiresAtMs:NOW+50});
 t.state.recheck=args=>{assert.equal(args.deadlineMs,NOW+50);};
 assert.equal((await t.source.propose({command:t.command})).status,'pending');
 assert.equal(t.state.ownerOptions.deadlineMs,NOW+50);assert.equal(t.state.producerCalls[0].deadlineMs,NOW+50);
});

test('the owner membership expiry bounds submission and recheck even when native authority lives longer',async()=>{
 const t=setup();t.state.ownerExpiresAtMs=NOW+50;
 t.state.recheck=args=>{assert.equal(args.deadlineMs,NOW+50);};
 assert.equal((await t.source.propose({command:t.command})).status,'pending');
 assert.equal(t.state.producerCalls[0].deadlineMs,NOW+50);
});

test('expired or malformed owner expiry refuses before entering the producer and records no effect',async()=>{
 for(const expiresAtMs of [NOW,NOW-1,undefined,NaN]){
  const t=setup();t.state.ownerExpiresAtMs=expiresAtMs;
  await assert.rejects(t.source.propose({command:t.command}),fault('ACCESS_DENIED','none'));
  assert.equal(t.state.producerCalls.length,0);assert.equal(t.journal.rows.size,0);assert.equal(t.core.calls.length,0);
 }
});

test('deadline expiry and cancellation during current read abort without entering the producer',async()=>{
 for(const mode of ['deadline','cancel']){
  const t=setup(),controller=new AbortController();let observed;
  t.state.readCurrent=({signal})=>{observed=signal;if(mode==='deadline')t.state.now=NOW+20000;else controller.abort();return structuredClone(t.current());};
  await assert.rejects(t.source.propose({command:t.command,signal:controller.signal}),fault(mode==='deadline'?'DEADLINE':'CANCELLED','none'));
  assert.equal(observed.aborted,true);assert.equal(t.state.producerCalls.length,0);assert.equal(t.journal.rows.size,0);
 }
});

test('an already expired or cancelled request never reads current authority',async()=>{
 const t=setup(),controller=new AbortController();controller.abort();
 await assert.rejects(t.source.propose({command:t.command,signal:controller.signal}),fault('DEADLINE','none'));
 const source=createMemoryCommandSource({...t.options,deadlineMs:NOW});
 await assert.rejects(source.propose({command:t.command}),fault('DEADLINE','none'));assert.equal(t.state.currentCalls,0);
 assert.equal(t.state.producerCalls.length,0);assert.equal(t.journal.rows.size,0);
});

test('lost Core acknowledgement preserves the candidate journal uncertainty and never claims pending or published',async()=>{
 const t=setup();t.core.failSubmit='lostAck';
 await assert.rejects(t.source.propose({command:t.command}),fault('UNKNOWN','unknown'));
 const [row]=t.journal.rows.values();assert.equal(row.submission.state,'SUBMISSION_UNKNOWN');assert.equal(t.core.reviews.size,1);
 assert.equal([...t.core.reviews.values()][0].status,'pending');assert.equal(t.state.producerCalls.length,1);
});

test('Core refusal after journal custody remains an unknown intent effect',async()=>{
 const t=setup();t.core.failSubmit='refused';
 await assert.rejects(t.source.propose({command:t.command}),fault('UNKNOWN','unknown'));
 assert.equal([...t.journal.rows.values()][0].submission.state,'PREPARED');assert.equal(t.core.reviews.size,0);
});

test('member or native current changes after submission withhold the receipt without undoing or resubmitting Core review',async()=>{
 for(const mode of ['member','native']){
  const t=setup();t.state.recheck=()=>{if(mode==='member')t.state.principal=principal({membershipRevision:'m2'});
   else t.state.readCurrent=()=>({...structuredClone(t.current()),policyRevision:'changed'});};
  await assert.rejects(t.source.propose({command:t.command}),fault('UNKNOWN','unknown'));
  assert.equal(t.core.reviews.size,1);assert.equal(t.core.calls.filter(c=>c.route==='submit').length,1);assert.equal(t.state.producerCalls.length,1);
 }
});

test('deadline or cancellation after entering the producer is unknown even if the owner has not returned',async()=>{
 for(const mode of ['deadline','cancel']){
  const t=setup(),controller=new AbortController();let observed;
  t.state.produce=({signal})=>{observed=signal;if(mode==='deadline')t.state.now=NOW+20000;else controller.abort();return {candidateId:id(300),review:{status:'pending'}};};
  await assert.rejects(t.source.propose({command:t.command,signal:controller.signal}),fault('UNKNOWN','unknown'));
  assert.equal(observed.aborted,true);assert.equal(t.state.producerCalls.length,1);assert.equal(t.state.rechecks,0);
 }
});

test('a producer returning approved, unavailable, malformed or thrown outcomes can never create a publication claim',async()=>{
 for(const status of ['approved','rejected','submission_unknown','not_found']){
  const t=setup();t.state.produce=()=>({candidateId:id(300),review:{status},publishedMemoryId:'memory'});
  await assert.rejects(t.source.propose({command:t.command}),fault('UNKNOWN','unknown'));
 }
 for(const result of [{candidateId:'invalid',review:{status:'pending'}},null]){
  const t=setup();t.state.produce=()=>result;await assert.rejects(t.source.propose({command:t.command}),fault('UNKNOWN','unknown'));
 }
 const t=setup();t.state.produce=()=>{throw Error('Owner unavailable');};
 await assert.rejects(t.source.propose({command:t.command}),fault('UNKNOWN','unknown'));
});
