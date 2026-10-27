/** Synthetic current-origin observations through the actual Core wire/client and action-session owner.
 * No network, database, provider call, execution allocation, or real credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createCoreArtifactAuthorityClient} from '../core-authority-client.mjs';
import {createCoreArtifactAuthority} from '../core-authority.mjs';
const ids={tenantId:randomUUID(),actorId:randomUUID(),conversationId:randomUUID(),clientId:randomUUID()};
const binding={...ids,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};delete binding.clientId;
const scopes=[{tenantId:ids.tenantId,kind:'client',resourceId:ids.clientId,policyRevision:'current-policy'}];
const copy=structuredClone,code=expected=>error=>{assert.equal(error.code,expected);return true;};
const SECRET='synthetic-service-secret',BEARER='synthetic-native-bearer',ORIGIN='https://core.synthetic.invalid';
function version({conversationId=randomUUID(),clientId=randomUUID()}={}){
 const sourceScopes=[{...scopes[0],kind:clientId===null?'private-user':'client',resourceId:clientId??ids.actorId}];
 return {contractVersion:'0.1.0',artifactId:randomUUID(),versionId:randomUUID(),parentVersionId:null,
  binding:{...binding,conversationId,runId:randomUUID()},object:{objectId:randomUUID(),versionId:'immutable-object',sha256:'a'.repeat(64),bytes:20,scopes:copy(sourceScopes)},
  filename:'Draft.txt',mimeType:'text/plain; charset=utf-8',scopes:sourceScopes,evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt:'2026-10-27T00:00:00.000Z'};
}
async function harness(intent='list'){
 let clock=100000;const now=()=>clock,core={calls:[],status:200,mutate:receipt=>receipt,park:false};
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:4,maxRequestMs:3000,maxTtlMs:60000,maxFactBytes:65536},
  async verifyIdentity({credential}){assert.equal(credential,BEARER);return {principal:{tenantId:ids.tenantId,actorId:ids.actorId},identityRevision:'identity',checkedAtMs:now(),expiresAtMs:now()+60000};},
  async resolveContext({identity,identitySha256}){assert.equal(identitySha256,hash(identity));return {identitySha256,binding:copy(binding),scopes:copy(scopes),selectedClientId:ids.clientId,contextRevision:'context',checkedAtMs:now(),expiresAtMs:now()+60000};}});
 const issued=await sessions.issue({identityCredential:BEARER});
 const client=createCoreArtifactAuthorityClient({origin:ORIGIN,now,fetchImpl:async(url,init)=>{
  assert.equal(url,ORIGIN+'/api/clio/application-authority/artifact');assert.equal(init.headers.authorization,'Bearer '+BEARER);assert.equal(init.headers['x-internal-service-secret'],SECRET);
  const request=JSON.parse(init.body);core.calls.push(request);
  if(core.park)return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
  if(core.status!==200)return Response.json({message:'synthetic denial'},{status:core.status});
  const receipt={contract:request.contract,observationId:request.observationId,principal:{tenantId:ids.tenantId,actorId:ids.actorId},identityRevision:hash('identity'),
   conversationId:request.conversationId,selectedClientId:request.clientId,...(request.scopeKind===undefined?{}:{scopeKind:request.scopeKind}),contextRevision:hash(request.conversationId),
   intent:request.intent,requestSha256:request.requestSha256,operations:['artifact.download','artifact.inspect'],limits:null,authorityRevision:hash('authority'),checkedAtMs:now(),expiresAtMs:now()+60000};
  return Response.json(core.mutate(receipt));}});
 const authority=createCoreArtifactAuthority({client,credentials:{async serviceSecret(){return SECRET;},admitBearer:bearer=>bearer},now,
  limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},maxOutputBytes:1048576});
 const body=intent==='list'?{scope:'owner',limit:25,cursor:null}:{versionId:randomUUID()},store={calls:0,async readOptional(){this.calls++;return null;}};
 const result=await authority.resolve({sessions,store,credential:issued.credential,intent,body,requestSha256:hash({intent,body}),deadlineMs:now()+5000});
 return {core,sessions,store,result,now,tick:()=>{clock++;},revoke:()=>sessions.revoke(issued.credential),
  call:(v,phase='admission',extra={})=>result.artifactOptions.authorizeOrigin({phase,version:v,deadlineMs:now()+4000,...extra})};
}

test('same owner library authorizes each real client/General origin with live caller identity and preserves source bytes',async()=>{
 const h=await harness();
 for(const source of [version(),version({clientId:null})]){
  const before=JSON.stringify(source),receipt=await h.call(source),request=h.core.calls.at(-1);
  assert.equal(request.conversationId,source.binding.conversationId);assert.equal(request.clientId,source.scopes[0].kind==='client'?source.scopes[0].resourceId:null);
  assert.equal(receipt.versionSha256,hash(source));assert.equal(receipt.scopesSha256,hash(source.scopes));assert.equal(receipt.conversationId,source.binding.conversationId);
  assert.deepEqual(receipt.principal,{tenantId:ids.tenantId,actorId:ids.actorId});assert.equal(receipt.checkedAtMs,h.now());assert.ok(receipt.expiresAtMs<=h.now()+4000);
  assert.equal(JSON.stringify(source),before);assert.equal(request.scopeKind,source.scopes[0].kind==='client'?undefined:'general');
 }
 assert.equal(h.core.calls.length,3);assert.equal(h.store.calls,3,'optional current-run reads only; no allocation or generation');
});

test('origin observations are request-local, deduplicated per phase, and never restamped or shared with release',async()=>{
 const h=await harness(),first=version(),second={...copy(first),artifactId:randomUUID(),versionId:randomUUID()};
 const admitted=await h.call(first);h.tick();const reused=await h.call(second);
 assert.equal(h.core.calls.length,2);assert.equal(reused.checkedAtMs,admitted.checkedAtMs);assert.notEqual(reused.versionSha256,admitted.versionSha256);
 const released=await h.call(second,'release');assert.equal(h.core.calls.length,3);assert.equal(released.checkedAtMs,h.now());assert.notEqual(released.checkedAtMs,admitted.checkedAtMs);
 h.tick();assert.equal((await h.call(first,'release')).checkedAtMs,released.checkedAtMs);assert.equal(h.core.calls.length,3);
 const separate=await harness();await separate.call(first);assert.equal(separate.core.calls.length,2);
});

for(const [name,mutate]of Object.entries({
 'another owner':v=>{v.binding.actorId=randomUUID();},
 'another tenant':v=>{v.binding.tenantId=randomUUID();},
 'stale policy':v=>{v.scopes[0].policyRevision='old-policy';v.object.scopes=copy(v.scopes);},
 'foreign private scope':v=>{v.scopes=[{...scopes[0],kind:'private-user',resourceId:randomUUID()}];v.object.scopes=copy(v.scopes);},
 'ambiguous scopes':v=>{v.scopes.push({...v.scopes[0],resourceId:randomUUID()});v.object.scopes=copy(v.scopes);},
 'object scope mismatch':v=>{v.object.scopes=copy(scopes);},
}))test(`source ${name} is refused before a Core origin read`,async()=>{
 const h=await harness(),source=version();mutate(source);await assert.rejects(h.call(source),code('ACCESS_DENIED'));assert.equal(h.core.calls.length,1);
});

for(const [name,status,expected]of [['membership/client/wall/colleague denial',403,'ACCESS_DENIED'],['native authentication denial',401,'SESSION_REFUSED'],['unavailable',503,'UNAVAILABLE']])
 test(`Core ${name} never becomes an allowed or silently omitted unknown observation`,async()=>{
  const h=await harness();h.core.status=status;await assert.rejects(h.call(version()),code(expected));assert.equal(h.core.calls.length,2);
 });

for(const [name,mutate]of Object.entries({
 'principal':r=>({...r,principal:{...r.principal,actorId:randomUUID()}}),
 'origin':r=>({...r,conversationId:randomUUID()}),
 'client':r=>({...r,selectedClientId:randomUUID()}),
 'identity revision':r=>({...r,identityRevision:hash('revoked-membership')}),
 'missing inspect operation':r=>({...r,operations:['artifact.download']}),
}))test(`current ${name} mismatch cannot release origin metadata`,async()=>{
 const h=await harness();h.core.mutate=mutate;await assert.rejects(h.call(version()),code('ACCESS_DENIED'));
});

test('release rechecks revoked access; revoked sessions, expired deadlines and cancellation remain closed',async()=>{
 const h=await harness(),source=version();await h.call(source);h.core.status=403;
 await assert.rejects(h.call(source,'release'),code('ACCESS_DENIED'));
 const revoked=await harness();revoked.revoke();await assert.rejects(revoked.call(source),code('SESSION_REFUSED'));assert.equal(revoked.core.calls.length,1);
 const expired=await harness();await assert.rejects(expired.call(source,'admission',{deadlineMs:expired.now()}),code('DEADLINE'));
 const cancelled=await harness(),controller=new AbortController();controller.abort();await assert.rejects(cancelled.call(source,'admission',{signal:controller.signal}),code('CANCELLED'));
 const pending=await harness(),abort=new AbortController();pending.core.park=true;const attempt=pending.call(source,'admission',{signal:abort.signal});
 setTimeout(()=>abort.abort(),10);await assert.rejects(attempt,code('CANCELLED'));
});

test('ordinary inspect/history/download do not receive an origin bypass callback and phase/extra authority selectors are closed',async()=>{
 for(const intent of ['inspect','history','download'])assert.equal((await harness(intent)).result.artifactOptions.authorizeOrigin,undefined);
 const h=await harness();await assert.rejects(h.call(version(),'effect'),code('ACCESS_DENIED'));
 await assert.rejects(h.call(version(),'admission',{actorId:ids.actorId}),code('ACCESS_DENIED'));
});
