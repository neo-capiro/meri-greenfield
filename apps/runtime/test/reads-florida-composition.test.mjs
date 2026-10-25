/** One ordinary Core/Intel-owned Florida read; closed synthetic HTTP only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {createMailFixture,uuid} from '../../gateway/sources/mail/test/fixtures.mjs';
const operation={id:'get_florida_budget_project',version:'0.2.0'},family='florida-budget';
async function fixture({client=false}={}){
 const source=createMailFixture(undefined,{client}),binding=source.binding,calls=[];let mutate,status=200,revoked=false;
 const scopes=[{tenantId:binding.tenantId,kind:client?'client':'private-user',resourceId:client?source.clientId:binding.actorId,policyRevision:source.subject.policyRevision}];
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:source.state.now+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const current={execution:identity,state:'running',scopes,selectedClientId:client?source.clientId:null,policyRevision:source.subject.policyRevision};
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[operation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:1048576};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:[family],
  nativeCredentials:{async nativeCredentialFor(){return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},
  readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>source.state.now,newId:()=>binding.attemptId,
  capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:[family],activeReadOperations:[operation]};}},
  async fetchImpl(url,options){assert.equal(new URL(url).pathname,'/api/clio/tools/get_florida_budget_project');assert.equal(options.method,'POST');assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
   const input=JSON.parse(options.body);calls.push(input);
   const result={tool:operation.id,generatedAt:new Date(source.state.now).toISOString(),result:{scope:{jurisdiction:'FL',sessionKey:input.sessionKey,folderId:input.folderId,clientId:input.clientId||input.folderId?source.clientId:null},fiscalYear:input.fiscalYear,projects:[],nextOffset:null,documents:[],amounts:[],events:[],notice:'Canonical source wording'},authority:'Canonical source wording'};
   mutate?.(result);return Response.json(result,{status});
  }});
 assert.deepEqual(composer.missing,[]);
 const execution={async authenticate(){if(revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return structuredClone(current);}},app=composer.createReadsRuntime({execution,binding,approvedReads});
 async function execute(args={}){const request=(kind,body)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body)});
  const a=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));assert.equal(a.status,200,await a.clone().text());const available=await a.json();
  return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation,arguments:args,deliveryId:'synthetic',installationId:available.installation.installationId,executionCatalogSha256:available.installation.executionCatalogSha256}));}
 return {execute,calls,clientId:source.clientId,status:v=>{status=v;},mutate:f=>{mutate=f;},revoke:()=>{revoked=true;}};
}
for(const client of [false,true])for(const selector of ['none','name','uuid','folder'])test(`Florida ${selector} selector uses one actual owner read in ${client?'client':'General'} context`,async()=>{
 const f=await fixture({client}),args=selector==='none'?{}:selector==='name'?{clientId:' Synthetic client '}:selector==='uuid'?{clientId:f.clientId.toUpperCase()}:{folderId:'folder',sessionKey:'session'};
 const r=await f.execute(args);assert.equal(r.status,200,await r.clone().text());const result=JSON.parse((await r.json()).resultJson);assert.equal(result.operation.id,operation.id);assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].clientId,selector==='name'?'Synthetic client':selector==='uuid'?f.clientId:null);
 assert.equal(result.result.result.scope.clientId,selector==='none'?null:f.clientId);
});
test('Florida canonical refusal and execution revocation cannot release a page',async()=>{
 const denied=await fixture();denied.status(403);assert.equal((await denied.execute()).status,403);assert.equal(denied.calls.length,1);
 const revoked=await fixture();revoked.mutate(revoked.revoke);assert.equal((await revoked.execute()).status,403);assert.equal(revoked.calls.length,1);
});
test('Florida malformed selector refuses before dispatch',async()=>{const f=await fixture();for(const args of [{folderId:'x'.repeat(101)},{clientId:{}},{offset:10001},{fiscalYear:'invalid'},{effectiveScope:{}}])assert.notEqual((await f.execute(args)).status,200);assert.equal(f.calls.length,0);});
test('Florida returned selector, paging and opaque row controls stay enforced',async()=>{
 for(const mutate of [p=>{p.result.scope.clientId=uuid('6');},p=>{p.result.scope.folderId='other';},p=>{p.result.scope.sessionKey='other';},p=>{p.result.nextOffset=100;},p=>{p.result.fiscalYear='2027-28';},p=>{p.result.projects=[{privateField:'secret'}];}]){
  const f=await fixture();f.mutate(mutate);assert.notEqual((await f.execute({clientId:f.clientId,folderId:'folder',sessionKey:'session'})).status,200);assert.equal(f.calls.length,1);
 }
});
