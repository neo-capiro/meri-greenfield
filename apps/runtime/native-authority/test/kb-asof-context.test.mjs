/** Actual CONTROL/task/current-native owners over synthetic identity HTTP and SQL protocol. No native source qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {storedCase,searchId,clientId} from '../../../gateway/sources/client-knowledge-search/test/fixture.mjs';
import {ownerFixture,uuid} from '../native-read-credentials/test/fixture.mjs';

const read=async(f,proof=f.proof())=>JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(proof));
const make=scene=>ownerFixture(searchId,{scene:scene??storedCase(searchId)});
function setSubject(scene,kind){
 const a=scene.authority,scope={tenantId:a.binding.tenantId,kind:kind==='client'?'client':'tenant',resourceId:kind==='client'?clientId:a.binding.tenantId,policyRevision:a.policyRevision};
 Object.assign(a.subject,{kind,entityType:kind==='client'?'client':'user',entityIds:[kind==='client'?clientId:a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];return scene;
}
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);}

test('semantic KB captures one trusted instant across advancing native checks and correlated credentials',async()=>{
 const f=await make();f.core.state.beforeResponse=()=>f.state.now++;
 try{
  const initial=await read(f),asOf=initial.context.asOf;assert.deepEqual(Object.keys(initial.context),['asOf']);assert.equal(asOf,new Date(Date.parse(asOf)).toISOString());
  assert.notEqual(asOf,f.normalizationContext.asOf);assert.equal(initial.requestSha256,hash(f.request));f.state.now+=31;
  assert.deepEqual((await read(f)).context,initial.context);
  const count=f.core.state.calls.length,credentials=await f.owner.getCredentials(f.credentials(initial.context));
  assert.ok(f.core.state.calls.length>count);assert.deepEqual(credentials.normalizationContext,initial.context);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,initial.context);
  assert.equal(credentials.requestSha256,hash(f.request));assert.equal(f.wire.length,0);
  const fresh=new AbortController();try{f.state.now+=31;assert.notEqual((await read(f,{...f.proof(),signal:fresh.signal})).context.asOf,asOf);}finally{fresh.abort();}
 }finally{f.scope.abort();}
});

for(const kind of ['personal','client'])for(const selector of ['omitted','null','empty'])test(`semantic KB ${selector} selector retains the no-client branch under a current ${kind} task`,async()=>{
 const request={query:' policy '};if(selector!=='omitted')request.clientId=selector==='null'?null:'';
 const scene=setSubject(storedCase(searchId,{request}),kind),f=await make(scene);f.core.state.clientIds=[];
 try{
  const out=await read(f),normalized=f.contract.normalizeInput(f.request,out.context);assert.equal(normalized.input.clientId,null);assert.deepEqual(f.request,request);
  const credentials=await f.owner.getCredentials(f.credentials(out.context));assert.deepEqual(credentials.normalizationContext,out.context);
  assert.equal(credentials.requestSha256,hash(request));assert.equal(f.wire.length,0);assert.equal(Object.hasOwn(credentials,'clientIds'),false);
 }finally{f.scope.abort();}
});

test('semantic KB selected client identity compares canonically while raw request spelling and normalization remain intact',async()=>{
 const raw=uuid('a').toUpperCase(),request={query:'  policy  ',clientId:raw,kind:'unknown',limit:2.5},f=await make(storedCase(searchId,{request}));
 try{
  const out=await read(f),normalized=f.contract.normalizeInput(f.request,out.context);assert.equal(normalized.input.clientId,raw);assert.equal(normalized.input.query,'policy');assert.equal(normalized.input.kind,null);assert.equal(normalized.input.limit,2.5);
  assert.equal(f.request.clientId,raw);const credentials=await f.owner.getCredentials(f.credentials(out.context));assert.equal(credentials.requestSha256,hash(request));assert.equal(f.stateOwner.secretProof.requestSha256,hash(request));
 }finally{f.scope.abort();}
});

test('semantic KB malformed truthy selectors fail before any current native credential or service secret',async()=>{
 for(const value of ['name',` ${clientId}`,`${clientId} `,' ']){
  const scene=storedCase(searchId),f=await make(scene);
  try{const request={...f.request,clientId:value};await assert.rejects(read(f,{...f.proof(),request,requestSha256:hash(request)}));noSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.core.state.calls.length,0);}
  finally{f.scope.abort();}
 }
});

test('semantic KB selected client requires exact one-client task/resource and current native visibility',async()=>{
 for(const mode of ['personal','foreign-subject','foreign-resource','multiple','foreign-scope','invisible']){
  const scene=storedCase(searchId),a=scene.authority,foreign=uuid('e');
  if(mode==='personal')setSubject(scene,'personal');if(mode==='foreign-subject')a.subject.entityIds=[foreign];if(mode==='multiple')a.subject.entityIds.push(foreign);
  if(mode==='foreign-resource'){const scope={...a.subject.scopes[0],resourceId:foreign};a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];}
  if(mode==='foreign-scope'){const scope={...a.subject.scopes[0],resourceId:foreign};a.subject.scopes.push(scope);a.claims.scopes.push(scope);a.decision.scopes.push(scope);}
  const f=await make(scene);f.core.state.clientIds=mode==='invisible'?[]:[clientId,foreign];
  // Canonically malformed single-subject shape fails before the source-specific ACCESS_DENIED guard.
  try{await assert.rejects(read(f),{message:mode==='multiple'?'UNAVAILABLE':'ACCESS_DENIED'},mode);noSource(f);if(mode!=='invisible')assert.equal(f.stateOwner.nativeCredentials,0);}
  finally{f.scope.abort();}
 }
});

test('semantic KB clock/context/body/operation proof substitution cannot reuse the observed scope',async()=>{
 for(const mode of ['asOf','body','operation','request-digest','arguments-digest']){
  const f=await make();
  try{
   const first=await read(f),proof=f.credentials(first.context);
   if(mode==='asOf')proof.normalizationContext={asOf:new Date(Date.parse(first.context.asOf)+1).toISOString()};
   if(mode==='body'){proof.request={...proof.request,query:'changed'};proof.requestSha256=hash(proof.request);const normalized=f.contract.normalizeInput(proof.request,first.context);proof.input=normalized.input;proof.argumentsSha256=normalized.argumentsSha256;}
   if(mode==='operation')proof.operation={id:'query_knowledge_graph',version:'0.2.0'};if(mode==='request-digest')proof.requestSha256='0'.repeat(64);if(mode==='arguments-digest')proof.argumentsSha256='0'.repeat(64);
   await assert.rejects(f.owner.getCredentials(proof));noSource(f);
  }finally{f.scope.abort();}
 }
});

test('semantic KB credentials require the private observation rather than a source/model clock',async()=>{
 const f=await make();try{await assert.rejects(f.owner.getCredentials(f.credentials(f.normalizationContext)),{message:'ACCESS_DENIED'});noSource(f);assert.equal(f.core.state.calls.length,0);}finally{f.scope.abort();}
});

test('semantic KB current membership, visibility or original expiry drift cannot renew credentials',async()=>{
 for(const mode of ['membership','visibility','expiry']){
  const f=await make();if(mode==='expiry')f.core.state.nativeExpiry=f.now()+1;
  try{
   const initial=await read(f);f.stateOwner.beforeSecret=()=>{if(mode==='membership')f.core.state.membershipRevision='e'.repeat(64);else if(mode==='visibility')f.core.state.clientIds=[];else f.state.now+=2;};
   await assert.rejects(f.owner.getCredentials(f.credentials(initial.context)));assert.equal(f.stateOwner.secrets,1);assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
  }finally{f.scope.abort();}
 }
});
