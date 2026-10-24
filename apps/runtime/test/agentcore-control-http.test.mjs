import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCoreControlApplication,createApprovalMetadataReaderApplication,APPROVAL_METADATA_READ_PATH} from '../agentcore-control-http.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
const control='synthetic-control-secret-'.repeat(3),run='synthetic-run-credential';

test('control and runtime routes use separate credentials and closed request shapes',async()=>{
 const calls=[];const owner=Object.fromEntries(['readiness','kickoff','status','stop','admitted','settle','retentionSweep'].map(name=>[name,async value=>{
  if(['admitted','settle'].includes(name)&&value.credential!==run)throw Object.assign(Error('denied'),{code:'EXECUTION_AUTHORITY_REFUSED'});
  calls.push({name,value});return {accepted:true};}]));
 const app=createAgentCoreControlApplication({owner,controlCredential:control});
 const post=(path,body,token)=>app.handle(new Request('https://control.example.test'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)}));
 const kickoff={binding,executionKey:'a'.repeat(64)};
 assert.equal((await post('/v1/execution/kickoff',kickoff,run)).status,403);assert.equal(calls.length,0);
 assert.equal((await post('/v1/execution/kickoff',{...kickoff,model:'injected'},control)).status,400);assert.equal(calls.length,0);
 assert.equal((await post('/v1/execution/kickoff',kickoff,control)).status,200);assert.equal(calls[0].value.credential,undefined);
 assert.equal((await post('/v1/runner/execution',{execution:{binding},versions},control)).status,403);
 assert.equal((await post('/v1/runner/execution',{execution:{binding},versions},run)).status,200);assert.equal(calls[1].value.credential,run);
 assert.equal((await post('/v1/readiness',{},run)).status,403);assert.equal(calls.length,2);
 assert.equal((await post('/v1/readiness',{ready:true},control)).status,400);assert.equal(calls.length,2);
 assert.equal((await post('/v1/readiness',{},control)).status,200);assert.equal(calls[2].name,'readiness');assert.equal(calls[2].value.credential,undefined);
 assert.equal((await post('/v1/retention/sweep',{after:null},run)).status,403);assert.equal(calls.length,3);
 assert.equal((await post('/v1/retention/sweep',{after:null,subject:binding},control)).status,400);assert.equal(calls.length,3);
 assert.equal((await post('/v1/retention/sweep',{after:null},control)).status,200);assert.equal(calls[3].name,'retentionSweep');assert.equal(calls[3].value.credential,undefined);
 assert.equal(await app.handle(new Request('https://control.example.test/unrelated')),null);
});

test('approval metadata service auth precedes body reads and uses only the service credential',async()=>{
 let bodies=0,reads=0,secretReads=0;const secret='synthetic-core-service-secret',reader={async read(value){reads++;return {schemaVersion:1,proposalId:value.proposalId};}},app=createApprovalMetadataReaderApplication({reader,getServiceSecret:async()=>{secretReads++;return secret;}});
 const rejected={url:'https://control.example.test'+APPROVAL_METADATA_READ_PATH,method:'POST',headers:new Headers({'content-type':'application/json',authorization:'Bearer '+control}),get body(){bodies++;throw Error('must not read');}};
 assert.equal((await app.handle(rejected)).status,503);assert.equal(bodies,0);assert.equal(reads,0);assert.equal(secretReads,0);
 rejected.headers.set('x-internal-service-secret','synthetic-wrong-service-secret');assert.equal((await app.handle(rejected)).status,503);assert.equal(bodies,0);assert.equal(reads,0);
 const input={schemaVersion:1,proposalId:'00000000-0000-4000-8000-000000000001',binding};
 const post=body=>app.handle(new Request(rejected.url,{method:'POST',headers:{'content-type':'application/json','x-internal-service-secret':secret},body:JSON.stringify(body)}));
 const response=await post(input);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(reads,1);
 assert.equal((await post({...input,authority:'caller-injected'})).status,503);assert.equal(reads,1);
 assert.equal((await post({...input,padding:'x'.repeat(17000)})).status,503);assert.equal(reads,1);
 assert.equal(await app.handle(new Request('https://control.example.test/unrelated')),null);
});
test('approval metadata deadline, unavailable SQL and oversized result never return a successful fact',async()=>{
 const secret='synthetic-core-service-secret',input={schemaVersion:1,proposalId:'00000000-0000-4000-8000-000000000001',binding};
 for(const mode of ['deadline','error','overflow']){
  let signal;const app=createApprovalMetadataReaderApplication({getServiceSecret:async()=>secret,maxRequestMs:20,reader:{async read(value){signal=value.signal;if(mode==='deadline')return new Promise(()=>{});if(mode==='error')throw Error('private-secret-canary');return {padding:'x'.repeat(131073)};}}});
  const response=await app.handle(new Request('https://control.example.test'+APPROVAL_METADATA_READ_PATH,{method:'POST',headers:{'content-type':'application/json','x-internal-service-secret':secret},body:JSON.stringify(input)}));
  assert.equal(response.status,503);assert.equal((await response.text()).includes('private-secret-canary'),false);assert.equal(signal.aborted,true);
 }
});
