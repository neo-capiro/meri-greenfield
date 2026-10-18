/** Synthetic stored DTOs crossing actual HTTP JSON bytes; no Core/live qualification. */
import schema from '../../../../../packages/contracts/retrieval-0.2/federal-legislation.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createFederalLegislationHandlers} from '../handler.mjs';

export const ids=Object.freeze(['get_bill_status','search_floor_votes']);
export const note=name=>schema.$defs[name].const;
const at='2026-10-12T12:00:00.000Z';
export function billVote(){return {chamber:'house',rollNumber:7,question:'On passage',result:'Passed',voteType:null,
 voteDate:new Date(at),yeas:200,nays:100,present:0,notVoting:0,partyTotals:{stored:{opaque:true}},sourceUrl:null};}
export function governingRule(){return {ruleBillId:'119-hres-2',ruleTitle:'Synthetic governing rule',ruleStatus:'passed_chamber',ruleLatestAction:null,
 ruleVotes:[{rollNumber:8,result:'Passed',yeas:200,nays:100,voteDate:new Date(at),question:null,sourceUrl:null}]};}
export function statusPage(billId='119-hr-1'){
 return {tool:ids[0],authoritativeOwner:'congress_bill_status',currentStatus:'available',generatedAt:at,billId,found:true,
  title:'Synthetic stored bill',congress:119,status:'introduced',statusLabel:'Introduced',statusAt:null,
  latestAction:{text:null,date:null},sponsor:{name:null,bioguideId:null},cosponsorsCount:0,
  recentActions:[{date:new Date(at),text:'Introduced',type:null,chamber:null}],floorVotes:[billVote()],governingRules:[governingRule()]};
}
export function votesPage(billId='119-hr-1'){
 return {tool:ids[1],generatedAt:at,votesFound:1,votes:[{id:'synthetic-house-119-2-7',congress:119,session:2,billId,title:null,...billVote()}]};
}
export function storedCase(id=ids[0],{defaultCongress=119,request=id===ids[0]?{billId:'H.R. 1'}:{}}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={defaultCongress};
 const {authority,state,now,wire}=scene;
 authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const selected=contract.normalizeInput(request,normalizationContext).input.billId;
 const page=id===ids[0]?selected===null?{tool:id,authoritativeOwner:'congress_bill_status',currentStatus:'invalid_request',generatedAt:at,found:false,note:note('FederalInvalidBillNote')}:statusPage(selected):votesPage(selected??`${defaultCongress}-hr-1`);
 const transport={...scene.transport,async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});
  const value=structuredClone(state.page??page);state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();
  return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{
  const normalized=contract.normalizeInput(raw,context);
  return {input:normalized.input,request:raw,authority:current,argumentsSha256:normalized.argumentsSha256,normalizationContext:context};
 };
 return {...scene,family:'federal-legislation',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createFederalLegislationHandlers({...transport,now,...changes},[operation])[0].execute};
}
