import {snapshotOperationData} from './operation-contracts.mjs';
import {assertPeContractorCorrelations} from './pe-contractors-validation.mjs';
const fail=message=>{throw new Error(message);};
const families=Object.freeze({get_pe_bills:'PeBills',get_pe_contractors:'PeContractors',get_pe_report_language:'PeReportLanguage'});
function family(operation){
  if(typeof operation!=='string'||!Object.hasOwn(families,operation))fail('Unknown PE reference operation');
  return families[operation];
}
function instant(value,dateOnly=false){
  const at=Date.parse(value);
  if(!Number.isFinite(at)||new Date(at).toISOString()!==value||dateOnly&&at%86400000!==0)fail('Invalid PE serialized date');
  return at;
}
function unique(rows,key){if(new Set(rows.map(row=>row[key])).size!==rows.length)fail('Duplicate PE projection identity');}
export function createPeReferenceValidators({validateShape,schema}) {
  function normalizePeReferenceInput(operation,value,options){
    const name=family(operation),raw=snapshotOperationData(value),context=snapshotOperationData(options);
    validateShape('PeReferenceContext',context);validateShape(`${name}Request`,raw);
    const input={peCode:raw.peCode.trim().slice(0,32)};validateShape(`${name}Input`,input);return input;
  }
  function bills(page){
    unique(page.bills,'id');let previous;
    for(const row of page.bills){
      const date=row.latestActionDate===null?0:instant(row.latestActionDate,true);
      if(previous&&(row.peCodeCount<previous.count||row.peCodeCount===previous.count&&date>previous.date))fail('PE bill specificity/date order mismatch');
      previous={count:row.peCodeCount,date};
    }
  }
  function provisions(page,input){
    if(page.peCode!==input.peCode)fail('PE report selector substitution');
    unique(page.provisions,'id');let previous,programs=0;
    for(const row of page.provisions){
      const basis=row.matchBasis==='pe_code'?0:row.matchBasis==='project_title'?1:2;
      const scope=basis<2?'pe_specific':'program_level';
      if(row.matchScope!==scope||row.attributionCaveat!==(scope==='program_level'?schema.$defs.PeProgramAttributionCaveat.const:null))fail('PE report attribution mismatch');
      if(scope==='program_level')programs++;
      const order=[row.reviewStatus==='accepted'?0:1,basis,-row.fy,-row.confidence];
      if(previous){const differing=order.findIndex((value,index)=>value!==previous[index]);if(differing>=0&&order[differing]<previous[differing])fail('PE report source order mismatch');}
      previous=order;
    }
    const expected=!page.provisions.length?schema.$defs.PeNoReportNote.const:programs?
      `${programs} of ${page.provisions.length} linked provision(s) are PROGRAM-LEVEL matches (matched via a program alias, because FY committee reports name programs, not PE codes). They may apply to sibling PEs in the same program — attribute such language at the program level, not exclusively to this budget line. Each carries matchScope:"program_level" and an attributionCaveat.`:null;
    if(expected===null?Object.hasOwn(page,'note'):page.note!==expected)fail('PE report coverage note mismatch');
  }
  function assertPeReferenceOutput(operation,value,raw,options){
    const name=family(operation),input=normalizePeReferenceInput(operation,raw,options),page=snapshotOperationData(value);
    validateShape(`${name}Output`,page);instant(page.generatedAt);
    if(operation==='get_pe_bills')bills(page);
    else if(operation==='get_pe_report_language')provisions(page,input);
    else {assertPeContractorCorrelations(page);if(page.todo===null)instant(page.evidence.federalAwards.provenance.asOf);}
    return value;
  }
  return {normalizePeReferenceInput,assertPeReferenceOutput};
}
