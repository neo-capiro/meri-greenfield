/** Synthetic source-shaped stored DTOs over real JSON bytes; no backend, provider or data qualification. */
import schema from '../../../../../packages/contracts/retrieval-0.2/state-legislation.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createStateLegislationHandlers} from '../handler.mjs';

export const ids=['search_state_bills','get_state_legislator'];
export const requests={
 search_state_bills:{query:'housing',state:'FL',session:'2026',status:'introduced',limit:2},
 get_state_legislator:{query:'Synthetic legislator',state:'FL',limit:5},
};
export const note=name=>schema.$defs[name].const;

export function storedPage(id,input={},at=Date.parse('2026-10-12T12:00:00.000Z')){
 const generatedAt=new Date(at).toISOString();
 if(id==='search_state_bills'){
  const status=input.status??'introduced',labels=schema.$defs.StateBillStatusLabels.const;
  return {tool:id,generatedAt,total:1,data:[{
   id:'synthetic-state-bill',state:input.state??'FL',session:input.session??'2026',identifier:'HB 1',
   title:'Synthetic housing bill',chamber:null,subjects:['housing'],status,
   statusLabel:Object.hasOwn(labels,status)?labels[status]:status,sponsorName:null,sponsorParty:null,sponsorCount:0,
   latestActionDate:'2026-10-10T00:00:00.000Z',latestActionText:null,stateUrl:null,url:null,
  }]};
 }
 if(id!=='get_state_legislator')throw Error('Unknown synthetic state operation');
 if(!input.query)return {tool:id,generatedAt,matchesFound:0,matches:[],note:note('StateLegislatorMissingNote')};
 return {tool:id,generatedAt,matchesFound:1,matches:[{
  id:'synthetic-state-legislator',name:'Synthetic legislator',state:input.state??'FL',chamber:null,district:null,
  party:null,committees:{synthetic:['stored committee']},active:true,matchedBy:'name-search',
 }]};
}

export function storedCase(id=ids[0],options={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene,request=options.request??requests[id];
 authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const page=options.page??storedPage(id,contract.normalizeInput(request,{}).input,now());
 const transport={...scene.transport,async fetchImpl(url,configuration){
  wire.push({url,options:configuration,body:JSON.parse(configuration.body)});
  const value=structuredClone(state.page??page);state.nativeValue=value;
  state.resultMutator?.(value);state.afterSource?.();
  return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(args=request,current=authority,context={})=>{
  const normalized=contract.normalizeInput(args,context);
  return {request:args,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'state-legislation',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createStateLegislationHandlers({...transport,now,...changes},[operation])[0].execute};
}
