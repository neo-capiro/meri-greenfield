import test from 'node:test';
import assert from 'node:assert/strict';
import {createApprovalMetadataReadback} from '../readback.mjs';
import {createPostgresApprovalMetadataReader} from '../postgres-store.mjs';
import {makePayload,canonicalSha256 as hash} from '../binding.mjs';
import {allocatedApplicationFixture,binding,scopes,id} from '../../../conversations/test/application-fixture.mjs';
import {normalizeTaskCreateInput,normalizeTaskUpdateInput,normalizeArtifactFileInput} from '../../../../../packages/contracts/commands-0.2/validate.mjs';

async function fixture(t,{general=false}={}){
 const admittedScopes=general?[{...scopes[0],kind:'private-user',resourceId:binding.actorId}]:scopes;
 const f=await allocatedApplicationFixture({scopes:admittedScopes,selectedClientId:general?null:id(5)});t.after(f.close);
 assert.equal((await f.post('submit')).status,200);
 const args={preparationSha256:'a'.repeat(64),artifactRequestSha256:'b'.repeat(64),sourceContextSha256:'c'.repeat(64),baseVersionId:null,title:'Native selected draft',format:'docx'};
 const payload=makePayload({operation:{id:'create_word',version:'0.2.0'},action:'document.draft',binding,request:args,inputSha256:hash({arguments:args,attachments:[]}),commandId:id(601),idempotencyKey:'native-draft-1',proposalId:id(602),scopes:admittedScopes,createdAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId}},{binding,scopes:admittedScopes});
 const state={payload,empty:false,corrupt:false,fail:null,suppressed:false,checks:0,queries:[],releases:[],ends:0,onSelect:null};
 const pool={options:{connectionTimeoutMillis:25000,query_timeout:25000},async connect(){
  if(state.fail==='connect')throw Error('private database value');
  return {async query(q){const sql=typeof q==='string'?q:q.text;state.queries.push(q);
   if(state.fail===sql||state.fail==='select'&&sql.startsWith('SELECT payload'))throw Error('private database value');
   if(!sql.startsWith('SELECT payload'))return {rows:[]};
   state.onSelect?.();return {rows:state.empty?[]:[{payload:state.payload,payload_sha256:state.corrupt?'f'.repeat(64):hash(state.payload)}]};
  },release(error){state.releases.push(error);if(state.fail==='release')throw Error('private release');}};
 },end(){state.ends++;}};
 const metadata=createPostgresApprovalMetadataReader({pool}),retention={async assertServable(subject){assert.deepEqual(subject,{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId});state.checks++;if(state.suppressed)throw Error('suppressed');}};
 const reader=createApprovalMetadataReadback({metadata,store:f.store,retention}),input={schemaVersion:1,proposalId:payload.record.proposalId,binding};
 let n=700;const stateTo=async state=>f.store.append(binding,{eventId:id(n++),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},()=>{},admittedScopes);
 return {f,state,pool,metadata,reader,input,stateTo,scopes:admittedScopes};
}
for(const general of [false,true])for(const terminal of ['completed','failed'])test(`readback returns actual ${general?'General':'client'} metadata and ${terminal} run without execution credentials`,async t=>{
 const f=await fixture(t,{general});
 if(terminal==='failed'){
  const raw={title:'Task committed before model failure'},context={binding,clientResolution:null};
  const args=normalizeTaskCreateInput(raw,context);
  f.state.payload=makePayload({...f.state.payload.record,action:'task.create',operation:{id:'create_task',version:'0.2.0'},request:raw,inputSha256:hash({arguments:args,attachments:[]})},context);
 }
 for(const state of ['starting','running',terminal])await f.stateTo(state);
 const result=await f.reader.read(f.input);assert.equal(result.run.state,terminal);assert.deepEqual(result.run.binding,binding);assert.deepEqual(result.run.scopes,f.scopes);
 assert.deepEqual(result.metadata,f.state.payload);assert.equal(result.commandSha256,f.state.payload.commandSha256);assert.equal(result.schemaVersion,1);
 assert.deepEqual(Object.keys(result).sort(),['commandSha256','metadata','run','schemaVersion']);assert.equal(f.state.checks,2);assert.equal(f.f.state.executions.size,0);
 assert.equal(f.state.queries[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.ok(f.state.queries.includes("SET LOCAL statement_timeout = '5s'"));
 const select=f.state.queries.find(q=>typeof q==='object');assert.equal(select.query_timeout,5000);assert.deepEqual(select.values,[binding.tenantId,binding.actorId,f.input.proposalId]);
 assert.equal(f.state.queries.at(-1),'COMMIT');assert.deepEqual(f.state.releases,[undefined]);assert.equal(f.state.ends,0);
});
for(const action of ['task.create','task.update'])for(const general of [false,true])test(`native ${action} metadata readback preserves raw normalization and ${general?'General':'client'} scope`,async t=>{
 const f=await fixture(t,{general}),raw=action==='task.create'?{title:'  Native task  '}:{taskId:id(812).toUpperCase(),title:'  Changed task  ',status:'open'};
 const context=action==='task.create'?{binding,clientResolution:null}:{binding};
 const args=(action==='task.create'?normalizeTaskCreateInput:normalizeTaskUpdateInput)(raw,context);
 f.state.payload=makePayload({...f.state.payload.record,action,operation:{id:action==='task.create'?'create_task':'update_task',version:'0.2.0'},request:raw,inputSha256:hash({arguments:args,attachments:[]})},context);
 const result=await f.reader.read(f.input);
 assert.deepEqual(result.metadata.record.request,raw);assert.equal(result.metadata.commandSha256,f.state.payload.commandSha256);assert.deepEqual(result.run.scopes,f.scopes);
});
for(const terminal of ['completed','failed'])test(`native filing metadata preserves exact object custody from an actual ${terminal} run`,async t=>{
 const f=await fixture(t),context={binding,destination:{clientId:id(5),conversationId:binding.conversationId}};
 const raw={...context.destination,objects:[{objectId:id(820),versionId:'opaque-storage-version',sha256:'a'.repeat(64),bytes:2,scopes:f.scopes}]};
 f.state.payload=makePayload({...f.state.payload.record,action:'artifact.file',operation:{id:'save_chat_attachments',version:'0.2.0'},request:raw,inputSha256:hash(normalizeArtifactFileInput(raw,context))},context);
 for(const state of ['starting','running',terminal])await f.stateTo(state);
 const result=await f.reader.read(f.input);
 assert.equal(result.run.state,terminal);assert.deepEqual(result.metadata.record.request,raw);assert.deepEqual(result.run.scopes,f.scopes);
 let initialReads=0;
 const absent=createApprovalMetadataReadback({metadata:f.metadata,store:{async readOptional(){return null;},initialBindings:{async readRetained(){initialReads++;throw Error('not a supported filing source');}}},retention:{async assertServable(){}}});
 await assert.rejects(absent.read(f.input));assert.equal(initialReads,0);
});
for(const failure of ['absent','corrupt','foreign-binding','scope','cancelled','suppressed-before','suppressed-after','select','COMMIT','ROLLBACK','release'])test(`metadata readback refuses ${failure} without an authorization or partial result`,async t=>{
 const f=await fixture(t);
 if(failure==='absent')f.state.empty=true;
 if(failure==='corrupt')f.state.corrupt=true;
 if(failure==='foreign-binding')f.input.binding={...binding,workerId:id(999)};
 if(failure==='scope')f.state.payload=makePayload({...f.state.payload.record,scopes:[{...scopes[0],resourceId:id(999)}]},{binding,scopes:[{...scopes[0],resourceId:id(999)}]});
 if(failure==='cancelled')await f.stateTo(failure);
 if(failure==='suppressed-before')f.state.suppressed=true;
 if(failure==='suppressed-after')f.state.onSelect=()=>{f.state.suppressed=true;};
 if(['select','COMMIT','release'].includes(failure))f.state.fail=failure;
 if(failure==='ROLLBACK'){f.state.corrupt=true;f.state.fail='ROLLBACK';}
 await assert.rejects(f.reader.read(f.input));assert.equal(f.state.ends,0);
 if(failure==='suppressed-before')assert.equal(f.state.queries.length,0);
 if(['select','ROLLBACK'].includes(failure))assert.ok(f.state.queries.includes('ROLLBACK'));
 if(failure==='COMMIT'||failure==='ROLLBACK')assert.ok(f.state.releases[0]);
});
test('cancelled read owns no SQL and late acquisition is released without a statement',async t=>{
 const f=await fixture(t),abort=new AbortController();abort.abort();await assert.rejects(f.reader.read({...f.input,signal:abort.signal}));assert.equal(f.state.queries.length,0);
 let live=true,release=0,queries=0;const reader=createPostgresApprovalMetadataReader({pool:{options:f.pool.options,async connect(){live=false;return {query(){queries++;},release(error){assert.ok(error);release++;}};}}});
 await assert.rejects(reader.read({tenantId:binding.tenantId,actorId:binding.actorId,proposalId:f.input.proposalId},()=>{if(!live)throw Error('cancelled');}));
 assert.equal(queries,0);assert.equal(release,1);
});
