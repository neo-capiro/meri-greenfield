/** Source-shaped stored DTOs and synthetic HTTP/credentials; no native qualification. */
import schema from '../../../../../packages/contracts/retrieval-0.2/legislative-directory.schema.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createLegislativeDirectoryHandlers} from '../handler.mjs';
export const ids=['get_committee_roster','list_members'];
export const note=name=>schema.$defs[name].const;
export const requests={get_committee_roster:{committee:'SYN',jurisdiction:'federal'},list_members:{state:'VA',chamber:'senate'}};
export function directoryPage(id){
 const generatedAt='2026-10-12T12:00:00.000Z';
 if(id==='list_members')return {tool:id,generatedAt,filter:{state:'Virginia',chamber:'senate'},matchesFound:1,
  members:[{id:'synthetic-senator',name:'Synthetic senator',party:null,state:'Virginia',district:null,chamber:'senate'}],
  note:'Current members from the Capiro congressional roster (congress_member, is_current). Cite as [S:list_members:Virginia-senate]. Note every state has exactly 2 senators; if a senate query returns fewer than 2, the roster is incomplete for that state — say so rather than inventing a name.'};
 const member={id:'synthetic-chair',name:'Synthetic chair',party:null,state:null,side:'majority',rank:1,title:'Chair'};
 return {tool:id,generatedAt,committee:{id:'SYN',name:'Synthetic committee',chamber:'joint',jurisdiction:'federal',isSubcommittee:false,matchedBy:'code'},chair:member,viceChair:null,rankingMember:null,members:[member],note:note('DirectoryFederalRosterNote')};
}
export function directoryCase(id=ids[0],{request=requests[id]}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene;authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];
 const page=directoryPage(id),transport={...scene.transport,async fetchImpl(url,options){
  wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=()=>{const normalized=contract.normalizeInput(request,{});return {request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:{},authority};};
 return {...scene,family:'legislative-directory',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createLegislativeDirectoryHandlers({...transport,now,...changes},[operation])[0].execute};
}
