import {fail,isFailure,copyBytes,digest,admittedVersions} from './boundary.mjs';
const getter=(prototype,name)=>Object.getOwnPropertyDescriptor(prototype,name).get;
// Options are trusted consumer configuration. Body/status/headers remain untrusted.
export async function receiveDocumentDownload(response,version,{maxBytes=16*1024*1024,timeoutMs=30000,signal}={}){
 if(!admittedVersions.has(version))fail('UNADMITTED_VERSION');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>16*1024*1024||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)fail('INVALID_DOWNLOAD_OPTIONS');
 if(version.object.bytes>maxBytes)fail('BYTE_LIMIT');
 if(signal!==undefined){try{getter(AbortSignal.prototype,'aborted').call(signal);}catch{fail('INVALID_SIGNAL');}}
 let body,headers,status;
 try{body=getter(Response.prototype,'body').call(response);headers=getter(Response.prototype,'headers').call(response);status=getter(Response.prototype,'status').call(response);}catch{fail('INVALID_RESPONSE_OBJECT');}
 const header=name=>Headers.prototype.get.call(headers,name);
 if(status!==200||header('content-type')!==version.mimeType||header('content-disposition')!==`attachment; filename="${version.filename}"`||header('content-length')!==String(version.object.bytes)||header('cache-control')!=='no-store'||header('x-content-type-options')!=='nosniff'||header('content-encoding')!==null)fail('DOWNLOAD_HEADERS');
 let reader;try{reader=ReadableStream.prototype.getReader.call(body);}catch{fail('INVALID_DOWNLOAD_BODY');}
 let timer,abort,done=false,closed=false;const started=Date.now(),end=started+timeoutMs;
 let rejectStop;const stop=new Promise((_,reject)=>{rejectStop=reject;});stop.catch(()=>{});
 const check=()=>{if(signal&&getter(AbortSignal.prototype,'aborted').call(signal))fail('DOWNLOAD_CANCELLED');if(Date.now()>=end)fail('DOWNLOAD_DEADLINE');};
 const wait=async action=>{check();const result=await Promise.race([action(),stop]);check();return result;};
 try{
  if(signal){try{getter(AbortSignal.prototype,'aborted').call(signal);}catch{fail('INVALID_SIGNAL');}abort=()=>rejectStop(new Error('cancelled'));EventTarget.prototype.addEventListener.call(signal,'abort',abort,{once:true});}
  timer=setTimeout(()=>rejectStop(new Error('deadline')),timeoutMs);check();
  const bytes=new Uint8Array(version.object.bytes);let observed=0;
  while(true){const part=await wait(()=>ReadableStreamDefaultReader.prototype.read.call(reader));if(part.done){done=true;break;}const chunk=copyBytes(part.value,Math.min(maxBytes,bytes.length)-observed);observed+=chunk.length;Uint8Array.prototype.set.call(bytes,chunk,observed-chunk.length);}
  if(observed!==bytes.length)fail('DOWNLOAD_LENGTH');if(await wait(()=>digest(bytes))!==version.object.sha256)fail('DOWNLOAD_HASH');
  closed=true;return Object.freeze({version,bytes});
 }catch(error){if(isFailure(error))throw error;if(signal&&getter(AbortSignal.prototype,'aborted').call(signal))fail('DOWNLOAD_CANCELLED');if(Date.now()>=end)fail('DOWNLOAD_DEADLINE');fail('DOWNLOAD_STREAM');}
 finally{clearTimeout(timer);if(signal&&abort)EventTarget.prototype.removeEventListener.call(signal,'abort',abort);if(!done&&!closed){try{Promise.resolve(ReadableStreamDefaultReader.prototype.cancel.call(reader)).catch(()=>{});}catch{}}try{ReadableStreamDefaultReader.prototype.releaseLock.call(reader);}catch{}}
}
