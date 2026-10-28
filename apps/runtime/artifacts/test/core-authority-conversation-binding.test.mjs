/** A reopened conversation whose current turn is an admitted reservation (nothing submitted yet) still reads its own
 * retained prepared documents. SYNTHETIC only: scripted Core replies over an in-memory fetch, control's real
 * process-local action-session owner, a scripted conversation store that keeps the canonical store's "no run row for
 * an unsubmitted binding" semantics, and placeholder credentials. No network, AWS, database or real credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createCoreArtifactAuthorityClient} from '../core-authority-client.mjs';
import {createCoreArtifactAuthority} from '../core-authority.mjs';
import {ARTIFACT_AUTHORITY_CONTRACT,ARTIFACT_AUTHORITY_ROUTE} from '../core-authority-wire.mjs';
const ORIGIN='https://core.synthetic.invalid',SECRET='synthetic-core-service-secret',BEARER='synthetic-native-bearer-1';
const ids={tenantId:'00000000-0000-4000-8000-00000000b001',actorId:'00000000-0000-4000-8000-00000000b002',conversationId:'00000000-0000-4000-8000-00000000b003',
 clientId:'00000000-0000-4000-8000-00000000b004',acceptedRunId:'00000000-0000-4000-8000-00000000b005',reservedRunId:'00000000-0000-4000-8000-00000000b006'};
const binding=runId=>({tenantId:ids.tenantId,actorId:ids.actorId,conversationId:ids.conversationId,runId,attemptId:'00000000-0000-4000-8000-00000000b007',workerId:'00000000-0000-4000-8000-00000000b008',writerFence:1});
const scopes=[{tenantId:ids.tenantId,kind:'client',resourceId:ids.clientId,policyRevision:'p'.repeat(64)}];
const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576};
const rev=label=>canonicalSha256({synthetic:label});
const code=c=>e=>{assert.equal(e?.code,c,`expected ${c}, got ${e?.code} (${e?.message})`);return true;};

function scriptedCore(state={}){const core={calls:0,bearers:new Set([BEARER]),status:200,principal:{tenantId:ids.tenantId,actorId:ids.actorId}};
 core.fetch=async(url,init)=>{core.calls++;const request=JSON.parse(init.body);
  assert.equal(url,ORIGIN+ARTIFACT_AUTHORITY_ROUTE);assert.equal(init.method,'POST');
  assert.equal(init.headers['x-internal-service-secret'],SECRET);
  if(!core.bearers.has(init.headers.authorization.slice(7)))return Response.json({message:'unauthenticated'},{status:401});
  if(core.status!==200)return Response.json({message:'unavailable'},{status:core.status});
  const checkedAtMs=Date.now();
  return Response.json({contract:ARTIFACT_AUTHORITY_CONTRACT,observationId:request.observationId,principal:core.principal,identityRevision:rev('identity'),conversationId:request.conversationId,
   selectedClientId:request.clientId,contextRevision:rev('context'),intent:request.intent,requestSha256:request.requestSha256,operations:state.operations??['artifact.download','artifact.inspect'],
   limits:state.coreLimits??null,authorityRevision:rev('authority'),checkedAtMs,expiresAtMs:checkedAtMs+60000});};
 return core;}

/** The canonical store's own semantics for the two reads the authority may use: `read` refuses a binding with no run row
 * (postgres-store readState), `readOptional` answers null for it. `stored` is the row, or null for an unsubmitted binding. */
function scriptedStore({stored,readOptional=true}){const store={calls:[],async read(){store.calls.push('read');throw Object.assign(Error('STORE_CORRUPT'),{code:'STORE_CORRUPT'});}};
 if(readOptional)store.readOptional=async()=>{store.calls.push('readOptional');return stored;};
 return store;}

async function harness({stored,readOptional=true,now=Date.now,operations}={}){
 const store=scriptedStore({stored,readOptional});
 const resolvedBinding=binding(ids.reservedRunId);
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:4,maxRequestMs:3000,maxTtlMs:60000,maxFactBytes:65536},
  async verifyIdentity({credential}){if(credential!==BEARER)throw Error('SYNTHETIC_IDENTITY_REFUSED');return {principal:{tenantId:ids.tenantId,actorId:ids.actorId},identityRevision:'synthetic-identity-1',checkedAtMs:now(),expiresAtMs:now()+60000};},
  // The conversation owner admitted this binding for a turn that has not been submitted yet: no run row exists.
  async resolveContext({identity,identitySha256}){if(identitySha256!==canonicalSha256(identity))throw Error('SYNTHETIC');return {identitySha256,binding:structuredClone(resolvedBinding),scopes:structuredClone(scopes),selectedClientId:ids.clientId,contextRevision:'synthetic-context-1',checkedAtMs:now(),expiresAtMs:now()+60000};}});
 const issued=await sessions.issue({identityCredential:BEARER});
 const core=scriptedCore({operations});
 const credentials={async serviceSecret(){return SECRET;},admitBearer(bearer,secret){if(bearer===secret)throw Object.assign(Error('UNAVAILABLE'),{code:'UNAVAILABLE'});return bearer;}};
 const client=createCoreArtifactAuthorityClient({origin:ORIGIN,fetchImpl:core.fetch,now});
 const authority=createCoreArtifactAuthority({client,credentials,now,limits,maxOutputBytes:limits.maxResponseBytes});
 const intent='download',body={versionId:'00000000-0000-4000-8000-00000000b009'},requestSha256=canonicalSha256({intent,body});
 return {store,sessions,core,authority,binding:resolvedBinding,intent,body,requestSha256,
  call:(extra={})=>{const next={intent,body,...extra};return {sessions,store,credential:issued.credential,deadlineMs:now()+5000,...next,requestSha256:canonicalSha256({intent:next.intent,body:next.body})};},now};
}
const row=r=>({run:r});

test('a binding admitted for a not-yet-submitted turn resolves the conversation\'s document read instead of ACCESS_DENIED',async()=>{
 const h=await harness({stored:null});
 const resolved=await h.authority.resolve(h.call());
 assert.equal(typeof resolved.recheck,'function');assert.equal(resolved.selectedClientId,ids.clientId);
 assert.deepEqual(resolved.artifactOptions.context.binding,h.binding,'the admitted binding is the pinned context binding');
 assert.deepEqual(resolved.artifactOptions.context.scopes,scopes);
 assert.deepEqual(h.store.calls,['readOptional'],'only the optional conversation read is consulted; the strict row read is never reached');
 assert.equal(h.core.calls,1,'one fresh Core observation');
 // The same gate is applied on the admission/effect/release rechecks.
 const r=await resolved.recheck({phase:'release',intent:h.intent,requestSha256:h.requestSha256,resource:null,deadlineMs:h.now()+4000});
 assert.equal(h.core.calls,2);assert.ok(r.expiresAtMs>h.now());
});

for(const intent of ['history','list','results'])test(`${intent}: current conversation read works after a run, never admits generation, and rechecks revocation`,async()=>{
 const h=await harness({stored:null}),call=h.call({intent,body:intent==='history'?{versionId:'00000000-0000-4000-8000-00000000b009',limit:25,cursor:null}:{scope:'conversation',limit:25,cursor:null}});
 const resolved=await h.authority.resolve(call),context=resolved.artifactOptions.context;
 const authorization={action:'artifact.inspect',resource:null,requestSha256:call.requestSha256,binding:context.binding,scopes:context.scopes,deadlineMs:h.now()+4000};
 assert.equal((await resolved.artifactOptions.authorize(authorization)).decision,'allow');
 await assert.rejects(resolved.artifactOptions.authorize({...authorization,action:'artifact.generate'}),code('ACCESS_DENIED'));
 await assert.rejects(resolved.artifactOptions.authorize({...authorization,action:'artifact.revise'}),code('ACCESS_DENIED'));
 h.core.status=403;
 await assert.rejects(resolved.recheck({phase:'release',intent,requestSha256:call.requestSha256,resource:null,deadlineMs:h.now()+4000}),code('ACCESS_DENIED'));
 assert.deepEqual(h.store.calls,['readOptional'],'no new run or write allocation');
});

test('a stored run keeps the exact binding and scope checks',async()=>{
 const run={...binding(ids.acceptedRunId),state:'completed',scopes:structuredClone(scopes)};
 const same=await harness({stored:row({...run,binding:structuredClone(binding(ids.reservedRunId))})});
 assert.equal((await same.authority.resolve(same.call())).selectedClientId,ids.clientId);
 for(const [label,mutate] of [
  ['another actor',r=>({...r,binding:{...r.binding,actorId:'00000000-0000-4000-8000-00000000b0ff'}})],
  ['another conversation',r=>({...r,binding:{...r.binding,conversationId:'00000000-0000-4000-8000-00000000b0fe'}})],
  ['changed scopes',r=>({...r,scopes:[{...scopes[0],policyRevision:'q'.repeat(64)}]})],
 ]){const h=await harness({stored:row(mutate({...run,binding:structuredClone(binding(ids.reservedRunId))}))});
  await assert.rejects(h.authority.resolve(h.call()),code('ACCESS_DENIED'),label);
  assert.equal(h.core.calls,1,'Core is still the first observation');}
});

for(const [intent,action] of [['inspect','artifact.inspect'],['history','artifact.inspect'],['list','artifact.inspect'],['results','artifact.inspect'],['download','artifact.download'],['preview','artifact.download']])
test(`${intent}: retained reads survive terminal origins but fresh release authority still governs`,async()=>{
 for(const state of ['completed','failed','cancelled']){
  const stored=row({binding:binding(ids.reservedRunId),scopes:structuredClone(scopes),state});
  const h=await harness({stored}),call=h.call({intent}),resolved=await h.authority.resolve(call),context=resolved.artifactOptions.context;
  const authorization={action,resource:null,requestSha256:call.requestSha256,binding:context.binding,scopes:context.scopes,deadlineMs:h.now()+4000};
  assert.equal((await resolved.artifactOptions.authorize(authorization)).decision,'allow');
  for(const action of ['artifact.generate','artifact.revise','artifact.preview-publish'])
   await assert.rejects(resolved.artifactOptions.authorize({...authorization,action}),code('ACCESS_DENIED'));
  stored.run.state='cancelled';
  const release={phase:'release',intent,requestSha256:call.requestSha256,resource:null,deadlineMs:h.now()+4000};
  await resolved.recheck(release);
  assert.equal(h.core.calls,2,'release freshly observes current Core authority even after cancellation');
  h.core.status=403;
  await assert.rejects(resolved.recheck(release),code('ACCESS_DENIED'));
  assert.ok(h.store.calls.every(call=>call==='readOptional'),'read admission never creates a run');
 }
});

for(const intent of ['create','revise','preview-publish'])test(`${intent}: a cancelled or absent run never admits a write, including at release`,async()=>{
 const operations=['artifact.download','artifact.generate','artifact.inspect','artifact.preview-publish','artifact.revise'];
 for(const stored of [null,row({binding:binding(ids.reservedRunId),scopes:structuredClone(scopes),state:'cancelled'})]){
  const h=await harness({stored,operations});
  await assert.rejects(h.authority.resolve(h.call({intent})),code('ACCESS_DENIED'));
 }
 const stored=row({binding:binding(ids.reservedRunId),scopes:structuredClone(scopes),state:'completed'}),h=await harness({stored,operations});
 const call=h.call({intent}),resolved=await h.authority.resolve(call);
 stored.run.state='cancelled';
 await assert.rejects(resolved.recheck({phase:'effect',intent,requestSha256:call.requestSha256,resource:null,deadlineMs:h.now()+4000}),code('ACCESS_DENIED'));
});

test('the gate stays closed: no optional read, Core refusal, or a different principal',async()=>{
 const noRead=await harness({stored:null,readOptional:false});
 await assert.rejects(noRead.authority.resolve(noRead.call()),code('ARTIFACT_AUTHORITY_CONFIGURATION'),'a store that cannot answer the conversation read is refused, never treated as empty');
 const write=await harness({stored:null});
 await assert.rejects(write.authority.resolve(write.call({intent:'create',body:{synthetic:true}})),code('ACCESS_DENIED'),'generation still requires the session\'s own accepted run');
 await assert.rejects(write.authority.resolve(write.call({intent:'revise',body:{synthetic:true}})),code('ACCESS_DENIED'),'revision still requires the session\'s own accepted run');
 const denied=await harness({stored:null});denied.core.status=403;
 await assert.rejects(denied.authority.resolve(denied.call()),code('ACCESS_DENIED'));
 const foreign=await harness({stored:null});foreign.core.principal={tenantId:ids.tenantId,actorId:'00000000-0000-4000-8000-00000000b0ff'};
 await assert.rejects(foreign.authority.resolve(foreign.call()),code('ACCESS_DENIED'),'Core principal must still join the session');
 const revoked=await harness({stored:null});revoked.sessions.revoke((await revoked.call()).credential);
 await assert.rejects(revoked.authority.resolve(revoked.call()),code('SESSION_REFUSED'),'a revoked action session never reaches the conversation read');
});
