/** Actual producer/canonical-run custody join. No producer is fabricated: missing genuine run/job correlation stays unavailable. */
import {own,data,continuationWork,coreDigest,fail} from './contract.mjs';
import {canonicalSha256 as meriHash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {strategyApplication} from '../core-receipts.mjs';
import {ProductError,productFailure} from '../../product-access/errors.mjs';
export function createContinuationAdmission({producer,runs,now=Date.now,maxRequestMs=3000}){
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 const available=()=>typeof producer?.admit==='function'&&typeof runs?.readOptional==='function';
 async function check(value){
  const {work:raw,phase,deadlineMs,signal}=own(value,['work','phase','deadlineMs'],['signal']),w=continuationWork(raw);nativeSignal(signal);
  if(!available())fail('PRODUCER_UNAVAILABLE');if(!['start','prepare','read','stop'].includes(phase)||!Number.isSafeInteger(deadlineMs))fail('CONFIGURATION');
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+maxRequestMs),errorFactory:code=>new ProductError('OBJECTIVE_PLANNER_'+code)});
  try{
   const began=now(),p=data(own(await life.run(signal=>producer.admit({work:w,phase,signal,deadlineMs})),['workSha256','sourceBinding','sourceRequestSha256','generationStatus','objectiveReceipt','checkedAtMs','expiresAtMs']));
   validateShape('RunBinding',p.sourceBinding);
   if(p.workSha256!==coreDigest(w)||p.sourceBinding.tenantId!==w.canonical.tenantId||!Number.isSafeInteger(p.checkedAtMs)||p.checkedAtMs<began||p.checkedAtMs>now()||!Number.isSafeInteger(p.expiresAtMs)||p.expiresAtMs<=now())fail('ACCESS_DENIED');life.limitDeadline(p.expiresAtMs);
   const applied=strategyApplication({receipt:p.objectiveReceipt,status:p.generationStatus,canonical:w.canonical});
   if(applied.generationRequestId!==w.generationRequestId||applied.strategyId!==w.strategyId||applied.strategyVersionId!==w.strategyVersionId||coreDigest(p.objectiveReceipt)!==w.objectiveReceiptSha256)fail('SOURCE_STALE');
   const saved=data(await life.run(()=>runs.readOptional(p.sourceBinding,{},life.check)));life.check();
   // Run status is not proof of application. The producer must bind the actual Core receipt to this immutable accepted request.
   if(!saved||meriHash(saved.run?.binding)!==meriHash(p.sourceBinding)||meriHash(saved.request)!==p.sourceRequestSha256)fail('CUSTODY_UNAVAILABLE');
   return data({workSha256:p.workSha256,sourceBinding:p.sourceBinding,sourceRequestSha256:p.sourceRequestSha256,expiresAtMs:p.expiresAtMs});
  }catch(error){if(productFailure(error))throw error;fail('PRODUCER_UNAVAILABLE');}finally{life.close();}
 }
 return Object.freeze({available,check});
}
