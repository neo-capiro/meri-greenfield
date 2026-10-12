import {canonicalSha256} from '../validate.mjs';
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
function identity(value,source=value){
  const token=x=>(x??'').trim().toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const type=token(source.lineType),appropriation=token(source.appropriationType),code=source.peCode.trim().toUpperCase();
  const rdte=['rdte','rdt_and_e','r_d_t_e','r_1','r1','r_2','r2','program_element','rdte_program_element','rdte_pe','research_development_test_and_evaluation'];
  const procurement=['procurement','p_1','p1','p_40','p40','procurement_line','procurement_line_item','procurement_blin'];
  let expected=rdte.includes(type)?'pe':procurement.includes(type)?'procurement_line_item':null;
  if(expected===null){
    if(['rdte','rdt_and_e','r_d_t_e','research_development','research_and_development'].some(x=>appropriation.includes(x)))expected='pe';
    else if(appropriation==='proc'||appropriation.includes('procurement'))expected='procurement_line_item';
    else expected=/^\d{7}[A-Z][A-Z0-9]*$/.test(code)?'pe':/^\d{4}[A-Z]{1,2}[0-9A-Z]{2,14}$/.test(code)?'procurement_line_item':'other';
  }
  if(value.identifierKind!==expected||value.budgetExhibitType!==exhibits[expected])fail('Budget identity/exhibit mismatch');
}
function cents(value){
  const text=typeof value==='number'?String(value):value;
  if(typeof text!=='string'||!/^(-?)(\d+)(?:\.(\d{1,2}))?$/.test(text))fail('Derived amount is not a stored decimal projection');
  const [,sign,whole,fraction='']=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  return (sign==='-'?-1n:1n)*(BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')));
}
function moneyEquals(actual,stored){return actual===null||stored===null?actual===stored:cents(actual)===cents(stored);}
function picked(row){
  for(const [key,stage] of [['enacted','enacted'],['conference','appropriations_conference'],['sacDMark','sacd'],['hacDMark','hacd'],['sascMark','sasc'],['hascMark','hasc'],['request','request']])if(row[key]!==null)return {value:row[key],stage};
  return {value:null,stage:'none'};
}
function claimSemantics(value){
  const fy=value.fiscalYear??'unknown',amount=value.value===null?'amount unavailable':`$${value.value}M`;
  if(value.stage==='none')return `stage=unmapped (unknown vehicle) FY${fy} ${amount} enactment=unknown source=unknown`;
  const original=value.originalUnit?` (source printed in ${value.originalUnit})`:'';
  const source=value.source?` source=${value.source.documentType??'unknown'}/${value.source.publisher??'unknown'}${value.source.pageNumber===null?'':` p.${value.source.pageNumber}`}`:' source=unknown';
  return `stage=${value.stageLabel} (${value.vehicleType??'unknown'} vehicle) FY${fy} ${amount}${original} enactment=${value.enactmentStatus??'unknown'}${source}`;
}
function claim(value,mode){
  if(value===null)return;
  const expected=stages[value.stage];
  if(value.stageLabel!==expected[0]||value.legislativeVehicle!==expected[1]||value.isProjection!==(value.cycleClass==='outyear'))fail('Funding claim stage/vehicle/cycle mismatch');
  const enactment=value.stage==='enacted'?'enacted':value.stage==='none'||value.cycleClass==='historical'?'unknown':['current','outyear'].includes(value.cycleClass)?'not_enacted':'unknown';
  const vehicle=value.stage==='request'?'budget_request':['hasc','sasc','ndaa_conference'].includes(value.stage)?'authorization':['hacd','sacd','appropriations_conference','enacted'].includes(value.stage)?'appropriation':'unknown';
  if(Object.hasOwn(value,'enactmentStatus')&&value.enactmentStatus!==enactment||Object.hasOwn(value,'vehicleType')&&value.vehicleType!==vehicle)fail('Claim enactment/vehicle contradiction');
  if(value.source?.observedAt!==null&&value.source?.observedAt!==undefined)instant(value.source.observedAt);
  if(mode==='enforce'&&(!Object.hasOwn(value,'semantics')||value.semantics!==claimSemantics(value)))fail('Enforced claim semantics mismatch');
  if(mode&&mode!=='enforce'&&extras.some(key=>Object.hasOwn(value,key)))fail('Legacy model claim includes enforced fields');
}
function years(rows,peCode,mode,currentCycleFy){
  let previous;const ids=new Set();
  for(const row of rows){
    if(row.peCode!==peCode||ids.has(row.id)||previous!==undefined&&row.fy<=previous)fail('Stored year identity/order mismatch');
    ids.add(row.id);previous=row.fy;instant(row.lastSyncedAt);claim(row.fundingClaim,mode);
    const selected=picked(row),expectedCycle=currentCycleFy===null?'unknown':row.fy===currentCycleFy?'current':row.fy>currentCycleFy?'outyear':'historical';
    if(row.fundingClaim===null||row.fundingClaim.fiscalYear!==row.fy||row.fundingClaim.stage!==selected.stage||!moneyEquals(row.fundingClaim.value,selected.value)||row.fundingClaim.cycleClass!==expectedCycle)fail('Year claim differs from source marks/cycle');
  }
}
function lineage(page,mode,peCode){
  if((mode==='enforce')!==Object.hasOwn(page,'lineage'))fail('Evidence-mode lineage mismatch');
  if(!page.lineage)return;
  for(const [bucket,status] of [['accepted','accepted'],['candidates','candidate']])for(const row of page.lineage[bucket])if(row.status!==status||row.fromCode!==peCode.toUpperCase()&&row.toCode!==peCode.toUpperCase())fail('Lineage review bucket/endpoint mismatch');
}
function closeNumber(a,b){return a===b||typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b))*4;}
function expectedCycle(fy,current){return current===null?'unknown':fy===current?'current':fy>current?'outyear':'historical';}
function observeClaim(value,money,fy,stage,cycle){
  const present=money!==null&&fy!==null;
  if(!present){if(value!==null)fail('Unavailable amount/FY cannot assert a funding claim');return;}
  if(value===null||value.value!==money||value.fiscalYear!==fy||value.stage!==stage||value.cycleClass!==expectedCycle(fy,cycle))fail('Finder residual claim differs from source funding axis');
}
function shortDirection(delta){
  if(delta===0)return 'equal to the request';
  const magnitude=Math.abs(delta),amount=magnitude>=1000?`$${(magnitude/1000).toFixed(2)}B`:`$${magnitude.toFixed(1)}M`;
  return `${amount} ${delta>0?'above':'below'} the request`;
}
function searchClaims(row){
  const f=row.funding,current=f.current,request=f.request,enacted=f.enacted;
  observeClaim(row.currentClaim,current?.value??null,current?.fy??null,current?.stage==='conference'?'appropriations_conference':current?.stage??'none',row.peCurrentCycleFy);
  observeClaim(row.requestClaim,request?.value??null,request?.fy??null,'request',row.peCurrentCycleFy);
  observeClaim(row.enactedClaim,enacted?.value??null,enacted?.fy??null,'enacted',row.peCurrentCycleFy);
  observeClaim(row.requestAtEnactedClaim,row.requestAtEnactedFy,enacted?.fy??null,'request',row.peCurrentCycleFy);
  const a=row.enactedClaim,b=row.requestAtEnactedClaim,pair=a!==null&&b!==null;
  const pct=pair&&b.value!==0?(a.value-b.value)/Math.abs(b.value)*100:null;
  if(pair){const x=row.comparableEnactedVsRequest;if(x===null||x.fiscalYear!==a.fiscalYear||x.enacted!==a.value||x.request!==b.value||!closeNumber(x.deltaPct,pct))fail('Matched enacted/request comparison mismatch');}
  else if(row.comparableEnactedVsRequest!==null)fail('Unmatched enacted/request comparison');
  if(!closeNumber(f.enactedVsRequestPct,pct))fail('Finder percent differs from matched fiscal-year pair');
  const comparison=current!==null&&request!==null&&current.stage!=='request'&&current.fy!==null&&current.fy===request.fy?shortDirection(current.value-request.value):null;
  if(f.currentVsRequest!==comparison)fail('Finder short direction differs from same-year current/request');
}
function currentClaim(page,rows){
  const expected=rows.find(row=>row.fundingClaim?.cycleClass==='current')?.fundingClaim??null;
  if(canonicalSha256(page.currentFundingClaim)!==canonicalSha256(expected))fail('Current claim is not emitted current-year claim');
}
export function createProgramElementValidators({validateShape,schema}) {
  function normalizeProgramElementInput(operation,value,options){
    const name=family(operation),raw=snapshotOperationData(value),context=snapshotOperationData(options);validateShape('ProgramElementContext',context);validateShape(name+'Request',raw);
    const input=operation==='search_program_elements'?{query:optional(raw.query,240)??optional(raw.q,240),service:optional(raw.service,60),budgetActivity:optional(raw.budgetActivity,120),hasData:typeof raw.hasData==='boolean'?raw.hasData:null,page:clamp(raw.page,1,100,1),limit:clamp(raw.limit,1,50,20)}:{peCode:raw.peCode.trim().slice(0,32)};
    validateShape(name+'Input',input);return input;
  }
  function search(page,input,mode){
    if(page.page!==input.page||page.limit!==input.limit||page.data.length>input.limit||page.data.length&&page.total<(input.page-1)*input.limit+page.data.length||!page.data.length&&page.total!==0)fail('Finder paging projection mismatch');
    const seen=new Set();
    for(const row of page.data){
      if(seen.has(row.peCode))fail('Duplicate finder identity');seen.add(row.peCode);instant(row.lastSyncedAt);identity(row);
      for(const key of ['currentClaim','requestClaim','enactedClaim','requestAtEnactedClaim'])claim(row[key]);
      claim(row.currentFundingClaim,mode);if(row.currentFundingClaim!==null&&row.currentFundingClaim.cycleClass!=='unknown')fail('Finder model claim cannot assert known cycle');
      if(input.service!==null&&row.service===null||input.budgetActivity!==null&&row.budgetActivity===null)fail('Selected nonempty finder field cannot be null');
      const funding=row.funding;
      if(funding.note!==schema.$defs.ProgramElementFundingNote.const)fail('Finder funding caution changed');
      if(row.currentFundingClaim!==null&&(!funding.current||row.currentFundingClaim.value!==funding.current.value||row.currentFundingClaim.fiscalYear!==funding.current.fy))fail('Finder current claim mismatch');
      if(funding.current){const expected=ladder[funding.current.stage];if(funding.current.stageLabel!==expected[0]||funding.current.vehicle!==expected[1])fail('Finder funding stage/vehicle mismatch');}
      if(funding.currentVsRequest!==null&&(!funding.current||!funding.request||funding.current.stage==='request'||funding.current.fy===null||funding.current.fy!==funding.request.fy))fail('Cross-year comparison is not source comparison');
      searchClaims(row);
      if(input.hasData===true&&!row.hasData)fail('Finder hasData selector mismatch');
    }
  }
  function detail(page,input,mode){
    const pe=page.programElement;
    // Legacy detail cache keys uppercase, so a cached stored selector may differ in case.
    if(pe.peCode.toUpperCase()!==input.peCode.toUpperCase())fail('Detail selector substitution');
    instant(pe.lastSyncedAt);if(pe.retiredAt!==null)instant(pe.retiredAt);years(pe.years,pe.peCode,mode,page.currentCycleFy);
    if(pe.currentCycleFy!==null&&page.currentCycleFy!==pe.currentCycleFy)fail('Detail catalog cycle mismatch');
    currentClaim(page,pe.years);
  }
  function timeline(page,input,mode){
    if(page.peCode!==input.peCode)fail('Timeline selector substitution');years(page.years,page.peCode,mode,page.currentCycleFy);currentClaim(page,page.years);
    for(const row of page.years){
      const selected=picked(row),selectedStage=selected.stage==='appropriations_conference'?'conference':selected.stage;
      if(row.currentStage!==selectedStage||!moneyEquals(row.current,selected.value)||row.cycle!==row.fundingClaim.cycleClass)fail('Timeline current/cycle mismatch');
      const conflicts=row.requestConflictValuesM;
      const hasConflict=row.request!==null&&cents(row.request)===0n&&conflicts?.length>0;
      const expectedDelta=row.request!==null&&selected.value!==null&&selectedStage!=='request'&&!hasConflict?Number(cents(selected.value)-cents(row.request))/100:null;
      if(!closeNumber(row.currentDeltaVsRequestM,expectedDelta))fail('Timeline current delta differs from same-row request');
      if(conflicts!==null&&(conflicts.some(x=>x===0)||new Set(conflicts).size!==conflicts.length))fail('Conflicting requests must be unique nonzero observations');
      const forecast=['predictedConferenceAmount','predictedConferenceAmountCiLow','predictedConferenceAmountCiHigh','predictedConferenceConfidence'];
      if(!forecast.every(k=>row[k]===null)&&!forecast.every(k=>row[k]!==null))fail('Incomplete prediction projection');
      const expected=ladder[row.currentStage];if(row.currentStageLabel!==expected[0]||row.currentVehicle!==expected[1])fail('Timeline stage/vehicle mismatch');
      if(row.request!==null&&/^-?0(?:\.0{1,2})?$/.test(row.request)&&row.requestConflictValuesM?.some(x=>x!==0)&&row.currentDeltaVsRequestM!==null)fail('Conflicting zero request cannot support delta');
      for(const key of Object.keys(row.missingMarks))if(row.missingMarks[key]==='not_applicable'||(row[key]!==null)!==(row.missingMarks[key]==='present'))fail('Present zero/nonzero mark misclassified');
    }
    const ids=new Set(),types=new Set();let previous=-Infinity;
    for(const item of page.milestones){
      const date=item.plannedDate===null?Infinity:instant(item.plannedDate,true);if(types.has(item.milestoneType)||date<previous)fail('Milestone type/order mismatch');types.add(item.milestoneType);previous=date;if(ids.has(item.id)||item.peCode!==page.peCode)fail('Milestone identity mismatch');ids.add(item.id);instant(item.lastSyncedAt);for(const key of ['plannedDate','actualDate'])if(item[key]!==null)instant(item[key],true);}
  }
  function assertProgramElementOutput(operation,value,raw,options){
    const name=family(operation),input=normalizeProgramElementInput(operation,raw,options),context=snapshotOperationData(options),page=snapshotOperationData(value);
    validateShape(name+'Output',page);instant(page.generatedAt);
    if(operation==='search_program_elements')search(page,input,context.evidenceAccuracyMode);
    else {const source=operation==='get_program_element'?page.programElement:page;identity(page,source);lineage(page,context.evidenceAccuracyMode,source.peCode);claim(page.currentFundingClaim,context.evidenceAccuracyMode);if(operation==='get_program_element')detail(page,input,context.evidenceAccuracyMode);else timeline(page,input,context.evidenceAccuracyMode);}
    // Admission is structural; no current source permission, freshness or completeness is inferred.
    return page;
  }
  return Object.freeze({normalizeProgramElementInput,assertProgramElementOutput});
}
