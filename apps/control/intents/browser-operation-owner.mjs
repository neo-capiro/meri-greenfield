/** One browser call's custody in the EXISTING intent journal.
 *
 * A browser call is claimed before the host effect runs and settled only on evidence, exactly like the
 * other deliveries. The row lives in meri_intents.preparations with the table's exact two-key record;
 * this module owns the descriptor preimage, the domain-separated delivery identity and the closed
 * verify variants the later download ingress can bind to.
 *
 * This is EXECUTION custody, not approval: the delivery domain tag differs from the approval domain, so
 * a browser execution row can never be read as an approval proposal, and no approval operation is
 * admitted by the internal registration.
 */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertBrowserOperationDescriptor,browserOperationArgumentsSha256,browserOperationRecord,
 browserExecutionDeliveryId,BROWSER_OPERATION_CONTRACT} from '../../../packages/contracts/runtime-0.2/browser-operation.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);

export function createBrowserOperationOwner({journal}={}){
 if(typeof journal?.begin!=='function'||typeof journal?.settle!=='function'||typeof journal?.read!=='function')
  throw fail('BROWSER_OPERATION_CONFIGURATION');

 function prepare(value){
  const v=own(data(value),['binding','requestId','tool','inputSha256','policySha256','scopes'],['signal']);
  validateShape('RunBinding',data(v.binding));
  const descriptor=assertBrowserOperationDescriptor({schema:'meri-browser-operation-descriptor/1',
   binding:v.binding,requestId:v.requestId,tool:v.tool,inputSha256:v.inputSha256,policySha256:v.policySha256,scopes:v.scopes});
  return {descriptor,record:browserOperationRecord(descriptor),
   deliveryId:browserExecutionDeliveryId({binding:v.binding,requestId:v.requestId}),signal:v.signal};
 }
 /** Claim before dispatch. `dispatch:true` means the caller is the single owner of this browser call;
   * every other answer is a replay or an unresolved delivery and must NOT call the host effect again. */
 async function claim(value){
  const {descriptor,record,deliveryId,signal}=prepare(value);
  let ack;
  try{ack=await journal.begin({binding:descriptor.binding,deliveryId,record,signal});}
  catch(error){
   // The journal answers UNKNOWN for PENDING/UNKNOWN rows and rethrows a retained owner refusal.
   if(error?.code==='UNKNOWN')return Object.freeze({dispatch:false,variant:'unresolved',deliveryId,
    argumentsSha256:record.argumentsSha256,result:null,release:null,descriptor});
   if(error?.code&&error.replayed===true)return Object.freeze({dispatch:false,variant:'refused',deliveryId,
    argumentsSha256:record.argumentsSha256,code:error.code,descriptor});
   throw error;
  }
  if(ack.claimed===true)return Object.freeze({dispatch:true,variant:'claimed',deliveryId,argumentsSha256:record.argumentsSha256,descriptor});
  return Object.freeze({dispatch:false,variant:'replayed',deliveryId,argumentsSha256:record.argumentsSha256,
   result:ack.result??null,release:ack.release??null,descriptor});
 }
 /** Settle only after the effect answered. PREPARED carries the result and its release window. */
 async function settle(value){
  const v=own(data(value),['binding','requestId','tool','inputSha256','policySha256','scopes','state','outcome'],['signal']);
  const {descriptor,record,deliveryId}=prepare({binding:v.binding,requestId:v.requestId,tool:v.tool,
   inputSha256:v.inputSha256,policySha256:v.policySha256,scopes:v.scopes});
  await journal.settle({binding:descriptor.binding,deliveryId,record,state:v.state,outcome:v.outcome,signal:v.signal});
  return Object.freeze({settled:true,deliveryId,argumentsSha256:record.argumentsSha256,state:v.state});
 }
 /** Closed read for a later download ingress. A caller's digest alone is never proof: the acknowledged
   * row, its exact record and the expected descriptor digest must all agree. */
 async function verify({binding,requestId,descriptorSha256,signal}={}){
  const b=data(binding);validateShape('RunBinding',b);
  if(typeof descriptorSha256!=='string'||!/^[0-9a-f]{64}$/u.test(descriptorSha256))throw fail('BROWSER_OPERATION_REFUSED');
  const deliveryId=browserExecutionDeliveryId({binding:b,requestId});
  const entry=await journal.read({binding:b,deliveryId,signal});
  if(entry===null)return Object.freeze({variant:'absent',deliveryId});
  const record=data(entry.record);
  if(!same(record.operation,BROWSER_OPERATION_CONTRACT)||record.argumentsSha256!==descriptorSha256)
   throw fail('BROWSER_OPERATION_CONFLICT');
  const base={deliveryId,argumentsSha256:record.argumentsSha256};
  if(entry.state==='PENDING'||entry.state==='UNKNOWN')return Object.freeze({...base,variant:'in-flight',state:entry.state});
  if(entry.state==='PREPARED'){
   const result=entry.outcome?.result??null,release=entry.outcome?.release??null;
   if(result===null||release===null)throw fail('BROWSER_OPERATION_UNKNOWN');
   // The retained release window must still be current for the caller's own binding.
   if(!same(release.binding,b)||release.expiresAtMs<=Date.now())throw fail('BROWSER_OPERATION_RELEASE_EXPIRED');
   return Object.freeze({...base,variant:'dispatched',state:'PREPARED',result,release});
  }
  if(entry.state==='FAILED')return Object.freeze({...base,variant:'refused',state:'FAILED',code:entry.outcome?.code??null});
  throw fail('BROWSER_OPERATION_UNKNOWN');
 }
 return Object.freeze({claim,settle,verify,operation:BROWSER_OPERATION_CONTRACT,
  argumentsSha256:browserOperationArgumentsSha256});
}
