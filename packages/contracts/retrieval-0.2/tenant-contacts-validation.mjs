// Pure private tenant-contact projection. Current access and unreturned client
// profile/domain facts belong to the source adapter, never to model selectors.
import {snapshotOperationData} from './operation-contracts.mjs';

const fail=message=>{throw new Error(message);};
const optional=value=>typeof value==='string' && value.trim() ? value.trim().slice(0,200) : null;
const key=value=>value===null ? '' : value.trim().toLowerCase();
function instant(value) {
  const time=Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString()!==value)
    fail('Tenant contact timestamp must use source ISO serialization');
  return time;
}

export function createTenantContactsValidators({validateShape}) {
  function normalizeTenantContactsInput(request,options={}) {
    const raw=snapshotOperationData(request), context=snapshotOperationData(options);
    validateShape('TenantContactsContext',context);validateShape('TenantContactsRequest',raw);
    const parsed=typeof raw.limit==='number' ? raw.limit : typeof raw.limit==='string' ? Number(raw.limit) : NaN;
    const input={clientId:optional(raw.clientId),domain:optional(raw.domain)?.trim().toLowerCase()??null,
      query:optional(raw.query)?.trim()??null,limit:Number.isFinite(parsed)?Math.max(1,Math.min(100,Math.trunc(parsed))):25};
    validateShape('TenantContactsInput',input);
    return input;
  }

  function assertTenantContactsResult(result,request,options={}) {
    const selected=normalizeTenantContactsInput(request,options), page=snapshotOperationData(result);
    validateShape('TenantContactsResult',page);instant(page.generatedAt);
    const linked=selected.clientId!==null, hasSelector=linked || selected.domain!==null || selected.query!==null;
    if (!hasSelector) {
      validateShape('TenantContactsRefusal',page);
      return result;
    }
    validateShape('TenantContactsPage',page);
    if ((page.clientId!==null)!==linked || page.matchedOn.linkedClient!==linked ||
        (!linked && page.clientName!==null) || page.matchedOn.query!==selected.query)
      fail('Tenant contacts selected client/query projection mismatch');
    if (selected.domain!==null ? page.matchedOn.domain!==selected.domain : !linked && page.matchedOn.domain!==null)
      fail('Tenant contacts explicit domain projection mismatch');
    if (page.contacts.length>selected.limit) fail('Tenant contacts exceed selected window');
    let previous=Infinity, nullSeen=false;
    for (const contact of page.contacts) {
      if (contact.lastContact===null) nullSeen=true;
      else {
        const time=instant(contact.lastContact);
        if (nullSeen || time>previous) fail('Tenant contacts must descend by returned last contact');
        previous=time;
      }
      // No normalized email means the producer never reads history for this row.
      if (!key(contact.email) && (contact.messageCount!==0 || contact.lastContact!==null))
        fail('Email-less tenant contact cannot report lookup history');
      if (contact.onProfile && (!linked || (!key(contact.email) && !key(contact.name))))
        fail('Tenant contact profile assertion lacks a selected client or identity');
      // SQL OR predicates cannot match NULL fields. Do not reimplement database
      // collation, claim the unprojected linked client, or infer source coverage.
      if (!linked && contact.email===null && (selected.query===null || contact.name===null))
        fail('Tenant contact has no field eligible for selected search');
    }
    const count=page.contacts.length, missing=page.contacts.filter(row=>!row.onProfile).length;
    const note=linked
      ? `${count} correspondent(s) found; ${missing} not yet on the People tab. These come from synced mail and calendar — cite them as such. Propose only the missing ones via update_client_profile people[].`
      : `${count} correspondent(s) found from synced mail and calendar.`;
    if (page.note!==note) fail('Tenant contact note differs from returned profile window');
    // This legacy guidance neither registers nor permits deferred profile writes.
    // onProfile and inferred organization remain unverified source assertions.
    return result;
  }
  return {normalizeTenantContactsInput,assertTenantContactsResult};
}
