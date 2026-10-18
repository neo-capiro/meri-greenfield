/** Fixed original native read routes; import and construction perform no I/O. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../json-response.mjs';
import {originalTrackingContract,assertOriginalSourceIdentity,readContext,ownFields,frozenData} from './request-context.mjs';
export function createOriginalTrackingHttpAdapter(options) {
  const {operation:reference,sourceIdentity:configured,origin,getCredentials,now,fetchImpl=globalThis.fetch,maxRequestMs=15000,maxResponseBytes=1048576}=
    ownFields(options,['operation','sourceIdentity','origin','getCredentials','now'],['fetchImpl','maxRequestMs','maxResponseBytes']);
  const {operation,contract}=originalTrackingContract(reference),sourceIdentity=assertOriginalSourceIdentity(configured,contract);
  if(typeof getCredentials!=='function'||typeof now!=='function'||typeof fetchImpl!=='function'||!Number.isSafeInteger(maxRequestMs)||
      maxRequestMs<1||maxRequestMs>3600000||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
  let endpoint;try{const url=new URL(origin);if(typeof origin!=='string'||url.protocol!=='https:'||url.origin!==origin||url.username||url.password)deny('GATEWAY_CONFIGURATION');
    endpoint=new URL(`/api/clio/tools/${operation.id}`,url).href;}catch{deny('GATEWAY_CONFIGURATION');}
  async function read(call) {
    let lifetime,acquired;
    try {
      const context=readContext({operation,...ownFields(call,['input','request','authority'],['signal','normalizationContext'])},now);
      let cutoff=Math.min(context.deadlineMs,context.active()+maxRequestMs);
      lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});const active=()=>{lifetime.check();return context.active(cutoff);};
      const pins=frozenData({operation,sourceIdentity,binding:context.authority.binding,subject:context.authority.subject,
        policyRevision:context.authority.policyRevision,sourceIds:context.authority.sourceIds,argumentsSha256:context.argumentsSha256});
      const credential=frozenData(await lifetime.run(signal=>{active();return getCredentials(Object.freeze({...pins,deadlineMs:cutoff,signal}));}));
      ownFields(credential,[...Object.keys(pins),'bearerToken','serviceSecret','expiresAtMs']);
      if(Object.keys(pins).some(key=>canonicalSha256(credential[key])!==canonicalSha256(pins[key]))||
          !Number.isSafeInteger(credential.expiresAtMs)||credential.expiresAtMs<=active()||credential.expiresAtMs>context.deadlineMs||
          ![credential.bearerToken,credential.serviceSecret].every(token=>typeof token==='string'&&token.length>0&&token.length<=8192&&/^[\x21-\x7e]+$/u.test(token)))deny('ACCESS_DENIED');
      cutoff=Math.min(cutoff,credential.expiresAtMs);lifetime.limitDeadline(cutoff);active();
      const input=context.input,body={limit:input.limit};
      for(const key of ['clientId','taskId','status','dueBefore','actionItemId','sort'])if(input[key]!==undefined&&input[key]!==null)body[key]=input[key];
      if(operation.id==='query_tasks')body.assignedToMe=input.ownerUserId!==null;
      const cursor=typeof context.request.cursor==='string'?context.request.cursor.trim():null;if(cursor!==null)body.cursor=cursor;
      const response=await lifetime.run(async signal=>{active();const result=await fetchImpl(endpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
        headers:{authorization:`Bearer ${credential.bearerToken}`,'x-internal-service-secret':credential.serviceSecret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(body)});
        acquired=result;try{active();return result;}catch(error){try{cancelBody(responseBody(result));}catch{}throw error;}});
      const result=frozenData(await readJsonResponse(response,{lifetime:{run:fn=>lifetime.run(signal=>{active();return fn(signal);}),check:active},maxResponseBytes}));
      active();return result;
    }catch(error){throw safeFailure(error);}finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime?.close();}
  }
  return Object.freeze({read});
}
