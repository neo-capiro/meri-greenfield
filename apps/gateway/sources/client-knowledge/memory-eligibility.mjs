/** Exact passive eligibility receipt correlation; the native owner decides recall eligibility. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {assertPins,frozenData,ownFields} from './request-context.mjs';

export async function assertMemoryEligibility({result,context,pins,readMemoryEligibility,lifetime,active,limit,deadline}) {
  const resultSha256=canonicalSha256(result);
  const records=frozenData((result.records??[]).map(record=>({memoryItemId:record.recordId,recordSha256:canonicalSha256(record)})));
  const started=active();
  const receipt=frozenData(await lifetime.run(signal=>{active();return readMemoryEligibility(Object.freeze({
    ...pins,resultSha256,records,deadlineMs:deadline(),signal}));}));
  ownFields(receipt,['operation','argumentsSha256','metadata','normalizationContext','requestSha256','binding','subject','policyRevision',
    'sourceIds','resultSha256','checkedAtMs','expiresAtMs','records']);
  assertPins(receipt,pins);
  const checked=active();
  if(receipt.resultSha256!==resultSha256||!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>checked||
      !Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=checked||receipt.expiresAtMs>deadline()||
      receipt.checkedAtMs>=receipt.expiresAtMs||!Array.isArray(receipt.records)||receipt.records.length!==records.length)deny('ACCESS_DENIED');
  const seen=new Set();
  for(const row of receipt.records) {
    ownFields(row,['memoryItemId','recordSha256','eligibleForRecall']);
    if(row.eligibleForRecall!==true||seen.has(row.memoryItemId)||!records.some(record=>
      record.memoryItemId===row.memoryItemId&&record.recordSha256===row.recordSha256))deny('ACCESS_DENIED');
    seen.add(row.memoryItemId);
  }
  // No filtering, approval, rewriting governance, or recounting incomplete recall.
  limit(receipt.expiresAtMs);context.active();
}
