/** Capture trusted owners; reuse canonical session freshness, not a policy engine. */
import {types} from 'node:util';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {admitDocumentDescriptor} from './format-admission.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createRequestCurrent,same} from '../action-host/current.mjs';
import {fail} from './http.mjs';
export {data,own,same,v};
const portCodes=new Set(['ACCESS_DENIED','SESSION_REFUSED','DEADLINE','CANCELLED','UNAVAILABLE','ARTIFACT_DEADLINE','ARTIFACT_CANCELLED','ARTIFACT_EFFECT_UNKNOWN','ARTIFACT_BUDGET_RESERVATION_UNKNOWN','ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN']);
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
 const c=own(value,['sessions','selectedClientId','artifactOptions','credential','now','limits'],['enabled','admitPdf','previewOptions']);
 const o=own(c.artifactOptions,['pool','allocationJson','producerContext','descriptor','context','validators','authority','authorize','versions','objects','executor','now','ids','newReservationId','limits'],['sourceEnabled','namespace','retention']);
 if(o.retention!==undefined&&typeof o.retention?.assertServable!=='function')fail('DOCUMENT_CONFIGURATION',500);
 const limits=documentLimits(c.limits);
 if(typeof c.now!=='function'||c.now!==o.now||o.validators!==v||typeof c.credential!=='string'||!c.credential||c.credential.length>4096||typeof(c.enabled??false)!=='boolean'||typeof(c.admitPdf??false)!=='boolean'||typeof(o.sourceEnabled??false)!=='boolean'||o.namespace!==undefined&&!['qualification','product'].includes(o.namespace))fail('DOCUMENT_CONFIGURATION',500);
 const context=data(v.context(o.context)),formatAdmission=admitDocumentDescriptor(o.descriptor,{pdf:c.admitPdf??false}),descriptor=formatAdmission.descriptor;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(c.selectedClientId??'')||!context.scopes.some(s=>s.kind==='client'&&s.resourceId.toLowerCase()===c.selectedClientId))fail('DOCUMENT_CONFIGURATION',500);
 for(const fn of ['authorize','ids','newReservationId'])if(typeof o[fn]!=='function')fail('DOCUMENT_CONFIGURATION',500);
 const options={...o,authorize:asyncPort(o.authorize),ids:syncPort(o.ids),newReservationId:syncPort(o.newReservationId),context,descriptor,producerContext:data(o.producerContext),limits:data(o.limits),
  authority:{check:method(o.authority,'check')},versions:{read:method(o.versions,'read'),commit:method(o.versions,'commit')},
  objects:{get:method(o.objects,'get'),put:method(o.objects,'put')},executor:{execute:method(o.executor,'execute')}};
 return {sessions:{authenticateSession:method(c.sessions,'authenticateSession'),readCurrentState:method(c.sessions,'readCurrentState')},
  options,formatAdmission,limits,now:c.now,credential:c.credential,selectedClientId:c.selectedClientId,enabled:c.enabled??false,previewOptions:c.previewOptions};
}
export function requestCurrent(config,info,life,deadlineMs){
 const context=config.options.context;let cutoff=deadlineMs;
 const ports=Object.fromEntries(Object.entries(config.sessions).map(([name,fn])=>[name,call=>fn({...call,deadlineMs:Math.min(call.deadlineMs,cutoff)})]));
 const current=createRequestCurrent({credential:info.credential,deadlineMs,signal:info.signal,ports,now:config.now,maxBytes:config.limits.maxResponseBytes,
  commandContext:{binding:context.binding,clientResolution:{reference:config.selectedClientId,clientId:config.selectedClientId}}});
 const check=()=>current.check(life);
 const clip=deadline=>{if(!Number.isSafeInteger(deadline))fail('ACCESS_DENIED',403);cutoff=Math.min(cutoff,deadline);life.limitDeadline(cutoff);check();};
 async function fresh(){const facts=await current.fresh(life);if(!same(facts.current.binding,context.binding)||!same(facts.current.scopes,context.scopes)||facts.current.selectedClientId!==config.selectedClientId)fail('ACCESS_DENIED',403);check();return facts;}
 const authority={check:asyncPort(async call=>{
  await fresh();clip(call.deadlineMs??current.deadline());
  const value=data(await life.run(signal=>config.options.authority.check({...call,signal,limitDeadline:deadline=>{clip(deadline);call.limitDeadline?.(deadline);}})));
  clip(value.deadlineMs);clip(Date.parse(value.claims?.expiresAt));await fresh();return value;
 })};
 async function authorize(call){
  clip(call.deadlineMs);await fresh();
  const result=data(await life.run(signal=>config.options.authorize({...call,signal,deadlineMs:Math.min(call.deadlineMs,Math.min(cutoff,current.deadline()))})));
  clip(result.expiresAtMs);await fresh();return result;
 }
 return {fresh,check,authority,authorize:asyncPort(authorize)};
}
