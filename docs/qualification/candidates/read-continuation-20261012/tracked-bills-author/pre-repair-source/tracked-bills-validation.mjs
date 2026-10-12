// Pure private tracking projection. The original-reference/subject association
// must come from a trusted resolver; its shape is not current access or a grant.
import {snapshotOperationData} from './operation-contracts.mjs';

const fail=message=>{throw new Error(message);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function instant(value) {
  const time=Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString()!==value)
    fail('Tracked bill timestamp must use admitted source ISO serialization');
  return time;
}

export function createTrackedBillsValidators({validateShape,assertSubject,canonicalSha256}) {
  function selection(request,options) {
    const raw=snapshotOperationData(request), context=snapshotOperationData(options);
    validateShape('TrackedBillsRequest',raw);validateShape('TrackedBillsContext',context);
    assertSubject(context.subject,context.binding);
    if (context.subject.kind!=='client' || context.subject.entityType!=='client' ||
        context.subject.entityIds.length!==1) fail('One resolved client subject required');
    const reference=raw.clientId.trim().slice(0,80), clientId=context.subject.entityIds[0];
    if (!reference || reference!==context.clientReference)
      fail('Tracked bill client reference differs from trusted resolution');
    // Name equality/collation is a source resolver obligation. UUID references
    // already identify a client and cannot be rebound to a different subject.
    if (UUID.test(reference.trim()) && reference.trim().toLowerCase()!==clientId.toLowerCase())
      fail('Tracked bill UUID selector differs from resolved client');
    const input={clientId};validateShape('TrackedBillsInput',input);
    return {input,context};
  }
  function normalizeTrackedBillsInput(request,options={}) {
    return selection(request,options).input;
  }
  function assertTrackedBillsResult(result,request,options={}) {
    const {input,context}=selection(request,options), page=snapshotOperationData(result);
    validateShape('TrackedBillsResult',page);assertSubject(page.subject,page.binding);
    if (canonicalSha256(page.binding)!==canonicalSha256(context.binding) ||
        canonicalSha256(page.subject)!==canonicalSha256(context.subject))
      fail('Tracked bill result differs from current context lineage');
    const data=page.data;
    instant(data.generatedAt);
    if (data.clientId!==input.clientId || data.total!==data.bills.length)
      fail('Tracked bill client/count substitution');
    if (new Set(data.bills.map(row=>row.id.toLowerCase())).size!==data.bills.length ||
        new Set(data.bills.map(row=>row.billId)).size!==data.bills.length)
      fail('Duplicate tracking row or tracked bill identity');
    let previous=Infinity;
    for (const row of data.bills) {
      const created=instant(row.createdAt);
      if (created>previous) fail('Tracking rows must descend by creation time');
      previous=created;
      if (row.bill!==null) {
        if (row.bill.identifier!==row.billId) fail('Global bill enrichment identity mismatch');
        if (row.bill.latestActionDate!==null && instant(row.bill.latestActionDate)%86400000!==0)
          fail('Global bill latest action uses a stored SQL date');
      }
    }
    // No page/limit slicing, invented action/subject ordering, current legislative
    // truth, global bill visibility or coverage inference from this returned set.
    return result;
  }
  return {normalizeTrackedBillsInput,assertTrackedBillsResult};
}
