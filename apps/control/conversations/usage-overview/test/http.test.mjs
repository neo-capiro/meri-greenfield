import test from 'node:test';import assert from 'node:assert/strict';
import {createUsageOverviewApplication} from '../http.mjs';
import {ProductError} from '../../../product-access/errors.mjs';
import {createUsageOverviewStore} from '../store.mjs';
import {assertUsageOverviewRequest,assertUsageOverviewResponse,assertUsageOverviewRequestV2,assertUsageOverviewResponseV2} from '../../../../../packages/contracts/conversation-usage/overview-validate.mjs';
import {USAGE_OVERVIEW_PATH,USAGE_OVERVIEW_SCHEMA,USAGE_OVERVIEW_SCHEMA_V2} from '../../../../../packages/contracts/conversation-usage/overview-protocol.mjs';
import {receiveUsageOverviewRequest,receiveUsageOverviewRequestV2,receiveUsageOverviewResponse,receiveUsageOverviewResponseV2} from '@capiro/meri-contracts/conversation-usage';
import {principal,request,requestV2,response,responseV1,responseV2,at,poolFixture,continuationCustody} from './fixture.mjs';
import {registerHooks} from 'node:module';
// No inherited provider credential may reach the runtime mount: this suite never calls AWS or a model provider.
for(const key of Object.keys(process.env))if(/^(AWS_|ANTHROPIC_|OPENAI_|GOOGLE_|AZURE_)/u.test(key))delete process.env[key];
// Inert in-process stand-ins for the exact external modules this qualified checkout cannot resolve. They are
// never installed or written into any package, and their classes can never perform an AWS or provider call.
const inertExternalAdapters={
 '@aws-sdk/client-s3':'data:text/javascript,'+encodeURIComponent(['S3Client','PutObjectCommand','GetObjectCommand','HeadObjectCommand','GetBucketVersioningCommand','ListObjectVersionsCommand','DeleteObjectCommand','GetObjectRetentionCommand','GetObjectLegalHoldCommand','GetBucketOwnershipControlsCommand','GetBucketPolicyStatusCommand','GetPublicAccessBlockCommand'].map(n=>`export class ${n}{constructor(input){this.input=input}}`).join('\n')),
 saxes:'data:text/javascript,'+encodeURIComponent('export class SaxesParser{constructor(){this.__inert=true}on(){return this}write(){return this}close(){return this}}')};
// Record the exact real import failure for a declared external module, or rethrow anything else: a future
// source error must fail the test instead of being relabelled as an absent dependency.
async function externalAbsence(specifier,matchers){
 try{await import(specifier);return null;}
 catch(error){const code=error?.code,message=String(error?.message??''),stack=String(error?.stack??'');
  const named=(code==='ERR_MODULE_NOT_FOUND'||code==='MODULE_NOT_FOUND')&&matchers.some(m=>message.includes(m[0])&&(!m[1]||stack.includes(m[1])));
  if(!named)throw error;return {code,message};}
}
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
function fixture({runtime=false,omitStore=false,omitGate=false,realStore=false,runtimeModule=null}={}){
 const state={principal:structuredClone(principal),reads:0,rechecks:0,revoked:false};
 const gate={async admit({credential}){if(credential!=='SYNTHETIC')throw new ProductError('UNAUTHENTICATED');return {principal:structuredClone(state.principal),expiresAtMs:at+2000};},async recheck({principal:p}){state.rechecks++;if(state.revoked)throw new ProductError('MEMBERSHIP_REVOKED');if(JSON.stringify(p)!==JSON.stringify(state.principal))throw new ProductError('MEMBERSHIP_CHANGED');}};
 // realStore drives the one production reader over the recorded row shape; the stub store only injects faults.
 const pool=poolFixture();
 const store={usageOverview:realStore?createUsageOverviewStore({pool:pool.pool,now:()=>at,continuationCustody})
  :{async read({principal:p,version='2'},check){assert.deepEqual(p,principal);state.reads++;check();state.afterRead?.();if(state.failure)throw state.failure;return state.value??(version==='1'?responseV1():responseV2());}},
  history:{async list(){throw Error('no conversation inventory');},async transcript(){throw Error('no transcript');}}};
 const limits={maxRequestMs:1000,maxRequestBytes:4096,maxResponseBytes:131072};
 const app=runtime?runtimeModule.createRuntimeProductApplications({configuration:{sourceEnabled:false,limits:{requestMs:1000,requestBytes:4096},native:{maxResponseBytes:131072}},sessions:{},ports:runtimeModule.captureRuntimePorts({...(!omitGate?{conversationMembership:gate}:{}),conversationCurrentness:{async assertCurrent(){throw Error('no run/conversation needed');}}}),...(!omitStore?{conversationStore:store}:{}),now:()=>at})
  :createUsageOverviewApplication({store,gate,now:()=>at,limits});
 const read=(body=requestV2,{method='POST',credential='SYNTHETIC'}={})=>app.handle(new Request('https://example.invalid'+USAGE_OVERVIEW_PATH,{method,headers:{authorization:'Bearer '+credential,'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})}));
 return {state,read,pool};
}
test('cold native membership reaches the actual mounted tenant overview and the real read transaction',async()=>{
 const f=fixture({realStore:true}),r=await f.read();assert.equal(r.status,200,await r.clone().text());const value=await r.json();
 // Real HTTP response, strict successor receiving, and the real five-read transaction behind it.
 assert.equal(value.schemaVersion,USAGE_OVERVIEW_SCHEMA_V2);
 assert.deepEqual(assertUsageOverviewResponseV2(value),value);
 assert.equal(value.periods[0].attempts,5);assert.equal(value.periods[0].conversationThreads.threads,3);
 assert.equal(value.jobIdentity.status,'measured');assert.equal(value.occupiedCapacity.status,'unavailable');
 // Whole jobs come from the successor's own bounded statement, so the mounted read is six statements.
 assert.equal(value.wholeJobs.jobs,7);assert.equal(value.wholeJobs.states.successful.jobs,1);assert.equal(value.wholeJobs.states.unclosed.jobs,3);
 // Whole jobs come from the successor's own bounded statement, plus the canonical continuation owner's own
 // source-control read for each continued revision: six statements of the read's own, three custody reads.
 const own=f.pool.state.calls.filter(c=>/^(WITH|SELECT)/.test(c.sql)&&!c.sql.startsWith('SELECT * FROM meri_conversations.controls'));
 assert.equal(own.length,6);
 assert.equal(f.pool.state.calls.filter(c=>c.sql.startsWith('SELECT * FROM meri_conversations.controls')).length,3);
 assert.equal(f.pool.state.releases.length,1);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('the runtime mount serves both wire versions through inert external adapters with no AWS/provider effect',async t=>{
 // The declared AWS SDK and the saxes XML parser's transitive dependency are external to the usage-overview
 // route and are incomplete or absent in this qualified checkout. Record each exact real import failure, then
 // load the real mount with inert in-process adapters for those modules only. Nothing is installed or written
 // into any package, the inert classes cannot perform an AWS or provider call, and every other import failure
 // still fails this test instead of being relabelled as an absent dependency.
 const absent={'@aws-sdk/client-s3':await externalAbsence('@aws-sdk/client-s3',[["'@aws-sdk/client-s3'"],['@aws-sdk/client-s3']]),
  saxes:await externalAbsence('saxes',[['xmlchars','saxes.js']])};
 for(const [specifier,failure] of Object.entries(absent))if(failure)t.diagnostic('inert external adapter for absent '+specifier+': '+failure.code+' — '+failure.message);
 const on=Object.entries(absent).filter(([,failure])=>failure!==null).map(([specifier])=>specifier);
 if(on.length)registerHooks({resolve(specifier,context,nextResolve){if(on.includes(specifier))return {url:inertExternalAdapters[specifier],shortCircuit:true};return nextResolve(specifier,context);}});
 const module=await import('../../../../runtime/product-applications.mjs');
 const f=fixture({runtime:true,realStore:true,runtimeModule:module}),r=await f.read();assert.equal(r.status,200,await r.clone().text());
 const value=await r.json();assert.equal(value.schemaVersion,USAGE_OVERVIEW_SCHEMA_V2);assert.deepEqual(assertUsageOverviewResponseV2(value),value);
 // The route keeps the honest successor semantics through the runtime mount, not only on the direct factory.
 assert.equal(value.jobIdentity.status,'measured');assert.equal(value.occupiedCapacity.status,'unavailable');
 assert.equal(value.wholeJobs.jobs,7);
 // The same mounted owner also serves the published /1 version, and the generated /1 receiver accepts it.
 const old=await f.read(request);assert.equal(old.status,200,await old.clone().text());const valueOld=await old.json();
 assert.equal(valueOld.schemaVersion,USAGE_OVERVIEW_SCHEMA);assert.deepEqual(assertUsageOverviewResponse(valueOld),valueOld);
 assert.deepEqual(receiveUsageOverviewResponse(200,bytes(valueOld),receiveUsageOverviewRequest(bytes(request))),valueOld);
 assert.equal(valueOld.coverage.chargeBasis,'recorded-sdk-estimate');
});
test('the current generated /1 receiver keeps ordinary parity and refuses the successor response',async()=>{
 // Precision (review F5iii): this imports the workspace @capiro/meri-contracts dist, i.e. the CURRENT
 // generated artifact, not a frozen archive. Genuine frozen-archive parity and /2 refusal rest on the
 // external physical .25/.26 proof, which is retained separately and is not re-run here.
 const f=fixture({realStore:true}),r=await f.read(),value=await r.json();
 // Ordinary old-version parity: the same module still accepts an ordinary /1 body unchanged.
 assert.deepEqual(receiveUsageOverviewResponse(200,bytes(response()),receiveUsageOverviewRequest(bytes(request))),response());
 // New-response refusal: the current generated /1 receiver rejects the /2 body instead of accepting it.
 assert.throws(()=>receiveUsageOverviewResponse(200,bytes(value),receiveUsageOverviewRequest(bytes(request))));
});
test('the one route serves both closed wire versions from the same read and refuses forged or unknown versions',async()=>{
 const f=fixture({realStore:true});
 // The old version is served again: the published /1 metadata block is not stranded, and the strict /1
 // receiver accepts the exact bytes the route returns for it.
 const old=await f.read(request);assert.equal(old.status,200,await old.clone().text());const valueOld=await old.json();
 assert.equal(valueOld.schemaVersion,USAGE_OVERVIEW_SCHEMA);
 assert.deepEqual(assertUsageOverviewResponse(valueOld),valueOld);
 assert.deepEqual(receiveUsageOverviewResponse(200,bytes(valueOld),receiveUsageOverviewRequest(bytes(request))),valueOld);
 // The successor is unchanged on the same route and still passes strict successor receiving.
 const next=await f.read();assert.equal(next.status,200,await next.clone().text());const valueNext=await next.json();
 assert.equal(valueNext.schemaVersion,USAGE_OVERVIEW_SCHEMA_V2);
 assert.deepEqual(assertUsageOverviewResponseV2(valueNext),valueNext);
 assert.deepEqual(receiveUsageOverviewResponseV2(200,bytes(valueNext),receiveUsageOverviewRequestV2(bytes(requestV2))),valueNext);
 // Two requests, two reads: five statements for the old version and six for the successor, one reader,
 // one projection per version, no extra read and no job custody read for /1. Only the successor read adds
 // the canonical continuation owner's own three source-control reads, on the same client and snapshot.
 assert.equal(f.pool.state.calls.filter(c=>/^(WITH|SELECT)/.test(c.sql)&&!c.sql.startsWith('SELECT * FROM meri_conversations.controls')).length,11);
 assert.equal(f.pool.state.calls.filter(c=>c.sql.startsWith('SELECT * FROM meri_conversations.controls')).length,3);
});
test('wrong, extra and non-discriminating versions are refused before any read',async()=>{
 const f=fixture({realStore:true});
 for(const body of [{...request,tenantId:'forged'},{...requestV2,runId:'forged'},{schemaVersion:'meri.usage-overview/3'},{schemaVersion:'MERI.USAGE-OVERVIEW/1'},{},null])
  assert.equal((await f.read(body)).status,400,JSON.stringify(body));
 assert.equal(f.pool.state.calls.length,0);
 assert.deepEqual(assertUsageOverviewRequest(request),request);
 assert.deepEqual(assertUsageOverviewRequestV2(requestV2),requestV2);
});
test('an uncomposed store or gate is refused at construction instead of serving invented numbers',()=>{
 // The direct authenticated factory must not mount a route it cannot serve; the runtime mount's own
 // missing-store degradation is a separate branch and is not asserted by this construction check.
 const limits={maxRequestMs:1000,maxRequestBytes:4096,maxResponseBytes:131072};
 assert.throws(()=>createUsageOverviewApplication({store:{},gate:{},now:()=>at,limits}),/PRODUCT_CONFIGURATION/u);
 assert.throws(()=>createUsageOverviewApplication({gate:{},now:()=>at,limits}),/PRODUCT_CONFIGURATION/u);
});
test('browser tenant/actor/client selectors and invalid methods never read',async()=>{
 const f=fixture();for(const extra of [{tenantId:'forged'},{actorId:'forged'},{clientId:null},{runId:'forged'}])assert.equal((await f.read({...requestV2,...extra})).status,400);
 assert.equal((await f.read(requestV2,{method:'GET'})).status,405);assert.equal((await f.read(requestV2,{credential:'foreign'})).status,401);assert.equal(f.state.reads,0);
});
test('membership revocation and tenant/actor/client changes after the aggregate read withhold every number',async()=>{
 for(const change of [s=>s.revoked=true,s=>s.principal.tenantId='foreign',s=>s.principal.actorId='foreign',s=>s.principal.clientIds=['foreign']]){
  const f=fixture();f.state.afterRead=()=>change(f.state);const r=await f.read();assert([403,409].includes(r.status));assert.equal(f.state.reads,1);assert.doesNotMatch(await r.text(),/knownCharge|periods|policy|queue|lineage/u);
 }
});
test('corrupt numeric output and unavailable or uncertain reads have closed public failures, no partial facts',async()=>{
 const bad=fixture();bad.state.value=responseV2();bad.state.value.periods[0].attempts++;assert.equal((await bad.read()).status,500);
 for(const failure of [new ProductError('USAGE_OVERVIEW_UNAVAILABLE'),new ProductError('USAGE_OVERVIEW_UNAVAILABLE','UNKNOWN')]){
  const f=fixture();f.state.failure=failure;const r=await f.read();assert.equal(r.status,503);const value=await r.json();
  assert.deepEqual(receiveUsageOverviewResponse(r.status,bytes(value),receiveUsageOverviewRequest(bytes(request))),value);assert.doesNotMatch(JSON.stringify(value),/periods|knownCharge|lineage/u);
 }
});
test('request bytes are bounded for both wire versions before any read',async()=>{
 const f=fixture({realStore:true});
 const oversized=version=>({schemaVersion:version,padding:'x'.repeat(2000)});
 for(const version of [USAGE_OVERVIEW_SCHEMA,USAGE_OVERVIEW_SCHEMA_V2])assert.equal((await f.read(oversized(version))).status,413);
 assert.equal(f.pool.state.calls.length,0);
});
test('the old wire version keeps the same membership release fence as the successor',async()=>{
 const f=fixture({realStore:true});f.state.revoked=true;
 const r=await f.read(request);assert.equal(r.status,403);
 assert.doesNotMatch(await r.text(),/knownCharge|periods|policy|queue/u);
});
