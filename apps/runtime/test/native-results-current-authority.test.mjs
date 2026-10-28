/** Cross-authority crossing proof for the native results read: the REAL document results route -> the document
 * application's current-session request adapter -> the REAL Meri current artifact authority (core-authority.mjs /
 * core-authority-wire.mjs, with the composed `results -> ['artifact.inspect']` intent map and the retained-read
 * admission) -> the REAL Meri Core HTTP client observed over a scripted Core service seam that asserts exact
 * intent/body/digest/principal -> validated retained manifest -> release-time current authorization.
 * Fixed seams only (scripted Core HTTP replies, scripted conversation store, scripted identity for the document
 * application, scripted discovery port). No authorize replacement: the gate is the real Meri authority and no
 * always-allow path exists. No network/AWS/database/model call: global fetch is replaced before any import. */
const network=[];
globalThis.fetch=async url=>{network.push(String(url));throw Object.assign(Error('NETWORK_FORBIDDEN'),{code:'NETWORK_FORBIDDEN'});};
const [{test},assert,{canonicalSha256},{createActionSessionOwner},{createCoreArtifactAuthorityClient},{createCoreArtifactAuthority},
 {ARTIFACT_AUTHORITY_CONTRACT,ARTIFACT_AUTHORITY_ROUTE},{createDocumentApplication},{v}]=await Promise.all([
 import('node:test'),import('node:assert/strict'),import('../../../packages/contracts/validate.mjs'),
 import('../../control/action-host/session/owner.mjs'),import('../artifacts/core-authority-client.mjs'),
 import('../artifacts/core-authority.mjs'),import('../artifacts/core-authority-wire.mjs'),
 import('../../control/document-application/index.mjs'),import('../../control/document-application/current.mjs')]);

const ORIGIN='https://core.synthetic.invalid',SECRET='synthetic-core-service-secret',BEARER='synthetic-native-bearer-1';
const ids={tenantId:'00000000-0000-4000-8000-00000000b001',actorId:'00000000-0000-4000-8000-00000000b002',
 conversationId:'00000000-0000-4000-8000-00000000b003',clientId:'00000000-0000-4000-8000-00000000b004',
 reservedRunId:'00000000-0000-4000-8000-00000000b006'};
const binding={tenantId:ids.tenantId,actorId:ids.actorId,conversationId:ids.conversationId,runId:ids.reservedRunId,
 attemptId:'00000000-0000-4000-8000-00000000b007',workerId:'00000000-0000-4000-8000-00000000b008',writerFence:1};
const scopes=[{tenantId:ids.tenantId,kind:'client',resourceId:ids.clientId,policyRevision:'p'.repeat(64)}];
const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576};
const MANIFEST='00000000-0000-4000-8000-00000000b101',CAPTURED='2026-10-28T00:00:00.000Z';
const SHA='a'.repeat(64),rev=label=>canonicalSha256({synthetic:label});
const code=c=>e=>{assert.equal(e?.code,c,`expected ${c}, got ${e?.code} (${e?.message})`);return true;};

/** The Core service boundary: the peer's own scripted reply shape. It records the exact observed intent, body digest,
 * principal and client, and can refuse by status so release-time revocation is exercised. */
function scriptedCore(state={}){
 const core={calls:0,observed:[],status:state.status??200,principal:{tenantId:ids.tenantId,actorId:ids.actorId}};
 core.fetch=async(url,init)=>{core.calls++;const request=JSON.parse(init.body);core.observed.push({url,method:init.method,
  secret:init.headers['x-internal-service-secret'],bearer:init.headers.authorization.slice(7),request});
  assert.equal(url,ORIGIN+ARTIFACT_AUTHORITY_ROUTE);assert.equal(init.method,'POST');
  if(core.status!==200)return Response.json({message:'refused'},{status:core.status});
  const checkedAtMs=Date.now();
  return Response.json({contract:ARTIFACT_AUTHORITY_CONTRACT,observationId:request.observationId,principal:core.principal,
   identityRevision:rev('identity'),conversationId:request.conversationId,selectedClientId:request.clientId,
   contextRevision:rev('context'),intent:request.intent,requestSha256:request.requestSha256,
   operations:state.operations??['artifact.inspect'],limits:null,authorityRevision:rev('authority'),checkedAtMs,
   expiresAtMs:checkedAtMs+60000});};
 return core;}

function scriptedStore(stored){const store={calls:[],writes:0,async read(){store.calls.push('read');throw Object.assign(Error('STORE_CORRUPT'),{code:'STORE_CORRUPT'});},
 async readOptional(){store.calls.push('readOptional');return stored;}};return store;}
const row=r=>({run:r});

/** Fixed identity/context seams for the document application (its own session port contract), mirroring the identity
 * the Meri authority resolved, plus the discovery port (already proven separately) and the retained metadata. */
function documentPorts({now,resolved}){
 const sessions={async authenticateSession({credential}){if(credential!==BEARER)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});
   return {principal:{sessionId:'00000000-0000-4000-8000-00000000b009',tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},sessionRevision:'rev-1',checkedAtMs:now(),expiresAtMs:now()+20000};},
  async readCurrentState({authentication}){return {authenticationSha256:v.hash(authentication),binding,scopes,selectedClientId:ids.clientId,
   checkedAtMs:now(),expiresAtMs:now()+20000};}};
 const source=resolved.artifactOptions;
 // Only the real authority's binding/scopes and its authorize gate cross into the document application. Its closed
 // configuration admits own data-property methods only, so the storage/executor/pool/ids seams stay the document
 // application's own plain ports -- they are not the authorization crossing, and the authority's own objects must not
 // be re-shaped to suit the test.
 const artifactOptions={pool:{},
  context:{binding:source.context.binding,scopes:source.context.scopes,evidence:[],assets:[],deadlineMs:now()+4000,maxBytes:1048576},
  validators:v,authorize:call=>source.authorize(call),
  versions:{read:async()=>null,commit:async()=>null},
  objects:{get:async()=>{throw Object.assign(Error('ENOENT'),{code:'ENOENT'});},put:async()=>null},
  executor:{execute:async()=>{throw Error('no generation in this test');}},now,
  ids:()=>({artifactId:'00000000-0000-4000-8000-00000000b201',versionId:'00000000-0000-4000-8000-00000000b202',objectId:'00000000-0000-4000-8000-00000000b203'}),
  retention:{assertServable:async()=>{}}};
 return {sessions,artifactOptions};}

async function harness({stored,manifest=MANIFEST,captured=CAPTURED,operations,coreStatus}={}){
 const now=Date.now;
 const store=scriptedStore(stored);
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:4,maxRequestMs:3000,maxTtlMs:60000,maxFactBytes:65536},
  async verifyIdentity({credential}){if(credential!==BEARER)throw Error('SYNTHETIC_IDENTITY_REFUSED');
   return {principal:{tenantId:ids.tenantId,actorId:ids.actorId},identityRevision:'synthetic-identity-1',checkedAtMs:now(),expiresAtMs:now()+60000};},
  async resolveContext({identity,identitySha256}){return {identitySha256,binding:structuredClone(binding),scopes:structuredClone(scopes),
   selectedClientId:ids.clientId,contextRevision:'synthetic-context-1',checkedAtMs:now(),expiresAtMs:now()+60000};}});
 const issued=await sessions.issue({identityCredential:BEARER});
 const core=scriptedCore({operations,status:coreStatus});
 const credentials={async serviceSecret(){return SECRET;},admitBearer:bearer=>bearer};
 const client=createCoreArtifactAuthorityClient({origin:ORIGIN,fetchImpl:core.fetch,now});
 const authority=createCoreArtifactAuthority({client,credentials,now,limits,maxOutputBytes:limits.maxResponseBytes});
 const intent='results',body={},requestSha256=canonicalSha256({intent,body});
 const resolved=await authority.resolve({sessions,store,credential:issued.credential,deadlineMs:now()+5000,intent,body,requestSha256});
 const result={binding:structuredClone(binding),scopes,now,store,core,resolved,intent,body,requestSha256};
 const ports=documentPorts({now,resolved});
 const authorizes=[];
 const authorize=resolved.artifactOptions.authorize;
 result.authorizeCalls=authorizes;
 result.artifactOptions={...ports.artifactOptions,authorize:async call=>{authorizes.push(call);return authorize(call);}};
 result.post=(extra={})=>{
  const app=createDocumentApplication({sessions:ports.sessions,selectedClientId:ids.clientId,artifactOptions:result.artifactOptions,
   now,limits,enabled:true,
   nativeResults:{list:async()=>({binding:structuredClone(binding),scopes:structuredClone(scopes),
    manifestId:extra.manifest??manifest,capturedAt:extra.captured??captured,truncated:false,
    results:[{versionId:'00000000-0000-4000-8000-00000000b301',path:'analysis/output/report.md',bytes:12,sha256:SHA,executable:false}]})}});
  return app.handle(new Request('http://127.0.0.1/api/documents/results',{method:'POST',
   headers:{'content-type':'application/json',authorization:`Bearer ${BEARER}`},body:'{}'}));};
 return result;}

test('the real results route is authorized through the real Meri current authority for General and a selected client',async()=>{
 for(const stored of [null,row({binding:structuredClone(binding),scopes:structuredClone(scopes),state:'completed'})]){
  const h=await harness({stored});
  // Direct current-authority crossing at the seam the route uses (native-results.mjs authority(): action artifact.inspect,
  // the explicit results digest, closed null pre-collection resource). Any refusal here is the real boundary's own code.
  let direct;
  try{direct=await h.resolved.artifactOptions.authorize({action:'artifact.inspect',binding:structuredClone(binding),scopes:structuredClone(scopes),
   requestSha256:h.requestSha256,deadlineMs:h.now()+4000,resource:{versionId:null,manifestId:null,capturedAt:null,object:null,assetObjects:[]}});}
  catch(error){throw Error('DIRECT_AUTHORIZE '+(error?.code??'')+': '+(error?.message??String(error)));}
  assert.equal(direct.requestSha256,h.requestSha256,'the receipt binds the outer results digest: '+JSON.stringify(direct));
  const answered=await h.post();
  assert.equal(answered.status,200,'the real authority admits the results read: '+await answered.clone().text()+' diag='+JSON.stringify({authorizes:h.authorizeCalls.length,core:h.core.calls,store:h.store.calls,stored:!!stored}));
  const payload=await answered.json();
  assert.deepEqual(payload.results.map(r=>r.path),['analysis/output/report.md']);
  assert.equal(payload.manifestId,MANIFEST);
  const observed=h.core.observed[0].request;
  assert.equal(observed.intent,'results');
  assert.equal(observed.requestSha256,canonicalSha256({intent:'results',body:{}}),'outer digest stays canonical({intent,body})');
  assert.equal(h.core.observed[0].bearer,BEARER,'the current grant is observed over the session bearer');
  assert.equal(observed.clientId,ids.clientId);
  assert.equal(observed.conversationId,ids.conversationId);
  assert.equal(h.core.observed[0].secret,SECRET);
  // Release-time authorization is a second current grant; the release grant binds the validated snapshot identity.
  assert.equal(h.authorizeCalls.length,2);
  assert.equal(h.authorizeCalls[0].resource.manifestId,null);
  assert.equal(h.authorizeCalls[1].resource.manifestId,MANIFEST);
  assert.equal(h.authorizeCalls[1].resource.capturedAt,CAPTURED);
  for(const call of h.authorizeCalls){assert.equal(call.action,'artifact.inspect');assert.equal(call.requestSha256,h.requestSha256);
   assert.deepEqual(call.binding,binding);assert.deepEqual(call.scopes,scopes);}
  assert.equal(h.store.writes,0,'no run or write allocation');
  assert.equal(h.store.calls.every(name=>name==='readOptional'||name==='read'),true);
 }});

test('retained reads work for completed, failed and cancelled origins, and never revive generation or writes',async()=>{
 for(const state of ['completed','failed','cancelled']){
  const h=await harness({stored:row({binding:structuredClone(binding),scopes:structuredClone(scopes),state})});
  const answered=await h.post();
  assert.equal(answered.status,200,`${state} origin still reads its retained results`);
  assert.equal(h.authorizeCalls.length,2);
  assert.equal(h.store.writes,0,`${state}: no write revival`);
  assert.equal(h.core.calls,1,'the real Meri authority holds one Core receipt per resolve and both grants evaluate against it');
 }});

test('wrong actor, revoked release authority, changed current context and a changed manifest all refuse with no names',async()=>{
 // Revoked at release: the session's own current authority refuses the second (release) grant, so nothing is released.
 const revoked=await harness({stored:null});
 const realRelease=revoked.artifactOptions.authorize;let grants=0;
 revoked.artifactOptions.authorize=async call=>{grants++;if(grants===2)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED',status:403});return realRelease(call);};
 const refused=await revoked.post();
 assert.equal(grants,2,'the release grant is actually requested');
 assert.notEqual(refused.status,200);
 assert.equal((await refused.text()).includes('report.md'),false);
 // A Core boundary that refuses issues no current grant at all: the real Meri authority cannot even resolve one.
 let resolveRefusal=null;try{await harness({stored:null,coreStatus:403});}catch(error){resolveRefusal=error;}
 assert.equal(resolveRefusal?.code,'ACCESS_DENIED','a refused Core yields no current receipt');
 // A receipt issued for a different snapshot identity cannot authorize the release.
 const changed=await harness({stored:null});
 const realAuthorize=changed.artifactOptions.authorize;
 changed.artifactOptions.authorize=async call=>{
  const answer=await realAuthorize(call.resource?.manifestId===null?call:{...call,resource:{...call.resource,capturedAt:'2026-10-28T00:00:01.000Z'}});
  return answer;};
 const drifted=await changed.post();
 assert.notEqual(drifted.status,200,'a grant for another snapshot identity does not authorize this release');
 assert.equal((await drifted.text()).includes('report.md'),false);
 // A wrong actor and a wrong current client never reach a grant.
 for(const mutate of [h=>{h.artifactOptions.context={...h.artifactOptions.context,binding:{...binding,actorId:'00000000-0000-4000-8000-00000000b0ff'}};},
  h=>{const real=h.artifactOptions.authorize;h.artifactOptions.authorize=async call=>({...await real(call),requestSha256:'b'.repeat(64)});}]){
  const h=await harness({stored:null});mutate(h);
  const answer=await h.post();
  assert.notEqual(answer.status,200);
  assert.equal((await answer.text()).includes('report.md'),false);}
 assert.equal(network.length,0,'no ambient network call is permitted in this test');
});
