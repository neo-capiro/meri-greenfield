/** Actual retained adapters and typed normalization, with closed ordinary Core HTTP responses. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {createClientKnowledgeFixture} from '../../gateway/sources/client-knowledge/test/fixtures.mjs';

async function fixture({client=true,monday=false}={}){
 const source=createClientKnowledgeFixture(monday?'read_monday_client_boards':'search_memory',{client}),binding=source.binding;
 const family=monday?'client-knowledge-monday':'client-knowledge-memory',calls=[];
 let revoked=false,afterPage,mutateHelper,mutatePage,status=200;
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},
  expiresAtMs:source.state.now+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const current={execution:identity,state:'running',scopes:source.subject.scopes,selectedClientId:client?source.clientId:null,policyRevision:source.subject.policyRevision};
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[source.operation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:1048576};
 const execution={async authenticate(){if(revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return structuredClone(current);}};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:[family],
  nativeCredentials:{async nativeCredentialFor(request){assert.deepEqual(request.binding,binding);assert.equal(request.selectedClientId,current.selectedClientId);return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},
  readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>source.state.now,newId:()=>source.binding.attemptId,
  capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:[family],activeReadOperations:[source.operation]};}},
  async fetchImpl(url,options){
   const path=new URL(url).pathname,body=JSON.parse(options.body);calls.push({path,body});
   assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
   assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
   const correlation=JSON.parse(Buffer.from(options.headers['x-meri-read-correlation'],'base64url').toString());
   assert.deepEqual(correlation.binding,binding);assert.equal(Object.hasOwn(correlation.subject,'authorizationDecisionId'),false);
   if(path==='/api/clio/tools/search_memory_eligibility'){
    assert.equal(Object.hasOwn(body,'pageProof'),false);
    const receipt=source.eligibility(body);receipt.expiresAtMs=Math.min(receipt.expiresAtMs,source.state.now+1000);mutateHelper?.(receipt);
    return Response.json(receipt,{status});
   }
   assert.equal(path,`/api/clio/tools/${source.operation.id}`);
   assert.equal(body.input.clientId,current.selectedClientId);const page=source.page(body.input);mutatePage?.(page);afterPage?.();
   return Response.json(page,{status});
  }});
 assert.deepEqual(composer.missing,[]);
 const app=composer.createReadsRuntime({execution,binding,approvedReads});
 const request=(kind,body)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body)});
 async function execute(args=source.args){
  const r=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));assert.equal(r.status,200,await r.clone().text());const a=await r.json();
  return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation:source.operation,arguments:args,deliveryId:'synthetic',installationId:a.installation.installationId,executionCatalogSha256:a.installation.executionCatalogSha256}));
 }
 return {source,calls,execute,revoke:()=>{revoked=true;},after:fn=>{afterPage=fn;},helper:fn=>{mutateHelper=fn;},page:fn=>{mutatePage=fn;},status:n=>{status=n;}};
}

for(const client of [true,false])test(`memory actual composition preserves ${client?'client':'General'} selection and exact eligibility`,async()=>{
 const f=await fixture({client}),response=await f.execute();assert.equal(response.status,200,await response.clone().text());
 const page=JSON.parse((await response.json()).resultJson);assert.deepEqual(page.result,f.source.page());
 assert.deepEqual(f.calls.map(c=>c.path),['/api/clio/tools/search_memory','/api/clio/tools/search_memory_eligibility']);
});
test('Monday actual composition preserves canonical saved mapping result',async()=>{const f=await fixture({monday:true}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(f.calls.length,1);assert.equal(JSON.parse((await r.json()).resultJson).result.records.length,1);});
test('wrong selected client refuses before the ordinary Core request',async()=>{const f=await fixture();const r=await f.execute({...f.source.args,clientId:f.source.binding.actorId});assert.notEqual(r.status,200);assert.equal(f.calls.length,0);});
test('current execution revocation between page and eligibility withholds all content',async()=>{const f=await fixture();f.after(f.revoke);const r=await f.execute();assert.equal(r.status,403);assert.equal(f.calls.length,1);assert.doesNotMatch(await r.text(),/approved note/);});
for(const [name,mutate] of Object.entries({pageHash:r=>{r.resultSha256='a'.repeat(64);},recordHash:r=>{r.records[0].recordSha256='a'.repeat(64);},ineligible:r=>{r.records[0].eligibleForRecall=false;},actor:r=>{r.subject.actorId=r.subject.tenantId;},expired:r=>{r.expiresAtMs=r.checkedAtMs;}}))test(`memory ${name} eligibility cannot release the page`,async()=>{const f=await fixture();f.helper(mutate);const r=await f.execute();assert.notEqual(r.status,200);assert.equal(f.calls.length,2);});
test('Core permission refusal remains a refusal without an eligibility fallback',async()=>{const f=await fixture();f.status(403);const r=await f.execute();assert.equal(r.status,403);assert.equal(f.calls.length,1);});
