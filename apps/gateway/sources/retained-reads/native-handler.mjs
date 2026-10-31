/** Shared mechanics for finite stored native producers, with family-owned exact routes and request bridges. */
import {types} from 'node:util';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {retainedCall} from './call-context.mjs';
import {createRetainedHttpTransport} from './http-transport.mjs';
import {NATIVE_READ_FAMILIES,nativeReadOperationAllowed} from './native-families.mjs';
import {MODE_READ_OPERATIONS} from '../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
const same=(a,b)=>hash(a)===hash(b);

export function createStoredNativeReadHandlers(configuration,operations,specification){
 const {family,routes,requestBody,resultBody,observation,requirePerCall}=ownFields(specification,['family','routes'],['requestBody','resultBody','observation','requirePerCall']);
 if(!NATIVE_READ_FAMILIES.includes(family)||[requestBody,resultBody,requirePerCall].some(value=>value!==undefined&&(typeof value!=='function'||types.isProxy(value))))deny('GATEWAY_CONFIGURATION');
 const fundingObservation=observation==='funding-asof'&&['funding-opportunities','funding-analysis'].includes(family),knowledgeObservation=observation==='client-knowledge-asof'&&family==='client-knowledge-search',
  modeObservation=observation==='evidence-mode'&&['public-data','program-elements'].includes(family),
  producerObservation=observation==='producer-context'&&['certification-status','rule-status','sam-opportunities'].includes(family);
 if(observation!==undefined&&(!(fundingObservation||knowledgeObservation||modeObservation||producerObservation)||requestBody!==undefined||resultBody!==undefined))deny('GATEWAY_CONFIGURATION');
 if(['certification-status','rule-status','sam-opportunities'].includes(family)&&!producerObservation)deny('GATEWAY_CONFIGURATION');
 if(['funding-opportunities','funding-analysis'].includes(family)&&observation!=='funding-asof')deny('GATEWAY_CONFIGURATION');
 const fixed=frozenData(routes);
 // Only this reviewed successor uses 0.3; all retained native reads keep their exact 0.2 binding.
 const version=family==='capiro-data-v3'?'0.3.0':'0.2.0';
 if(!fixed||Array.isArray(fixed)||typeof fixed!=='object'||!Object.keys(fixed).length)deny('GATEWAY_CONFIGURATION');
 if(knowledgeObservation&&(Object.keys(fixed).length!==1||!Object.hasOwn(fixed,'search_client_knowledge'))||
  family==='client-knowledge-search'&&Object.hasOwn(fixed,'search_client_knowledge')&&!knowledgeObservation)deny('GATEWAY_CONFIGURATION');
 for(const [id,path] of Object.entries(fixed)){
  if(path!==(family==='client-knowledge-attachments'&&id==='read_chat_attachments'?'/api/clio/attachments/read':`/api/clio/tools/${id}`))deny('GATEWAY_CONFIGURATION');
  if((modeObservation||producerObservation&&id==='search_sam_opportunities')!==MODE_READ_OPERATIONS.includes(id))deny('GATEWAY_CONFIGURATION');
  let contract;try{contract=resolveOperationContract({id,version});}catch{deny('GATEWAY_CONFIGURATION');}
  if(contract.binding.group!==family||!nativeReadOperationAllowed(family,id)||contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none')deny('GATEWAY_CONFIGURATION');
 }
 const {credentialsForCall,...c}=ownFields(configuration,['origin','now'],['getCredentials','credentialsForCall','readSource','fetchImpl','maxRequestMs','maxResponseBytes']);
 if(credentialsForCall!==undefined&&(typeof credentialsForCall!=='function'||types.isProxy(credentialsForCall)||c.getCredentials!==undefined))deny('GATEWAY_CONFIGURATION');
 const selectedOperations=frozenData(operations);
 if(!Array.isArray(selectedOperations)||!selectedOperations.length)deny('GATEWAY_CONFIGURATION');
 const transport=createRetainedHttpTransport(c),seen=new Set();
 return selectedOperations.map(reference=>{
  const operation=frozenData(ownFields(reference,['id','version']));
  if(operation.version!==version||!Object.hasOwn(fixed,operation.id)||seen.has(operation.id))deny('GATEWAY_CONFIGURATION');seen.add(operation.id);
  const contract=resolveOperationContract(operation);
  return {operation,async execute(call){try{
   const {signal,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']),data=frozenData(fields);
   try{contract.normalizeInput(data.request,data.normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
   const current=retainedCall(operation,{...data,...(signal===undefined?{}:{signal})},c.now);
   // Observation support cannot be inferred from a static credential or a matching response clock.
   if((observation||requirePerCall?.(current))&&!credentialsForCall&&!c.readSource)deny('UNAVAILABLE');
   const selected=credentialsForCall?createRetainedHttpTransport({...c,getCredentials:credentialsForCall(operation,call)}):transport;
   const body=requestBody?frozenData(requestBody(current)):current.request;
   const result=await selected.read(current,{path:fixed[operation.id],method:'POST',body,serviceSecret:true,...(observation?{observation}:{})});
   const received=resultBody?frozenData(await resultBody(current,result,call)):result;
   try{contract.assertOutput(received,{request:current.request,...current.normalizationContext});}catch{deny('INVALID_RESULT');}
   if(current.signal?.aborted)deny('CANCELLED');if(c.now()>=current.deadlineMs)deny('DEADLINE');
   return JSON.stringify({binding:current.authority.binding,subject:current.authority.subject,operation,argumentsSha256:current.argumentsSha256,result:received});
  }catch(error){throw safeFailure(error);}}};
 });
}
