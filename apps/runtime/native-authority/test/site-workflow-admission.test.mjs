import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreSiteWorkflowAdmission,SITE_WORKFLOW_READ_ROUTE} from '../site-workflow-admission.mjs';
import {workflowCurrent,workflowSelection} from '../../../../packages/contracts/test/site-workflow.fixture.mjs';
import {binding,scopes,id} from '../../../control/conversations/test/store-fixture.mjs';
const json=value=>Response.json(value);
function fixture({fetcher,secret,now=Date.now,maxRequestMs=1000}={}){
 let credential='synthetic-native',expiresAtMs=now()+60000;const calls=[],borrowed=[];
 const nativeCredentials={nativeCredentialFor:input=>{borrowed.push(input);return {credential,expiresAtMs};}};
 const port=createCoreSiteWorkflowAdmission({origin:'https://core.example',getServiceSecret:secret??(async()=> 'synthetic-service'),nativeCredentials,now,maxRequestMs,
  fetchImpl:async(url,init)=>{calls.push({url,init});return fetcher?fetcher({rotate:()=>{credential='changed-native';}}):json(workflowCurrent());}});
 return {port,calls,borrowed,rotate:()=>{credential='changed-native';},expire:()=>{expiresAtMs=now();},read:extra=>port.resolve({binding,selection:workflowSelection,scopes,...extra})};
}
test('fixed Core route uses exact native scope and returns only current manifest data',async()=>{
 const f=fixture();assert.deepEqual(await f.read(),workflowCurrent());
 assert.equal(f.calls.length,1);const {url,init}=f.calls[0];assert.equal(url,'https://core.example'+SITE_WORKFLOW_READ_ROUTE);
 assert.deepEqual(JSON.parse(init.body),{conversationId:binding.conversationId,selection:workflowSelection});
 assert.equal(init.headers.authorization,'Bearer synthetic-native');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');
 assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
 assert.ok(f.borrowed.every(v=>v.selectedClientId===id(5)));assert.ok(f.borrowed.every(v=>JSON.stringify(v.binding)===JSON.stringify(binding)));
});
test('General scope borrows no client and rejects foreign-actor or multiple-client requests',async()=>{
 const f=fixture(),general=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:scopes[0].policyRevision}];
 await f.read({scopes:general});assert.ok(f.borrowed.every(v=>v.selectedClientId===null));
 for(const invalid of [[{...general[0],resourceId:'other'}],[...scopes,{...scopes.find(s=>s.kind==='client'),resourceId:id(99)}]])await assert.rejects(f.read({scopes:invalid}));
 assert.equal(f.calls.length,1);
});
test('session rotation across either await withholds the manifest or prevents the request',async()=>{
 const answered=fixture({fetcher:({rotate})=>{rotate();return json(workflowCurrent());}});
 await assert.rejects(answered.read(),{code:'SITE_WORKFLOW_CORE_SESSION_UNAVAILABLE'});
 let release;const waiting=fixture({secret:()=>new Promise(r=>{release=r;})});const read=waiting.read();
 await new Promise(r=>setImmediate(r));waiting.rotate();release('synthetic-service');
 await assert.rejects(read,{code:'SITE_WORKFLOW_CORE_SESSION_UNAVAILABLE'});assert.equal(waiting.calls.length,0);
 const expired=fixture();expired.expire();await assert.rejects(expired.read());assert.equal(expired.calls.length,0);
});
test('disabled, revision/hash drift, extra authority and malformed responses refuse',async()=>{
 for(const changed of [v=>({...v,enabled:false}),v=>({...v,manifestSha256:'b'.repeat(64)}),v=>({...v,manifest:{...v.manifest,version:2}}),
  v=>({...v,manifest:{...v.manifest,taskSummary:'changed'}}),v=>({...v,credential:'not-allowed'})]){
  const f=fixture({fetcher:()=>json(changed(workflowCurrent()))});await assert.rejects(f.read());
 }
 for(const response of [new Response('{}'),json({manifest:null,manifestSha256:workflowSelection.manifestSha256,enabled:true}),
  new Response('x'.repeat(131073),{headers:{'content-type':'application/json'}}),new Response('{}',{headers:{'content-type':'application/json','content-encoding':'gzip'}})]){
  await assert.rejects(fixture({fetcher:()=>response}).read());
 }
});
test('refusals, cancellation and a never-ending body settle without a positive admission',async()=>{
 for(const status of [400,401,403,404,409,500])await assert.rejects(fixture({fetcher:()=>new Response('',{status})}).read());
 const controller=new AbortController();controller.abort();const f=fixture();await assert.rejects(f.read({signal:controller.signal}));assert.equal(f.calls.length,0);
 let cancelled=false;const hanging=fixture({maxRequestMs:15,fetcher:()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}})});
 await assert.rejects(hanging.read(),{code:'SITE_WORKFLOW_CORE_DEADLINE'});assert.equal(cancelled,true);
});
