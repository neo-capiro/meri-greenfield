/** Fixed governed read route. No ambient credentials, retries or initialization I/O. */
import { types } from 'node:util';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { createDispatchLifetime } from '../../dispatch/dispatch-lifetime.mjs';
import { deny, parseRawJson, safeFailure } from '../../dispatch/operation-result.mjs';
import { frozenData, ownFields, readContext } from './request-context.mjs';

const route='/clio/tools/list_memory_proposals';
const cancel=body=>{try{Promise.resolve(body?.cancel()).catch(()=>{});}catch{}};
function responseBody(response) {
  if(!response||types.isProxy(response)||!(response instanceof Response))deny('INVALID_RESULT');
  return response.body;
}
export function createMemoryProposalHttpAdapter(options) {
  const {origin,getCredentials,fetchImpl=globalThis.fetch,now,maxResponseBytes,maxRequestMs}=ownFields(options,
    ['origin','getCredentials','now','maxResponseBytes','maxRequestMs'],['fetchImpl']);
  if(typeof origin!=='string'||typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||
      !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16*1024*1024||
      !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000)deny('GATEWAY_CONFIGURATION');
  let endpoint;
  try{const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)deny('GATEWAY_CONFIGURATION');endpoint=new URL(route,url).href;}
  catch{deny('GATEWAY_CONFIGURATION');}
  async function read(call) {
    let lifetime,reader,body;
    try {
      const context=readContext(call,now);
      let deadlineMs=Math.min(context.deadlineMs,now()+maxRequestMs);
      lifetime=createDispatchLifetime({deadlineMs,now,signal:context.signal});
      const credentials=frozenData(await lifetime.run(signal=>getCredentials(Object.freeze({binding:context.authority.binding,
        subject:context.authority.subject,deadlineMs,signal}))));
      ownFields(credentials,['binding','bearerToken','serviceSecret','expiresAtMs']);
      if(canonicalSha256(credentials.binding)!==canonicalSha256(context.authority.binding)||
          !Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=now()||
          ![credentials.bearerToken,credentials.serviceSecret].every(x=>typeof x==='string'&&x.length>=1&&x.length<=8192&&/^[\x21-\x7e]+$/.test(x)))deny('ACCESS_DENIED');
      deadlineMs=Math.min(deadlineMs,credentials.expiresAtMs);lifetime.limitDeadline(deadlineMs);
      const response=await lifetime.run(async signal=>{
        const result=await fetchImpl(endpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
          headers:{authorization:`Bearer ${credentials.bearerToken}`,'x-internal-service-secret':credentials.serviceSecret,
            'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(context.input)});
        try{lifetime.check();return result;}catch(error){try{cancel(responseBody(result));}catch{}throw error;}
      });
      body=responseBody(response);
      if(response.status!==200||response.redirected||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type')??'')||
          ![null,'identity'].includes(response.headers.get('content-encoding')))deny('INVALID_RESULT');
      const length=response.headers.get('content-length');
      if(length!==null&&(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxResponseBytes))deny('RESOURCE_LIMIT');
      if(!body)deny('INVALID_RESULT');reader=body.getReader();
      const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
      while(true){
        const part=await lifetime.run(()=>reader.read());
        if(part.done)break;
        if(!(part.value instanceof Uint8Array))deny('INVALID_RESULT');
        bytes+=part.value.byteLength;if(bytes>maxResponseBytes)deny('RESOURCE_LIMIT');
        text+=decoder.decode(part.value,{stream:true});
      }
      text+=decoder.decode();lifetime.check();
      if(length!==null&&bytes!==Number(length))deny('INVALID_RESULT');
      const page=frozenData(parseRawJson(text,maxResponseBytes,'INVALID_RESULT'));validateShape('MemoryProposalReadResult',page);
      lifetime.check();return page;
    }catch(error){throw safeFailure(error);}
    finally {
      // Cancellation is requested without awaiting an uncooperative transport's cleanup.
      // The transport owner must qualify physical cancellation and socket retirement.
      if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}try{reader.releaseLock();}catch{}}
      else cancel(body);
      lifetime?.close();
    }
  }
  return Object.freeze({read});
}
