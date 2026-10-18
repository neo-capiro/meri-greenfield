/** Fixed-route source transport. Missing broker stays unavailable; no ambient credentials. The credential owner receives the
 * exact target (method, path, sha256 of the body bytes sent) so a run-bound read delegation (option B) can bind its single-use
 * tool token to this request; such a token is sent with its own `CapiroMeriRead` scheme, never as a Bearer. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {readJsonResponse,cancelBody,responseBody} from '../json-response.mjs';
import {credentialProof} from './call-context.mjs';
import {createNativeReadObservation,encodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER,MODE_READ_OPERATIONS} from '../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {FUNDING_OPPORTUNITY_OPERATION_IDS} from '../../../../packages/contracts/retrieval-0.2/funding-opportunities-validation.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const token=value=>typeof value==='string'&&/^[\x21-\x7e]{1,8192}$/.test(value);
export function createRetainedHttpTransport(configuration){
 const {origin,now,getCredentials,delegatedTransport,fetchImpl=globalThis.fetch,maxRequestMs=15000,maxResponseBytes=1048576}=
  ownFields(configuration,['origin','now'],['getCredentials','delegatedTransport','fetchImpl','maxRequestMs','maxResponseBytes']);
 try{const url=new URL(origin);if(typeof origin!=='string'||url.protocol!=='https:'||url.origin!==origin||url.username||url.password)deny('GATEWAY_CONFIGURATION');}
 catch{deny('GATEWAY_CONFIGURATION');}
 if(typeof now!=='function'||getCredentials!==undefined&&typeof getCredentials!=='function'||typeof fetchImpl!=='function'||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000||
  !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
 const delegated=delegatedTransport===undefined?null:ownFields(delegatedTransport,['read']);
 if(delegated&&(typeof delegated.read!=='function'||getCredentials!==undefined))deny('GATEWAY_CONFIGURATION');
 return Object.freeze({async read(c,specification){
  const {path,method,body,serviceSecret=false,observation}=ownFields(specification,['path','method'],['body','serviceSecret','observation']);
  const fundingObservation=observation==='funding-asof'&&c.contract.binding.group==='funding-opportunities'&&FUNDING_OPPORTUNITY_OPERATION_IDS.includes(c.operation.id);
  const knowledgeObservation=observation==='client-knowledge-asof'&&c.contract.binding.group==='client-knowledge-search'&&c.operation.id==='search_client_knowledge';
  const modeObservation=observation==='evidence-mode'&&['public-data','program-elements'].includes(c.contract.binding.group)&&MODE_READ_OPERATIONS.includes(c.operation.id);
  if(observation!==undefined&&(!(fundingObservation||knowledgeObservation||modeObservation)||c.operation.version!=='0.2.0'||
   method!=='POST'||path!==`/api/clio/tools/${c.operation.id}`||!serviceSecret||!same(body,c.request)))deny('GATEWAY_CONFIGURATION');
  if(MODE_READ_OPERATIONS.includes(c.operation.id)&&!modeObservation)deny('GATEWAY_CONFIGURATION');
  // Explicit trusted composition only. New-mode failure never reaches legacy credentials or transport.
  if(observation&&delegated)deny('UNAVAILABLE');
  if(delegated)return delegated.read.call(delegatedTransport,c,{path,method,...(body===undefined?{}:{body})});
  if(!getCredentials)deny('UNAVAILABLE');
  let cutoff=Math.min(c.deadlineMs,now()+maxRequestMs);
  const lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:c.signal});
  let acquired;
  try{
   const bytes=body===undefined?undefined:JSON.stringify(body),target=Object.freeze({method,path,bodySha256:createHash('sha256').update(bytes??'','utf8').digest('hex')});
   const proof=credentialProof(c,origin),credentials=frozenData(await lifetime.run(signal=>getCredentials(Object.freeze({
    ...proof,input:c.input,deadlineMs:cutoff,target,signal}))));
   ownFields(credentials,[...Object.keys(proof),'bearerToken','expiresAtMs',...(serviceSecret?['serviceSecret']:[])],['authorizationScheme','target']);
   if(Object.hasOwn(credentials,'target')&&!same(credentials.target,target)||![undefined,'Bearer','CapiroMeriRead'].includes(credentials.authorizationScheme))deny('ACCESS_DENIED');
   if(Object.keys(proof).some(key=>!same(credentials[key],proof[key]))||!token(credentials.bearerToken)||
    serviceSecret&&!token(credentials.serviceSecret)||!Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=now())deny('ACCESS_DENIED');
   cutoff=Math.min(cutoff,credentials.expiresAtMs);lifetime.limitDeadline(cutoff);
   const observationHeader=observation?encodeNativeReadObservation(createNativeReadObservation({operation:c.operation,request:c.request,context:c.normalizationContext}),{operation:c.operation,request:c.request}):undefined;
   const response=await lifetime.run(async signal=>{
    const result=await fetchImpl(new URL(path,origin).href,{method,redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:`${credentials.authorizationScheme??'Bearer'} ${credentials.bearerToken}`,accept:'application/json','accept-encoding':'identity',
      'x-meri-deadline-at':String(cutoff),
      ...(observationHeader?{[NATIVE_READ_OBSERVATION_HEADER]:observationHeader}:{}),
      ...(serviceSecret?{'x-internal-service-secret':credentials.serviceSecret}:{}),...(body===undefined?{}:{'content-type':'application/json'})},
     ...(bytes===undefined?{}:{body:bytes})});
    acquired=result;
    try{lifetime.check();return result;}catch(error){try{cancelBody(responseBody(result));}catch{}throw error;}
   });
   const value=frozenData(await readJsonResponse(response,{lifetime,maxResponseBytes:Math.min(maxResponseBytes,c.authority.claims.budgets.maxOutputBytes)}));
   lifetime.check();return value;
  }catch(error){throw safeFailure(error);}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime.close();}
 }});
}
