// Private stored-disclosure DTO boundary; no source reads, identity decisions,
// Decimal reconstruction, pagination state or import-time resource allocation.
import {snapshotOperationData} from './operation-contracts.mjs';

const fail=message=>{throw new Error(message);};
const families=Object.freeze({search_sec_filings:'Sec',search_fara_registrations:'Fara',search_lda_filings:'Lda'});
function family(operation) {
  if (!Object.hasOwn(families,operation)) fail('Unknown disclosures operation');
  return families[operation];
}
const optional=(value,max)=>typeof value==='string' && value.trim() ? value.trim().slice(0,max) : null;
function bounded(value,max,fallback) {
  const parsed=typeof value==='number' ? value : typeof value==='string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(1,Math.min(max,Math.trunc(parsed))) : fallback;
}
function instant(value) {
  const time=Date.parse(value);
  if (!Number.isFinite(time)) fail('Disclosures timestamp must be finite');
  return time;
}
function observations(rows,key) {
  let previous=Infinity;
  for (const row of rows) if (row[key]!==null) {
    const time=instant(row[key]);
    if (time>previous) fail('Disclosure observations must descend');
    previous=time;
  }
  // Nullable storage dates do not supply a separate application ordering or
  // snapshot boundary. Equal timestamps require no fabricated tie-breaker.
}
function distinct(rows,key) {
  if (new Set(rows.map(row=>row[key])).size!==rows.length) fail('Duplicate disclosure record identity');
}
function summary(value) {
  if (value.length>300 || value.trim()!==value || /[^\S ]| {2}/u.test(value))
    fail('Disclosure summary exceeds its normalized UTF-16 projection');
}
function storedDate(value) {
  if (value!==null && instant(value)%86400000!==0) fail('Disclosure stored date must identify UTC midnight');
}

export function createDisclosuresValidators({validateShape}) {
  function normalizeDisclosuresInput(operation,request,options={}) {
    const mode=family(operation), raw=snapshotOperationData(request), context=snapshotOperationData(options);
    validateShape('DisclosuresContext',context);
    validateShape(`Disclosures${mode}Request`,raw);
    const input={limit:bounded(raw.limit,50,mode==='Lda'?15:20)};
    const put=(key,value)=>{if (value!==null) input[key]=value;};
    if (mode==='Sec') {
      put('query',optional(raw.query,240)??optional(raw.companyName,240));
      put('formType',optional(raw.formType,20));put('cik',optional(raw.cik,20));
    } else if (mode==='Fara') {
      put('query',optional(raw.query,240));
      put('registrantName',optional(raw.registrantName,240)??optional(raw.registrant,240));
      put('foreignPrincipal',optional(raw.foreignPrincipal,240));
      put('country',optional(raw.country,120));put('status',optional(raw.status,20));
    } else {
      put('clientName',optional(raw.clientName,200)??optional(raw.query,200));
      put('registrantName',optional(raw.registrantName,200)??optional(raw.registrant,200));
      put('issueCode',optional(raw.issueCode,120)??optional(raw.issue,120));
      input.page=bounded(raw.page,100,1);
      // The producer Number-converts a truthy raw year; the service filters only
      // a truthy converted year. Zero/NaN therefore have no effective filter.
      if (raw.year) {
        const year=Number(raw.year);
        if (!Number.isNaN(year) && year!==0) input.year=year;
      }
    }
    // Finite fractional/out-of-Int32 years would reach an invalid database
    // selector in the producer. Meri rejects them before any source adapter.
    validateShape(`Disclosures${mode}Input`,input);
    return input;
  }

  function assertDisclosuresOutput(operation,result,request,options={}) {
    const mode=family(operation), input=normalizeDisclosuresInput(operation,request,options), page=snapshotOperationData(result);
    validateShape(`Disclosures${mode}Output`,page);instant(page.generatedAt);
    if (page.data.length>input.limit) fail('Disclosure rows exceed requested bound');
    // Rows/counts are separate queries. Never require total>=data.length or
    // derive hasMore/complete/absence from that independent observation.
    if (mode==='Sec') {
      distinct(page.data,'id');distinct(page.data,'accessionNumber');observations(page.data,'filingDate');
      for (const row of page.data) {
        summary(row.description);storedDate(row.filingDate);
        if ((input.formType!==undefined && row.formType!==input.formType) ||
            (input.cik!==undefined && row.cik!==input.cik)) fail('SEC exact selector mismatch');
      }
    } else if (mode==='Fara') {
      distinct(page.data,'id');distinct(page.data,'registrationNumber');observations(page.data,'registrationDate');
      for (const row of page.data) {
        summary(row.description);storedDate(row.registrationDate);
        if (input.status!==undefined && row.status!==input.status) fail('FARA exact status mismatch');
      }
    } else {
      if (page.page!==input.page || page.limit!==input.limit) fail('LDA page/window substitution');
      distinct(page.data,'filingUuid');observations(page.data,'dtPosted');
      for (const row of page.data) {
        if ((input.year!==undefined && row.filingYear!==input.year) ||
            (input.issueCode!==undefined && !row.issueCodes.includes(input.issueCode)))
          fail('LDA exact year/issue selector mismatch');
      }
    }
    return result;
  }
  return {normalizeDisclosuresInput,assertDisclosuresOutput};
}
