/** Real native preparer, metadata codec/store and custody policy over scripted SQL/current/inspection ports.
 * No PostgreSQL durability, native SDK file custody, Core approval or filing execution is qualified here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {assertArtifactFileCommand} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {createMetadataPoolFixture,id,NOW} from '../../commands/approval-metadata/test/fixture.mjs';
import {createNativeAttachmentFilingPreparer} from '../attachment-filing-services.mjs';
const deliveryId=`sdk:${'a'.repeat(64)}`;
const fault=(code,effect)=>e=>{if(code!==null)assert.equal(e.code,code);assert.equal(e.effect,effect);return true;};
function setup(){
 const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const selectedClientId=id(5),policyRevision='policy-1',scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:selectedClientId,policyRevision}];
 const object={objectId:id(6),versionId:'native-file-v1',sha256:'a'.repeat(64),bytes:12,scopes};
 const request={clientId:selectedClientId,conversationId:binding.conversationId,objects:[object]};
 const state={now:NOW,currentCalls:0,inspections:[],expectedObjects:structuredClone(request.objects),currentHook:null,inspectHook:null,failCommit:false};
 const sql=createMetadataPoolFixture(),connect=sql.pool.connect;
 sql.pool.connect=async()=>{const client=await connect(),query=client.query;return {...client,async query(value){
  if(typeof value==='string'){sql.calls.push(value);if(value==='COMMIT'&&state.failCommit)throw Error('Synthetic lost metadata commit acknowledgement');return {rows:[]};}
  return query(value);
 }};};
 const receipt=()=>({binding,scopes,selectedClientId,policyRevision,checkedAtMs:state.now,expiresAtMs:state.now+5000});
 const config={pool:sql.pool,binding,scopes,selectedClientId,policyRevision,expiresAtMs:NOW+60000,now:()=>state.now,maxRequestMs:2000,
  async readCurrent(call){state.currentCalls++;const current=structuredClone(receipt());await state.currentHook?.(current,call);return current;},
  custody:{async inspectSelections(call){state.inspections.push(call);assert.deepEqual(call.objects,state.expectedObjects);
   assert.deepEqual(call.binding,binding);assert.deepEqual(call.destination,{clientId:selectedClientId,conversationId:binding.conversationId});
   assert.equal(Object.isFrozen(call.objects),true);assert.equal(Object.isFrozen(call.binding),true);await state.inspectHook?.(call);
  }}};
 const preparer=createNativeAttachmentFilingPreparer(config),prepare=(value=request,signal)=>preparer.prepare({arguments:value,deliveryId,signal});
 return {binding,scopes,selectedClientId,policyRevision,object,request,state,sql,receipt,config,preparer,prepare};
}

test('native filing prepares one exact command and stores existing approval metadata without uploading or filing',async()=>{
 const t=setup();assert.equal(t.sql.calls.length,0);assert.equal(t.state.currentCalls,0);
 const result=await t.prepare(),{proposal}=result;
 assert.equal(t.preparer.owner,'command');assert.deepEqual(t.preparer.operation,{id:'save_chat_attachments',version:'0.2.0'});
 assert.equal(result.status,'approval_required');assert.deepEqual(Object.keys(result).sort(),['proposal','status']);assertProposalIntegrity(proposal);
 assertArtifactFileCommand(proposal.command,{binding:t.binding,destination:{clientId:t.selectedClientId,conversationId:t.binding.conversationId}});
 assert.equal(proposal.command.contractVersion,'0.1.0');assert.equal(proposal.command.action,'artifact.file');
 assert.deepEqual(proposal.command.attachments,t.request.objects);assert.deepEqual(proposal.command.scopes,t.scopes);
 assert.equal(proposal.commandSha256,canonicalSha256(proposal.command));
 assert.deepEqual(proposal.requiredApprover,{tenantId:t.binding.tenantId,actorId:t.binding.actorId});assert.equal(proposal.expiresAt,new Date(t.config.expiresAtMs).toISOString());
 assert.equal(t.sql.rows.size,1);const [row]=t.sql.rows.values();
 assert.equal(row.payload.commandSha256,proposal.commandSha256);assert.equal(row.payload.record.proposalId,proposal.proposalId);
 assert.equal(row.payload.record.action,'artifact.file');assert.equal(t.state.inspections.length,2);assert.equal(t.state.currentCalls,4);
 assert.ok(t.sql.calls.includes('BEGIN'));assert.ok(t.sql.calls.includes('COMMIT'));
 assert.equal(Object.hasOwn(t.preparer,'execute'),false);assert.equal(Object.hasOwn(result,'filing_observed'),false);
});

test('selected native file references keep immutable provenance and can include the ten-object contract maximum',async()=>{
 const t=setup();t.request.objects=Array.from({length:10},(_,n)=>({...structuredClone(t.object),objectId:id(30+n),versionId:`native-file-${n}`}));
 t.state.expectedObjects=structuredClone(t.request.objects);
 const {proposal}=await t.prepare();assert.deepEqual(proposal.command.attachments,t.request.objects);assert.equal(t.state.inspections[0].objects.length,10);
});

test('private source scopes and a broader private-plus-client run cannot prepare native filing',async()=>{
 const t=setup(),privateScope={tenantId:t.binding.tenantId,kind:'private-user',resourceId:t.binding.actorId,policyRevision:t.policyRevision};
 t.object.scopes=[privateScope];
 await assert.rejects(t.prepare(),fault('REFUSED','none'));
 t.scopes.push(privateScope);
 assert.throws(()=>createNativeAttachmentFilingPreparer(t.config),fault('INTENT_CONFIGURATION',undefined));
 assert.equal(t.sql.rows.size,0);assert.equal(t.state.inspections.length,0);
});

test('a null General client, foreign tenant or mismatched pinned policy cannot compose filing',()=>{
 const t=setup();
 for(const extra of [{selectedClientId:null,scopes:[{tenantId:t.binding.tenantId,kind:'private-user',resourceId:t.binding.actorId,policyRevision:t.policyRevision}]},
  {scopes:[{...t.scopes[0],tenantId:'foreign'}]},{policyRevision:'other'},{selectedClientId:id(99)}]){
  assert.throws(()=>createNativeAttachmentFilingPreparer({...t.config,...extra}),fault('INTENT_CONFIGURATION',undefined));
 }
 assert.equal(t.sql.calls.length,0);
});

test('model destination changes, authority fields and malformed or duplicate references refuse before current reads or metadata',async()=>{
 const changes=[r=>{r.clientId=id(99);},r=>{r.conversationId=id(99);},r=>{r.requiredApprover={actorId:'model'};},
  r=>{r.binding={};},r=>{r.url='https://model.invalid';},r=>{r.objects=[];},r=>{r.objects=Array(11).fill(r.objects[0]);},
  r=>{r.objects.push({...r.objects[0],versionId:'different'});},r=>{r.objects[0].sha256='malformed';},r=>{r.objects[0].scopes[0].tenantId='foreign';}];
 for(const change of changes){const t=setup(),request=structuredClone(t.request);change(request);
  await assert.rejects(t.prepare(request),fault('INVALID_ARGUMENTS','none'));assert.equal(t.state.currentCalls,0);assert.equal(t.sql.rows.size,0);
 }
});

test('delivery identity must be a canonical SDK delivery and untrusted custody accessors are never invoked',async()=>{
 const t=setup();
 for(const bad of ['delivery',`sdk:${'A'.repeat(64)}`,null])await assert.rejects(t.preparer.prepare({arguments:t.request,deliveryId:bad}),fault('INVALID_ARGUMENTS','none'));
 let getters=0;assert.throws(()=>createNativeAttachmentFilingPreparer({...t.config,custody:{get inspectSelections(){getters++;return ()=>{};}}}));
 assert.equal(getters,0);assert.equal(t.sql.rows.size,0);
});

test('changed, stale, expanded or malformed native current receipts never store a proposal',async()=>{
 const changes=[r=>{r.binding.writerFence++;},r=>{r.binding.runId=id(99);},r=>{r.binding.actorId='foreign';},
  r=>{r.scopes[0].resourceId=id(99);},r=>{r.selectedClientId=id(99);},r=>{r.policyRevision='other';},
  r=>{r.checkedAtMs--;},r=>{r.checkedAtMs++;},r=>{r.expiresAtMs=NOW;},r=>{r.extra=true;}];
 for(const change of changes){const t=setup();t.state.currentHook=change;
  await assert.rejects(t.prepare(),fault('REFUSED','none'));assert.equal(t.sql.rows.size,0);assert.equal(t.state.inspections.length,0);
 }
});

test('object scope cannot exceed current native scopes even when its reference is otherwise well formed',async()=>{
 const t=setup(),request=structuredClone(t.request);request.objects[0].scopes=[{...t.scopes[0],resourceId:id(99)}];
 await assert.rejects(t.prepare(request),fault('REFUSED','none'));assert.equal(t.state.inspections.length,0);assert.equal(t.sql.rows.size,0);
});

test('canonical custody refusal and current revocation after inspection leave no approval metadata',async()=>{
 for(const mode of ['custody','current']){
  const t=setup();t.state.inspectHook=()=>{if(mode==='custody')throw Error('Canonical object unavailable');t.state.currentHook=r=>{r.policyRevision='revoked';};};
  await assert.rejects(t.prepare(),fault('REFUSED','none'));assert.equal(t.sql.rows.size,0);assert.equal(t.state.inspections.length,1);
 }
});

test('native expiry narrows read-only custody deadline and an expired proposal cap refuses without custody',async()=>{
 const t=setup();t.state.currentHook=r=>{r.expiresAtMs=NOW+1000;};
 await t.prepare();for(const call of t.state.inspections)assert.equal(call.deadlineMs,NOW+1000);
 const expired=setup(),preparer=createNativeAttachmentFilingPreparer({...expired.config,expiresAtMs:NOW});
 await assert.rejects(preparer.prepare({arguments:expired.request,deliveryId}),fault('REFUSED','none'));
 assert.equal(expired.state.inspections.length,0);assert.equal(expired.sql.rows.size,0);
});

test('already aborted or cancelled parked custody is no effect and cannot produce a late proposal',async()=>{
 const t=setup(),controller=new AbortController();controller.abort();
 await assert.rejects(t.prepare(t.request,controller.signal),fault(null,'none'));assert.equal(t.sql.rows.size,0);assert.equal(t.state.currentCalls,0);
 const u=setup(),abort=new AbortController();let entered,release;
 const started=new Promise(r=>{entered=r;}),parked=new Promise(r=>{release=r;});u.state.inspectHook=async()=>{entered();await parked;};
 const pending=u.prepare(u.request,abort.signal);await started;abort.abort();
 await assert.rejects(pending,fault('CANCELLED','none'));release();await new Promise(r=>setImmediate(r));assert.equal(u.sql.rows.size,0);
});

test('custody that exhausts the request deadline cannot store or release approval metadata',async()=>{
 const t=setup();let signal;t.state.inspectHook=call=>{signal=call.signal;t.state.now=NOW+3000;};
 await assert.rejects(t.prepare(),fault('DEADLINE','none'));assert.equal(t.sql.rows.size,0);assert.equal(signal.aborted,true);
});

test('current revocation after immutable metadata commit withholds the proposal as UNKNOWN',async()=>{
 const t=setup();t.state.currentHook=r=>{if(t.sql.rows.size)r.policyRevision='revoked';};
 await assert.rejects(t.prepare(),fault('UNKNOWN','unknown'));assert.equal(t.sql.rows.size,1);assert.equal(t.state.inspections.length,1);
});

test('lost metadata commit acknowledgement remains UNKNOWN and cannot become a no-effect refusal',async()=>{
 const t=setup();t.state.failCommit=true;
 await assert.rejects(t.prepare(),fault('UNKNOWN','unknown'));assert.equal(t.sql.rows.size,1);assert.equal(t.state.inspections.length,1);
});

test('caller mutation cannot change the inspected selection or retained proposal',async()=>{
 const t=setup(),expected=structuredClone(t.request);t.state.inspectHook=()=>{t.request.objects[0].versionId='caller-mutated';};
 const {proposal}=await t.prepare();assert.deepEqual(proposal.command.attachments,expected.objects);
 assert.equal(proposal.commandSha256,canonicalSha256(proposal.command));
});
