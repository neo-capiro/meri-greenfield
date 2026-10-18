/** Core artifact authority: the trusted in-process `authority` that `../product-ports/documents.mjs` composes into the late-bound
 * `artifactOptionsOwner`. Contract: docs/integration/ARTIFACT-CURRENT-AUTHORITY-CONTRACT.md.
 *
 * `resolve({sessions,credential,intent,body,requestSha256,deadlineMs,signal})` -> `{artifactOptions,selectedClientId,credential,limits,
 * enabled,recheck}` or null. One current-authority OBSERVATION is, in order and fail closed:
 *  1. Meri-local session: control's own action-session owner authenticates the caller's action session and reads its current
 *     binding, scopes and selected client (each read re-verifies identity/context at Core through the session owner);
 *  2. native bearer (RC1 option A): the run's live action-session native credential for exactly that binding and client, admitted
 *     only when it is not a marked candidate credential or the service secret, and looked up again after the service-secret read;
 *  3. Core receipt: POST /api/clio/application-authority/artifact with that bearer and the verified service identity, correlated,
 *     bounded and joined to the session (tenant/actor = principal, conversation, selected client, intent operations).
 * The first observation pins every authority fact (binding, scopes, client, principal, identity/context/authority revisions,
 * operations, limits). `recheck` (called by the runtime application at admission, around every effect and before release) makes a
 * NEW observation and refuses ACCESS_DENIED unless the pin is unchanged. `authorize` (the artifact service's per-action decision) is
 * synchronous over the latest observation: the action must be one the intent needs AND one Core currently allows, for the pinned
 * binding and scopes, and its receipt expires no later than that observation.
 *
 * Meri-local and NOT Core facts (dot, PR #121 6246642210): the run allocation, producer context, operation descriptor, evidence,
 * assets, output ceiling, the run capability (`credential`) and its `authority.check` come from the injected `runOptions.read` owner;
 * pool/versions/objects/executor are substituted by the documents composer. The native bearer never enters `artifactOptions` or
 * `credential`. */
import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {INTENT_OPERATIONS,ArtifactAuthorityError,isArtifactAuthorityError,refuse} from './core-authority-wire.mjs';

const SHA=/^[0-9a-f]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const PHASES=Object.freeze(['admission','effect','release']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const lifeError=code=>new ArtifactAuthorityError(['DEADLINE','CANCELLED'].includes(code)?code:'ACCESS_DENIED');
/** Session-owner refusals stay SESSION_REFUSED; every other foreign error becomes the given closed code. */
function closedError(error,fallback){
 if(isArtifactAuthorityError(error))return error;
 let code=null;try{if(error&&typeof error==='object'&&!types.isProxy(error))code=Object.getOwnPropertyDescriptor(error,'code')?.value??null;}catch{}
 return new ArtifactAuthorityError(['SESSION_REFUSED','SESSION_UNAVAILABLE'].includes(code)?(code==='SESSION_REFUSED'?'SESSION_REFUSED':'UNAVAILABLE'):fallback);
}
/** An own (or inherited, non-proxy) data-property function, captured once and called with its owner as receiver. */
function capture(port,name,code='ARTIFACT_AUTHORITY_CONFIGURATION'){
 if(!port||typeof port!=='object'||types.isProxy(port))refuse(code);
 let cursor=port,d;for(let depth=0;cursor!==null&&depth<32&&!d;depth++){if(types.isProxy(cursor))refuse(code);d=Object.getOwnPropertyDescriptor(cursor,name);cursor=Object.getPrototypeOf(cursor);}
 if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))refuse(code);
 const fn=d.value;return (...args)=>Reflect.apply(fn,port,args);
}
function documentLimits(value){
 let l;try{l=data(own(value,['maxRequestMs','maxRequestBytes','maxResponseBytes']));}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 if(Object.values(l).some(n=>!Number.isSafeInteger(n)||n<1)||l.maxRequestMs>60000||l.maxRequestBytes>2097152||l.maxResponseBytes>16777216)refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 return l;
}

export function createCoreArtifactAuthority(configuration){
 let c;try{c=own(configuration,['client','credentials','runOptions','now','limits'],['newId']);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const read=capture(c.client,'read'),serviceSecret=capture(c.credentials,'serviceSecret'),admitBearer=capture(c.credentials,'admitBearer'),readRunOptions=capture(c.runOptions,'read');
 const origin=c.client.origin,now=c.now,newId=c.newId??randomUUID,limits=documentLimits(c.limits);
 if(typeof origin!=='string'||typeof now!=='function'||types.isProxy(now)||typeof newId!=='function')refuse('ARTIFACT_AUTHORITY_CONFIGURATION');

 /** One full current-authority observation inside `life`. */
 async function observe(ports,{credential,intent,requestSha256},life){
  let state;
  try{
   const authentication=await life.run(signal=>ports.authenticateSession({credential,signal,deadlineMs:life.deadline()}));
   state=data(await life.run(signal=>ports.readCurrentState({authentication,signal,deadlineMs:life.deadline()})));
  }catch(error){throw closedError(error,'SESSION_REFUSED');}
  try{
   own(state,['authenticationSha256','binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']);validateShape('RunBinding',state.binding);
   if(!Array.isArray(state.scopes)||state.scopes.length<1||state.scopes.length>100)throw Error();
   for(const scope of state.scopes){validateShape('Scope',scope);if(scope.tenantId!==state.binding.tenantId)throw Error();}
   const clients=state.scopes.filter(scope=>scope.kind==='client');
   if(typeof state.selectedClientId!=='string'||!UUID.test(state.selectedClientId)||clients.length!==1||clients[0].resourceId.toLowerCase()!==state.selectedClientId||
    !Number.isSafeInteger(state.expiresAtMs)||state.expiresAtMs<=now())throw Error();
  }catch{refuse('SESSION_REFUSED');}
  life.limitDeadline(state.expiresAtMs);
  const lookup=signal=>{let issued;try{issued=data(own(ports.nativeCredentialFor({binding:state.binding,selectedClientId:state.selectedClientId,signal}),['credential','expiresAtMs']));}catch{refuse('UNAVAILABLE');}
   if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('UNAVAILABLE');return issued;};
  const issued=lookup(life.signal);life.limitDeadline(issued.expiresAtMs);
  let secret;try{secret=await life.run(()=>serviceSecret());}catch(error){throw closedError(error,'UNAVAILABLE');}
  const bearer=admitBearer(issued.credential,secret);
  // The service-secret read awaited: the same live session must still hold the same bearer (not expired, revoked or replaced).
  const again=lookup(life.signal);if(again.credential!==bearer)refuse('UNAVAILABLE');life.limitDeadline(again.expiresAtMs);
  let observation;
  try{observation=await life.run(signal=>read({bearer,serviceSecret:secret,request:{conversationId:state.binding.conversationId,clientId:state.selectedClientId,intent,requestSha256},deadlineMs:life.deadline(),signal}));}
  catch(error){throw closedError(error,'UNAVAILABLE');}
  const r=observation.receipt;
  if(r.principal.tenantId!==state.binding.tenantId||r.principal.actorId!==state.binding.actorId||r.conversationId!==state.binding.conversationId||r.selectedClientId!==state.selectedClientId)refuse('ACCESS_DENIED');
  const expiresAtMs=Math.min(observation.localExpiresAtMs,issued.expiresAtMs,again.expiresAtMs,state.expiresAtMs);
  life.check();if(expiresAtMs<=now())refuse('ACCESS_DENIED');
  const pin=canonicalSha256({binding:state.binding,scopes:state.scopes,selectedClientId:state.selectedClientId,principal:r.principal,identityRevision:r.identityRevision,
   contextRevision:r.contextRevision,operations:r.operations,limits:r.limits,authorityRevision:r.authorityRevision});
  return Object.freeze({binding:state.binding,scopes:state.scopes,selectedClientId:state.selectedClientId,receipt:r,bearerSha256:sha(bearer),checkedAtMs:observation.observedAtMs,expiresAtMs,pin});
 }
 function lifetime(deadlineMs,signal){
  let cutoff=deadlineMs;const t=createOperationLifetime({deadlineMs,now,signal,errorFactory:lifeError});
  return {...t,deadline:()=>cutoff,limitDeadline(next){if(next<cutoff){cutoff=next;t.limitDeadline(next);}else t.check();}};
 }
 function sessionPorts(sessions){
  try{return {authenticateSession:capture(sessions,'authenticateSession'),readCurrentState:capture(sessions,'readCurrentState'),nativeCredentialFor:capture(sessions,'nativeCredentialFor')};}
  catch{refuse('UNAVAILABLE');}
 }

 async function resolve(raw){
  let call;try{call=own(raw,['sessions','credential','intent','body','requestSha256','deadlineMs'],['signal']);nativeSignal(call.signal);}catch{refuse('ACCESS_DENIED');}
  if(typeof call.credential!=='string'||!TOKEN.test(call.credential))refuse('SESSION_REFUSED');
  if(!Object.hasOwn(INTENT_OPERATIONS,call.intent)||typeof call.requestSha256!=='string'||!SHA.test(call.requestSha256)||!Number.isSafeInteger(call.deadlineMs))refuse('ACCESS_DENIED');
  let body;try{body=data(call.body);if(canonicalSha256({intent:call.intent,body})!==call.requestSha256)throw Error();}catch{refuse('ACCESS_DENIED');}
  if(call.signal?.aborted)refuse('CANCELLED');if(call.deadlineMs<=now())refuse('DEADLINE');
  const ports=sessionPorts(call.sessions),request={credential:call.credential,intent:call.intent,requestSha256:call.requestSha256},required=INTENT_OPERATIONS[call.intent];
  const life=lifetime(call.deadlineMs,call.signal);
  try{
   const first=await observe(ports,request,life);
   const authority=data({operations:first.receipt.operations,limits:first.receipt.limits,expiresAtMs:first.expiresAtMs});
   let supplied;
   try{supplied=await life.run(signal=>readRunOptions({binding:first.binding,scopes:first.scopes,selectedClientId:first.selectedClientId,intent:call.intent,body,requestSha256:call.requestSha256,authority,signal,deadlineMs:life.deadline()}));}
   catch(error){throw closedError(error,'UNAVAILABLE');}
   if(supplied===null)return null;
   let o;try{o=own(supplied,['allocationJson','producerContext','descriptor','evidence','assets','maxBytes','authority','credential'],['sourceEnabled']);}catch{refuse('UNAVAILABLE');}
   if(typeof o.allocationJson!=='string'||o.allocationJson.length<2||Buffer.byteLength(o.allocationJson)>1048576||typeof o.credential!=='string'||!TOKEN.test(o.credential)||o.credential.length>4096||
    sha(o.credential)===first.bearerSha256||!Number.isSafeInteger(o.maxBytes)||o.maxBytes<1||o.sourceEnabled!==undefined&&typeof o.sourceEnabled!=='boolean')refuse('UNAVAILABLE');
   const maxBytes=Math.min(o.maxBytes,first.receipt.limits?.maxArtifactBytes??Infinity,limits.maxResponseBytes);
   let context;try{context=v.context({binding:first.binding,scopes:first.scopes,evidence:data(o.evidence),assets:data(o.assets),deadlineMs:call.deadlineMs,maxBytes});}catch{refuse('UNAVAILABLE');}
   life.check();
   let latest=first;
   async function authorize(value){
    let a;try{a=own(value,['action','resource','requestSha256','binding','scopes','deadlineMs'],['signal']);nativeSignal(a.signal);}catch{refuse('ACCESS_DENIED');}
    if(a.signal?.aborted)refuse('CANCELLED');
    const current=latest,at=now();
    if(!required.includes(a.action)||!current.receipt.operations.includes(a.action)||typeof a.requestSha256!=='string'||!SHA.test(a.requestSha256)||!Number.isSafeInteger(a.deadlineMs))refuse('ACCESS_DENIED');
    let resourceSha256;try{if(canonicalSha256(a.binding)!==canonicalSha256(first.binding)||canonicalSha256(a.scopes)!==canonicalSha256(first.scopes))throw Error();resourceSha256=v.hash(a.resource);}catch{refuse('ACCESS_DENIED');}
    const expiresAtMs=Math.min(current.expiresAtMs,a.deadlineMs);if(!Number.isSafeInteger(at)||expiresAtMs<=at)refuse('ACCESS_DENIED');
    return data({receiptId:newId(),decision:'allow',action:a.action,binding:first.binding,scopesSha256:v.hash(first.scopes),resourceSha256,requestSha256:a.requestSha256,expiresAtMs});
   }
   async function recheck(value){
    let k;try{k=own(value,['phase','intent','requestSha256','resource','deadlineMs'],['signal']);nativeSignal(k.signal);}catch{refuse('ACCESS_DENIED');}
    if(!PHASES.includes(k.phase)||k.intent!==call.intent||k.requestSha256!==call.requestSha256||!Number.isSafeInteger(k.deadlineMs))refuse('ACCESS_DENIED');
    if(k.signal?.aborted)refuse('CANCELLED');if(k.deadlineMs<=now())refuse('DEADLINE');
    const t=lifetime(k.deadlineMs,k.signal);
    try{
     const next=await observe(ports,request,t);
     if(next.pin!==first.pin||next.bearerSha256===sha(o.credential))refuse('ACCESS_DENIED');
     if(next.checkedAtMs>=latest.checkedAtMs)latest=next;
     return Object.freeze({phase:k.phase,checkedAtMs:next.checkedAtMs,expiresAtMs:next.expiresAtMs});
    }catch(error){throw closedError(error,'ACCESS_DENIED');}finally{t.close();}
   }
   const artifactOptions={pool:null,allocationJson:o.allocationJson,producerContext:o.producerContext,descriptor:o.descriptor,context,validators:v,
    authority:o.authority,authorize,versions:null,objects:null,executor:null,now,
    ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),newReservationId:()=>randomUUID(),
    limits:{maxRequestMs:limits.maxRequestMs,maxResponseBytes:limits.maxResponseBytes},...(o.sourceEnabled===undefined?{}:{sourceEnabled:o.sourceEnabled})};
   return {artifactOptions,selectedClientId:first.selectedClientId,credential:o.credential,limits:{...limits},enabled:true,recheck};
  }catch(error){throw closedError(error,'ACCESS_DENIED');}finally{life.close();}
 }
 return Object.freeze({origin,now,resolve});
}
