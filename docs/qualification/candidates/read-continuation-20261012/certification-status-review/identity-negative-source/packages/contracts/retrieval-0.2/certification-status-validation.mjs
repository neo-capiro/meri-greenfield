import {snapshotOperationData} from './operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
function instant(value){
  const at=Date.parse(value);
  if(!Number.isFinite(at)||new Date(at).toISOString()!==value)fail('Invalid certification serialized observation');
}
export function createCertificationStatusValidators({validateShape,schema}) {
  function context(value){
    const selected=snapshotOperationData(value);validateShape('CertificationStatusContext',selected);
    let canonical;
    try{canonical=Intl.getCanonicalLocales(selected.comparisonLocale);}catch{fail('Invalid certification comparison locale');}
    if(canonical.length!==1||canonical[0]!==selected.comparisonLocale)fail('Certification comparison locale must be canonical');
    // Supported locale admission is separate from actual source-adapter casing
    // qualification. Neither canonical spelling nor ICU support proves it.
    if(Intl.Collator.supportedLocalesOf(canonical,{localeMatcher:'lookup'}).length!==1)fail('Unsupported certification comparison locale');
    return selected;
  }
  function normalizeCertificationStatusInput(value,options){
    context(options);const raw=snapshotOperationData(value);validateShape('CertificationStatusRequest',raw);
    const input={program:raw.program,query:raw.query.trim()};validateShape('CertificationStatusInput',input);return input;
  }
  function assertCertificationStatusOutput(value,raw,options){
    const selected=context(options),input=normalizeCertificationStatusInput(raw,selected),page=snapshotOperationData(value);
    validateShape('CertificationStatusOutput',page);
    if(!page.found){
      // Both optional wire keys come from the same first complete source record.
      if(Object.hasOwn(page,'sourceUrl')!==Object.hasOwn(page,'observedAt'))fail('Incomplete certification absence provenance');
      if(Object.hasOwn(page,'observedAt'))instant(page.observedAt);
      return value;
    }
    const records=page.ambiguous?page.candidates:[page.record];
    if(page.ambiguous&&records.length!==Math.min(page.candidateCount,10))fail('Certification candidate window mismatch');
    const fold=text=>text.toLocaleLowerCase(selected.comparisonLocale),query=fold(input.query);
    let observed;
    for(const record of records){
      instant(record.observedAt);if(record.authorizationDate!==null)instant(record.authorizationDate);
      if(observed!==undefined&&observed!==record.observedAt)fail('Certification records mix source observations');
      observed=record.observedAt;
      const exact=fold(record.productId)===query;
      if(page.ambiguous&&exact)fail('Exact certification ID cannot remain an ambiguous candidate');
      if(!exact&&!fold(record.cspName).includes(query)&&!fold(record.csoName).includes(query))fail('Certification record does not match selector');
    }
    // The omitted dataset cannot prove exact-ID absence or completeness. No
    // result here grants current verification, release authority or a new fetch.
    return value;
  }
  return {normalizeCertificationStatusInput,assertCertificationStatusOutput};
}
