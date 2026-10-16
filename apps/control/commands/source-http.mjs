/** Fixed governed command routes. Preparation reads credentials/metadata only. Attachment registration belongs to execute,
 * after the canonical executor has claimed the command, reserved its budget and rechecked current effect authority.
 * No ambient credentials, redirects or retries. */
import {types} from 'node:util';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError,data,deny,nativeSignal,own,safe} from './protocol.mjs';
import {commandSourceBody,commandSourceResult,commandSourceTool} from './source-projection.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const cancel=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{});}catch{}};
const responseGet=(value,key)=>{if(!value||types.isProxy(value)||!(value instanceof Response))deny('INVALID_SOURCE_RESULT');return Object.getOwnPropertyDescriptor(Response.prototype,key).get.call(value);};
export function createCommandHttpSource(options){
 const {origin,getCredentials,resolveAttachments,fetchImpl,now,maxResponseBytes}=own(options,['origin','getCredentials','fetchImpl','now','maxResponseBytes'],['resolveAttachments']);
 if(typeof origin!=='string'||typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16*1024*1024)deny('COMMAND_CONFIGURATION');
 let base;try{base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin||base.username||base.password)deny('COMMAND_CONFIGURATION');}catch{deny('COMMAND_CONFIGURATION');}
 const retained=new WeakMap();
 function lifetime(deadlineMs,signal){nativeSignal(signal);return createOperationLifetime({deadlineMs,signal,now,errorFactory:code=>new CommandError(code)});}
 async function prepare(value){
  const c=own(value,['command','context','authority','deadlineMs','signal']);const command=data(c.command),context=data(c.context),authority=data(c.authority);
  const tool=commandSourceTool(command.action);
  // No credentials, journal claim or source call for incompatible personal auto-commit.
  if(command.action==='memory.propose'&&command.arguments.scope==='personal')deny('PENDING_PRODUCER_UNAVAILABLE');
  let deadlineMs=c.deadlineMs;const life=lifetime(deadlineMs,c.signal);
  try{
   const credentials=data(await life.run(signal=>getCredentials({binding:authority.binding,subject:authority.subject,commandSha256:canonicalSha256(command),deadlineMs,signal})));
   own(credentials,['binding','bearerToken','serviceSecret','expiresAtMs']);
   if(!same(credentials.binding,authority.binding)||!Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=now()||![credentials.bearerToken,credentials.serviceSecret].every(s=>typeof s==='string'&&s.length>0&&s.length<=8192&&/^[\x21-\x7e]+$/.test(s)))deny('COMMAND_SOURCE_IDENTITY_REFUSED');
   deadlineMs=Math.min(deadlineMs,credentials.expiresAtMs);life.limitDeadline(deadlineMs);
   life.check();if(life.signal.aborted)deny('CANCELLED');
   const token=Object.freeze({deadlineMs});retained.set(token,{command,context,authority,credentials,tool});return token;
  }catch(error){throw safe(error);}finally{life.close();}
 }
 async function execute(token,value){
  if(!retained.has(token))deny('COMMAND_SOURCE_PREPARATION_REFUSED');const prepared=retained.get(token);retained.delete(token);
  const c=own(value,['authority','signal']),authority=data(c.authority);
  if(!same(authority.binding,prepared.authority.binding)||authority.policyRevision!==prepared.authority.policyRevision||authority.claims.capabilityId!==prepared.authority.claims.capabilityId)deny('COMMAND_SOURCE_IDENTITY_REFUSED');
  const life=lifetime(Math.min(token.deadlineMs,authority.deadlineMs),c.signal);let body,reader;
  try{
   const {command,context}=prepared;let deadlineMs=Math.min(token.deadlineMs,authority.deadlineMs);
   let attachments=[];
   if(command.action==='artifact.file'){
    if(typeof resolveAttachments!=='function')deny('COMMAND_SOURCE_VERSION_UNAVAILABLE');
    const fact=data(await life.run(signal=>resolveAttachments({objects:command.attachments,destination:context.destination,binding:authority.binding,deadlineMs,signal})));
    own(fact,['binding','destination','expiresAtMs','objects']);
    if(!same(fact.binding,authority.binding)||!same(fact.destination,context.destination)||!Number.isSafeInteger(fact.expiresAtMs)||fact.expiresAtMs<=now()||!Array.isArray(fact.objects)||fact.objects.length!==command.attachments.length)deny('COMMAND_SOURCE_VERSION_REFUSED');
    const ids=new Set(),objects=new Set();
    for(const row of fact.objects){own(row,['object','attachmentId']);validateShape('ObjectReference',row.object);const hash=canonicalSha256(row.object);
     if(typeof row.attachmentId!=='string'||!uuid.test(row.attachmentId)||ids.has(row.attachmentId.toLowerCase())||objects.has(hash)||!command.attachments.some(o=>same(o,row.object)))deny('COMMAND_SOURCE_VERSION_REFUSED');
     ids.add(row.attachmentId.toLowerCase());objects.add(hash);
    }
    attachments=fact.objects;deadlineMs=Math.min(deadlineMs,fact.expiresAtMs);life.limitDeadline(deadlineMs);
   }
   const requestBody=JSON.stringify(commandSourceBody(command,attachments));if(Buffer.byteLength(requestBody)>maxResponseBytes)deny('COMMAND_RESOURCE_LIMIT');
   const response=await life.run(async signal=>{
    const r=await fetchImpl(new URL(`/clio/tools/${prepared.tool}`,base).href,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:`Bearer ${prepared.credentials.bearerToken}`,'x-internal-service-secret':prepared.credentials.serviceSecret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:requestBody});
    try{life.check();if(life.signal.aborted)deny('CANCELLED');return r;}catch(error){try{cancel(responseGet(r,'body'));}catch{}throw error;}
   });
   body=responseGet(response,'body');const headers=responseGet(response,'headers');
   if(responseGet(response,'status')!==200||responseGet(response,'redirected')||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(headers.get('content-type')??'')||![null,'identity'].includes(headers.get('content-encoding')))deny('INVALID_SOURCE_RESULT');
   const length=headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxResponseBytes))deny('COMMAND_RESOURCE_LIMIT');
   if(!body)deny('INVALID_SOURCE_RESULT');reader=body.getReader();let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
   for(;;){const part=await life.run(()=>reader.read());if(part.done)break;if(!(part.value instanceof Uint8Array))deny('INVALID_SOURCE_RESULT');bytes+=part.value.byteLength;if(bytes>maxResponseBytes)deny('COMMAND_RESOURCE_LIMIT');text+=decoder.decode(part.value,{stream:true});}
   text+=decoder.decode();if(length!==null&&bytes!==Number(length))deny('INVALID_SOURCE_RESULT');life.check();if(life.signal.aborted)deny('CANCELLED');
   return commandSourceResult(JSON.parse(text),prepared.command,attachments);
  }catch(error){if(error?.code==='ARTIFACT_EFFECT_UNKNOWN')deny('COMMAND_OUTCOME_UNKNOWN');throw safe(error);}finally{if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}try{reader.releaseLock();}catch{}}else cancel(body);life.close();}
 }
 return Object.freeze({prepare,execute});
}
