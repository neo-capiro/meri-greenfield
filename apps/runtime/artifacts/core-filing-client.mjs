/** Fixed Core upload and approved-filing transport. No retry, ambient identity or new custody store.
 * Core must enable its existing native approval execute/read owners for artifact.file before this is mounted.
 * Upload carries the original approved filing context and preserves the ordinary response plus sha256/bytes.
 * Core must derive/reuse stable staged attachment identity from that context, verify bytes and own idempotency.
 * These receiver extensions are deliberately not simulated as available by production composition. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertProposalIntegrity,canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertArtifactFileCommand} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../../gateway/sources/json-response.mjs';
import {artifactAuthorityOrigin} from './core-authority-client.mjs';
import {nativeApprovalScope} from '../native-authority/approval-session.mjs';
import {nativeArtifactFileOutcome} from '../../control/intents/filing-outcome.mjs';

export const CORE_FILING_ROUTES=Object.freeze({register:'/api/clio/attachments',execute:'/api/clio/approvals/native/execute',read:'/api/clio/approvals/native/execution/read'});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const MIME=new Set([...Object.values(ARTIFACT_MIME_TYPES),'application/octet-stream']);
const same=(a,b)=>hash(a)===hash(b),fail=(code,effect='none')=>{throw Object.assign(Error(code),{code,effect});};
const method=(port,name)=>{const d=port&&!types.isProxy(port)?Object.getOwnPropertyDescriptor(port,name):null;if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))fail('ARTIFACT_FILING_CONFIGURATION');return (...args)=>Reflect.apply(d.value,port,args);};
function proposalOf(value,binding){
 const p=data(value);assertProposalIntegrity(p);validateShape('RunBinding',binding);
 const command=p.command,context={binding:command.binding,destination:{clientId:command.arguments.clientId,conversationId:command.binding.conversationId}};
 assertArtifactFileCommand(command,context);const selected=nativeApprovalScope(p);
 if(['tenantId','actorId','conversationId'].some(k=>binding[k]!==command.binding[k])||binding.writerFence<command.binding.writerFence||
  selected.selectedClientId===null||selected.selectedClientId!==command.arguments.clientId||command.scopes.length!==1||
  command.attachments.some(object=>!same(object.scopes,command.scopes)))fail('ACCESS_DENIED');
 return {p,context};
}
export function createCoreFilingClient(configuration){
 const c=own(configuration,['origin','credentials','now'],['fetchImpl','maxRequestMs','maxResponseBytes']);
 const origin=artifactAuthorityOrigin(c.origin),credentials=method(c.credentials,'getCredentials'),fetchImpl=c.fetchImpl??globalThis.fetch,
  maxRequestMs=c.maxRequestMs??10000,maxResponseBytes=c.maxResponseBytes??262144;
 if(typeof fetchImpl!=='function'||types.isProxy(fetchImpl)||typeof c.now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>1048576)fail('ARTIFACT_FILING_CONFIGURATION');
 async function call(route,value){
  let life,acquired,started=false;
  try{
   const extras=route==='register'?['object','filename','mimeType','bytes']:route==='execute'?['attachments']:[];
   const v=own(value,['proposal','binding','deadlineMs',...extras],['signal']);nativeSignal(v.signal);
   const binding=data(v.binding),{p}=proposalOf(v.proposal,binding);
   if(!Number.isSafeInteger(v.deadlineMs))fail('ACCESS_DENIED');
   life=createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,c.now()+maxRequestMs,...(route==='read'?[]:[Date.parse(p.expiresAt)])),now:c.now,signal:v.signal,errorFactory:code=>Object.assign(Error(code),{code})});
   let body,selectedObject;
   if(route==='register'){
    const object=selectedObject=data(v.object);
    if(!p.command.attachments.some(o=>same(o,object))||!Buffer.isBuffer(v.bytes)||v.bytes.length>10485760||v.bytes.length!==object.bytes||
     createHash('sha256').update(v.bytes).digest('hex')!==object.sha256||typeof v.filename!=='string'||!/^[^\x00-\x1f\x7f/\\]{1,255}$/u.test(v.filename)||
     !MIME.has(v.mimeType))fail('ACCESS_DENIED');
    body=new FormData();body.set('file',new Blob([Buffer.from(v.bytes)],{type:v.mimeType}),v.filename);
    // Snapshot approval correlation before credentials resolve; current binding selects credentials only.
    body.set('filing',JSON.stringify({proposal:p,binding:p.command.binding,object}));
   }else if(route==='execute'){
    const attachments=data(v.attachments);
    if(!Array.isArray(attachments)||attachments.length!==p.command.attachments.length)fail('ACCESS_DENIED');
    const ids=new Set(),objects=new Set();
    for(const a of attachments){own(a,['attachmentId','object']);const key=hash(a.object);
     if(!UUID.test(a.attachmentId??'')||ids.has(a.attachmentId)||objects.has(key)||!p.command.attachments.some(o=>same(o,a.object)))fail('ACCESS_DENIED');
     ids.add(a.attachmentId);objects.add(key);}
    // Approval metadata and the Core receipt stay bound to the original proposal. The live binding below only selects credentials.
    body=JSON.stringify({proposal:p,binding:p.command.binding,attachments});
   }else body=JSON.stringify({proposal:p,binding:p.command.binding});
   // The retained proposal lets the existing approval credential owner select this client's current session without a static candidate.
   const auth=data(own(await life.run(signal=>credentials({tenantId:binding.tenantId,actorId:binding.actorId,purpose:'approval.execution',proposal:p,binding,signal,deadlineMs:life.deadline()})),
    ['tenantId','actorId','bearerToken','serviceSecret','expiresAtMs']));
   if(auth.tenantId!==binding.tenantId||auth.actorId!==binding.actorId||!TOKEN.test(auth.bearerToken??'')||!TOKEN.test(auth.serviceSecret??'')||auth.bearerToken===auth.serviceSecret||!Number.isSafeInteger(auth.expiresAtMs))fail('ACCESS_DENIED');
   life.limitDeadline(auth.expiresAtMs);life.check();
   const response=await life.run(signal=>{
    started=route!=='read';const pending=Promise.resolve(fetchImpl(new URL(CORE_FILING_ROUTES[route],origin).href,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:'Bearer '+auth.bearerToken,'x-internal-service-secret':auth.serviceSecret,accept:'application/json','accept-encoding':'identity',...(route==='register'?{}:{'content-type':'application/json'})},body}));
    pending.then(r=>{acquired=r;if(life.signal.aborted)try{cancelBody(responseBody(r));}catch{}},()=>{});return pending;
   });
   acquired=response;responseBody(response);
   if(response.redirected||response.status!==(route==='register'?201:200))fail('UNAVAILABLE');
   // The bounded JSON reader intentionally expects200; ordinary Nest upload returns201.
   const jsonResponse=route==='register'?new Response(response.body,{status:200,headers:response.headers}):response;
   const result=await readJsonResponse(jsonResponse,{lifetime:life,maxResponseBytes});life.check();
   if(route==='register'){
    own(result,['id','filename','kind','status','pages','truncated','reason','chars','sha256','bytes'],['contentState','limitation']);
    if(!UUID.test(result.id??'')||result.sha256!==selectedObject.sha256||result.bytes!==selectedObject.bytes||typeof result.filename!=='string'||
     Object.hasOwn(result,'contentState')!==Object.hasOwn(result,'limitation'))fail('ACCESS_DENIED');
    return data({attachmentId:result.id,sha256:result.sha256,bytes:result.bytes,expiresAtMs:life.deadline()});
   }
   if(route==='read'&&result===null)return null;
   const state=route==='read'?'state':'status',observed=route==='read'?'OUTCOME':'observed',unknown=route==='read'?'UNKNOWN':'indeterminate';
   if(result?.[state]===unknown){own(result,[state]);return data(result);}
   own(result,[state,'outcome']);if(result[state]!==observed)fail('ACCESS_DENIED');
   return data({...result,outcome:nativeArtifactFileOutcome(result.outcome,p)});
  }catch(error){
   if(started)fail('ARTIFACT_EFFECT_UNKNOWN','unknown');
   fail(['ACCESS_DENIED','CANCELLED','DEADLINE'].includes(error?.code)?error.code:'UNAVAILABLE');
  }finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}
 }
 return Object.freeze({register:value=>call('register',value),execute:value=>call('execute',value),read:value=>call('read',value)});
}
