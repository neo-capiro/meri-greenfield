import {snapshotOperationData} from './operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
const families=Object.freeze({search_program_elements:'ProgramElementSearch',get_program_element:'ProgramElementDetail',get_pe_budget_timeline:'ProgramElementTimeline'});
const stages=Object.freeze({request:['Request','request'],hasc:['HASC','authorization'],sasc:['SASC','authorization'],ndaa_conference:['NDAA conference report','authorization_conference'],hacd:['HAC-D','appropriations'],sacd:['SAC-D','appropriations'],appropriations_conference:['Appropriations conference','appropriations_conference'],enacted:['Enacted','enacted'],none:['No data','none']});
const ladder=Object.freeze({request:['Request','request'],hasc:['HASC','authorization'],sasc:['SASC','authorization'],hacd:['HAC-D','appropriation'],sacd:['SAC-D','appropriation'],conference:['Conference','appropriation'],enacted:['Enacted','appropriation'],none:['No data','none']});
const exhibits=Object.freeze({pe:'R-1/R-2 RDT&E Program Element',procurement_line_item:'P-1/P-40 procurement line item (NOT a Program Element)',other:'budget line (exhibit type not classified)'});
const extras=['enactmentStatus','vehicleType','originalUnit','originalValue','source','semantics'];
function family(operation){if(typeof operation!=='string'||!Object.hasOwn(families,operation))fail('Unknown program-element operation');return families[operation];}
function optional(value,max){return typeof value==='string'?(value.trim().slice(0,max)||null):null;}
function clamp(value,min,max,fallback){const n=typeof value==='number'||typeof value==='string'?Number(value):NaN;return Number.isFinite(n)?Math.min(max,Math.max(min,Math.trunc(n))):fallback;}
function instant(value,dateOnly=false){const n=Date.parse(value);if(!Number.isFinite(n)||new Date(n).toISOString()!==value||dateOnly&&n%86400000!==0)fail('Invalid program-element serialized date');return n;}
function identity(value){if(value.budgetExhibitType!==exhibits[value.identifierKind])fail('Budget identity/exhibit mismatch');}
function claim(value,mode){
  if(value===null)return;
  const expected=stages[value.stage];
  if(value.stageLabel!==expected[0]||value.legislativeVehicle!==expected[1]||value.isProjection!==(value.cycleClass==='outyear'))fail('Funding claim stage/vehicle/cycle mismatch');
  if(mode==='enforce'&&!Object.hasOwn(value,'semantics'))fail('Enforced claim semantics required');
  if(mode&&mode!=='enforce'&&extras.some(key=>Object.hasOwn(value,key)))fail('Legacy model claim includes enforced fields');
}
function years(rows,peCode,mode){
  let previous;const ids=new Set();
  for(const row of rows){
    if(row.peCode!==peCode||ids.has(row.id)||previous!==undefined&&row.fy<=previous)fail('Stored year identity/order mismatch');
    ids.add(row.id);previous=row.fy;instant(row.lastSyncedAt);claim(row.fundingClaim,mode);
    if(row.fundingClaim!==null&&row.fundingClaim.fiscalYear!==row.fy)fail('Year claim fiscal year mismatch');
  }
}
function lineage(page,mode){
  if((mode==='enforce')!==Object.hasOwn(page,'lineage'))fail('Evidence-mode lineage mismatch');
  if(!page.lineage)return;
  for(const [bucket,status] of [['accepted','accepted'],['candidates','candidate']])for(const row of page.lineage[bucket])if(row.status!==status)fail('Lineage review bucket mismatch');
}
export function createProgramElementValidators({validateShape,schema}) {
  function normalizeProgramElementInput(operation,value,options){
    const name=family(operation),raw=snapshotOperationData(value),context=snapshotOperationData(options);validateShape('ProgramElementContext',context);validateShape(name+'Request',raw);
    const input=operation==='search_program_elements'?{query:optional(raw.query,240)??optional(raw.q,240),service:optional(raw.service,60),budgetActivity:optional(raw.budgetActivity,120),hasData:typeof raw.hasData==='boolean'?raw.hasData:null,page:clamp(raw.page,1,100,1),limit:clamp(raw.limit,1,50,20)}:{peCode:raw.peCode.trim().slice(0,32)};
    validateShape(name+'Input',input);return input;
  }
  function search(page,input,mode){
    if(page.page!==input.page||page.limit!==input.limit||page.data.length>input.limit||!page.data.length&&page.total!==0)fail('Finder paging projection mismatch');
    const seen=new Set();
    for(const row of page.data){
      if(seen.has(row.peCode))fail('Duplicate finder identity');seen.add(row.peCode);instant(row.lastSyncedAt);identity(row);
      for(const key of ['currentClaim','requestClaim','enactedClaim','requestAtEnactedClaim'])claim(row[key]);
      claim(row.currentFundingClaim,mode);if(row.currentFundingClaim.cycleClass!=='unknown')fail('Finder model claim cannot assert known cycle');
      const funding=row.funding;
      if(funding.current){const expected=ladder[funding.current.stage];if(funding.current.stageLabel!==expected[0]||funding.current.vehicle!==expected[1])fail('Finder funding stage/vehicle mismatch');}
      if(funding.currentVsRequest!==null&&(!funding.current||!funding.request||funding.current.fy===null||funding.current.fy!==funding.request.fy))fail('Cross-year comparison is not source comparison');
      if(input.hasData===true&&!row.hasData)fail('Finder hasData selector mismatch');
    }
  }
  function detail(page,input,mode){
    const pe=page.programElement;
    // Legacy detail cache keys uppercase, so a cached stored selector may differ in case.
    if(pe.peCode.toUpperCase()!==input.peCode.toUpperCase())fail('Detail selector substitution');
    instant(pe.lastSyncedAt);if(pe.retiredAt!==null)instant(pe.retiredAt);years(pe.years,pe.peCode,mode);
  }
  function timeline(page,input,mode){
    if(page.peCode!==input.peCode)fail('Timeline selector substitution');years(page.years,page.peCode,mode);
    for(const row of page.years){
      const expected=ladder[row.currentStage];if(row.currentStageLabel!==expected[0]||row.currentVehicle!==expected[1])fail('Timeline stage/vehicle mismatch');
      if(row.request!==null&&/^-?0(?:\.0{1,2})?$/.test(row.request)&&row.requestConflictValuesM.some(x=>x!==0)&&row.currentDeltaVsRequestM!==null)fail('Conflicting zero request cannot support delta');
      for(const key of Object.keys(row.missingMarks))if(row[key]!==null&&row.missingMarks[key]!=='present')fail('Present zero/nonzero mark misclassified');
    }
    const ids=new Set();
    for(const item of page.milestones){if(ids.has(item.id)||item.peCode!==page.peCode)fail('Milestone identity mismatch');ids.add(item.id);instant(item.lastSyncedAt);for(const key of ['plannedDate','actualDate'])if(item[key]!==null)instant(item[key],true);}
  }
  function assertProgramElementOutput(operation,value,raw,options){
    const name=family(operation),input=normalizeProgramElementInput(operation,raw,options),context=snapshotOperationData(options),page=snapshotOperationData(value);
    validateShape(name+'Output',page);instant(page.generatedAt);
    if(operation==='search_program_elements')search(page,input,context.evidenceAccuracyMode);
    else {identity(page);lineage(page,context.evidenceAccuracyMode);claim(page.currentFundingClaim,context.evidenceAccuracyMode);if(operation==='get_program_element')detail(page,input,context.evidenceAccuracyMode);else timeline(page,input,context.evidenceAccuracyMode);}
    // Admission is structural; no current source permission, freshness or completeness is inferred.
    return page;
  }
  return Object.freeze({normalizeProgramElementInput,assertProgramElementOutput});
}
