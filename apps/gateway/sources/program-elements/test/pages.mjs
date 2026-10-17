/** Literal synthetic stored funding observations. No provider, mode resolver or funding calculation. */
import schema from '../../../../../packages/contracts/retrieval-0.2/program-elements.schema.json' with {type:'json'};
export const peCode='0601000A';
const identity={identifierKind:'pe',budgetExhibitType:'R-1/R-2 RDT&E Program Element'};
const source={sourceDocumentId:null,documentType:null,budgetCycle:null,publisher:null,sourceUrl:null,pageNumber:null,observedAt:null};
const legacyClaim={value:12,fiscalYear:2026,stage:'request',stageLabel:'Request',legislativeVehicle:'request',cycleClass:'current',isProjection:false,unit:'USD millions'};
const labels={enactmentStatus:'not_enacted',vehicleType:'budget_request'};
const enforcedClaim={...legacyClaim,...labels,semantics:'stage=Request (budget_request vehicle) FY2026 $12M enactment=not_enacted source=unknown'};
const timelineClaim={...enforcedClaim,originalUnit:null,originalValue:null,source,semantics:'stage=Request (budget_request vehicle) FY2026 $12M enactment=not_enacted source=unknown/unknown'};
const lineage={accepted:[],candidates:[],note:schema.$defs.ProgramElementLineage.properties.note.const};
function year(code,at,claim){return {id:'11111111-1111-4111-8111-111111111111',peCode:code,fy:2026,request:'12',hascMark:null,sascMark:null,hacDMark:null,sacDMark:null,conference:null,
 ndaaConference:null,enacted:null,reprogrammed:null,executed:null,notes:null,rDocSection:null,raw:{observation:'synthetic'},lastSyncedAt:at,fundingClaim:structuredClone(claim)};}

export function storedPage(id,input,mode,at){
 const generatedAt=new Date(at).toISOString(),claim=mode==='enforce'?enforcedClaim:legacyClaim;
 if(id==='search_program_elements')return {tool:id,generatedAt,total:(input.page-1)*input.limit+1,page:input.page,limit:input.limit,data:[{
  peCode,title:'Synthetic PE',service:input.service??'Army',budgetActivity:input.budgetActivity??null,appropriationType:'RDT&E',status:null,lastSyncedAt:generatedAt,hasData:true,watched:false,billCount:null,
  requestAtEnactedFy:null,peCurrentCycleFy:2026,signalType:null,signalScore:null,signalDeltaPct:null,lineType:null,maturity:null,appropTier:null,appropScore:null,actionSignalType:null,actionSignalTone:null,valleyOfDeath:null,
  currentClaim:{...legacyClaim,...labels},requestClaim:{...legacyClaim,...labels},enactedClaim:null,requestAtEnactedClaim:null,comparableEnactedVsRequest:null,...identity,
  currentFundingClaim:{...legacyClaim,cycleClass:'unknown',...(mode==='enforce'?{enactmentStatus:'unknown',vehicleType:'budget_request',semantics:'stage=Request (budget_request vehicle) FY2026 $12M enactment=unknown source=unknown'}:{})},funding:{unit:'USD millions',current:{value:12,fy:2026,stage:'request',stageLabel:'Request',vehicle:'request'},request:{value:12,fy:2026},enacted:null,
   enactedVsRequestPct:null,currentVsRequest:null,note:schema.$defs.ProgramElementFundingNote.const},
 }]};
 const code=input.peCode;
 if(id==='get_program_element')return {tool:id,generatedAt,...identity,currentCycleFy:2026,currentFundingClaim:structuredClone(claim),...(mode==='enforce'?{lineage:structuredClone(lineage)}:{}),programElement:{
  peCode:code,service:'Army',serviceCode:null,appropriationType:'RDT&E',budgetActivity:null,budgetActivityName:null,lineNumber:null,title:'Synthetic PE',description:null,acatLevel:null,programOfRecord:null,
  status:null,rDocUrl:null,pDocUrl:null,oDocUrl:null,raw:{},source:'synthetic',sourceConfidence:null,firstSeenFy:null,lastSyncedAt:generatedAt,retiredAt:null,retiredReason:null,years:[year(code,generatedAt,claim)],
  fundingSummary:'Synthetic stored summary',billCount:null,projectCount:0,sourceCount:0,currentCycleFy:2026,currentUserIsWatching:false,
 }};
 if(id==='get_pe_budget_timeline'){
  const selected=mode==='enforce'?timelineClaim:legacyClaim;
  return {tool:id,generatedAt,...identity,peCode:code,title:'Synthetic PE',service:'Army',appropriationType:'RDT&E',budgetActivity:null,lineNumber:null,currentCycleFy:2026,
   currentFundingClaim:structuredClone(selected),fundingSummary:'Synthetic stored summary',...(mode==='enforce'?{lineage:structuredClone(lineage)}:{}),years:[{
    ...year(code,generatedAt,selected),cycle:'current',current:12,currentStage:'request',currentStageLabel:'Request',currentVehicle:'request',currentDeltaVsRequestM:null,requestConflictValuesM:null,
    missingMarks:{request:'present',hascMark:'unknown_coverage',sascMark:'unknown_coverage',ndaaConference:'unknown_coverage',hacDMark:'unknown_coverage',sacDMark:'unknown_coverage',conference:'unknown_coverage',enacted:'unknown_coverage'},
    predictedConferenceAmount:null,predictedConferenceAmountCiLow:null,predictedConferenceAmountCiHigh:null,predictedConferenceConfidence:null,
   }],milestones:[]};
 }
 throw Error('SYNTHETIC_OPERATION_MISMATCH');
}
