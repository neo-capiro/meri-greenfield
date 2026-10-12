import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
const v={normalizeActionItemsCompleteInput:(raw,context)=>resolveOperationContract({id:'actions.query',version:'0.2.0'}).normalizeInput(raw,context).input};
const id=n=>`abcdef00-0000-4000-8000-${String(n).padStart(12,'0')}`,NOW='2026-10-12T00:00:00.000Z';
const binding=()=>({tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1});
const context=()=>({binding:binding(),clientResolution:null});
const scopedContext=(reference=id(9))=>({...context(),clientResolution:{reference,clientId:id(9)}});
const card=(n=1)=>({id:id(100+n),districtKey:null,clientId:id(9),clientName:'Client',peCode:null,programId:null,deltaId:null,actionType:'protect_funding',issueTitle:'Issue',whatChanged:'Changed',whyItMatters:'Matters',recommendedAction:'Recommend',targetAudience:[],suggestedArtifactType:null,deadline:null,deadlineSource:null,ownerUserId:null,priority:1,confidence:{},uncertainty:null,evidence:[],status:'new',dismissalReason:null,outcome:null,createdAt:NOW,updatedAt:NOW});
const page=(rows=[card()],total=rows.length)=>({tool:'query_action_items',generatedAt:NOW,total,actions:rows});
function scoped(input={clientId:id(9)},ctx=scopedContext()) {
 const n=v.normalizeActionItemsCompleteInput(input,ctx),selection=n.selection;
 const row={...card(),title:'Issue',body:'Recommend',recordKind:'action_recommendation',recommendation:true,acceptedAsTask:false,nativeCompletion:{completed:false,evidence:null,establishesDeliveryOrAcceptance:false,note:'Recommendation only'}};
 const keys=['id','districtKey','clientId','clientName','peCode','programId','deltaId','actionType','issueTitle','whatChanged','whyItMatters','recommendedAction','targetAudience','suggestedArtifactType','deadline','deadlineSource','ownerUserId','priority','confidence','uncertainty','evidence','status','dismissalReason','outcome','createdAt','updatedAt','title','body'];
 row.sourceProof={version:1,owner:'action_recommendation',sourceRecordId:row.id,currentClientId:row.clientId,sourceVersion:row.updatedAt,contentSha256:createHash('sha256').update(JSON.stringify(Object.fromEntries(keys.map(k=>[k,row[k]])))).digest('hex'),linkedSources:[]};
 const complete=n.cursor===null,scope={tenantId:'tenant',kind:'client',resourceId:id(9),policyRevision:'p1'};
 return {kind:'action-item-client-scoped-page',contractVersion:'0.2.0',operation:{id:'query_action_items',version:'0.2.0'},requestId:id(20),traceId:id(21),binding:binding(),subject:{kind:'client',entityType:'client',entityIds:[id(9)],tenantId:'tenant',actorId:'actor',authorizationDecisionId:id(22),policyRevision:'p1',scopes:[scope],rosterVersionId:null},window:{basis:'unbounded'},argumentsSha256:canonicalSha256(selection),appliedFilters:[],generatedAt:NOW,sources:[{sourceId:'action_recommendation',authority:'authoritative',snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt:NOW,freshness:'unknown'}],coverage:{sourcesRequested:['action_recommendation'],sourcesChecked:['action_recommendation'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,returnedCount:1,truncated:!complete,historySupport:'bounded',limitations:['Synthetic pending transport']},selection,order:selection.sort==='priority'?'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed':'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed',snapshotVersionId:null,clientId:id(9),scope:{actionItemId:selection.actionItemId,status:selection.status,sort:selection.sort,page:complete?1:2,limit:selection.limit,cursorApplied:!complete},total:1,returned:1,actions:[row],pageCoverage:{sourceStatus:'healthy',sourceReason:null,complete,partial:!complete,paginationComplete:true,hasMore:false,nextCursor:null,totalIsExactForScope:true,absenceSupported:false,note:'Structural page assertion only'},continuation:{cursor:null,requiredReads:[],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'}};
}

export {id,card,scoped};
// Exact eight-field source envelope derived only from the accepted synthetic fixture above.
export function nativeScopedPage(raw={clientId:id(9)}) {
  const p=scoped(raw);
  return {tool:'query_action_items',generatedAt:p.generatedAt,clientId:p.clientId,total:p.total,
    returned:p.returned,actions:p.actions,scope:p.scope,coverage:p.pageCoverage};
}
