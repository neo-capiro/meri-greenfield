/** Capture trusted owners; reuse canonical session freshness, not a policy engine. */
import {types} from 'node:util';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {admitDocumentFormats} from './format-admission.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {same} from '../action-host/current.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {fail} from './http.mjs';
export {data,own,same,v};
const portCodes=new Set(['ACCESS_DENIED','SESSION_REFUSED','DEADLINE','CANCELLED','UNAVAILABLE','ARTIFACT_DEADLINE','ARTIFACT_CANCELLED','ARTIFACT_EFFECT_UNKNOWN','ARTIFACT_REPLAY_UNRESOLVED','CONFLICT','ENOENT','RETENTION_SUPPRESSED','RETENTION_RECOVERY_BARRIER','RETENTION_READ_UNAVAILABLE']);
function portError(error){
 let code='DOCUMENT_PORT_REFUSED';
 if(error&&typeof error==='object'&&!types.isProxy(error)){const d=Object.getOwnPropertyDescriptors(error),candidate=d.code?.value??d.message?.value;if(portCodes.has(candidate))code=candidate;}
 return Object.assign(new Error(code),{code});
}
const asyncPort=fn=>async(...args)=>{try{return await fn(...args);}catch(error){throw portError(error);}};
const syncPort=fn=>(...args)=>{try{return fn(...args);}catch(error){throw portError(error);}};
/** An own data-property method of a borrowed port, captured once; its rejections become inert closed codes. */
export function method(value,key){
 if(!value||typeof value!=='object'||types.isProxy(value))fail('DOCUMENT_CONFIGURATION',500);
 const d=Object.getOwnPropertyDescriptor(value,key);
 if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')fail('DOCUMENT_CONFIGURATION',500);
 return asyncPort(d.value.bind(value));
}
export function documentLimits(value){
 const limits=data(value);own(limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']);
 if(Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<1)||limits.maxRequestMs>60000||limits.maxRequestBytes>2097152||limits.maxResponseBytes>16777216)fail('DOCUMENT_CONFIGURATION',500);
 return limits;
}
export function configuration(value){
 const c=own(value,['sessions','selectedClientId','artifactOptions','now','limits'],['enabled','admitPdf','previewOptions','nativeFiles']);
 const o=own(c.artifactOptions,['pool','context','validators','authorize','versions','objects','executor','now','ids'],['retention','admitRetainedEvidence','selectedInvocationId','authorizeOrigin','retainedAssetMapWrites']);
 if(o.authorizeOrigin!==undefined&&(typeof o.authorizeOrigin!=='function'||types.isProxy(o.authorizeOrigin)))fail('DOCUMENT_CONFIGURATION',500);
 if(o.retention!==undefined&&typeof o.retention?.assertServable!=='function')fail('DOCUMENT_CONFIGURATION',500);
 if(o.admitRetainedEvidence!==undefined&&(typeof o.admitRetainedEvidence!=='function'||types.isProxy(o.admitRetainedEvidence)))fail('DOCUMENT_CONFIGURATION',500);
 // The deployment's private write activation for the retained asset map: a boolean when present, and it is
 // never a callable or a request-supplied value. Absent/false keeps the writer from emitting a new map.
 if(typeof(o.retainedAssetMapWrites??false)!=='boolean')fail('DOCUMENT_CONFIGURATION',500);
 const limits=documentLimits(c.limits),context=v.context(o.context);assertNativeConversationScope({...context,selectedClientId:c.selectedClientId});
 if(c.now!==o.now||typeof c.now!=='function'||o.validators!==v||typeof o.authorize!=='function'||typeof o.ids!=='function'||typeof(c.enabled??false)!=='boolean'||typeof(c.admitPdf??false)!=='boolean')fail('DOCUMENT_CONFIGURATION',500);
 const options={...o,context,...(o.authorizeOrigin?{authorizeOrigin:asyncPort(o.authorizeOrigin)}:{}),...(o.admitRetainedEvidence?{admitRetainedEvidence:syncPort(o.admitRetainedEvidence)}:{}),authorize:asyncPort(o.authorize),ids:syncPort(o.ids),
  versions:{read:method(o.versions,'read'),commit:method(o.versions,'commit'),...(o.versions.history?{history:method(o.versions,'history')}:{}),...(o.versions.list?{list:method(o.versions,'list')}:{}),...(o.versions.recoverTenant?{recoverTenant:method(o.versions,'recoverTenant')}:{})},
  objects:{get:method(o.objects,'get'),put:method(o.objects,'put')},executor:{execute:method(o.executor,'execute')}};
 return {sessions:{authenticateSession:method(c.sessions,'authenticateSession'),readCurrentState:method(c.sessions,'readCurrentState')},
  options,formatAdmission:admitDocumentFormats({pdf:c.admitPdf??false}),limits,now:c.now,selectedClientId:c.selectedClientId,enabled:c.enabled??false,previewOptions:c.previewOptions,
  nativeFiles:c.nativeFiles===undefined?null:{read:method(c.nativeFiles,'read')}};
}
export function requestCurrent(config,info,life,deadlineMs){
 const context=config.options.context;let cutoff=deadlineMs,identity=null;
 const check=()=>{life.check();if(config.now()>=cutoff)fail('DEADLINE',408);};
 const clip=ms=>{if(!Number.isSafeInteger(ms)||ms<=config.now())fail('ACCESS_DENIED',403);cutoff=Math.min(cutoff,ms);life.limitDeadline(cutoff);check();};
 async function fresh(){
  const started=config.now(),authentication=data(await life.run(signal=>config.sessions.authenticateSession({credential:info.credential,signal,deadlineMs:cutoff})));
  own(authentication,['principal','sessionRevision','checkedAtMs','expiresAtMs']);own(authentication.principal,['sessionId','tenantId','actorId','conversationId','runId']);
  if(!Number.isSafeInteger(authentication.checkedAtMs)||authentication.checkedAtMs<started||authentication.checkedAtMs>config.now()||Object.values(authentication.principal).some(x=>typeof x!=='string'||!x)||typeof authentication.sessionRevision!=='string'||!authentication.sessionRevision)fail('ACCESS_DENIED',403);
  const who={principal:authentication.principal,sessionRevision:authentication.sessionRevision};if(identity&&!same(identity,who))fail('ACCESS_DENIED',403);identity??=who;clip(authentication.expiresAtMs);
  if(['tenantId','actorId','conversationId','runId'].some(k=>authentication.principal[k]!==context.binding[k]))fail('ACCESS_DENIED',403);
  const at=config.now(),current=data(await life.run(signal=>config.sessions.readCurrentState({authentication,signal,deadlineMs:cutoff})));
  own(current,['authenticationSha256','binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']);assertNativeConversationScope(current);
  if(current.authenticationSha256!==v.hash(authentication)||!same(current.binding,context.binding)||!same(current.scopes,context.scopes)||current.selectedClientId!==config.selectedClientId||!Number.isSafeInteger(current.checkedAtMs)||current.checkedAtMs<at||current.checkedAtMs>config.now())fail('ACCESS_DENIED',403);
  clip(current.expiresAtMs);return {authentication,current};
 }
 async function authorize(call){clip(call.deadlineMs);await fresh();const result=data(await life.run(signal=>config.options.authorize({...call,signal,deadlineMs:cutoff})));clip(result.expiresAtMs);check();return result;}
 return {fresh,check,authorize:asyncPort(authorize)};
}
