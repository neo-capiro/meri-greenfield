/** Configured bounded passive HTTP source projection; no initialization I/O. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import canonicalize from 'canonicalize';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../json-response.mjs';
import {operationIds,readContext,assertIdentityContactsResult,frozenData,ownFields} from './request-context.mjs';
function configuredEndpoints(value){const fields=ownFields(value,[],operationIds),out={};
 if(Object.keys(fields).length===0)deny('GATEWAY_CONFIGURATION');
 for(const [id,endpoint] of Object.entries(fields)){try{
 if(typeof endpoint!=='string')deny('GATEWAY_CONFIGURATION');const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)deny('GATEWAY_CONFIGURATION');out[id]=url.href;
 }catch{deny('GATEWAY_CONFIGURATION');}}return Object.freeze(out);}
export function createIdentityContactsHttpAdapter(options){
 const {endpoints:configured,getCredentials,fetchImpl=globalThis.fetch,now,maxRequestMs=15000,maxResponseBytes=1048576}=
  ownFields(options,['endpoints','getCredentials','now'],['fetchImpl','maxRequestMs','maxResponseBytes']);
 if(typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||
    maxRequestMs<1||maxRequestMs>3600000||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
 const endpoints=configuredEndpoints(configured);
 async function read(call){let life,acquired;try{
  const context=readContext(call,now),endpoint=endpoints[context.operation.id];
  if(endpoint===undefined)deny('UNAVAILABLE');
  let cutoff=Math.min(context.deadlineMs,context.active()+maxRequestMs);
  life=createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});const active=()=>{life.check();return context.active(cutoff);};
  const pins=Object.freeze({operation:context.operation,input:context.input,metadata:context.metadata,normalizationContext:context.normalizationContext,
    argumentsSha256:context.argumentsSha256,requestSha256:context.requestSha256,binding:context.authority.binding,subject:context.authority.subject,
    policyRevision:context.authority.policyRevision,sourceIds:context.authority.sourceIds});
  const credential=frozenData(await life.run(signal=>{active();return getCredentials(Object.freeze({...pins,deadlineMs:cutoff,signal}));}));
  ownFields(credential,['operation','argumentsSha256','metadata','normalizationContext','requestSha256','binding','subject','policyRevision','sourceIds','bearerToken','serviceSecret','expiresAtMs']);
  if(['operation','metadata','normalizationContext','binding','subject','sourceIds'].some(key=>canonicalSha256(credential[key])!==canonicalSha256(pins[key]))||
     credential.argumentsSha256!==pins.argumentsSha256||credential.requestSha256!==pins.requestSha256||credential.policyRevision!==pins.policyRevision||
     !Number.isSafeInteger(credential.expiresAtMs)||credential.expiresAtMs<=active()||credential.expiresAtMs>context.deadlineMs||
     ![credential.bearerToken,credential.serviceSecret].every(token=>typeof token==='string'&&token.length>=1&&token.length<=8192&&/^[\x21-\x7e]+$/u.test(token)))deny('ACCESS_DENIED');
  cutoff=Math.min(cutoff,credential.expiresAtMs);life.limitDeadline(cutoff);active();
  const response=await life.run(async signal=>{active();const result=await fetchImpl(endpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{authorization:`Bearer ${credential.bearerToken}`,'x-internal-service-secret':credential.serviceSecret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},
    body:canonicalize({input:context.input,metadata:context.metadata})});acquired=result;
    try{active();return result;}catch(error){try{cancelBody(responseBody(result));}catch{}throw error;}});
  const bounded={run:fn=>life.run(signal=>{active();return fn(signal);}),check:active};
  const result=frozenData(await readJsonResponse(response,{lifetime:bounded,maxResponseBytes}));active();
  assertIdentityContactsResult(result,context);active();return result;
 }catch(error){throw safeFailure(error);}finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}}
 return Object.freeze({read});
}
