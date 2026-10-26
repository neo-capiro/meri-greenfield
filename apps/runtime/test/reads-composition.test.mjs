/** Actual composer/dispatch/normalizer/HTTP path with closed Core-shaped responses. No network or provider. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {binding as storedBinding,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {storeFixture} from '../../control/conversations/test/store-fixture.mjs';
import {seedStore} from '../../control/conversations/sources/test/fixture.mjs';
import {assertNativeSourceEvent} from '../../../packages/contracts/conversation-sources/validate.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
const schemaVersion='meri-native-general-reads/1',operation={id:'read_bill_text',version:'0.2.0'};
const binding={...storedBinding,tenantId:id(70),actorId:id(71)},scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:'policy1'}];
async function fixture(conversationStore,signal,args={billId:'H.R. 1'}){
 let authCalls=0,at=1000,coreMutate,afterSource,sourceMutate,executionError,sourceStatus=200;const calls=[];
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:'read'},expiresAtMs:10000,runtimeSessionId:'synthetic-'+('a'.repeat(64))});
 const base={execution:identity,state:'running',scopes,selectedClientId:id(5),policyRevision:'policy1'};
 const approvedReads={schemaVersion,enabled:true,operations:[operation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:1048576};
 const source=billTextCase(),execution={async authenticate({credential,binding:requested}){authCalls++;assert.equal(credential,'SYNTHETIC_EXECUTION');assert.deepEqual(requested,binding);if(executionError)throw executionError;return structuredClone(base);}};
 const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:['bill-text'],defaultCongress:119,
  nativeCredentials:{async nativeCredentialFor(request){assert.deepEqual(request.binding,binding);assert.equal(request.selectedClientId,id(5));return {credential:'SYNTHETIC_USER',expiresAtMs:9000};}},
  readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic-only',capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:['bill-text'],activeReadOperations:[operation]};}},now:()=>at,newId:()=>id(90),
  async fetchImpl(url,options){calls.push(new URL(url).pathname);assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
   if(url.endsWith('/application-authority/current')){
    assert.deepEqual(JSON.parse(options.body),{conversationId:binding.conversationId,clientId:id(5)});
    const receipt={principal:{tenantId:binding.tenantId,actorId:binding.actorId},role:'standard_user',permissions:[],clientIds:[id(5)],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:binding.conversationId,selectedClientId:id(5),checkedAtMs:at,expiresAtMs:9000};
    return response(coreMutate?.(receipt)??receipt);
   }
   assert.equal(new URL(url).pathname,'/api/clio/tools/read_bill_text');
   assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
   const result=source.native(JSON.parse(options.body));sourceMutate?.(result);afterSource?.();return Response.json(result,{status:sourceStatus});
  }});
 const app=composer.createReadsRuntime({execution,binding,approvedReads,conversationStore});
 const request=(kind,body)=>new Request('https://control.example.invalid/v1/runner/reads/'+kind,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body),signal});
 async function execute(){const availability=await app.handle(request('availability',{schemaVersion,binding}));assert.equal(availability.status,200,await availability.clone().text());const available=await availability.json();
  return app.handle(request('execute',{schemaVersion,binding,operation,arguments:args,deliveryId:'synthetic',installationId:available.installation.installationId,executionCatalogSha256:available.installation.executionCatalogSha256}));}
 return {execute,calls,authCalls:()=>authCalls,status:v=>{sourceStatus=v;},core:v=>{coreMutate=v;},source:v=>{sourceMutate=v;},unavailable:()=>{source.state.unavailable=true;},after:v=>{afterSource=v;},revoke:()=>{executionError=Error('EXECUTION_AUTHORITY_REFUSED');},clock:v=>{at=v;}};
}
test('ordinary Core bearer/service transport retains actual bill normalization and exact typed result',async()=>{
 const f=await fixture(),r=await f.execute();assert.equal(r.status,200,await r.clone().text());const wire=await r.json(),page=JSON.parse(wire.resultJson);
 assert.equal(page.operation.id,'read_bill_text');assert.equal(page.result.billId,'119-hr-1');assert.equal(page.result.text,'x'.repeat(12));
 assert.equal(f.calls.filter(path=>path==='/api/clio/tools/read_bill_text').length,1);assert.equal(f.calls.filter(path=>path==='/api/clio/application-authority/current').length,2,'one bounded selection at admission plus the deliberate final-release observation');
});
test('foreign Core identity/client and revoked membership never dispatch a source read',async()=>{
 for(const mutate of [r=>({...r,principal:{...r.principal,tenantId:id(99)}}),r=>({...r,principal:{...r.principal,actorId:id(99)}}),r=>({...r,selectedClientId:id(99)}),r=>({...r,clientIds:[]})]){
  const f=await fixture();f.core(mutate);const r=await f.execute();assert.notEqual(r.status,200);assert.equal(f.calls.includes('/api/clio/tools/read_bill_text'),false);
 }
});
test('settlement during the actual source call withholds the completed page',async()=>{const f=await fixture();f.after(f.revoke);const r=await f.execute();assert.equal(r.status,403);assert.equal(f.calls.filter(path=>path==='/api/clio/tools/read_bill_text').length,1);assert.doesNotMatch(await r.text(),/Synthetic stored|xxxxxxxx/);});
test('late and malformed actual Core pages cannot become successful reads',async()=>{
 const late=await fixture();late.after(()=>late.clock(2001));assert.notEqual((await late.execute()).status,200);
 const wrong=await fixture();wrong.source(r=>{r.billId='119-hr-2';});assert.notEqual((await wrong.execute()).status,200);
});

test('canonical Core resource denial after initial selection withholds the page without repeating identity',async()=>{const f=await fixture();f.status(403);const r=await f.execute();assert.equal(r.status,403);assert.equal(f.calls.filter(path=>path==='/api/clio/application-authority/current').length,1);assert.equal(f.calls.filter(path=>path==='/api/clio/tools/read_bill_text').length,1);});

test('actual native producer records the actual result hash before returning the bill page',async()=>{
 const database=storeFixture(),store=createPostgresConversationStore({pool:database.pool,now:()=>1000});await seedStore(store);const f=await fixture(store),response=await f.execute();assert.equal(response.status,200,await response.clone().text());
 const wire=await response.json(),saved=(await store.read(binding,{},()=>{})).events.at(-1);assertNativeSourceEvent(saved);assert.equal(saved.data.resultSha256,wire.resultSha256);assert.equal(saved.data.requestSha256,wire.inputSha256);assert.equal(saved.data.executionSha256,wire.executionSha256);assert.equal(saved.data.resultSha256,canonicalSha256(JSON.parse(wire.resultJson)));
 const replay=await f.execute();assert.equal(replay.status,200,await replay.clone().text());assert.equal((await store.read(binding,{},()=>{})).lastSequence,4);
 f.source(r=>{r.sourceLocator='https://evidence.example.invalid/changed';});const changed=await f.execute();assert.equal(changed.status,409);assert.deepEqual(await changed.json(),{error:{code:'SOURCE_PUBLICATION_CONFLICT'}});
});
test('native producer retains unknown publication and releases no result text on lost commit acknowledgement',async()=>{
 const database=storeFixture(),store=createPostgresConversationStore({pool:database.pool});await seedStore(store);const f=await fixture(store);database.state.commitUnknown=true;
 const response=await f.execute();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'SOURCE_PUBLICATION_UNKNOWN'}});database.state.commitUnknown=false;assert.equal((await store.read(binding,{},()=>{})).lastSequence,4);
});
test('revocation after native read prevents source persistence',async()=>{
 const database=storeFixture(),store=createPostgresConversationStore({pool:database.pool});await seedStore(store);const f=await fixture(store);f.after(f.revoke);assert.equal((await f.execute()).status,403);assert.equal((await store.read(binding,{},()=>{})).lastSequence,3);
});

test('HTTP cancellation while native publication is pending preserves UNKNOWN without returning read bytes',async()=>{
 const abort=new AbortController(),f=await fixture({async appendSource(){abort.abort();await new Promise(()=>{});}},abort.signal);
 const response=await f.execute();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'SOURCE_PUBLICATION_UNKNOWN'}});
});
test('canonical unavailable bill result preserves existing tool behavior without inventing a saved source',async()=>{const database=storeFixture(),store=createPostgresConversationStore({pool:database.pool});await seedStore(store);const f=await fixture(store);f.unavailable();const r=await f.execute();assert.equal(r.status,503,await r.clone().text());assert.deepEqual(await r.json(),{error:{code:'UNAVAILABLE'}});assert.equal((await store.read(binding,{},()=>{})).lastSequence,3);});

test('query excerpts retain existing native read behavior without source publication or extra currentness calls',async()=>{const args={billId:'H.R. 1',query:'x'},before=await fixture(undefined,undefined,args);assert.equal((await before.execute()).status,200);const database=storeFixture(),store=createPostgresConversationStore({pool:database.pool});await seedStore(store);const f=await fixture(store,undefined,args),r=await f.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(f.authCalls(),before.authCalls());assert.equal((await store.read(binding,{},()=>{})).lastSequence,3);});
