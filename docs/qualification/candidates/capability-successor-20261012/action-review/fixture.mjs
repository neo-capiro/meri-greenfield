/** Independent literal synthetic records; no private bodies, source adapters or live authority. */
import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../../../../../packages/contracts/validate.mjs';
import { assertActionItemReadInput, resolveOperationContract } from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import { fixture as gatewayFixture, uuid, NOW } from '../../../../../apps/gateway/test/fixtures.mjs';
export const operation = Object.freeze({id:'query_action_items',version:'0.2.0'});
export const clientId = 'independent-client';
export const actorId = 'synthetic-actor';
export const id = 'independent-recommendation';
export const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const binding = {tenantId:'synthetic-tenant',actorId,conversationId:uuid('1'),runId:uuid('2'),attemptId:uuid('3'),workerId:uuid('4'),writerFence:1};
export const scope = {tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'revision-1'};
export const subject = {kind:'client',entityType:'client',entityIds:[clientId],tenantId:binding.tenantId,actorId,authorizationDecisionId:uuid('6'),policyRevision:'revision-1',scopes:[scope],rosterVersionId:null};
export const contract = () => resolveOperationContract(operation);
export function row({outcome = null, evidence = [], linkedSources = []} = {}) {
  // Literal canonical source projection, in the frozen producer's declared field order.
  const core = {id,districtKey:null,clientId,clientName:'Synthetic client',peCode:null,programId:null,deltaId:null,
    actionType:'protect_funding',issueTitle:'A synthetic issue',whatChanged:'A synthetic change',whyItMatters:'Synthetic relevance',
    recommendedAction:'Consider a synthetic follow-up',targetAudience:[],suggestedArtifactType:null,deadline:null,deadlineSource:null,
    ownerUserId:actorId,priority:1,confidence:{},uncertainty:null,evidence,status:outcome===null?'new':'outreach_completed',
    dismissalReason:null,outcome,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-02T00:00:00.000Z',
    title:'A synthetic issue',body:'Consider a synthetic follow-up'};
  return {...core,recordKind:'action_recommendation',recommendation:true,acceptedAsTask:false,
    nativeCompletion:{completed:false,evidence:outcome===null?null:'recommendation_outcome_only',establishesDeliveryOrAcceptance:false,note:'Outcome text is not proof of task completion or acceptance.'},
    sourceProof:{version:1,owner:'action_recommendation',sourceRecordId:id,currentClientId:clientId,sourceVersion:core.updatedAt,contentSha256:sha(core),linkedSources}};
}
export function page(request = {clientId}, options = {}) {
  const selection = assertActionItemReadInput(request).selection;
  const actions = options.actions ?? [row()];
  const number = options.page ?? (selection.cursorApplied ? 2 : 1);
  const total = options.total ?? actions.length;
  const hasMore = number*selection.limit < total;
  const complete = !selection.cursorApplied && !hasMore && actions.length===total;
  return {kind:'action-item-client-scoped-page',contractVersion:'0.2.0',operation,requestId:uuid('8'),traceId:uuid('9'),
    binding:structuredClone(options.binding??binding),subject:structuredClone(options.subject??subject),window:{basis:'unbounded'},
    argumentsSha256:canonicalSha256(selection),appliedFilters:[],generatedAt:'2026-10-12T01:00:00.000Z',
    sources:[{sourceId:'action_recommendation',authority:'authoritative',snapshotVersionId:null,adapterVersion:'0.2.0',status:'partial',synchronizedAt:null,asOf:null,retrievedAt:'2026-10-12T01:00:00.000Z',freshness:'unknown'}],
    coverage:{sourcesRequested:['action_recommendation'],sourcesChecked:['action_recommendation'],sourcesUnavailable:[],enumeration:'unknown',enumerableTotal:null,returnedCount:actions.length,truncated:!complete,historySupport:'bounded',limitations:['Synthetic pending source; no independent snapshot or freshness.']},
    selection,snapshotVersionId:null,continuation:{cursor:null,requiredReads:[],remainingSources:[]},evidenceReady:false,negativeAssertion:{kind:'none'},
    order:selection.sort==='priority'?'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed':'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed',
    clientId:selection.clientId,scope:{actionItemId:selection.actionItemId,status:selection.status,sort:selection.sort,page:number,limit:selection.limit,cursorApplied:selection.cursorApplied},
    total,returned:actions.length,actions,
    pageCoverage:{sourceStatus:'healthy',sourceReason:null,complete,partial:!complete,paginationComplete:!hasMore,hasMore,nextCursor:hasMore?'opaque-unqualified-next':null,totalIsExactForScope:true,absenceSupported:complete&&actions.length===0,note:'Bounded synthetic page; no global source absence claim.'}};
}
export function connected(request = {clientId}) {
  const f = gatewayFixture(), resolved = contract();
  f.state.grants = ['tool.read']; f.state.deadline = NOW+10000;
  f.claims.scopes = [structuredClone(scope)];
  f.subject = structuredClone(subject);
  const current = f.ports.currentRun;
  f.ports.currentRun = async call => { const v=JSON.parse(await current(call));v.deadlineMs=f.state.deadline;return JSON.stringify(v); };
  f.ports.authorizeBusiness = async call => {f.calls.push('policy');f.state.policyInput=call.input;return JSON.stringify({
    decision:{decisionId:f.subject.authorizationDecisionId,actor:{tenantId:binding.tenantId,actorId},operation:`${operation.id}@${operation.version}`,scopes:f.subject.scopes,policyRevision:'revision-1',evaluatedAt:new Date(f.state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},subject:f.subject,grants:f.state.grants});};
  f.ports.authorizeSources = async () => {f.calls.push('source-policy');return JSON.stringify({sourceIds:['action_recommendation'],enabled:f.state.sourceEnabled,policyRevision:'revision-1',checkedAtMs:f.state.now});};
  const reserve=f.budget.reserve;
  f.budget.reserve=async call=>{f.state.reservation=call;return reserve(call);};
  const entry={descriptor:resolved.descriptor,contract:resolved,async execute(call){f.calls.push('handler');f.state.handlerCall=call;return JSON.stringify(page(call.request,{binding:call.authority.binding,subject:call.authority.subject}));}};
  const oldCreate=f.create;
  f.create=options=>oldCreate({catalog:{entry:()=>entry,discoverable:()=>[entry]},...options});
  f.entry=entry;f.request=JSON.stringify({operation,arguments:request});
  return f;
}
