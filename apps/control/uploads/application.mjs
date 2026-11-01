/** CONTROL-only upload routes. Existing session currentness owns identity/access; custody owns every effect. */
import {types} from 'node:util';
import {setTimeout as sleep} from 'node:timers/promises';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createRequestCurrent} from '../action-host/current.mjs';
import {jsonBody} from '../action-application/http.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createUploadCustody,hash,uuid,fail} from './custody.mjs';
import {UPLOAD_LIMITS,uploadError} from './policy.mjs';
import {uploadErrorStatuses,uploadNotDispatchedErrors,uploadDisposition} from '../../../packages/contracts/uploads-application/protocol.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(key=>[key,Object.getOwnPropertyDescriptor(Request.prototype,key).get]));
const states={prepared:'awaiting_upload',writing:'unknown',stored:'stored',removing:'removing',removed:'removed'};
/** Route budgets: a stored original is inspected on the inspection owner's budget, everything else on the ordinary one. */
const ROUTE_MS=Object.freeze({inspect:150000,other:30000});
/** The server-side inspection dispatch after a stored original: bounded attempts, exponential backoff between them, and
 * ONLY an unknown remote outcome is retried (a refusal, a revoked session or a settled verdict never is). */
export const UPLOAD_INSPECTION_DISPATCH=Object.freeze({attempts:3,backoffMs:2000});
/** One content-free stderr event when the dispatch gave up: an allowlisted code and the attempt count, never an identifier. */
export const UPLOAD_INSPECTION_UNSETTLED_EVENT='control.uploads.inspection.unsettled';
/** The only codes the event may carry: the wire's closed upload codes plus the inspection transport's closed faults.
 * Anything else (a tool's own error, a thrown string, a foreign code) is reported as UPLOAD_UNAVAILABLE. */
const UNSETTLED_CODES=new Set([...Object.keys(uploadErrorStatuses),'UPLOAD_INSPECTION_OUTCOME_UNKNOWN','UPLOAD_INSPECTION_CLEANUP_UNKNOWN',
 'UPLOAD_INSPECTION_RESULT_REFUSED','UPLOAD_INSPECTION_REQUEST_REFUSED','UPLOAD_INSPECTION_TRANSPORT_UNAVAILABLE','UPLOAD_INSPECTION_CONFIGURATION',
 'UPLOAD_INSPECTION_EXPIRED','UPLOAD_INSPECTION_CANCELLED','UPLOAD_INSPECTION_REFUSED','UPLOAD_SANDBOX_REFUSED','UPLOAD_TOOL_RECEIPT','UPLOAD_AUTHORITY_CHANGED']);
/** Shared with the outer CONTROL listener; the upload owner alone defines its admitted paths. */
export function matchUploadApplicationPath(path){return /^\/api\/uploads\/(initiate|status|inspect|read|remove|original\/([a-f0-9-]{36}))$/u.exec(path);}
export function uploadReceipt(r){
 return {uploadId:r.uploadId,requestId:r.requestId,original:{...r.declaration,versionId:r.object?.versionId??null},storageStatus:states[r.state],
  scanStatus:r.state==='removed'?'unavailable':r.inspection?.scan.status??'pending',scanReason:r.state==='removed'?'UPLOAD_REMOVED':r.inspection?.scan.reason??null,
  extraction:r.state==='removed'?{status:'unavailable',limitations:['UPLOAD_REMOVED']}:
   {status:r.inspection?.extraction.status??'pending',limitations:r.inspection?.extraction.limitations??[]},
  originalBytesAvailable:r.state==='stored'&&r.inspection?.scan.status==='clean'};
}
const known=new Set(Object.keys(uploadErrorStatuses));
function failure(error,mutating){
 const field=key=>{const descriptor=error&&!types.isProxy(error)&&Object.getOwnPropertyDescriptor(error,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;};
 const raw=known.has(field('code'))?field('code'):field('message');
 const code=known.has(raw)?raw:'UPLOAD_UNAVAILABLE';
 const status=uploadErrorStatuses[code],invalid=uploadNotDispatchedErrors.includes(code);
 return reply({error:{code,outcome:invalid?'NOT_DISPATCHED':mutating?'UNKNOWN':'READ_UNAVAILABLE'}},status);
}
async function originalBody(request,length,life){
 if(length===null||!Number.isSafeInteger(length)||length<1||length>UPLOAD_LIMITS.originalBytes||!request.body)fail('UPLOAD_SIZE');
 const reader=request.body.getReader(),chunks=[];let bytes=0,done=false;
 try{for(;;){const next=await life.run(()=>reader.read());if(next.done){done=true;break;}if(!(next.value instanceof Uint8Array)||(bytes+=next.value.byteLength)>length)fail('UPLOAD_SIZE');chunks.push(Buffer.from(next.value));}
  if(bytes!==length)fail('UPLOAD_SIZE');return Buffer.concat(chunks);
 }finally{if(!done)try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}reader.releaseLock();}
}
/** Server-side inspection dispatch. The composer wire has initiate/original/status/remove only, so nothing else
 * inspects a stored original: once `put` stores the exact bytes the application starts ONE inspection here, through
 * the same authenticated custody (`open`) and the same composed inspection port the explicit route uses, so the
 * caller's status reads see the scan and extraction progress without a second call. It is idempotent per OWNER and
 * upload id: a put retry or a concurrent explicit inspect by the same authenticated owner joins the attempt in flight
 * instead of running a second native inspection over the same bytes (custody itself reconciles a settled observation
 * rather than re-running it), while another principal's explicit inspect of that id is a different key, so an
 * unauthorized attempt can never be joined by, or stand in for, the owner's own. Nothing here is a timer, daemon or
 * queue: an attempt is started and not awaited, bounded by its own lifetime and the runtime shutdown `signal`, which
 * cancels an attempt and its backoff. */
function createInspectionDispatch({attempts,backoffMs,now,signal,open,log}){
 const inFlight=new Map();
 const key=(owner,uploadId)=>owner+'\0'+uploadId;
 const track=(owner,uploadId,work)=>{
  const k=key(owner,uploadId),existing=inFlight.get(k);if(existing)return existing;
  const pending=work().finally(()=>{if(inFlight.get(k)===pending)inFlight.delete(k);});
  inFlight.set(k,pending);return pending;
 };
 async function attempt(uploadId,credential){
  const life=createOperationLifetime({now,deadlineMs:now()+ROUTE_MS.inspect,signal,errorFactory:uploadError});
  try{const {custody,options}=await open({credential,life});return await custody.inspect(uploadId,options);}finally{life.close();}
 }
 return Object.freeze({track,
  inFlight:(owner,uploadId)=>inFlight.get(key(owner,uploadId))??null,
  start(owner,uploadId,credential){
   return track(owner,uploadId,async()=>{
    for(let n=1;;n++){
     try{return await attempt(uploadId,credential);}
     catch(error){
      const code=UNSETTLED_CODES.has(error?.code)?error.code:'UPLOAD_UNAVAILABLE';
      if(code!=='UPLOAD_INSPECTION_OUTCOME_UNKNOWN'||n>=attempts||signal?.aborted){log({event:UPLOAD_INSPECTION_UNSETTLED_EVENT,code,attempts:n});return null;}
     }
     if(backoffMs>0)await sleep(backoffMs*2**(n-1),undefined,{signal}).catch(()=>{});
     if(signal?.aborted){log({event:UPLOAD_INSPECTION_UNSETTLED_EVENT,code:'CANCELLED',attempts:n});return null;}
    }
   });
  }});
}
export function createUploadApplication(configuration){
 const {sessions,store,objects,inspection,retention,removeOriginal,now=Date.now,ids,signal,dispatch:declared={},
  log=event=>process.stderr.write(JSON.stringify(event)+'\n')}=configuration;
 const ports=Object.fromEntries(['authenticateSession','readCurrentState'].map(name=>[name,storageMethod(sessions,name)]));
 let dispatchOptions;try{dispatchOptions=own(data(declared),[],['attempts','backoffMs']);}catch{fail('UPLOAD_CONFIGURATION');}
 const {attempts=UPLOAD_INSPECTION_DISPATCH.attempts,backoffMs=UPLOAD_INSPECTION_DISPATCH.backoffMs}=dispatchOptions;
 if(!Number.isSafeInteger(attempts)||attempts<1||attempts>10||!Number.isSafeInteger(backoffMs)||backoffMs<0||backoffMs>60000||typeof log!=='function')fail('UPLOAD_CONFIGURATION');
 /** The ONE way to reach custody: the existing authenticated owner selects the session facts, the shared current
  * reader validates and rechecks them, and custody is bound to that reader. The request routes and the server-side
  * dispatch both come through here, so a background inspection carries exactly the authority a request would. `owner`
  * is the content-free hash of the selected principal facts (tenant, actor, conversation, client) the dispatch keys on. */
 async function open({credential,life}){
  const deadlineMs=life.deadline();
  const authentication=await life.run(signal=>ports.authenticateSession({credential,signal,deadlineMs}));
  const selected=data(await life.run(signal=>ports.readCurrentState({authentication,signal,deadlineMs})));
  if(selected.authenticationSha256!==hash(authentication))fail('UPLOAD_ACCESS_DENIED');
  const current=createRequestCurrent({credential,deadlineMs,signal:life.signal,ports,now,maxBytes:65536,
   commandContext:{binding:selected.binding,clientResolution:selected.selectedClientId===null?null:{clientId:selected.selectedClientId,reference:selected.selectedClientId}}});
  await current.fresh(life);
  const custody=createUploadCustody({store,objects,inspection,retention,removeOriginal,now,ids,current:async()=>{const observed=await current.fresh(life);return observed.current;}});
  const owner=hash({tenantId:selected.binding.tenantId,actorId:selected.binding.actorId,conversationId:selected.binding.conversationId,clientId:selected.selectedClientId});
  return {current,custody,owner,options:{signal:life.signal,deadlineMs:life.deadline()}};
 }
 const dispatch=createInspectionDispatch({attempts,backoffMs,now,signal,open,log});
 return Object.freeze({async handle(request){let life,mutating=false;
  try{
   if(types.isProxy(request)||!(request instanceof Request))fail('UPLOAD_ID');
   request=Object.fromEntries(Object.entries(getters).map(([key,get])=>[key,get.call(request)]));
   const url=new URL(request.url),match=matchUploadApplicationPath(url.pathname);
   if(!match||url.search||url.hash)return reply({error:{code:'NOT_FOUND',outcome:'NOT_DISPATCHED'}},404);
   const original=match[1].startsWith('original/'),intent=original?'put':match[1];
   if(request.method!==(original?'PUT':'POST'))return reply({error:{code:'METHOD_NOT_ALLOWED',outcome:'NOT_DISPATCHED'}},405);
   const credential=/^Bearer ([A-Za-z0-9._~+\/-]{1,8192}={0,2})$/u.exec(request.headers.get('authorization')??'')?.[1];
   if(!credential)fail('UPLOAD_ACCESS_DENIED');
   if(request.headers.get('content-encoding')||request.headers.get('content-type')!==(original?'application/octet-stream':'application/json'))fail('UPLOAD_FORMAT');
   const rawLength=request.headers.get('content-length'),length=rawLength===null?null:/^(0|[1-9][0-9]*)$/u.test(rawLength)?Number(rawLength):-1;
   life=createOperationLifetime({now,deadlineMs:now()+(intent==='inspect'?ROUTE_MS.inspect:ROUTE_MS.other),signal:request.signal,errorFactory:uploadError});
   const {current,custody,owner,options}=await open({credential,life});
   let result;
   if(original){const uploadId=uuid(match[2]),bytes=await originalBody(request,length,life);mutating=true;result=await custody.put(uploadId,bytes,options);
    // The stored original is inspected NOW, server-side, on its own lifetime: the reply below is the pending receipt
    // and the status reads see the inspection land. A retained write (already stored and inspected, or in flight) is
    // never dispatched again.
    if(result.state==='stored'&&result.inspection===null)dispatch.start(owner,uploadId,credential);}
   else{
    const body=await jsonBody({body:request.body,length},8192,life,life.check);
    if(intent==='initiate'){const call=own(data(body),['requestId','filename','mimeType','bytes','sha256']);const {requestId,...declaration}=call;mutating=true;result=await custody.initiate({requestId,declaration},options);}
    else if(intent==='status'&&Object.hasOwn(body,'requestId')){const {requestId}=own(data(body),['requestId']);result=await custody.statusByRequest(uuid(requestId),options);}
    else{const {uploadId}=own(data(body),['uploadId']);uuid(uploadId);mutating=['inspect','remove'].includes(intent);
     if(intent!=='inspect')result=await custody[intent](uploadId,options);
     else{
      // The explicit route re-inspects an outage verdict; while the server-side attempt is still in flight it joins
      // that attempt and reports its outcome under this caller's own authority instead of running the bytes twice.
      const shared=dispatch.inFlight(owner,uploadId);
      if(shared===null)result=await dispatch.track(owner,uploadId,()=>custody.inspect(uploadId,options));
      else{await life.run(()=>shared.then(()=>null,()=>null));result=await custody.status(uploadId,options);}
     }}
   }
   await current.fresh(life);life.check();
   if(intent==='read')return new Response(result.bytes,{status:200,headers:{'content-type':result.record.declaration.mimeType,
    'content-disposition':uploadDisposition(result.record.declaration.filename),'content-length':String(result.bytes.length),'cache-control':'no-store','x-content-type-options':'nosniff',
    'x-meri-upload-id':result.record.uploadId,'x-meri-upload-sha256':result.record.declaration.sha256,'x-meri-upload-version':encodeURIComponent(result.record.object.versionId)}});
   return reply(uploadReceipt(result));
  }catch(error){return failure(error,mutating);}finally{life?.close();}
 }});
}
