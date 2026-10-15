/** Read-only Temporal evidence for one conversation run: whether its exact workflow ID was ever started. Only the SDK's typed
 * WorkflowNotFoundError counts as proof of absence; a deadline, cancellation, transport or service error is no evidence. */
import {WorkflowNotFoundError} from '@temporalio/client';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {validateShape,fail} from './boundary.mjs';
import {workflowId} from './temporal-dispatch.mjs';
export function createTemporalRunEvidence({client,now=Date.now,maxRequestMs=3000}){
 if(typeof client?.workflow?.getHandle!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('TEMPORAL_CONFIGURATION');
 async function describe({binding,signal,deadlineMs}){
  validateShape('RunBinding',binding);nativeSignal(signal);signal?.throwIfAborted();const began=now();
  if(deadlineMs!==undefined&&(!Number.isSafeInteger(deadlineMs)||deadlineMs<=began))fail('TEMPORAL_EVIDENCE_UNKNOWN');
  let withDeadline,withAbortSignal;try{withDeadline=storageMethod(client.connection,'withDeadline');withAbortSignal=storageMethod(client.connection,'withAbortSignal');}catch{fail('TEMPORAL_TRANSPORT_UNAVAILABLE');}
  const cutoff=Math.min(deadlineMs??began+maxRequestMs,began+maxRequestMs),unknown=()=>Object.assign(Error('TEMPORAL_EVIDENCE_UNKNOWN'),{code:'TEMPORAL_EVIDENCE_UNKNOWN'});
  const life=createOperationLifetime({now,signal,deadlineMs:cutoff,errorFactory:unknown}),id=workflowId(binding);let absent=false;
  try{
   await life.run(rpcSignal=>withDeadline(cutoff,()=>withAbortSignal(rpcSignal,async()=>{
    life.check();
    try{const d=await client.workflow.getHandle(id).describe();if(d?.workflowId!==id)throw unknown();}
    catch(error){if(!(error instanceof WorkflowNotFoundError))throw error;absent=true;}
    life.check();
   })));life.check();
  }catch{throw unknown();}finally{life.close();}
  return absent?'ABSENT':'PRESENT';
 }
 return Object.freeze({describe});
}
