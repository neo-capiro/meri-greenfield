/** Adapt the existing inspect-only Core client to the current native read credential owner. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createWatchCoreClient} from '../../../runtime/native-authority/watch-client.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {retainedCall,credentialProof} from '../retained-reads/call-context.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
const operation=Object.freeze({id:'inspect_watch_state',version:'0.2.0'});
export function createWatchStateHandlers(configuration,operations){
 const c=ownFields(configuration,['origin','now'],['credentialsForCall','readSource','fetchImpl','maxRequestMs','maxResponseBytes']);
 if(hash(operations)!==hash([operation])||typeof c.now!=='function'||c.credentialsForCall!==undefined&&typeof c.credentialsForCall!=='function')deny('GATEWAY_CONFIGURATION');
 return [{operation,async execute(call){try{
  if(c.readSource||!c.credentialsForCall)deny('UNAVAILABLE');
  let current;try{current=retainedCall(operation,call,c.now);}catch(error){throw safeFailure(error);}
  const proof=credentialProof(current,c.origin),borrow=c.credentialsForCall(operation,call);
  let serviceSecret;
  const client=createWatchCoreClient({origin:c.origin,now:c.now,...(c.fetchImpl?{fetchImpl:c.fetchImpl}:{}),maxRequestMs:c.maxRequestMs??10000,
   // This adapter accepts only the per-invocation native owner above. It has no ambient/static credential port.
   reservedCredentials:async()=>new Set(),getServiceSecret:async()=>serviceSecret,
   async getCredentials({signal}){try{
    const receipt=frozenData(await borrow({...proof,input:current.input,deadlineMs:current.deadlineMs,signal}));
    ownFields(receipt,[...Object.keys(proof),'bearerToken','serviceSecret','expiresAtMs'],['authorizationScheme']);
    if(Object.keys(proof).some(key=>hash(receipt[key])!==hash(proof[key]))||![undefined,'Bearer'].includes(receipt.authorizationScheme))deny('ACCESS_DENIED');
    if(serviceSecret!==undefined&&serviceSecret!==receipt.serviceSecret)deny('ACCESS_DENIED');
    serviceSecret=receipt.serviceSecret;
    return {credential:receipt.bearerToken,expiresAtMs:receipt.expiresAtMs};
   }catch(error){const code=safeFailure(error).message;throw Object.assign(Error(code),{code});}}});
  let result;
  try{result=await client.inspect({binding:current.authority.binding,selectedClientId:current.normalizationContext.watchStateScope.selectedClientId,
   target:current.input,signal:current.signal,deadlineMs:current.deadlineMs});}
  catch(error){deny(['ACCESS_DENIED','INVALID_ARGUMENTS','INVALID_RESULT','SOURCE_UNAVAILABLE','DEADLINE','CANCELLED'].includes(error?.code)?error.code:'UNAVAILABLE');}
  try{current.contract.assertOutput(result,{request:current.request,...current.normalizationContext});}catch{deny('INVALID_RESULT');}
  if(current.signal?.aborted)deny('CANCELLED');if(c.now()>=current.deadlineMs)deny('DEADLINE');
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>Math.min(c.maxResponseBytes??32768,current.authority.maxOutputBytes))deny('RESOURCE_LIMIT');
  return JSON.stringify({binding:current.authority.binding,subject:current.authority.subject,operation,argumentsSha256:current.argumentsSha256,result});
 }catch(error){throw safeFailure(error);}}}];
}
