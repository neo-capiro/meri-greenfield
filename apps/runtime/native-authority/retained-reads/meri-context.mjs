/** Joins real accepted conversation/request rows to the SAME admitted task verifier. No journal or issuance. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertNativeReadTaskAssertion,nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {assertRetainedObservation} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw nativeReadFault('ACCESS_DENIED');};
export function createRetainedMeriContext(configuration){
 const c=own(configuration,['binding','expiresAtMs'],['store','taskVerifier','taskCapability','enabled','now']),binding=data(c.binding),enabled=c.enabled??false,now=c.now??Date.now;
 validateShape('RunBinding',binding);if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(c.expiresAtMs))throw nativeReadFault('CONFIGURATION');const ready=Boolean(enabled&&c.store&&c.taskVerifier&&typeof c.taskCapability==='string');
 const read=ready?storageMethod(c.store,'read'):null,verify=ready?storageMethod(c.taskVerifier,'verify'):null;
 async function readCurrent(raw){let life;try{if(!ready)throw nativeReadFault('UNAVAILABLE');const {signal,...fields}=own(raw,['binding','subject','operation','requestSha256','policyRevision','sourceIds','request','observationAt','deadlineMs'],['signal']);nativeSignal(signal);const proof=assertRetainedObservation(fields);
  if(!same(proof.binding,binding))deny();const started=now(),inputSha256=hash(proof),operation='runner/reads/execute';let expiresAtMs=Math.min(c.expiresAtMs,proof.deadlineMs);life=createOperationLifetime({now,deadlineMs:expiresAtMs,signal,errorFactory:nativeReadFault});
  async function admission(){const began=now(),receipt=assertNativeReadTaskAssertion(await life.run(signal=>verify({capability:c.taskCapability,binding,operation,inputSha256,signal,deadlineMs:expiresAtMs})),{binding,operation,inputSha256,started:began,now});
   if(receipt.policyRevision!==proof.policyRevision||proof.subject.scopes.some(s=>!receipt.scopes.some(t=>same(t,s))))deny();expiresAtMs=Math.min(expiresAtMs,receipt.expiresAtMs);life.limitDeadline(expiresAtMs);return receipt;}
  const before=await admission(),row=data(await life.run(()=>read(binding,{},life.check)));validateShape('Run',row.run);
  if(!same(row.run.binding,binding)||!['queued','starting','running'].includes(row.run.state)||row.run.policyRevision!==proof.policyRevision||!same(row.run.scopes,before.scopes)||hash(row.request)!==before.runRequestSha256)deny();
  const after=await admission();if(!same({...before,checkedAtMs:0,expiresAtMs:0,authorizationDecisionId:''},{...after,checkedAtMs:0,expiresAtMs:0,authorizationDecisionId:''}))deny();life.check();
  return data({assertion:after,runRequestSha256:hash(row.request),checkedAtMs:now(),expiresAtMs});
 }finally{life?.close();}}
 return Object.freeze({available:ready,readCurrent});
}
