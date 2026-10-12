// Pure private District Nexus projection boundary. No source/flag/policy reads.
// The lineage wrapper is a new Meri contract, not a legacy authorization proof.
import {snapshotOperationData} from './operation-contracts.mjs';

const fail = message => { throw new Error(message); };
const CONTEXT='get_district_nexus_context', CHANGES='get_district_nexus_changes';
function kind(operation) {
  if (operation===CONTEXT) return 'Context';
  if (operation===CHANGES) return 'Changes';
  fail('Unsupported District Nexus operation');
}
function instant(value) {
  const time=Date.parse(value);
  if (!Number.isFinite(time)) fail('District timestamp must identify a finite instant');
  return time;
}

export function createDistrictNexusValidators({validateShape, assertSubject, canonicalSha256}) {
  function context(raw) {
    const value=snapshotOperationData(raw);
    validateShape('DistrictNexusContext',value);
    assertSubject(value.subject,value.binding);
    if (value.subject.kind!=='client' || value.subject.entityType!=='client' || value.subject.entityIds.length!==1)
      fail('One current client subject required');
    return value;
  }

  function normalizeDistrictNexusInput(operation, raw, options={}) {
    const type=kind(operation), input=snapshotOperationData(raw), ctx=context(options);
    validateShape(`DistrictNexus${type}Input`,input);
    const selected={clientId:input.clientId.trim(),state:input.state.trim().toUpperCase(),district:input.district.trim()};
    if (selected.clientId!==ctx.subject.entityIds[0]) fail('District client differs from selected subject');
    if (type==='Changes') {
      selected.since=null;
      if (input.since!==undefined) {
        if (!/^\d{4}-\d{2}-\d{2}T/.test(input.since)) fail('District since requires an ISO timestamp prefix');
        selected.since=new Date(instant(input.since)).toISOString();
      }
    }
    validateShape(`DistrictNexus${type}Selection`,selected);
    return selected;
  }

  function assertDistrictNexusReadResult(operation, page, raw, options={}) {
    const type=kind(operation), selected=normalizeDistrictNexusInput(operation,raw,options);
    const value=snapshotOperationData(page), ctx=context(options);
    validateShape(`DistrictNexus${type}Result`,value);
    assertSubject(value.subject,value.binding);
    if (canonicalSha256(value.binding)!==canonicalSha256(ctx.binding) ||
        canonicalSha256(value.subject)!==canonicalSha256(ctx.subject))
      fail('District result differs from current binding/subject');
    const result=value.data;
    if (!result.available) return page;
    if (result.clientId!==selected.clientId || result.state!==selected.state || result.district!==selected.district)
      fail('District result selector mismatch');
    instant(result.generatedAt);
    if (type==='Changes') {
      if (result.truncated!==(result.changes.length===20)) fail('District changes truncation differs from returned bound');
      let previous=Infinity;
      for (const change of result.changes) {
        const observed=instant(change.observedAt);
        if (observed>previous || (selected.since!==null && observed<instant(selected.since)))
          fail('District changes must descend and honor inclusive since');
        previous=observed;
        if (change.effectiveAt!==null) instant(change.effectiveAt);
      }
      if (result.gaps.some(gap=>gap.source==='district_nexus_change' && gap.reason==='Change ledger unavailable') &&
          result.changes.length!==0) fail('Unavailable district ledger cannot supply changes');
    } else {
      // The source always reserves one gap slot for possible fact overflow.
      // Exactly 30 original gaps can therefore return 29 and truncated:false.
      if (result.gaps.length===30 && (!result.truncated || result.facts.length!==40))
        fail('District context full gap page requires reported fact truncation');
      for (const fact of result.facts) {
        if (fact.geography.state!==selected.state ||
            (fact.geography.district!==null && fact.geography.district!==selected.district) ||
            (fact.geography.scope==='district' && fact.geography.district===null))
          fail('District fact geography differs from selection');
      }
    }
    // Reported basis/coverage/freshness remain source claims. Neither empty
    // changes nor truncated:false proves absence, completeness or current access.
    return page;
  }
  return {normalizeDistrictNexusInput,assertDistrictNexusReadResult};
}
