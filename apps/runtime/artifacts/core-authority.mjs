/** Current Core artifact permission plus the canonical accepted conversation run. No execution grants or allocation registry. */
import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {INTENT_OPERATIONS,ArtifactAuthorityError,isArtifactAuthorityError,refuse} from './core-authority-wire.mjs';

const SHA=/^[0-9a-f]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const PHASES=Object.freeze(['admission','effect','release']);
const RETAINED_READ_INTENTS=Object.freeze(['inspect','history','list','results','download','preview']);
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
 let c;try{c=own(configuration,['client','credentials','now','limits','maxOutputBytes'],['newId']);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const read=capture(c.client,'read'),serviceSecret=capture(c.credentials,'serviceSecret'),admitBearer=capture(c.credentials,'admitBearer');
 const origin=c.client.origin,now=c.now,newId=c.newId??randomUUID,limits=documentLimits(c.limits);
 if(!Number.isSafeInteger(c.maxOutputBytes)||c.maxOutputBytes<1||c.maxOutputBytes>16777216||typeof origin!=='string'||typeof now!=='function'||types.isProxy(now)||typeof newId!=='function')refuse('ARTIFACT_AUTHORITY_CONFIGURATION');

 /** One full current-authority observation inside `life`. */
 async function observe(ports,{credential,intent,requestSha256},life,source=null){
  let state;
  try{
   const authentication=await life.run(signal=>ports.authenticateSession({credential,signal,deadlineMs:life.deadline()}));
   state=data(await life.run(signal=>ports.readCurrentState({authentication,signal,deadlineMs:life.deadline()})));
  }catch(error){throw closedError(error,'SESSION_REFUSED');}
  try{
   own(state,['authenticationSha256','binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']);validateShape('RunBinding',state.binding);
   if(!Array.isArray(state.scopes)||state.scopes.length<1||state.scopes.length>100)throw Error();
   for(const scope of state.scopes){validateShape('Scope',scope);if(scope.tenantId!==state.binding.tenantId)throw Error();}
   assertNativeConversationScope(state);
   if(!Number.isSafeInteger(state.expiresAtMs)||state.expiresAtMs<=now())throw Error();
  }catch{refuse('SESSION_REFUSED');}
  life.limitDeadline(state.expiresAtMs);
  const lookup=signal=>{let issued;try{issued=data(own(ports.nativeCredentialFor({binding:state.binding,selectedClientId:state.selectedClientId,signal}),['credential','expiresAtMs']));}catch{refuse('UNAVAILABLE');}
   if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('UNAVAILABLE');return issued;};
  const issued=lookup(life.signal);life.limitDeadline(issued.expiresAtMs);
  let secret;try{secret=await life.run(()=>serviceSecret());}catch(error){throw closedError(error,'UNAVAILABLE');}
  const bearer=admitBearer(issued.credential,secret);
  // The service-secret read awaited: the same live session must still hold the same bearer (not expired, revoked or replaced).
  const again=lookup(life.signal);if(again.credential!==bearer)refuse('UNAVAILABLE');life.limitDeadline(again.expiresAtMs);
  const selected=source??{conversationId:state.binding.conversationId,clientId:state.selectedClientId};
  let observation;
  try{observation=await life.run(signal=>read({bearer,serviceSecret:secret,request:{conversationId:selected.conversationId,clientId:selected.clientId,...(selected.clientId===null?{scopeKind:'general'}:{}),intent,requestSha256},deadlineMs:life.deadline(),signal}));}
  catch(error){throw closedError(error,'UNAVAILABLE');}
  const r=observation.receipt;
  if(r.principal.tenantId!==state.binding.tenantId||r.principal.actorId!==state.binding.actorId||r.conversationId!==selected.conversationId||r.selectedClientId!==selected.clientId)refuse('ACCESS_DENIED');
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
  let call;try{call=own(raw,['sessions','store','credential','intent','body','requestSha256','deadlineMs'],['signal']);nativeSignal(call.signal);}catch{refuse('ACCESS_DENIED');}
  if(typeof call.credential!=='string'||!TOKEN.test(call.credential))refuse('SESSION_REFUSED');
  if(!Object.hasOwn(INTENT_OPERATIONS,call.intent)||typeof call.requestSha256!=='string'||!SHA.test(call.requestSha256)||!Number.isSafeInteger(call.deadlineMs))refuse('ACCESS_DENIED');
  let body;try{body=data(call.body);if(canonicalSha256({intent:call.intent,body})!==call.requestSha256)throw Error();}catch{refuse('ACCESS_DENIED');}
  if(call.signal?.aborted)refuse('CANCELLED');if(call.deadlineMs<=now())refuse('DEADLINE');
  const ports=sessionPorts(call.sessions),request={credential:call.credential,intent:call.intent,requestSha256:call.requestSha256},required=INTENT_OPERATIONS[call.intent];
  const life=lifetime(call.deadlineMs,call.signal);
  try{
   const first=await observe(ports,request,life);
   const readRunOptional=capture(call.store,'readOptional');
   /** The canonical accepted conversation run. A binding the conversation owner admitted for a turn that has not been
    * submitted yet has no run row of its own; explicit retained reads are then pinned to the
    * conversation by the fresh Core observation above and by the artifact owner's own version context (identical
    * tenant/actor/conversation/scopes), exactly as a prior-run version read is. Cancellation does not suppress an
    * already published artifact; publication, retention and release checks remain the artifact owner's responsibility.
    * Generation, revision and derived-preview publication still require the session's own non-cancelled accepted run. */
   const conversationRead=RETAINED_READ_INTENTS.includes(call.intent);
   async function canonicalRun(observation,t){
    const saved=await t.run(()=>readRunOptional(observation.binding,{limit:1},t.check));
    if(saved===null){if(!conversationRead)refuse('ACCESS_DENIED');return null;}
    if(canonicalSha256(saved.run?.binding)!==canonicalSha256(observation.binding)||canonicalSha256(saved.run.scopes)!==canonicalSha256(observation.scopes)||saved.run.state==='cancelled'&&!conversationRead)refuse('ACCESS_DENIED');
    return saved.run;
   }
   await canonicalRun(first,life);
   const maxBytes=Math.min(c.maxOutputBytes,first.receipt.limits?.maxArtifactBytes??Infinity,limits.maxResponseBytes);
   // Typed document content is self-contained. Evidence/assets are never supplied by the public request.
   const context=v.context({binding:first.binding,scopes:first.scopes,evidence:[],assets:[],deadlineMs:life.deadline(),maxBytes});
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
     await canonicalRun(next,t);
     if(next.pin!==first.pin)refuse('ACCESS_DENIED');
     if(next.checkedAtMs>=latest.checkedAtMs)latest=next;
     return Object.freeze({phase:k.phase,checkedAtMs:next.checkedAtMs,expiresAtMs:next.expiresAtMs});
    }catch(error){throw closedError(error,'ACCESS_DENIED');}finally{t.close();}
   }
   // Request-local, phase-separated observations: two documents from one origin
   // share its actual Core read, but release never reuses admission authority.
   const originObservations=new Map();
   async function authorizeOrigin(raw){
    let q,version,selectedClientId;
    try{
     q=own(raw,['phase','version','deadlineMs'],['signal']);nativeSignal(q.signal);version=v.version(q.version);
     if(call.intent!=='list'||!['admission','release'].includes(q.phase)||!Number.isSafeInteger(q.deadlineMs)||
      version.binding.tenantId!==first.binding.tenantId||version.binding.actorId!==first.binding.actorId||version.scopes.length!==1||
      version.scopes[0].policyRevision!==first.scopes[0].policyRevision||v.hash(version.object.scopes)!==v.hash(version.scopes))throw Error();
     const scope=version.scopes[0];selectedClientId=scope.kind==='private-user'?null:scope.kind==='client'?scope.resourceId:undefined;
     assertNativeConversationScope({binding:version.binding,scopes:version.scopes,selectedClientId});
    }catch{refuse('ACCESS_DENIED');}
    if(q.signal?.aborted)refuse('CANCELLED');
    const t=lifetime(Math.min(q.deadlineMs,context.deadlineMs),q.signal),source={conversationId:version.binding.conversationId,clientId:selectedClientId};
    try{
     t.check();const key=v.hash({phase:q.phase,source,scopes:version.scopes});
     if(!originObservations.has(key)){
      const pending=(async()=>{
       const observed=await observe(ports,{...request,requestSha256:v.hash({requestSha256:call.requestSha256,phase:q.phase,source,scopes:version.scopes})},t,source);
       await canonicalRun(observed,t);
       if(v.hash(observed.binding)!==v.hash(first.binding)||v.hash(observed.scopes)!==v.hash(first.scopes)||
        observed.receipt.identityRevision!==first.receipt.identityRevision)refuse('ACCESS_DENIED');
       return data({principal:observed.receipt.principal,conversationId:source.conversationId,selectedClientId,
        identityRevision:observed.receipt.identityRevision,contextRevision:observed.receipt.contextRevision,
        checkedAtMs:observed.checkedAtMs,expiresAtMs:observed.expiresAtMs});
      })();
      originObservations.set(key,pending);
     }
     const observed=await t.run(()=>originObservations.get(key)),expiresAtMs=Math.min(observed.expiresAtMs,t.deadline());
     t.check();if(expiresAtMs<=now())refuse('ACCESS_DENIED');
     return data({...observed,versionSha256:v.hash(version),scopesSha256:v.hash(version.scopes),expiresAtMs});
    }catch(error){throw closedError(error,'UNAVAILABLE');}finally{t.close();}
   }
   const artifactOptions={pool:null,context,validators:v,authorize,...(call.intent==='list'?{authorizeOrigin}:{}),versions:null,objects:null,executor:null,now,
    ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})};
   return {artifactOptions,selectedClientId:first.selectedClientId,limits:{...limits},enabled:true,recheck};
  }catch(error){throw closedError(error,'ACCESS_DENIED');}finally{life.close();}
 }
 return Object.freeze({origin,now,resolve});
}
