/** Trusted-owner receipt data checks. Receipts are expectations, never authenticated by hash shape. */
import {obj,uuid,sha,time} from './shapes.mjs';
export const admissionReceiptShape=obj({kind:{const:'meri-admission-observation/1'},receiptRef:uuid,requestSha256:sha,applicationTargetSha256:sha,associationSha256:sha,observedAtMs:time});
export const completionReceiptShape=obj({kind:{const:'meri-result-custody-receipt/1'},receiptRef:uuid,associationSha256:sha,resultRef:uuid,resultSha256:sha,durableCompletedAtMs:time});
// Separate destination receipt proposal: it is not part of Meri custody or proof of product persistence.
export const backendApplicationReceiptShape=obj({kind:{const:'backend-application-receipt/1'},receiptRef:uuid,associationSha256:sha,applicationTargetSha256:sha,resultRef:uuid,resultSha256:sha,nativeReceiptRef:uuid,appliedAtMs:time});
export function trustedTime(nowMs,fail){if(!Number.isSafeInteger(nowMs)||nowMs<0)fail();}
export function checkAdmission(r,{observedAtMs,nowMs},{fail}){
 trustedTime(nowMs,fail);trustedTime(observedAtMs,fail);
 if(r.requestedAtMs>observedAtMs||observedAtMs>nowMs||observedAtMs>=r.originalExpiresAtMs)fail();
}
export function checkReceipts(v,r,a,{admission,completion,nowMs,retained},{hash,fail}){
 checkAdmission(r,{observedAtMs:admission.observedAtMs,nowMs},{fail});
 if(admission.receiptRef!==v.admissionReceiptRef||hash(admission)!==v.admissionReceiptSha256||completion.receiptRef!==v.completionReceiptRef||admission.requestSha256!==hash(r)||admission.applicationTargetSha256!==hash(r.applicationTarget)||admission.associationSha256!==hash(a)||completion.associationSha256!==hash(a)||completion.resultRef!==v.resultRef||completion.resultSha256!==v.resultSha256)fail();
 if(v.completedAtMs<admission.observedAtMs||v.completedAtMs>completion.durableCompletedAtMs||completion.durableCompletedAtMs>nowMs)fail();
 const accountingOnly=v.state==='failed'||v.state==='cancelled';
 if(!accountingOnly&&(completion.durableCompletedAtMs>=r.originalExpiresAtMs||!retained&&nowMs>=r.originalExpiresAtMs))fail();
}
