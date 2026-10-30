import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash,assertProposalIntegrity} from '../../../../../packages/contracts/validate.mjs';
import {assertBrowserApprovalPreparation,BROWSER_ACTION,BROWSER_ACTION_OPERATION,BROWSER_APPROVAL_REQUEST_SCHEMA,
 BROWSER_APPROVAL_PREPARATION_SCHEMA,browserPreparationFromRequest,browserRequestFromPreparation,
 browserPreparationArguments,browserCommandSha256,browserInputSha256,assertBrowserPreparationDigests}
 from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createPostgresApprovalMetadataStore} from '../postgres-store.mjs';
import {createBrowserActionApprovalMetadataOwner} from '../browser-owner.mjs';
import {createApprovalMetadataReadback} from '../readback.mjs';
import {createApprovalMetadataReaderApplication,APPROVAL_METADATA_READ_PATH} from '../../../../runtime/agentcore-control-http.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture,id,NOW} from './fixture.mjs';

const service='synthetic-core-service-secret';
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const input={tool:'browser_click',arguments:{selector:'#confirm',value:'ok'}};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy-1'}];
function subjectOf(overrides={}){
 return {schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',toolUseId:'toolu_01HZX',
  inputSha256:hash(input),pageOrigin:'https://app.capiro.example',policySha256:'a'.repeat(64),...overrides};
}
function requestOf({subject=subjectOf(),atMs=NOW-1000,expiresAtMs=NOW+60000,display=input}={}){
 return {schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:hash(subject),input:display,requestedAtMs:atMs,expiresAtMs};
}
const preparationOf=options=>browserPreparationFromRequest(requestOf(options));
function setup({policy,now=()=>NOW}={}){
 const sql=createMetadataPoolFixture(),store=createPostgresApprovalMetadataStore({pool:sql.pool});
 const p=policy??createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId:'tenant',actorId:'reviewer'},
  expiresAt:new Date(NOW+60000).toISOString(),now});
 let n=900;const owner=createBrowserActionApprovalMetadataOwner({store,preparePolicy:p.preparePolicy,now,newId:()=>id(n++)});
 const call=({binding:bound=binding,request=preparationOf(),deadlineMs=NOW+1000}={})=>
  ({operation:BROWSER_ACTION_OPERATION,action:BROWSER_ACTION,binding:bound,request,deadlineMs});
 const readCall=record=>({proposalId:record.proposalId,commandSha256:record.commandSha256,operation:BROWSER_ACTION_OPERATION,
  action:BROWSER_ACTION,binding,deadlineMs:NOW+1000});
 return {sql,store,p,owner,call,readCall,inserts:()=>sql.calls.filter(c=>typeof c==='object'&&c.text.startsWith('INSERT')).length};
}

test('the host request maps to the stored preparation and back without changing any field',()=>{
 const request=requestOf(),preparation=browserPreparationFromRequest(request);
 assert.equal(preparation.schema,BROWSER_APPROVAL_PREPARATION_SCHEMA);
 assert.equal(request.schema,BROWSER_APPROVAL_REQUEST_SCHEMA);
 assert.deepEqual({...preparation,schema:request.schema},request);
 assert.deepEqual(browserRequestFromPreparation(preparation),request);
 assert.deepEqual(assertBrowserApprovalPreparation(preparation).input,input);
});

test('prepares one immutable record whose C, A, S and I digests each verify independently',async()=>{
 const f=setup(),preparation=preparationOf();
 const record=await f.owner.prepare(f.call({request:preparation}));
 assert.equal(record.action,BROWSER_ACTION);assert.deepEqual(record.operation,BROWSER_ACTION_OPERATION);
 assert.equal(record.resolved,false);assert.deepEqual(record.binding,binding);
 assert.equal(record.expiresAt,new Date(NOW+60000).toISOString());
 const stored=[...f.sql.rows.values()][0].payload,storedPreparation=assertBrowserApprovalPreparation(stored.record.request);
 assert.deepEqual(storedPreparation,assertBrowserApprovalPreparation(preparation));
 const args=browserPreparationArguments(storedPreparation);
 assert.equal(stored.record.inputSha256,browserInputSha256(stored.record));
 assert.equal(stored.record.inputSha256,hash({arguments:args,attachments:[]}));
 assert.equal(stored.commandSha256,browserCommandSha256(stored.record));
 assert.equal(storedPreparation.subjectSha256,hash(storedPreparation.subject));
 assert.equal(storedPreparation.subject.inputSha256,hash(storedPreparation.input));
 // The internal envelope hash is a different identity from the subject hash Core decides on.
 assert.notEqual(stored.commandSha256,storedPreparation.subjectSha256);
 assert.equal(assertBrowserPreparationDigests({preparation:storedPreparation,record:stored.record,
  commandSha256:stored.commandSha256}),true);
 assert.equal(f.inserts(),1);
});

test('the generic native proposal schema refuses the browser command, so only the browser validator admits it',()=>{
 const preparation=preparationOf();
 const commandSha256=browserCommandSha256({request:preparation,commandId:id(1),binding,scopes,idempotencyKey:'k'});
 const proposal={proposalId:id(2),command:{contractVersion:'0.1.0',commandId:id(1),binding,action:BROWSER_ACTION,
  arguments:browserPreparationArguments(preparation),attachments:[],scopes,idempotencyKey:'k'},commandSha256,
  createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),
  requiredApprover:{tenantId:'tenant',actorId:'reviewer'}};
 assert.throws(()=>assertProposalIntegrity(proposal),/browser\.action|allowed values/u);
});

test('a repeat resolves the stored row only while current authority is unchanged',async()=>{
 const f=setup(),preparation=preparationOf();
 const first=await f.owner.prepare(f.call({request:preparation}));
 const second=await f.owner.prepare(f.call({request:preparation}));
 assert.equal(second.resolved,true);assert.equal(second.proposalId,first.proposalId);
 assert.equal(second.commandSha256,first.commandSha256);assert.equal(f.inserts(),1);
 // A scope change in current authority makes the same deterministic selector refuse instead of resolving.
 f.p.state.mutate=result=>{result.scopes=[{tenantId:'tenant',kind:'private-user',resourceId:id(9),policyRevision:'policy-2'}];};
 await assert.rejects(f.owner.prepare(f.call({request:preparation})),{message:'COMMAND_PREPARATION_REFUSED'});
 assert.equal(f.inserts(),1);
});

test('the same identity with substituted contents refuses before release',async()=>{
 const f=setup(),preparation=preparationOf();
 await f.owner.prepare(f.call({request:preparation}));
 for(const changed of [
  // A host-captured substitution: a different input with its own consistent subject digest.
  browserPreparationFromRequest(requestOf({display:{tool:'browser_click',arguments:{selector:'#delete',value:'ok'}},
   subject:subjectOf({inputSha256:hash({tool:'browser_click',arguments:{selector:'#delete',value:'ok'}})})})),
  preparationOf({subject:subjectOf({policySha256:'b'.repeat(64)})}),
  preparationOf({subject:subjectOf({pageOrigin:'https://evil.example'})}),
  preparationOf({expiresAtMs:NOW+120000}),
  preparationOf({subject:subjectOf({binding:{...binding,writerFence:2}})})]){
  await assert.rejects(f.owner.prepare(f.call({request:changed})),{message:'COMMAND_PREPARATION_REFUSED'});
 }
 assert.equal(f.inserts(),1);assert.equal(f.sql.rows.size,1);
});

test('extra keys, foreign actors and expired requests refuse',async()=>{
 const f=setup();
 await assert.rejects(f.owner.prepare(f.call({request:{...preparationOf(),approved:true}})),{message:'COMMAND_PREPARATION_REFUSED'});
 await assert.rejects(f.owner.prepare(f.call({request:preparationOf({expiresAtMs:NOW-1})})),{message:'COMMAND_PREPARATION_REFUSED'});
 await assert.rejects(f.owner.prepare(f.call({deadlineMs:NOW})),(error)=>{
  assert.equal(error.message,'DEADLINE');assert.equal(error.outcome,'NOT_STORED');return true;});
 const record=await f.owner.prepare(f.call());
 await assert.rejects(f.owner.read({...f.readCall(record),binding:{...binding,actorId:'intruder'}}),
  {message:'COMMAND_PREPARATION_REFUSED'});
});

test('a cancellation refused before any write creates nothing',async()=>{
 const f=setup();f.p.state.denyPhase='prepare';
 await assert.rejects(f.owner.prepare(f.call()),(error)=>{assert.equal(error.outcome,'NOT_STORED');return true;});
 assert.equal(f.inserts(),0);
});

test('an authority change after the write is retained but never released',async()=>{
 const f=setup();
 f.p.state.mutate=(result,call)=>{if(call.phase==='before_release')result.authorized=false;};
 await assert.rejects(f.owner.prepare(f.call()),(error)=>{assert.equal(error.outcome,'STORED_NOT_RELEASED');return true;});
 assert.equal(f.sql.rows.size,1,'the immutable row exists for reconciliation');
 f.p.state.mutate=null;f.p.state.denyPhase='read_release';
 const stored=[...f.sql.rows.values()][0].payload;
 await assert.rejects(f.owner.read({proposalId:stored.record.proposalId,commandSha256:stored.commandSha256,
  operation:BROWSER_ACTION_OPERATION,action:BROWSER_ACTION,binding,deadlineMs:NOW+1000}),
  {message:'COMMAND_PREPARATION_REFUSED'});
});

test('a lost acknowledgement stays UNKNOWN and the same identity reads the row back',async()=>{
 const f=setup(),preparation=preparationOf();
 const realInsert=f.store.insert.bind(f.store);
 const losingStore={...f.store,async insert(payload,check){await realInsert(payload,check);
  throw Object.assign(Error('synthetic lost acknowledgement'),{code:'APPROVAL_METADATA_UNKNOWN'});}};
 const losingOwner=createBrowserActionApprovalMetadataOwner({store:losingStore,preparePolicy:f.p.preparePolicy,
  now:()=>NOW,newId:()=>id(950)});
 await assert.rejects(losingOwner.prepare(f.call({request:preparation})),(error)=>{
  assert.equal(error.outcome,'UNKNOWN');assert.equal(error.message,'APPROVAL_METADATA_UNKNOWN');
  assert.ok(error.metadataReference.proposalId);
  assert.match(error.metadataReference.commandSha256,/^[0-9a-f]{64}$/u);return true;});
 assert.equal(f.inserts(),1,'no second proposal is written as a retry');
 const stored=[...f.sql.rows.values()][0].payload;
 const read=await f.owner.read({proposalId:stored.record.proposalId,commandSha256:stored.commandSha256,
  operation:BROWSER_ACTION_OPERATION,action:BROWSER_ACTION,binding,deadlineMs:NOW+1000});
 assert.equal(read.proposalId,stored.record.proposalId);
 assert.deepEqual(read.request,assertBrowserApprovalPreparation(preparation));
});

test('a deadline lost after the write was attempted is UNKNOWN, not NOT_STORED',async()=>{
 let clock=NOW;
 const f=setup({now:()=>clock});
 const realInsert=f.store.insert.bind(f.store);
 // The row lands, then the operation deadline expires before the acknowledgement is observed.
 const lateStore={...f.store,async insert(payload,check){await realInsert(payload,check);clock=NOW+(f.owner?1_000_000:0);check();}};
 const lateOwner=createBrowserActionApprovalMetadataOwner({store:lateStore,preparePolicy:f.p.preparePolicy,
  now:()=>clock,newId:()=>id(960)});
 await assert.rejects(lateOwner.prepare(f.call()),(error)=>{
  assert.equal(error.message,'DEADLINE');assert.equal(error.outcome,'UNKNOWN');return true;});
 assert.equal(f.sql.rows.size,1);
});

test('the private HTTP route returns the browser record with real run custody only',async()=>{
 const f=setup(),record=await f.owner.prepare(f.call()),payload=[...f.sql.rows.values()][0].payload;
 const run={binding,state:'waiting-for-approval',scopes:payload.record.scopes,createdAt:new Date(NOW).toISOString(),
  policyRevision:'policy-1',versions:{imageDigest:`sha256:${'a'.repeat(64)}`,sdk:'0.1.0',cli:'0.1.0',contracts:'0.1.0',
   skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};
 const metadata={async read(){return payload;}};
 const retention={async assertServable(){}};
 const store={async readOptional(){return {run,generation:1};},
  initialBindings:{async readRetained(){throw Error('no initial-binding custody for a browser preparation');}}};
 const reader=createApprovalMetadataReadback({metadata,store,retention});
 const post=app=>app.handle(new Request('https://control.example.test'+APPROVAL_METADATA_READ_PATH,{method:'POST',
  headers:{'content-type':'application/json','x-internal-service-secret':service},
  body:JSON.stringify({schemaVersion:1,proposalId:record.proposalId,binding})}));
 const app=createApprovalMetadataReaderApplication({reader,getServiceSecret:async()=>service,now:()=>NOW});
 const response=await post(app);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.deepEqual(Object.keys(body).sort(),['commandSha256','metadata','run','schemaVersion']);
 assert.equal(body.metadata.record.action,BROWSER_ACTION);
 assert.equal(body.commandSha256,payload.commandSha256);
 assert.notEqual(body.commandSha256,body.metadata.record.request.subjectSha256);
 assert.equal(body.run.state,'waiting-for-approval');
 // Without a real run a browser preparation is never served from initial-binding custody.
 const noRun=createApprovalMetadataReaderApplication({reader:createApprovalMetadataReadback({metadata,
  store:{async readOptional(){return null;},initialBindings:store.initialBindings},retention}),
  getServiceSecret:async()=>service,now:()=>NOW});
 assert.equal((await post(noRun)).status,503);
});
