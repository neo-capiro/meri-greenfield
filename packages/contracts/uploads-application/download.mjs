import {requests,receipts,fail,isFailure,copy,digest} from './boundary.mjs';
import {UPLOAD_LIMITS,uploadDisposition} from './protocol.mjs';
const get=(prototype,name)=>Object.getOwnPropertyDescriptor(prototype,name).get;
/** Exact original bytes only; the authenticated server independently checks current custody/access on every read. */
export async function receiveUploadDownload(response,request,receipt,{timeoutMs=30000,signal}={}){
 if(requests.get(request)!=='read'||!receipts.has(receipt)||request.uploadId!==receipt.uploadId||!receipt.originalBytesAvailable)fail('UNADMITTED_UPLOAD_DOWNLOAD');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)fail('UPLOAD_DOWNLOAD_OPTIONS');
 if(signal!==undefined)try{get(AbortSignal.prototype,'aborted').call(signal);}catch{fail('UPLOAD_DOWNLOAD_SIGNAL');}
 let body,headers,status,redirected;
 try{body=get(Response.prototype,'body').call(response);headers=get(Response.prototype,'headers').call(response);status=get(Response.prototype,'status').call(response);redirected=get(Response.prototype,'redirected').call(response);}catch{fail('UPLOAD_DOWNLOAD_RESPONSE');}
 const header=name=>Headers.prototype.get.call(headers,name),original=receipt.original;
 if(redirected||status!==200||header('content-type')!==original.mimeType||header('content-length')!==String(original.bytes)||
  header('content-disposition')!==uploadDisposition(original.filename)||header('x-meri-upload-id')!==receipt.uploadId||
  header('x-meri-upload-sha256')!==original.sha256||header('x-meri-upload-version')!==encodeURIComponent(original.versionId)||
  header('cache-control')!=='no-store'||header('x-content-type-options')!=='nosniff'||header('content-encoding')!==null)fail('UPLOAD_DOWNLOAD_HEADERS');
 let reader;try{reader=ReadableStream.prototype.getReader.call(body);}catch{fail('UPLOAD_DOWNLOAD_BODY');}
 const deadline=Date.now()+timeoutMs;let abort,timer,done=false,stopReject;
 const stop=new Promise((_,reject)=>{stopReject=reject;});stop.catch(()=>{});
 const check=()=>{if(signal&&get(AbortSignal.prototype,'aborted').call(signal))fail('UPLOAD_DOWNLOAD_CANCELLED');if(Date.now()>=deadline)fail('UPLOAD_DOWNLOAD_DEADLINE');};
 const wait=async action=>{check();const out=await Promise.race([action(),stop]);check();return out;};
 try{
  if(signal){abort=()=>stopReject(Error('cancelled'));EventTarget.prototype.addEventListener.call(signal,'abort',abort,{once:true});}
  timer=setTimeout(()=>stopReject(Error('deadline')),timeoutMs);check();
  const bytes=new Uint8Array(original.bytes);let count=0;
  for(;;){const next=await wait(()=>ReadableStreamDefaultReader.prototype.read.call(reader));if(next.done){done=true;break;}
   const chunk=copy(next.value,Math.min(UPLOAD_LIMITS.originalBytes,bytes.length)-count);Uint8Array.prototype.set.call(bytes,chunk,count);count+=chunk.length;}
  if(count!==original.bytes||await wait(()=>digest(bytes))!==original.sha256)fail('UPLOAD_DOWNLOAD_INTEGRITY');
  return Object.freeze({receipt,bytes});
 }catch(error){if(isFailure(error))throw error;check();fail('UPLOAD_DOWNLOAD_STREAM');}
 finally{clearTimeout(timer);if(signal&&abort)EventTarget.prototype.removeEventListener.call(signal,'abort',abort);
  if(!done)try{Promise.resolve(ReadableStreamDefaultReader.prototype.cancel.call(reader)).catch(()=>{});}catch{}
  try{ReadableStreamDefaultReader.prototype.releaseLock.call(reader);}catch{}}
}
