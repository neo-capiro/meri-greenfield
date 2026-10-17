/** Synthetic native status/vote DTO branches and credentials; no quota, sync, provider or DB work. */
import schema from '../../../../../packages/contracts/retrieval-0.2/state-status-votes.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createStateStatusVotesHandlers} from '../handler.mjs';

export const ids=['get_state_bill_status','search_state_floor_votes'],billKey='tx-2025-hb1234';
export const requests={get_state_bill_status:{billId:billKey},search_state_floor_votes:{billId:billKey,chamber:'lower',limit:2}};
export const note=name=>schema.$defs[name].const;
export function storedPage(id,selector,at,{input={},nativeOutcome='found',resolvedKey}={}){
 const generatedAt=new Date(at).toISOString(),key=resolvedKey??(selector.kind==='canonical'?selector.key:
  selector.kind==='designation'?`${selector.state.toLowerCase()}-2025-${selector.billNumber}`:billKey);
 // These are observed native DTO rails, not a lookup, cache, session or provider implementation.
 const unresolved=reason=>id==='get_state_bill_status'?{tool:id,generatedAt,found:false,note:reason}:{tool:id,generatedAt,votesFound:0,votes:[],note:reason};
 if(selector.kind==='missing'&&id==='get_state_bill_status')return unresolved(note('MissingStateBillNote'));
 if(selector.kind==='invalid')return unresolved(input.state?`Could not parse "${input.billId}" as a state bill designation.`:
  `Could not parse "${input.billId}" as a state bill designation \u2014 specify the state, e.g. "TX HB 1234".`);
 if(selector.kind==='designation'&&['not-found','not-configured','quota','provider-error'].includes(nativeOutcome)){
  const suffix={'not-found':' A live LegiScan lookup of the current session found no such bill either.','not-configured':'',
   quota:' A live LegiScan lookup was skipped because this month\u2019s lookup budget is used up; say the bill could not be checked.',
   'provider-error':' A live LegiScan lookup failed; say the bill could not be checked rather than that it does not exist.'}[nativeOutcome];
  return unresolved(`No bill found matching "${input.billId}" in ${selector.state}.${suffix}`);
 }
 if(id==='get_state_bill_status'&&nativeOutcome==='absent')return {tool:id,generatedAt,billId:key,found:false,
  note:`No bill ${key} on record in the Capiro database. Say so explicitly \u2014 do not describe its status from memory.`};
 if(id==='get_state_bill_status')return {tool:id,generatedAt,billId:key,found:true,state:'TX',session:'2025',identifier:'HB 1234',
  title:'Synthetic stored bill',status:'introduced',statusLabel:'Introduced',statusAt:null,latestAction:{text:null,date:null},
  sponsor:{name:null,party:null,count:0},recentActions:[],votes:[],companions:[],url:null,note:note('NoBillVotesNote')};
 if(id!=='search_state_floor_votes')throw Error('SYNTHETIC_OPERATION_MISMATCH');
 if(nativeOutcome==='empty')return {tool:id,generatedAt,votesFound:0,votes:[],note:note('NoStateVotesNote')};
 return {tool:id,generatedAt,votesFound:1,votes:[{
  id:'synthetic-state-vote',billKey:key,chamber:'lower',motion:'Passage',date:'2025-01-15T00:00:00.000Z',
  yeas:1,nays:0,nv:0,absent:0,passed:true,sourceUrl:null,
 }]};
}
export function storedCase(id=ids[0],options={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene,request=options.request??requests[id],normalized=contract.normalizeInput(request,{});
 authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=options.page??storedPage(id,normalized.metadata.selector,now(),{input:normalized.input,nativeOutcome:options.nativeOutcome,resolvedKey:options.resolvedKey}),transport={...scene.transport,async fetchImpl(url,configuration){
  wire.push({url,options:configuration,body:JSON.parse(configuration.body)});
  const value=structuredClone(state.page??page);state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();
  return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(args=request,current=authority,context={})=>{
  const result=contract.normalizeInput(args,context);
  return {request:args,input:result.input,argumentsSha256:result.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'state-status-votes',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createStateStatusVotesHandlers({...transport,now,...changes},[operation])[0].execute};
}
