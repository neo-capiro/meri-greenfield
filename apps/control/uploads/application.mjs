/** CONTROL-only upload routes. Existing session currentness owns identity/access; custody owns every effect. */
import {types} from 'node:util';
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
export function createUploadApplication(configuration){
 const {sessions,store,objects,inspection,retention,removeOriginal,now=Date.now,ids}=configuration;
 const ports=Object.fromEntries(['authenticateSession','readCurrentState'].map(name=>[name,storageMethod(sessions,name)]));
 return Object.freeze({async handle(request){let life,mutating=false;
  try{
   if(types.isProxy(request)||!(request instanceof Request))fail('UPLOAD_ID');
   request=Object.fromEntries(Object.entries(getters).map(([key,get])=>[key,get.call(request)]));
   const url=new URL(request.url),match=/^\/api\/uploads\/(initiate|status|inspect|read|remove|original\/([a-f0-9-]{36}))$/u.exec(url.pathname);
   if(!match||url.search||url.hash)return reply({error:{code:'NOT_FOUND',outcome:'NOT_DISPATCHED'}},404);
   const original=match[1].startsWith('original/'),intent=original?'put':match[1];
   if(request.method!==(original?'PUT':'POST'))return reply({error:{code:'METHOD_NOT_ALLOWED',outcome:'NOT_DISPATCHED'}},405);
   const credential=/^Bearer ([A-Za-z0-9._~+\/-]{1,8192}={0,2})$/u.exec(request.headers.get('authorization')??'')?.[1];
   if(!credential)fail('UPLOAD_ACCESS_DENIED');
   if(request.headers.get('content-encoding')||request.headers.get('content-type')!==(original?'application/octet-stream':'application/json'))fail('UPLOAD_FORMAT');
   const rawLength=request.headers.get('content-length'),length=rawLength===null?null:/^(0|[1-9][0-9]*)$/u.test(rawLength)?Number(rawLength):-1;
   const deadlineMs=now()+(intent==='inspect'?150000:30000);life=createOperationLifetime({now,deadlineMs,signal:request.signal,errorFactory:uploadError});
   // Bootstrap only selects expected facts from the existing authenticated owner. The shared current reader validates/rechecks them before use.
   const authentication=await life.run(signal=>ports.authenticateSession({credential,signal,deadlineMs}));
   const selected=data(await life.run(signal=>ports.readCurrentState({authentication,signal,deadlineMs})));
   if(selected.authenticationSha256!==hash(authentication))fail('UPLOAD_ACCESS_DENIED');
   const current=createRequestCurrent({credential,deadlineMs,signal:life.signal,ports,now,maxBytes:65536,
    commandContext:{binding:selected.binding,clientResolution:selected.selectedClientId===null?null:{clientId:selected.selectedClientId,reference:selected.selectedClientId}}});
   await current.fresh(life);
   const custody=createUploadCustody({store,objects,inspection,retention,removeOriginal,now,ids,current:async()=>{const observed=await current.fresh(life);return observed.current;}}),options={signal:life.signal,deadlineMs:life.deadline()};
   let result;
   if(original){const uploadId=uuid(match[2]),bytes=await originalBody(request,length,life);mutating=true;result=await custody.put(uploadId,bytes,options);}
   else{
    const body=await jsonBody({body:request.body,length},8192,life,life.check);
    if(intent==='initiate'){const call=own(data(body),['requestId','filename','mimeType','bytes','sha256']);const {requestId,...declaration}=call;mutating=true;result=await custody.initiate({requestId,declaration},options);}
    else{const {uploadId}=own(data(body),['uploadId']);uuid(uploadId);mutating=['inspect','remove'].includes(intent);result=await custody[intent](uploadId,options);}
   }
   await current.fresh(life);life.check();
   if(intent==='read')return new Response(result.bytes,{status:200,headers:{'content-type':result.record.declaration.mimeType,
    'content-disposition':uploadDisposition(result.record.declaration.filename),'content-length':String(result.bytes.length),'cache-control':'no-store','x-content-type-options':'nosniff',
    'x-meri-upload-id':result.record.uploadId,'x-meri-upload-sha256':result.record.declaration.sha256,'x-meri-upload-version':encodeURIComponent(result.record.object.versionId)}});
   return reply(uploadReceipt(result));
  }catch(error){return failure(error,mutating);}finally{life?.close();}
 }});
}
