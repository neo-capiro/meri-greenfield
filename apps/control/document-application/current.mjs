/** Capture trusted owners; reuse canonical session freshness, not a policy engine. */
import {types} from 'node:util';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createRequestCurrent,same} from '../action-host/current.mjs';
import {fail} from './http.mjs';
export {data,own,same,v};
function method(value,key){
 if(!value||typeof value!=='object'||types.isProxy(value))fail('DOCUMENT_CONFIGURATION',500);
 const d=Object.getOwnPropertyDescriptor(value,key);
 if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')fail('DOCUMENT_CONFIGURATION',500);
 return d.value.bind(value);
}
export function configuration(value){
 const c=own(value,['sessions','selectedClientId','artifactOptions','credential','now','limits'],['enabled']);
 const o=own(c.artifactOptions,['pool','allocationJson','producerContext','descriptor','context','validators','authority','authorize','versions','objects','executor','now','ids','newReservationId','limits'],['sourceEnabled']);
 const limits=data(c.limits);own(limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']);
 if(Object.values(limits).some(n=>!Number.isSafeInteger(n)||n<1)||limits.maxRequestMs>60000||limits.maxRequestBytes>2097152||limits.maxResponseBytes>16777216||typeof c.now!=='function'||c.now!==o.now||o.validators!==v||typeof c.credential!=='string'||!c.credential||c.credential.length>4096||typeof(c.enabled??false)!=='boolean'||typeof(o.sourceEnabled??false)!=='boolean')fail('DOCUMENT_CONFIGURATION',500);
 const context=data(v.context(o.context)),descriptor=data(o.descriptor);
 const entry=catalog.operations.find(e=>e.operation.id==='create_word'),canonicalDescriptor={operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};
 if(!same(descriptor,canonicalDescriptor))fail('DOCUMENT_CONFIGURATION',500);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(c.selectedClientId??'')||!context.scopes.some(s=>s.kind==='client'&&s.resourceId.toLowerCase()===c.selectedClientId)||descriptor.operation?.id!=='create_word'||descriptor.operation?.version!=='0.2.0')fail('DOCUMENT_CONFIGURATION',500);
 for(const fn of ['authorize','ids','newReservationId'])if(typeof o[fn]!=='function')fail('DOCUMENT_CONFIGURATION',500);
 const options={...o,context,descriptor,producerContext:data(o.producerContext),limits:data(o.limits),
  authority:{check:method(o.authority,'check')},versions:{read:method(o.versions,'read'),commit:method(o.versions,'commit')},
  objects:{get:method(o.objects,'get'),put:method(o.objects,'put')},executor:{execute:method(o.executor,'execute')}};
 return {sessions:{authenticateSession:method(c.sessions,'authenticateSession'),readCurrentState:method(c.sessions,'readCurrentState')},
  options,limits,now:c.now,credential:c.credential,selectedClientId:c.selectedClientId,enabled:c.enabled??false};
}
export function requestCurrent(config,info,life,deadlineMs){
 const context=config.options.context;let cutoff=deadlineMs;
 const ports=Object.fromEntries(Object.entries(config.sessions).map(([name,fn])=>[name,call=>fn({...call,deadlineMs:Math.min(call.deadlineMs,cutoff)})]));
 const current=createRequestCurrent({credential:info.credential,deadlineMs,signal:info.signal,ports,now:config.now,maxBytes:config.limits.maxResponseBytes,
  commandContext:{binding:context.binding,clientResolution:{reference:config.selectedClientId,clientId:config.selectedClientId}}});
 const check=()=>current.check(life);
 const clip=deadline=>{if(!Number.isSafeInteger(deadline))fail('ACCESS_DENIED',403);cutoff=Math.min(cutoff,deadline);life.limitDeadline(cutoff);check();};
 async function fresh(){const facts=await current.fresh(life);if(!same(facts.current.binding,context.binding)||!same(facts.current.scopes,context.scopes)||facts.current.selectedClientId!==config.selectedClientId)fail('ACCESS_DENIED',403);check();return facts;}
 const authority={async check(call){
  await fresh();clip(call.deadlineMs??current.deadline());
  const value=data(await life.run(signal=>config.options.authority.check({...call,signal,limitDeadline:deadline=>{clip(deadline);call.limitDeadline?.(deadline);}})));
  clip(value.deadlineMs);clip(Date.parse(value.claims?.expiresAt));await fresh();return value;
 }};
 async function authorize(call){
  clip(call.deadlineMs);await fresh();
  const result=data(await life.run(signal=>config.options.authorize({...call,signal,deadlineMs:Math.min(call.deadlineMs,Math.min(cutoff,current.deadline()))})));
  clip(result.expiresAtMs);await fresh();return result;
 }
 return {fresh,check,authority,authorize};
}
