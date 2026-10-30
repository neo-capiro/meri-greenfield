import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {assertBrowserApprovalPreparation,BROWSER_ACTION,BROWSER_ACTION_OPERATION,BROWSER_ACTION_SCHEMA,BROWSER_APPROVAL_PREPARATION_SCHEMA}
 from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {createPostgresApprovalMetadataStore} from '../postgres-store.mjs';
import {createBrowserActionApprovalMetadataOwner} from '../browser-owner.mjs';
import {createApprovalMetadataReadback} from '../readback.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture,id,NOW} from './fixture.mjs';

const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const input={tool:'browser_click',arguments:{selector:'#confirm',value:'ok'}};
function subjectOf(overrides={}){
 const s={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',toolUseId:'toolu_01HZX',
  inputSha256:hash(input),pageOrigin:'https://app.capiro.example',policySha256:'a'.repeat(64),...overrides};
 return s;
}
function preparationOf({subject=subjectOf(),atMs=NOW-1000,expiresAtMs=NOW+60000,display=input}={}){
 return {schema:BROWSER_APPROVAL_PREPARATION_SCHEMA,subject,subjectSha256:hash(subject),input:display,requestedAtMs:atMs,expiresAtMs};
}
function setup({policy,now=()=>NOW}={}){
 const sql=createMetadataPoolFixture(),store=createPostgresApprovalMetadataStore({pool:sql.pool});
 const p=policy??createMetadataPolicyFixture({binding,scopes:[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy-1'}],
  requiredApprover:{tenantId:'tenant',actorId:'reviewer'},expiresAt:new Date(NOW+60000).toISOString(),now});
 let n=900;const owner=createBrowserActionApprovalMetadataOwner({store,preparePolicy:p.preparePolicy,now,newId:()=>id(n++)});
 const call=({binding:bound=binding,request=preparationOf(),deadlineMs=NOW+1000}={})=>({operation:BROWSER_ACTION_OPERATION,action:BROWSER_ACTION,
  binding:bound,request,deadlineMs});
 const readCall=(record)=>({proposalId:record.proposalId,commandSha256:record.commandSha256??record.payload?.commandSha256,operation:BROWSER_ACTION_OPERATION,
  action:BROWSER_ACTION,binding,deadlineMs:NOW+1000});
 return {sql,store,p,owner,call,readCall,inserts:()=>sql.calls.filter(c=>typeof c==='object'&&c.text.startsWith('INSERT')).length};
}

test('prepares one immutable browser record in the existing metadata table',async()=>{
 const f=setup(),preparation=preparationOf();
 const record=await f.owner.prepare(f.call({request:preparation}));
 assert.equal(record.action,BROWSER_ACTION);assert.deepEqual(record.operation,BROWSER_ACTION_OPERATION);
 assert.equal(record.resolved,false);assert.deepEqual(record.binding,binding);
 assert.equal(record.inputSha256,hash({arguments:{subject:assertBrowserApprovalPreparation(preparation).subject,
  subjectSha256:hash(subjectOf()),input,requestedAtMs:NOW-1000,expiresAtMs:NOW+60000},attachments:[]}));
 assert.deepEqual(record.scopes,[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy-1'}]);
 assert.deepEqual(record.requiredApprover,{tenantId:'tenant',actorId:'reviewer'});
 assert.equal(record.expiresAt,new Date(NOW+60000).toISOString());
 // The stored request round-trips through the closed schema, and nothing about it is a permission.
 const stored=assertBrowserApprovalPreparation(f.sql.rows.values().next().value.payload.record.request);
 assert.deepEqual(stored,assertBrowserApprovalPreparation(preparation));
 assert.equal(f.inserts(),1);
});

test('a repeat of the same tool use resolves the stored record instead of writing again',async()=>{
 const f=setup(),preparation=preparationOf();
 const first=await f.owner.prepare(f.call({request:preparation}));
 const second=await f.owner.prepare(f.call({request:preparation}));
 assert.equal(second.resolved,true);assert.equal(second.proposalId,first.proposalId);
 assert.equal(second.commandSha256,first.commandSha256);assert.equal(f.inserts(),1);
 assert.equal(f.sql.rows.size,1);
});

test('the same identity with substituted contents refuses before release',async()=>{
 const f=setup(),preparation=preparationOf();
 const first=await f.owner.prepare(f.call({request:preparation}));
 for(const changed of [
  preparationOf({display:{tool:'browser_click',arguments:{selector:'#delete',value:'ok'}}}),
  preparationOf({subject:subjectOf({policySha256:'b'.repeat(64)})}),
  preparationOf({subject:subjectOf({pageOrigin:'https://evil.example'})}),
  preparationOf({expiresAtMs:NOW+120000})]){
  await assert.rejects(f.owner.prepare(f.call({request:changed})),{message:'COMMAND_PREPARATION_REFUSED'});
 }
 assert.equal(f.inserts(),1);assert.equal(f.sql.rows.size,1);
 assert.equal((await f.owner.prepare(f.call({request:preparation}))).proposalId,first.proposalId);
});

test('extra keys, incomplete bindings and a foreign actor refuse',async()=>{
 const f=setup();
 await assert.rejects(f.owner.prepare(f.call({request:{...preparationOf(),approved:true}})),{message:'COMMAND_PREPARATION_REFUSED'});
 await assert.rejects(f.owner.prepare(f.call({request:{...preparationOf(),subject:{...subjectOf(),extra:'x'}}})),{message:'COMMAND_PREPARATION_REFUSED'});
 const {runId,...partial}=binding;
 await assert.rejects(f.owner.prepare(f.call({binding:partial,request:preparationOf({subject:subjectOf({binding:partial})})})));
 const record=await f.owner.prepare(f.call());
 // A different actor can never read this preparation: the key is the authenticated binding.
 await assert.rejects(f.owner.read({...f.readCall({...record,payload:{commandSha256:record.commandSha256}}),
  binding:{...binding,actorId:'intruder'},proposalId:record.proposalId}),{message:'COMMAND_PREPARATION_REFUSED'});
});

test('a cancelled, successor or expired run cannot create a new preparation',async()=>{
 const f=setup();
 f.p.state.denyPhase='prepare';
 await assert.rejects(f.owner.prepare(f.call()),(error)=>{assert.equal(error.message,'COMMAND_PREPARATION_REFUSED');
  assert.equal(error.outcome,'NOT_STORED');return true;});
 assert.equal(f.inserts(),0);
 const expired=setup();
 await assert.rejects(expired.owner.prepare(expired.call({request:preparationOf({expiresAtMs:NOW-1})})),{message:'COMMAND_PREPARATION_REFUSED'});
 await assert.rejects(expired.owner.prepare(expired.call({deadlineMs:NOW})),{message:'DEADLINE'});
 assert.equal(expired.inserts(),0);
});

test('a currentness change after the write is retained but never released',async()=>{
 const f=setup();
 f.p.state.mutate=(result,call)=>{if(call.phase==='before_release')result.authorized=false;};
 await assert.rejects(f.owner.prepare(f.call()),(error)=>{assert.equal(error.outcome,'STORED_NOT_RELEASED');return true;});
 assert.equal(f.sql.rows.size,1,'the immutable row exists for reconciliation');
 f.p.state.mutate=null;f.p.state.denyPhase='read_release';
 await assert.rejects(f.owner.read(f.readCall({proposalId:[...f.sql.rows.keys()][0].match(/"(.*)"/u)?.[0]??'',commandSha256:'0'.repeat(64)})),
  {message:'COMMAND_PREPARATION_REFUSED'});
});

test('a lost acknowledgement keeps UNKNOWN and the same identity reads back',async()=>{
 const f=setup(),preparation=preparationOf();
 // The write lands in the real store, then the acknowledgement is lost.
 const realInsert=f.store.insert.bind(f.store);
 const losingStore={...f.store,async insert(payload,check){await realInsert(payload,check);
  throw Object.assign(Error('synthetic lost acknowledgement'),{code:'APPROVAL_METADATA_UNKNOWN'});}};
 const losingOwner=createBrowserActionApprovalMetadataOwner({store:losingStore,preparePolicy:f.p.preparePolicy,now:()=>NOW,newId:()=>id(950)});
 await assert.rejects(losingOwner.prepare(f.call({request:preparation})),(error)=>{
  assert.equal(error.outcome,'UNKNOWN');assert.equal(error.message,'APPROVAL_METADATA_UNKNOWN');
  assert.ok(error.metadataReference.proposalId);assert.match(error.metadataReference.commandSha256,/^[0-9a-f]{64}$/u);return true;});
 assert.equal(f.inserts(),1,'no second proposal is written as a retry');
 const stored=[...f.sql.rows.values()][0].payload;
 const read=await f.owner.read({proposalId:stored.record.proposalId,commandSha256:stored.commandSha256,operation:BROWSER_ACTION_OPERATION,
  action:BROWSER_ACTION,binding,deadlineMs:NOW+1000});
 assert.equal(read.proposalId,stored.record.proposalId);assert.deepEqual(read.request,assertBrowserApprovalPreparation(preparation));
});

test('the existing Core-only readback returns the browser record with real run custody only',async()=>{
 const f=setup();
 const record=await f.owner.prepare(f.call()),stored=[...f.sql.rows.values()][0].payload;
 const metadata={async read(){return stored;}};
 const run={binding,state:'waiting-for-approval',scopes:record.scopes,createdAt:new Date(NOW).toISOString(),policyRevision:'policy-1',
  versions:{imageDigest:`sha256:${'a'.repeat(64)}`,sdk:'0.1.0',cli:'0.1.0',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};
 const retention={async assertServable(){}};
 const store={async readOptional(){return {run,generation:1};},initialBindings:{async readRetained(){throw Error('a browser preparation never falls back to initial-binding custody');}}};
 const reader=createApprovalMetadataReadback({metadata,store,retention});
 const result=await reader.read({schemaVersion:1,proposalId:record.proposalId,binding});
 assert.deepEqual(result.metadata,stored);assert.equal(result.metadata.record.action,BROWSER_ACTION);
 assert.equal(result.run.state,'waiting-for-approval');assert.deepEqual(result.run.scopes,record.scopes);
 assert.deepEqual(Object.keys(result).sort(),['commandSha256','metadata','run','schemaVersion']);
 await assert.rejects(createApprovalMetadataReadback({metadata,store:{async readOptional(){return null;},initialBindings:store.initialBindings},retention})
  .read({schemaVersion:1,proposalId:record.proposalId,binding}),{message:'APPROVAL_METADATA_READ_UNAVAILABLE'});
});
