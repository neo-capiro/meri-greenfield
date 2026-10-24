/** Actual private intent transport, native resolver, release authority and journal adapter over scripted authority/SQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCoreIntentResolver} from '../execution-composition.mjs';
import {createRunnerIntentsApplication} from '../intents-http.mjs';
import {registerDocumentIntentOwner} from '../../artifacts/intent-binding.mjs';
import {createPreparedSchedulePoolFixture} from '../../../control/intents/test/prepared-schedule-fixture.mjs';
import {binding,scopes,id} from '../../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';

const at=1800000000000,operation={id:'create_word',version:'0.2.0'},deliveryId='sdk:'+'a'.repeat(64);
function fixture({enabled=true,documents=true,retention}={}){
 const sql=createPreparedSchedulePoolFixture(),state={auth:0,core:0,prepared:0,revoked:false,changed:false,afterPrepare:null};
 const executionIdentity={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs:at+60000,runtimeSessionId:id(50)};
 const context={configuration:{sourceEnabled:true,intents:{enabled},limits:{requestMs:3000}},pool:sql.pool,now:()=>at};
 const current={execution:executionIdentity,scopes,selectedClientId:id(5),policyRevision:scopes[0].policyRevision,state:'running'};
 const execution={async authenticate({binding:b,credential}){state.auth++;if(credential!=='actual-execution'||hash(b)!==hash(binding)||state.revoked)throw Error('refused');return structuredClone(state.changed?{...current,selectedClientId:id(6)}:current);}};
 const transitionAuthority={async readCurrent(value){state.core++;assert.deepEqual(value.binding,binding);if(state.revoked)throw Error('revoked');return {binding,scopes,selectedClientId:id(5),policyRevision:current.policyRevision,checkedAtMs:at,expiresAtMs:at+30000};}};
 if(documents)registerDocumentIntentOwner(context,value=>{assert.deepEqual(value.clientResolution,{clientId:id(5)});return [{operation,owner:'document',binding,async prepare(){state.prepared++;await state.afterPrepare?.();return {status:'draft',version:{binding,scopes}};}}];});
 const resolveRun=createAgentCoreIntentResolver({context,execution,transitionAuthority});
 const app=createRunnerIntentsApplication({resolveRun,enabled:true,now:()=>at,...(retention?{retention}:{}),limits:{maxRequestBytes:65536,maxResponseBytes:262144,maxPrepareMs:3000}});
 const post=(route='prepare',extra={},credential='actual-execution')=>app.handle(new Request('https://control.invalid/v1/runner/intents/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({binding,...(route==='prepare'?{operation,deliveryId,arguments:{title:'reviewed'}}:{}),...extra})}));
 return {state,sql,post,resolveRun,context};
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
