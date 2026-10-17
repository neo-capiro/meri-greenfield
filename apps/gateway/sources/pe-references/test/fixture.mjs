/** Synthetic source-shaped JSON pages; no backend, credentials or live qualification. */
import schema from '../../../../../packages/contracts/retrieval-0.2/pe-references.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createPeReferenceHandlers} from '../handler.mjs';

export const ids=['get_pe_bills','get_pe_contractors','get_pe_report_language'];
export const note=name=>schema.$defs[name].const;
export function storedPage(id,{peCode='0601234A',generatedAt='2026-10-12T12:00:00.000Z'}={}){
 if(id==='get_pe_bills')return {tool:id,generatedAt,bills:[{
  id:'119-hr-1',congress:119,billType:'hr',billNumber:'1',title:'Synthetic linked bill',policyArea:null,
  latestActionText:null,latestActionDate:null,url:null,sponsor:null,committee:null,peCodeCount:1,
  link:{type:'versioned',confidence:0.7,evidence:'Synthetic stored mention',status:'qualified'},budgetPackage:null,
 }]};
 if(id==='get_pe_report_language')return {tool:id,generatedAt,peCode,provisions:[{
  id:'synthetic-provision',committee:'HASC',fy:2027,heading:'Synthetic heading',text:'Synthetic stored language',
  pageStart:null,pageEnd:null,actionType:null,sourceUrl:null,matchBasis:'pe_code',reviewStatus:'accepted',
  confidence:0.7,matchScope:'pe_specific',attributionCaveat:null,
 }]};
 const exhibit=schema.$defs.PeGovernmentExhibit.properties,awards=schema.$defs.PeFederalAwards.properties;
 const constants=properties=>Object.fromEntries(Object.entries(properties).filter(([,v])=>Object.hasOwn(v,'const')).map(([k,v])=>[k,v.const]));
 return {tool:id,generatedAt,namedPrimes:[{
  contractorName:'Synthetic exhibit prime',location:null,contractMethod:null,totalCostM:7,fy:2027,sourceUrl:null,
  pageNumber:2,publisher:'DoD',attribution:'Named prime per DoD FY2027 R-3 exhibit (p. 2)',
 }],data:[
  {contractorName:'Synthetic direct award',amount:3,awards:2,source:'direct',attribution:'Award attributed to this program element'},
  {contractorName:'Synthetic program award',amount:2,awards:1,source:'program',attribution:'Linked via DoD Acquisition Program (USAspending)'},
 ],evidence:{
  governmentExhibit:{...constants(exhibit),amountM:7,count:1,provenance:constants(exhibit.provenance.properties)},
  federalAwards:{...constants(awards),amountM:5,count:3,
   provenance:{...constants(awards.provenance.properties),asOf:generatedAt},
   buckets:schema.$defs.PeAwardBuckets.prefixItems.map((bucket,index)=>({
    ...constants(bucket.properties),amountM:[3,2,0][index],count:[2,1,0][index],
   })),
  },
 },evidenceNote:note('PeContractorEvidenceNote'),todo:null};
}

export function storedCase(id=ids[0],{request={peCode:'0601234A'}}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene;
 authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=storedPage(id,{peCode:contract.normalizeInput(request,{}).input.peCode}),transport={...scene.transport,
  async fetchImpl(url,options){
   wire.push({url,options,body:JSON.parse(options.body)});
   const value=structuredClone(state.page??page);state.nativeValue=value;
   state.resultMutator?.(value);state.afterSource?.();
   return state.responseFactory?state.responseFactory(value):Response.json(value);
  },
 };
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{
  const normalized=contract.normalizeInput(raw,context);
  return {request:raw,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'pe-references',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createPeReferenceHandlers({...transport,now,...changes},[operation])[0].execute};
}
