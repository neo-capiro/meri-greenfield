/** Fixed source routes with bounded ordinary Core user/service credentials. */
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {readJsonResponse,cancelBody,responseBody} from '../json-response.mjs';
import {credentialProof} from './call-context.mjs';
import {createNativeReadObservation,encodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER,MODE_READ_OPERATIONS} from '../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {FUNDING_READ_OPERATIONS} from '../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const token=value=>typeof value==='string'&&/^[\x21-\x7e]{1,8192}$/.test(value);
export function createRetainedHttpTransport(configuration){
 const {origin,now,getCredentials,readSource,fetchImpl=globalThis.fetch,maxRequestMs=15000,maxResponseBytes=1048576}=
  ownFields(configuration,['origin','now'],['getCredentials','readSource','fetchImpl','maxRequestMs','maxResponseBytes']);
 try{const url=new URL(origin);if(typeof origin!=='string'||url.protocol!=='https:'||url.origin!==origin||url.username||url.password)deny('GATEWAY_CONFIGURATION');}
 catch{deny('GATEWAY_CONFIGURATION');}
 if(typeof now!=='function'||getCredentials!==undefined&&typeof getCredentials!=='function'||readSource!==undefined&&(typeof readSource!=='function'||getCredentials!==undefined)||typeof fetchImpl!=='function'||
  !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000||
  !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
 return Object.freeze({async read(c,specification){
  const {path,method,body,serviceSecret=false,observation}=ownFields(specification,['path','method'],['body','serviceSecret','observation']);
  const fundingObservation=observation==='funding-asof'&&['funding-opportunities','funding-analysis'].includes(c.contract.binding.group)&&FUNDING_READ_OPERATIONS.includes(c.operation.id);
  const knowledgeObservation=observation==='client-knowledge-asof'&&c.contract.binding.group==='client-knowledge-search'&&c.operation.id==='search_client_knowledge';
  const modeObservation=observation==='evidence-mode'&&['public-data','program-elements'].includes(c.contract.binding.group)&&MODE_READ_OPERATIONS.includes(c.operation.id);
  const producerObservation=observation==='producer-context'&&['certification-status','rule-status','sam-opportunities'].includes(c.contract.binding.group);
  const savedOwner=['saved-records','strategy-saved-records','legiwatch-review','legiwatch-relevance','legislative-comparisons','florida-budget'].includes(c.contract.binding.group);
  const privateData=['capiro-data','capiro-data-v3'].includes(c.contract.binding.group)&&c.request.source==='client_records';
  if((savedOwner||privateData)&&readSource)deny('ACCESS_DENIED');
  const strategyData=c.contract.binding.group==='strategy-saved-records',legiwatchData=['legiwatch-review','legiwatch-relevance','legislative-comparisons','florida-budget'].includes(c.contract.binding.group);
  if((privateData||strategyData||legiwatchData)&&(c.operation.version!==(c.contract.binding.group==='capiro-data-v3'?'0.3.0':'0.2.0')||!(legiwatchData?['get_legiwatch_review','preview_legiwatch_relevance','get_florida_budget_project','compare_florida_budget_amounts','compare_legislative_versions']:strategyData?['read_saved_strategy_records']:['describe_capiro_data','query_capiro_data']).includes(c.operation.id)||
   method!=='POST'||path!==`/api/clio/tools/${c.operation.id}`||!serviceSecret||!same(body,c.operation.id==='get_florida_budget_project'?c.input:c.request)))deny('GATEWAY_CONFIGURATION');
  const correlation=privateData||strategyData||legiwatchData?canonicalize(frozenData({binding:c.authority.binding,subject:c.authority.subject,
   policyRevision:c.authority.policyRevision,normalizationContext:c.normalizationContext})):undefined;
  if((privateData||strategyData||legiwatchData)&&(typeof correlation!=='string'||Buffer.byteLength(correlation,'utf8')>8192))deny('RESOURCE_LIMIT');
  if(observation!==undefined&&(!(fundingObservation||knowledgeObservation||modeObservation||producerObservation)||c.operation.version!=='0.2.0'||
   method!=='POST'||path!==`/api/clio/tools/${c.operation.id}`||!serviceSecret||!same(body,c.request)))deny('GATEWAY_CONFIGURATION');
  if(MODE_READ_OPERATIONS.includes(c.operation.id)&&!modeObservation&&!(producerObservation&&c.operation.id==='search_sam_opportunities'))deny('GATEWAY_CONFIGURATION');
  if(readSource){
   const context={binding:c.authority.binding,subject:c.authority.subject,policyRevision:c.authority.policyRevision,normalizationContext:c.normalizationContext};
   return frozenData(await readSource({operation:c.operation.id,input:body??c.input,context,deadlineMs:Math.min(c.deadlineMs,now()+maxRequestMs),signal:c.signal}));
  }
  if(!getCredentials)deny('UNAVAILABLE');
  let cutoff=Math.min(c.deadlineMs,now()+maxRequestMs);
  const lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:c.signal});
  let acquired;
  try{
   const bytes=body===undefined?undefined:JSON.stringify(body),target=Object.freeze({method,path,bodySha256:createHash('sha256').update(bytes??'','utf8').digest('hex')});
   const proof=credentialProof(c,origin),credentials=frozenData(await lifetime.run(signal=>getCredentials(Object.freeze({
    ...proof,input:c.input,deadlineMs:cutoff,target,signal}))));
   ownFields(credentials,[...Object.keys(proof),'bearerToken','expiresAtMs',...(serviceSecret?['serviceSecret']:[])],['authorizationScheme','target']);
   if(Object.hasOwn(credentials,'target')&&!same(credentials.target,target)||![undefined,'Bearer'].includes(credentials.authorizationScheme))deny('ACCESS_DENIED');
   if(Object.keys(proof).some(key=>!same(credentials[key],proof[key]))||!token(credentials.bearerToken)||
    serviceSecret&&!token(credentials.serviceSecret)||!Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=now())deny('ACCESS_DENIED');
   cutoff=Math.min(cutoff,credentials.expiresAtMs);lifetime.limitDeadline(cutoff);
   const observationHeader=observation?encodeNativeReadObservation(createNativeReadObservation({operation:c.operation,request:c.request,context:c.normalizationContext}),{operation:c.operation,request:c.request}):undefined;
   const response=await lifetime.run(async signal=>{
    const result=await fetchImpl(new URL(path,origin).href,{method,redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:`${credentials.authorizationScheme??'Bearer'} ${credentials.bearerToken}`,accept:'application/json','accept-encoding':'identity',
      'x-meri-deadline-at':String(cutoff),
      ...(correlation?{'x-meri-read-correlation':Buffer.from(correlation,'utf8').toString('base64url')}:{}),
      ...(observationHeader?{[NATIVE_READ_OBSERVATION_HEADER]:observationHeader}:{}),
      ...(serviceSecret?{'x-internal-service-secret':credentials.serviceSecret}:{}),...(body===undefined?{}:{'content-type':'application/json'})},
     ...(bytes===undefined?{}:{body:bytes})});
    acquired=result;
    if(c.operation.id==='query_knowledge_graph'){
     responseBody(result);
     if(!result.redirected&&(result.status===408||result.status===429||result.status>=500))deny('UNAVAILABLE');
    }
    try{lifetime.check();return result;}catch(error){try{cancelBody(responseBody(result));}catch{}throw error;}
   });
   const value=frozenData(await readJsonResponse(response,{lifetime,maxResponseBytes:Math.min(maxResponseBytes,c.authority.maxOutputBytes)}));
   lifetime.check();return value;
  }catch(error){throw safeFailure(error);}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime.close();}
 }});
}
