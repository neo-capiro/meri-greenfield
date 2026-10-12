/** Fixed governed read route. No ambient credentials, retries or initialization I/O. */
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { createDispatchLifetime } from '../../dispatch/dispatch-lifetime.mjs';
import { deny, safeFailure } from '../../dispatch/operation-result.mjs';
import { frozenData, ownFields, readContext } from './request-context.mjs';

import { cancelBody as cancel, responseBody, readJsonResponse } from '../json-response.mjs';

const route='/clio/tools/list_memory_proposals';
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
    let lifetime, acquiredResponse;
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
        // Own the response before the lifetime's outer await can reject. Abort
        // can occur after this callback returns but before its caller resumes.
        acquiredResponse=result;
        try{lifetime.check();return result;}catch(error){try{cancel(responseBody(result));}catch{}throw error;}
      });
      const page=frozenData(await readJsonResponse(response,{lifetime,maxResponseBytes}));
      validateShape('MemoryProposalReadResult',page);
      lifetime.check();return page;
    }catch(error){throw safeFailure(error);}
    finally {
      try{if(acquiredResponse)cancel(responseBody(acquiredResponse));}catch{}
      lifetime?.close();
    }
  }
  return Object.freeze({read});
}
