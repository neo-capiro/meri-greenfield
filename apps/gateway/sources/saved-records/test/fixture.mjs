/** Synthetic owner payloads; mounted transport tests do not claim live owner data. */
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
export const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
export const clientId=uuid('d'),recordId=uuid('e'),parentId=uuid('f');
export const ids=['read_saved_record','read_saved_strategy_records'];
export function savedReadCase(id=ids[0],{request,selected=false}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation);
 const family=id===ids[0]?'saved-records':'strategy-saved-records';
 request??=id===ids[0]?{source:'workspace',kind:'saved_version',input:{draftId:parentId,versionId:recordId}}:{kind:'strategy_activity',clientId,strategyId:parentId};
 const {authority,state,now,wire}=scene;
 if(selected)Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[clientId],scopes:[{tenantId:authority.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:authority.subject.policyRevision}]});
 const revisions={identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)};
 const normalizationContext=id===ids[0]?{savedRecordScope:{clientId:selected?clientId:null,tenantId:authority.binding.tenantId,...revisions}}:{strategySavedScope:{clientId,...revisions}};
 authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=contract.descriptor.sourceRequirements.map(s=>s.sourceId);
 const record={id:recordId,actorUserId:null,authorKind:'person',action:'created',entityType:'strategy',entityId:parentId,occurredAt:'2026-10-27T00:00:00.000Z'};
 const page=id===ids[0]?{version:'0.1.0',kind:request.kind,coverage:{basis:'current_owner_read',limitations:['Synthetic existing saved owner']},maxOutputBytes:262144,data:
  request.kind==='library'?{items:[{id:recordId,kind:'draft',name:'Saved draft',blueprint:'proposal',clientId,client:'Synthetic client',status:'draft',updatedAt:'2026-10-27T00:00:00.000Z',owner:{id:'user_synthetic',name:'Owner',initials:'O'},route:'/workspace/draft'}],nextCursor:null}:
  {draftId:parentId,versionId:recordId,label:null,authorId:'user_synthetic',authorKind:'person',savedAt:'2026-10-27T00:00:00.000Z',snapshot:{paragraphs:['Complete saved version — 界'],optional:null,count:0}}}:
  {version:'0.1.0',kind:request.kind,clientId,observedAt:'2026-10-27T00:00:00.000Z',items:[{source:{relation:'sp_activity_log',id:recordId,contentSha256:createHash('sha256').update(JSON.stringify(record)).digest('hex')},record}],nextCursor:null,
   coverage:{scope:'selected_client',sourceUniverseComplete:false,representation:'activity_summaries',rowLimit:100,maxOutputBytes:262144,byteTruncated:false,limitations:['Strategy activity metadata only']}};
 const transport={...scene.transport,async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});const value=structuredClone(state.page??page);state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):Response.json(value);}};
 const call=()=>{const normalized=contract.normalizeInput(request,normalizationContext);return {request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext,authority:readContext(authority)};};
 return {...scene,family,operation,contract,arguments:request,normalizationContext,transport,page,call,visibleClientIds:[clientId]};
}
