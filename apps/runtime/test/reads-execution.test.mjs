/** Closed HTTP/execution boundary controls. Core family behavior is tested separately. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {createReadsOwner} from '../reads-owner.mjs';
import {createReadsApplication} from '../reads-http.mjs';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {GENERAL_READ_ADAPTER_FAMILIES} from '../read-families.mjs';
const schemaVersion='meri-native-general-reads/1',operation={id:'read_bill_text',version:'0.2.0'};
function fixture(){
 let at=1000,change,authError,onExecute,availabilityChange;const calls=[];
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:'read'},expiresAtMs:10000,runtimeSessionId:'synthetic-'+('a'.repeat(64))});
 const approvedReads={schemaVersion,enabled:true,operations:[operation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:8192};
 const base={execution:identity,state:'running',scopes,selectedClientId:id(5),policyRevision:'policy1'};
 let authCount=0,created=0;
 const execution={async authenticate(input){calls.push('authenticate');authCount++;assert.equal(input.credential,'same-execution');assert.deepEqual(input.binding,binding);if(authError)throw authError;return change?.(structuredClone(base),authCount)??structuredClone(base);}};
 const snapshot=()=>({installation:{installationId:id(80),baseCatalogSha256:hash(catalog),executionCatalogSha256:'b'.repeat(64),operations:[operation],checkedAtMs:at,expiresAtMs:9000},
  discovery:{binding,policyRevision:'policy1',operations:[operation],checkedAtMs:at,expiresAtMs:9000}});
 const owner=createReadsOwner({binding,execution,approvedReads,now:()=>at,createGateway(input){created++;assert.equal(input.credential,'same-execution');return {
  async readAvailability(){calls.push('availability');return availabilityChange?.(snapshot())??snapshot();},
  async execute(input){calls.push('execute');return onExecute?onExecute(input):JSON.stringify({synthetic:'bounded result'});},
 };}});
 const app=createReadsApplication({owner,approvedReads,now:()=>at});
 const body=kind=>kind==='availability'?{schemaVersion,binding}:{schemaVersion,binding,operation,arguments:{},deliveryId:'same-delivery',installationId:id(80),executionCatalogSha256:'b'.repeat(64)};
 const request=(kind='execute',raw=body(kind),signal)=>new Request('https://control.synthetic.invalid/v1/runner/reads/'+kind,{method:'POST',headers:{authorization:'Bearer same-execution','content-type':'application/json'},body:JSON.stringify(raw),...(signal?{signal}:{})});
 return {app,owner,identity,base,calls,body,request,clock:v=>{at=v;},change:v=>{change=v;},authError:v=>{authError=v;},onExecute:v=>{onExecute=v;},availability:v=>{availabilityChange=v;},created:()=>created};
}
for(const kind of ['availability','execute'])test(`${kind} binds the existing execution and returns unchanged typed response fields`,async()=>{
 const f=fixture(),r=await f.app.handle(f.request(kind));assert.equal(r.status,200);const value=await r.json();
 assert.equal(value.executionSha256,hash(f.identity));assert.equal(value.policyRevision,'policy1');assert.deepEqual(value.binding,binding);
 assert.equal(Object.hasOwn(value,'allocationSha256'),false);assert.equal(f.calls.includes('execute'),kind==='execute');
});
for(const state of ['completed','failed','cancelled','paused','waiting-for-approval'])test(`terminal/held ${state} never starts another read`,async()=>{
 const f=fixture();f.change(v=>({...v,state}));assert.equal((await f.app.handle(f.request())).status,403);assert.equal(f.created(),0);
});
test('foreign binding/scopes, changed selected client and altered execution identity withhold source results',async()=>{
 for(const mutate of [v=>({...v,execution:{...v.execution,binding:{...binding,writerFence:2}}}),v=>({...v,scopes:[{...scopes[0],tenantId:id(99)}]}),
  v=>({...v,selectedClientId:id(99)}),v=>({...v,execution:{...v.execution,runtimeSessionId:'different-'+('a'.repeat(64))}})]){
  const f=fixture();f.onExecute(async()=>{f.change(mutate);return '{"private":"withheld"}';});
  const r=await f.app.handle(f.request());assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/withheld/);assert.equal(f.calls.filter(x=>x==='execute').length,1);
 }
});
test('a stopping/settled execution refusal after the source call releases no data',async()=>{
 const f=fixture();f.onExecute(async()=>{f.authError(Object.assign(Error('private'),{code:'EXECUTION_AUTHORITY_REFUSED'}));return '{"private":"withheld"}';});
 assert.equal((await f.app.handle(f.request())).status,403);
});
for(const code of ['STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN','EXECUTION_STORE_UNAVAILABLE','EXECUTION_STORE_COMMIT_UNKNOWN'])test(`${code} stays unavailable without invoking a source`,async()=>{
 const f=fixture();f.authError(Object.assign(Error('private'),{code}));const r=await f.app.handle(f.request());assert.equal(r.status,503);assert.equal(f.created(),0);
});
test('unknown authentication failure refuses rather than becoming an availability success',async()=>{const f=fixture();f.authError(Error('not canonical'));assert.equal((await f.app.handle(f.request())).status,403);});
test('original expiry and cancellation stop dispatch; a late source response is withheld',async()=>{
 const expired=fixture();expired.clock(10001);assert.equal((await expired.app.handle(expired.request())).status,408);assert.equal(expired.created(),0);
 const cancelled=fixture(),controller=new AbortController();controller.abort();assert.equal((await cancelled.app.handle(cancelled.request('execute',undefined,controller.signal))).status,408);assert.equal(cancelled.created(),0);
 const late=fixture();late.onExecute(async()=>{late.clock(2001);return '{"private":"late"}';});assert.equal((await late.app.handle(late.request())).status,408);
});
test('catalog/snapshot mutation and stale descriptor pins fail closed',async()=>{
 const f=fixture();f.onExecute(async()=>{f.availability(s=>({...s,installation:{...s.installation,executionCatalogSha256:'c'.repeat(64)}}));return '{}';});assert.equal((await f.app.handle(f.request())).status,503);
 const stale=fixture();assert.equal((await stale.app.handle(stale.request('execute',{...stale.body('execute'),executionCatalogSha256:'d'.repeat(64)}))).status,503);assert.equal(stale.calls.includes('execute'),false);
});
test('request, result and malformed JSON limits retain explicit refusals',async()=>{
 const f=fixture();assert.equal((await f.app.handle(f.request('execute',{...f.body('execute'),arguments:{text:'x'.repeat(5000)}}))).status,413);assert.equal(f.created(),0);
 const large=fixture();large.onExecute(async()=>JSON.stringify({value:'x'.repeat(9000)}));assert.equal((await large.app.handle(large.request())).status,502);
 const invalid=fixture();invalid.onExecute(async()=>'{');assert.equal((await invalid.app.handle(invalid.request())).status,503);
});

test('all 62 current family constructors compose without an allocation or grant owner',async()=>{
 assert.equal(GENERAL_READ_ADAPTER_FAMILIES.length,62);assert.equal(new Set(GENERAL_READ_ADAPTER_FAMILIES).size,62);
 const c=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',nativeCredentials:{async nativeCredentialFor(){throw Error('not invoked');}},readSecret:async()=>{throw Error('not invoked');},serviceSecretFile:'synthetic',capabilityPolicy:{async forRun(){throw Error('not invoked');}}});
 assert.deepEqual(c.familyIds,GENERAL_READ_ADAPTER_FAMILIES);assert.deepEqual(c.missing,[]);
});
