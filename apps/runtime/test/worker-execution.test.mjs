/** Private HTTP boundary controls; service effects are synthetic here, real service/store composition is in worker-terminal-ack. */
import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {taskControlPage} from '../../control/conversations/lifecycle/service.mjs';
import {runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
registerHooks({resolve(specifier,context,next){if(specifier==='./config.mjs'&&context.parentURL?.endsWith('/apps/runtime/worker-http.mjs'))return {url:new URL('../../control/conversations/test/load-only-runtime-config-stub.mjs',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
const {createWorkerRunApplication}=await import('../worker-http.mjs');
function fixture(){let at=1000,authError,change;const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:'worker'},expiresAtMs:10000,runtimeSessionId:'synthetic-'+('a'.repeat(64))});const calls=[];let checks=0,creates=0;
 const execution={async authenticate(input){checks++;assert.equal(input.credential,'same-execution');assert.deepEqual(input.binding,binding);if(authError)throw authError;return change?.({execution:identity,scopes,selectedClientId:id(5),policyRevision:'policy1'},checks)??{execution:identity,scopes,selectedClientId:id(5),policyRevision:'policy1'};}};
 const app=createWorkerRunApplication({execution,now:()=>at,configuration:{limits:{requestMs:3000,requestBytes:2048}},createService(input){creates++;assert.deepEqual(input,{credential:'same-execution',binding});return Object.fromEntries(Object.entries(runOwnerOperations).map(([route,method])=>[route==='next-controls'?taskControlPage:method,async input=>{calls.push({route,input});return {synthetic:route};}]));}});
 const request=(route,body,{method='POST',headers={},path=''}={})=>new Request('https://control.synthetic.invalid/internal/conversations/'+route+path,{method,headers:{authorization:'Bearer same-execution','content-type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
 return {app,calls,request,checks:()=>checks,creates:()=>creates,error:value=>{authError=value;},change:fn=>{change=fn;},clock:value=>{at=value;}};
}
for(const route of Object.keys(runOwnerOperations))test(`existing ${route} delegates the same execution credential through its canonical method`,async()=>{
 const f=fixture(),body={binding,...(route==='publish'?{event:{eventId:id(90),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:id(91),text:'synthetic'}}}:route==='load'||route==='next-controls'||route==='procedure-resolve'?{}:{input:route==='record-usage'?{usage:null,toolsUsed:{tools:[],omitted:0}}:route==='upload-source'?{selection:{uploadId:id(901),sha256:'a'.repeat(64)},page:0}:{}})};
 const response=await f.app.handle(f.request(route,body));assert.equal(response.status,200);assert.equal(f.calls.length,1);assert.equal(f.calls[0].route,route);if(route==='next-controls'){assert.equal('credential' in f.calls[0].input,false);assert.deepEqual(f.calls[0].input.scopes,scopes);assert.equal(f.calls[0].input.selectedClientId,id(5));}else assert.equal(f.calls[0].input.credential,'same-execution');assert.equal(f.checks(),2);assert.equal(f.creates(),1);
});
for(const code of ['STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN','EXECUTION_STORE_UNAVAILABLE','EXECUTION_STORE_COMMIT_UNKNOWN'])test(`canonical authentication ${code} is unavailable and dispatches nothing`,async()=>{const f=fixture();f.error(Object.assign(Error('private diagnostic'),{code}));const r=await f.app.handle(f.request('load',{binding}));assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:{code:'WORKER_AUTHORITY_UNAVAILABLE'}});assert.equal(f.creates(),0);});
for(const code of ['EXECUTION_AUTHORITY_REFUSED','EXECUTION_CORRUPT','UNKNOWN','FAKE_COMMIT_UNKNOWN'])test(`authentication ${code} remains refused`,async()=>{const f=fixture();f.error(Object.assign(Error('private diagnostic'),{code}));assert.equal((await f.app.handle(f.request('load',{binding}))).status,403);assert.equal(f.creates(),0);});
test('malformed binding and foreign scopes refuse before service creation; changed currentness withholds an effected result',async()=>{
 for(const change of [v=>({...v,execution:{...v.execution,binding:{...binding,writerFence:2}}}),v=>({...v,scopes:[{...scopes[0],tenantId:'foreign'}]})]){const f=fixture();f.change(change);assert.equal((await f.app.handle(f.request('load',{binding}))).status,403);assert.equal(f.creates(),0);}
 const f=fixture();f.change((v,n)=>n===2?{...v,scopes:[{...scopes[0],resourceId:id(99)}]}:v);const r=await f.app.handle(f.request('load',{binding}));assert.equal(r.status,403);assert.equal(f.calls.length,1);assert.doesNotMatch(await r.text(),/synthetic/);
});
test('expired execution, unknown route, malformed JSON shape and oversized request never dispatch',async()=>{
 const expired=fixture();expired.clock(10001);assert.equal((await expired.app.handle(expired.request('load',{binding}))).status,408);assert.equal(expired.creates(),0);
 for(const [route,body,options,status] of [['new-work',{binding},{},404],['load',{binding},{method:'GET'},405],['load',{binding},{path:'?other=target'},404],['load',{binding,raw:'not allowed'},{},403],['load',{binding,padding:'x'.repeat(3000)},{},403]]){const f=fixture();assert.equal((await f.app.handle(f.request(route,body,options))).status,status);assert.equal(f.creates(),0);}
});

test('control polling withholds changed execution scope and rejects caller-supplied authority',async()=>{
 const f=fixture();f.change((v,n)=>n===2?{...v,scopes:[{...scopes[0],resourceId:id(99)}]}:v);const r=await f.app.handle(f.request('next-controls',{binding,after:1}));assert.equal(r.status,403);assert.equal(f.calls.length,1);assert.doesNotMatch(await r.text(),/synthetic/);
 const g=fixture();assert.equal((await g.app.handle(g.request('next-controls',{binding,scopes}))).status,403);assert.equal(g.creates(),0);
});

test('upload source transport admits only a bounded selected tuple and withholds changed execution scope',async()=>{
 const selection={uploadId:id(901),sha256:'a'.repeat(64)};
 for(const input of [{selection,page:256},{selection,page:-1},{selection:{...selection,url:'https://not-authority.invalid'},page:0},{selection,page:0,scopes},{selection:{...selection,sha256:'bad'},page:0}]){
  const f=fixture();assert.equal((await f.app.handle(f.request('upload-source',{binding,input}))).status,403);assert.equal(f.creates(),0);
 }
 const f=fixture();f.change((v,n)=>n===2?{...v,scopes:[{...scopes[0],resourceId:id(99)}]}:v);
 const response=await f.app.handle(f.request('upload-source',{binding,input:{selection,page:0}}));assert.equal(response.status,403);assert.equal(f.calls.length,1);assert.doesNotMatch(await response.text(),/synthetic/);
});
