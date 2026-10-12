import {types} from 'node:util';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {snapshotOperationData} from '../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
export const operation=Object.freeze({id:'actions.query',version:'0.2.0'});
const contract=resolveOperationContract(operation);
export const deny=code=>{throw Object.assign(new Error(code),{code});};
export function data(value){const copy=snapshotOperationData(value);const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};return freeze(copy);}
export function options(value,required,optional=[]){if(!value||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)deny('LOOKUP_DATA');const out={};for(const k of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,k);if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))deny('LOOKUP_DATA');out[k]=d.value;}return keys(out,required,optional);}
export function keys(v,required,optional=[]){if(!v||typeof v!=='object'||Array.isArray(v)||required.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>![...required,...optional].includes(k)))deny('LOOKUP_DATA');return v;}
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export const uuid=v=>{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))deny('LOOKUP_DATA');return v;};
export const digest=v=>{if(typeof v!=='string'||!/^[0-9a-f]{64}$/.test(v))deny('LOOKUP_DATA');return v;};
export function method(v,name){if(!v||types.isProxy(v))deny('LOOKUP_CONFIGURATION');let p=v;while(p){const d=Object.getOwnPropertyDescriptor(p,name);if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function')deny('LOOKUP_CONFIGURATION');return d.value.bind(v);}p=Object.getPrototypeOf(p);if(p&&types.isProxy(p))deny('LOOKUP_CONFIGURATION');}deny('LOOKUP_CONFIGURATION');}
export function code(error){if(!error||types.isProxy(error)||typeof error!=='object')return null;const d=Object.getOwnPropertyDescriptor(error,'code');return d&&Object.hasOwn(d,'value')&&typeof d.value==='string'?d.value:null;}
function scopes(values,tenant){if(!Array.isArray(values)||!values.length||values.length>100)deny('LOOKUP_DATA');for(const s of values){validateShape('Scope',s);if(s.tenantId!==tenant)deny('LOOKUP_BINDING');}if(new Set(values.map(canonicalSha256)).size!==values.length)deny('LOOKUP_DATA');}
function deadline(ms,now){if(!Number.isSafeInteger(now)||!Number.isSafeInteger(ms)||ms<=now||ms-now>60000)deny('DEADLINE');}
export function prepare(request,context,now){
 const r=data(request),c=data(context);keys(r,[],['actionItemId','status','sort','limit','cursor']);
 keys(c,['lookupId','resultReference','requestId','binding','scopes','selectedClientId','deliveryJson','slots','deadlineMs']);
 for(const id of ['lookupId','resultReference','requestId','selectedClientId'])uuid(c[id]);validateShape('RunBinding',c.binding);scopes(c.scopes,c.binding.tenantId);deadline(c.deadlineMs,now);
 if(!c.scopes.some(s=>s.kind==='client'&&s.resourceId.toLowerCase()===c.selectedClientId.toLowerCase()))deny('LOOKUP_BINDING');
 keys(c.slots,['started','terminal']);for(const slot of Object.values(c.slots)){keys(slot,['eventId','sequence']);uuid(slot.eventId);if(!Number.isSafeInteger(slot.sequence)||slot.sequence<1)deny('LOOKUP_DATA');}
 if(c.slots.started.sequence>=c.slots.terminal.sequence||c.slots.started.eventId.toLowerCase()===c.slots.terminal.eventId.toLowerCase())deny('LOOKUP_DATA');
 if(typeof c.deliveryJson!=='string'||Buffer.byteLength(c.deliveryJson)>65536)deny('LOOKUP_DATA');
 let delivery;try{delivery=data(JSON.parse(c.deliveryJson));}catch{deny('LOOKUP_DATA');}
 keys(delivery,['context','producer','deliveryId']);if(!same(delivery.context.binding,c.binding))deny('LOOKUP_BINDING');
 const args={...r,clientId:c.selectedClientId.toLowerCase()},options={binding:c.binding,clientResolution:{reference:args.clientId,clientId:args.clientId}};
 const normalized=contract.normalizeInput(args,options),requestValue={operation,arguments:args};
 return data({context:c,request:requestValue,argumentsSha256:normalized.argumentsSha256,bindingSha256:canonicalSha256({context:c,request:requestValue})});
}
export function readContext(context,now){const c=data(context);keys(c,['currentBinding','scopes','deadlineMs']);validateShape('RunBinding',c.currentBinding);scopes(c.scopes,c.currentBinding.tenantId);deadline(c.deadlineMs,now);return c;}
export function event(b,type,at,resultReference){
 if(!Number.isSafeInteger(at))deny('LOOKUP_CLOCK');const c=b.context,slot=type==='tool.started'?c.slots.started:c.slots.terminal;
 const value={contractVersion:'0.1.0',eventId:slot.eventId,binding:c.binding,sequence:slot.sequence,createdAt:new Date(at).toISOString(),scopes:c.scopes,type,data:type==='tool.started'?{requestId:c.requestId,tool:'actions.query@0.2.0'}:type==='tool.completed'?{requestId:c.requestId,resultReference}:{code:'ACTION_LOOKUP_UNAVAILABLE',retryable:false,message:'Action recommendation lookup could not be delivered.'}};
 validateShape('UIEvent',value);return data(value);
}
export function observation(raw,b){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>16*1024*1024)deny('LOOKUP_RESULT');let out;try{out=data(JSON.parse(raw));}catch{deny('LOOKUP_RESULT');}
 keys(out,['binding','subject','operation','argumentsSha256','result']);const c=b.context;
 if(!same(out.binding,c.binding)||!same(out.operation,operation)||out.argumentsSha256!==b.argumentsSha256)deny('LOOKUP_RESULT');
 const args=b.request.arguments;contract.assertOutput(out.result,{request:args,binding:c.binding,clientResolution:{reference:args.clientId,clientId:args.clientId}});
 if(!same(out.subject,out.result.subject)||out.subject.tenantId!==c.binding.tenantId||out.subject.actorId!==c.binding.actorId)deny('LOOKUP_RESULT');
 return out;
}
export function authBinding(original,current,scopeValues,resultReference,resultSha256){const b={original,current,scopes:scopeValues,resultReference,resultSha256};return data({...b,bindingSha256:canonicalSha256(b)});}
export function authReceipt(value,b){const a=data(value);keys(a,['authorized','bindingSha256','expiresAtMs']);if(a.authorized!==true||a.bindingSha256!==b.bindingSha256||!Number.isSafeInteger(a.expiresAtMs))deny('ACCESS_DENIED');return a;}
export function receipt(value,b,state){const r=data(value);keys(r,['lookupId','bindingSha256','state']);if(r.lookupId!==b.context.lookupId||r.bindingSha256!==b.bindingSha256||r.state!==state)deny('LOOKUP_STORE_UNKNOWN');return r;}
export function storedBinding(value){const b=data(value);keys(b,['context','request','argumentsSha256','bindingSha256']);if(!same(b,prepare(Object.fromEntries(Object.entries(b.request.arguments).filter(([k])=>k!=='clientId')),b.context,b.context.deadlineMs-1)))deny('LOOKUP_STORE_UNKNOWN');return b;}
export function storedEvent(value,b,type){const e=data(value);if(!same(e,event(b,type,Date.parse(e.createdAt),b.context.resultReference)))deny('LOOKUP_STORE_UNKNOWN');return e;}
export function retained(value){const r=data(value);keys(r,['binding','observation','resultSha256','events']);const b=storedBinding(r.binding);digest(r.resultSha256);if(!same(observation(JSON.stringify(r.observation),b),r.observation)||canonicalSha256(r.observation)!==r.resultSha256||!Array.isArray(r.events)||r.events.length!==2)deny('LOOKUP_STORE_UNKNOWN');for(const [i,type]of ['tool.started','tool.completed'].entries()){const time=Date.parse(r.events[i].createdAt);if(!same(r.events[i],event(b,type,time,b.context.resultReference)))deny('LOOKUP_STORE_UNKNOWN');}return r;}
export function delivery(r,include=false){const b=r.binding;return data({lookupId:b.context.lookupId,resultReference:b.context.resultReference,resultSha256:r.resultSha256,classification:'recommendations',acceptedTasks:false,events:r.events,...(include?{observation:r.observation}:{})});}
export {canonicalSha256};
