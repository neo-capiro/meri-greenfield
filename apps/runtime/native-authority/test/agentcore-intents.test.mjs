/** Actual private intent transport, native resolver, release authority and journal adapter over scripted authority/SQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCoreIntentResolver} from '../execution-composition.mjs';
import {createRunnerIntentsApplication} from '../intents-http.mjs';
import {registerDocumentIntentOwner} from '../../artifacts/intent-binding.mjs';
import {createPreparedSchedulePoolFixture} from '../../../control/intents/test/prepared-schedule-fixture.mjs';
import {binding,scopes as clientScopes,id} from '../../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createMetadataPoolFixture} from '../../../control/commands/approval-metadata/test/fixture.mjs';

const at=1800000000000,operation={id:'create_word',version:'0.2.0'},deliveryId='sdk:'+'a'.repeat(64);
function fixture({enabled=true,documents=true,tasks=false,general=false,retention}={}){
 const scopes=general?[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:clientScopes[0].policyRevision}]:clientScopes,selectedClientId=general?null:id(5);
 const sql=createPreparedSchedulePoolFixture(),state={auth:0,core:0,prepared:0,revoked:false,changed:false,afterPrepare:null};
 const metadata=createMetadataPoolFixture(),pool={options:{connectionTimeoutMillis:30000,query_timeout:30000},async connect(){const intent=await sql.pool.connect(),meta=await metadata.pool.connect();return {async query(q,args){
  if((typeof q==='string'?q:q.text).includes('meri_commands.approval_metadata')){const answer=await meta.query(q);await state.afterMetadata?.();return answer;}
  return intent.query(q,args);
 },release(){intent.release();meta.release();}};}};
 const executionIdentity={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs:at+60000,runtimeSessionId:id(50)};
 const context={configuration:{sourceEnabled:true,intents:{enabled,...(tasks?{core:{origin:'https://core.invalid',serviceSecretFile:'/synthetic'}}:{})},limits:{requestMs:3000}},pool,now:()=>at};
 const current={execution:executionIdentity,scopes,selectedClientId,policyRevision:scopes[0].policyRevision,state:'running'};
 const execution={async authenticate({binding:b,credential}){state.auth++;if(credential!=='actual-execution'||hash(b)!==hash(binding)||state.revoked)throw Error('refused');return structuredClone(state.changed?{...current,selectedClientId:id(6)}:current);}};
 const transitionAuthority={async readCurrent(value){state.core++;assert.deepEqual(value.binding,binding);if(state.revoked)throw Error('revoked');return {binding,scopes,selectedClientId,policyRevision:current.policyRevision,checkedAtMs:at,expiresAtMs:at+30000};}};
 if(documents)registerDocumentIntentOwner(context,value=>{assert.deepEqual(value.clientResolution,{clientId:selectedClientId});return [{operation,owner:'document',binding,async prepare(){state.prepared++;await state.afterPrepare?.();return {status:'draft',version:{binding,scopes}};}}];});
 const resolveRun=createAgentCoreIntentResolver({context,execution,transitionAuthority});
 const app=createRunnerIntentsApplication({resolveRun,enabled:true,now:()=>at,...(retention?{retention}:{}),limits:{maxRequestBytes:65536,maxResponseBytes:262144,maxPrepareMs:3000}});
 const post=(route='prepare',extra={},credential='actual-execution')=>app.handle(new Request('https://control.invalid/v1/runner/intents/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({binding,...(route==='prepare'?{operation,deliveryId,arguments:{title:'reviewed'}}:{}),...extra})}));
 return {state,sql,metadata,post,resolveRun,context,scopes};
}
test('native document preparation uses current Core rights and existing durable journal, never a task allocation',async()=>{
 const f=fixture();const available=await f.post('availability');assert.equal(available.status,200);assert.deepEqual((await available.json()).operations,[operation]);
 const first=await f.post();assert.equal(first.status,200);assert.equal((await first.json()).status,'draft');assert.equal(f.state.prepared,1);
 const core=f.state.core,replay=await f.post();assert.equal(replay.status,200);assert.equal(f.state.prepared,1);assert.ok(f.state.core>core);
 assert.equal(f.sql.state.rows.size,1);assert.ok(f.sql.state.queries.every(q=>!q.sql.includes('allocation')));
 const conflict=await f.post('prepare',{arguments:{title:'changed'}});assert.equal(conflict.status,409);assert.equal(f.state.prepared,1);
});
test('another execution, binding, disabled source and absent document owner cannot prepare',async()=>{
 for(const options of [{enabled:false},{documents:false}]){const f=fixture(options);assert.equal((await f.post()).status,503);assert.equal(f.sql.state.connects,0);assert.equal(f.state.prepared,0);}
 const f=fixture();assert.equal((await f.post('prepare',{},'control-credential')).status,403);
 assert.equal((await f.post('prepare',{binding:{...binding,runId:id(90)}})).status,403);assert.equal(f.state.core,0);assert.equal(f.sql.state.connects,0);
});
test('current authority loss after preparation retains custody and does not release or prepare again',async()=>{
 const f=fixture();f.state.afterPrepare=()=>{f.state.revoked=true;};const first=await f.post();assert.notEqual(first.status,200);
 assert.equal([...f.sql.state.rows.values()][0].state,'PREPARED');assert.equal(f.state.prepared,1);
 assert.equal((await f.post()).status,403);assert.equal(f.state.prepared,1);
});
test('changed selected client is refused before any SQL or document work',async()=>{
 const f=fixture();f.state.changed=true;assert.notEqual((await f.post()).status,200);assert.equal(f.sql.state.connects,0);assert.equal(f.state.prepared,0);
});
test('suppression after authentication but before preparation performs no journal work',async()=>{
 const f=fixture({retention:{async assertServable(){throw Error('suppressed');},withRelease(){assert.fail('no release');}}});
 assert.equal((await f.post()).status,503);assert.ok(f.state.auth>0);assert.equal(f.state.prepared,0);assert.equal(f.sql.state.connects,0);
});
test('suppression at the final serving lock withholds prepared result as UNKNOWN',async()=>{
 let held=0;const f=fixture({retention:{async assertServable(){},async withRelease(subjects,release,{signal}){held++;assert.deepEqual(subjects,[{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId}]);return release(signal,async()=>{throw Error('suppressed');});}}});
 const answer=await f.post();assert.equal(answer.status,502);assert.deepEqual(await answer.json(),{error:{code:'UNKNOWN'}});assert.equal(held,1);assert.equal(f.state.prepared,1);
});
test('the canonical serving lock covers actual response serialization',async()=>{
 let serialized=false;const f=fixture({retention:{async assertServable(){},async withRelease(_subjects,release,{signal}){const answer=await release(signal,async()=>{});assert.ok(answer instanceof Response);assert.equal(JSON.parse(await answer.clone().text()).status,'draft');serialized=true;return answer;}}});
 assert.equal((await f.post()).status,200);assert.equal(serialized,true);
});

for(const general of [false,true])for(const id of ['create_task','update_task'])test(`native ${general?'General':'client'} ${id} prepares through existing metadata and replays one durable delivery`,async()=>{
 const f=fixture({tasks:true,general,documents:false}),operation={id,version:'0.2.0'},args=id==='create_task'?{title:' Review task '}:{taskId:'00000009-0000-4000-8000-000000000000',title:' Review task ',status:'open'};
 const available=await f.post('availability');assert.equal(available.status,200);assert.deepEqual((await available.json()).operations.map(x=>x.id),['create_task','update_task']);
 const first=await f.post('prepare',{operation,arguments:args});assert.equal(first.status,200,await first.clone().text());const result=await first.json();assert.equal(result.status,'approval_required');
 assert.deepEqual(result.proposal.command.binding,binding);assert.deepEqual(result.proposal.command.scopes,f.scopes);assert.deepEqual(result.proposal.requiredApprover,{tenantId:binding.tenantId,actorId:binding.actorId});
 assert.equal(f.metadata.rows.size,1);assert.equal(f.sql.state.rows.size,1);assert.ok(f.sql.state.queries.every(q=>!q.sql.includes('allocation')));
 const replay=await f.post('prepare',{operation,arguments:args});assert.equal(replay.status,200);assert.deepEqual(await replay.json(),result);assert.equal(f.metadata.rows.size,1);
 assert.equal((await f.post('prepare',{operation,arguments:{...args,title:'Changed'}})).status,409);assert.equal(f.metadata.rows.size,1);
 f.state.revoked=true;assert.equal((await f.post('prepare',{operation,arguments:args})).status,403);
});

test('native task creation uses only the exact selected client resolution and refuses a foreign selector before metadata',async()=>{
 const f=fixture({tasks:true,documents:false}),operation={id:'create_task',version:'0.2.0'};
 const accepted=await f.post('prepare',{operation,arguments:{title:'Client task',clientId:id(5)}});assert.equal(accepted.status,200,await accepted.clone().text());assert.equal((await accepted.json()).proposal.command.arguments.clientId,id(5));
 const refused=await f.post('prepare',{operation,deliveryId:'sdk:'+'b'.repeat(64),arguments:{title:'Foreign task',clientId:id(6)}});assert.equal(refused.status,400);assert.equal(f.metadata.rows.size,1);
});

test('native task metadata stored before authority loss stays uncertain and is not prepared twice',async()=>{
 const f=fixture({tasks:true,documents:false});f.state.afterMetadata=()=>{f.state.revoked=true;};const input={operation:{id:'create_task',version:'0.2.0'},arguments:{title:'Prepare once'}};
 assert.notEqual((await f.post('prepare',input)).status,200);assert.equal(f.metadata.rows.size,1);assert.equal([...f.sql.state.rows.values()][0].state,'UNKNOWN');
 f.state.afterMetadata=null;f.state.revoked=false;assert.notEqual((await f.post('prepare',input)).status,200);assert.equal(f.metadata.rows.size,1);
});
