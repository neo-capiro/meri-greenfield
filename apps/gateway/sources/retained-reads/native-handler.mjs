/** Shared mechanics for finite stored native producers, with family-owned exact routes and request bridges. */
import {types} from 'node:util';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {retainedCall} from './call-context.mjs';
import {createRetainedHttpTransport} from './http-transport.mjs';
import {NATIVE_READ_FAMILIES} from './native-families.mjs';
const same=(a,b)=>hash(a)===hash(b);

function admitDecision(current,now){
 const a=current.authority;
 try{validateShape('AuthorizationDecision',a.decision);}catch{deny('ACCESS_DENIED');}
 if(a.claims.audience!=='meri-gateway'||!a.claims.actions.includes('tool.read')||a.decision.decision!=='allowed'||
  a.decision.operation!==`${current.operation.id}@${current.operation.version}`||a.decision.decisionId!==a.subject.authorizationDecisionId||
  a.decision.policyRevision!==a.policyRevision||!same(a.decision.actor,{tenantId:a.binding.tenantId,actorId:a.binding.actorId})||
  !same(a.decision.scopes,a.subject.scopes)||a.subject.scopes.some(scope=>!a.claims.scopes.some(parent=>same(scope,parent)))||
  a.claims.scopes.some(scope=>scope.tenantId!==a.binding.tenantId||scope.policyRevision!==a.policyRevision)||Date.parse(a.claims.issuedAt)>now())deny('ACCESS_DENIED');
}

export function createStoredNativeReadHandlers(configuration,operations,specification){
 const {family,routes,requestBody,resultBody}=ownFields(specification,['family','routes'],['requestBody','resultBody']);
 if(!NATIVE_READ_FAMILIES.includes(family)||[requestBody,resultBody].some(value=>value!==undefined&&(typeof value!=='function'||types.isProxy(value))))deny('GATEWAY_CONFIGURATION');
 const fixed=frozenData(routes);
 if(!fixed||Array.isArray(fixed)||typeof fixed!=='object'||!Object.keys(fixed).length)deny('GATEWAY_CONFIGURATION');
 for(const [id,path] of Object.entries(fixed)){
  if(path!==`/api/clio/tools/${id}`)deny('GATEWAY_CONFIGURATION');
  let contract;try{contract=resolveOperationContract({id,version:'0.2.0'});}catch{deny('GATEWAY_CONFIGURATION');}
  if(contract.binding.group!==family||contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none')deny('GATEWAY_CONFIGURATION');
 }
 const {credentialsForCall,...c}=ownFields(configuration,['origin','now'],['getCredentials','credentialsForCall','fetchImpl','maxRequestMs','maxResponseBytes']);
 if(credentialsForCall!==undefined&&(typeof credentialsForCall!=='function'||types.isProxy(credentialsForCall)||c.getCredentials!==undefined))deny('GATEWAY_CONFIGURATION');
 const selectedOperations=frozenData(operations);
 if(!Array.isArray(selectedOperations)||!selectedOperations.length)deny('GATEWAY_CONFIGURATION');
 const transport=createRetainedHttpTransport(c),seen=new Set();
 return selectedOperations.map(reference=>{
  const operation=frozenData(ownFields(reference,['id','version']));
  if(operation.version!=='0.2.0'||!Object.hasOwn(fixed,operation.id)||seen.has(operation.id))deny('GATEWAY_CONFIGURATION');seen.add(operation.id);
  const contract=resolveOperationContract(operation);
  return {operation,async execute(call){try{
   const {signal,...fields}=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']),data=frozenData(fields);
   try{contract.normalizeInput(data.request,data.normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
   const current=retainedCall(operation,{...data,...(signal===undefined?{}:{signal})},c.now);admitDecision(current,c.now);
   const selected=credentialsForCall?createRetainedHttpTransport({...c,getCredentials:credentialsForCall(operation,call)}):transport;
   const body=requestBody?frozenData(requestBody(current)):current.request;
   const result=await selected.read(current,{path:fixed[operation.id],method:'POST',body,serviceSecret:true});
   const received=resultBody?frozenData(await resultBody(current,result,call)):result;
   try{contract.assertOutput(received,{request:current.request,...current.normalizationContext});}catch{deny('INVALID_RESULT');}
   if(current.signal?.aborted)deny('CANCELLED');if(c.now()>=current.deadlineMs)deny('DEADLINE');
   return JSON.stringify({binding:current.authority.binding,subject:current.authority.subject,operation,argumentsSha256:current.argumentsSha256,result:received});
  }catch(error){throw safeFailure(error);}}};
 });
}
