/** Closed governed legislative-document proposal/receipt binding; Core remains the current authority and effect owner.
 * Two write effects share one owner kind: `prepare_legiwatch_briefing` (Intel EditorialService.save) and
 * `save_legislative_research` (Intel ResearchService.saveResearch). Neither publishes, sends or schedules.
 *
 * The receipt states a truthful durable effect and never upgrades one:
 * - `complete`        the canonical Workspace document was actually returned by the export owner;
 * - `selection_only`  the canonical selection/request row was saved and the export owner returned no document;
 * - `unknown`         no confirmed receipt exists; the effect must be observed, never repeated.
 *
 * Model/tool input omits empty scopes; the canonical Core proposal and receipt explicitly retain null
 * clientId (and research folderId). Keep those wire bytes immutable while normalizing tool input separately. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const LEGISLATIVE_DOCUMENT_ACTIONS=Object.freeze(['prepare_legiwatch_briefing','save_legislative_research']);
export const BRIEFING_ACTION='prepare_legiwatch_briefing',RESEARCH_ACTION='save_legislative_research';
export const LEGISLATIVE_DOCUMENT_STATUSES=Object.freeze(['proposed','approved','executing','succeeded','failed_retryable','failed_terminal','outcome_unknown','blocked','dismissed','expired']);
export const LEGISLATIVE_DOCUMENT_EFFECTS=Object.freeze(['complete','selection_only','unknown']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,hex=/^[a-f0-9]{64}$/u;
const draftId=/^[a-zA-Z0-9-]{1,100}$/u,location=/^\/workspace\/draft\/[a-zA-Z0-9-]{1,100}$/u,instant=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u;
const fail=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
const string=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n;
const jurisdiction=value=>typeof value==='string'&&(/^[A-Z]{2}$/u.test(value)||value==='US');
const BRIEFING_FIELDS=Object.freeze(['folderId','jurisdiction','sessionKey','template','title','analysis','cutoff','timezone','sources','citations']);
const RESEARCH_FIELDS=Object.freeze(['jurisdiction','sessionKey','title','analysis','documents','citations']);
export function createLegislativeDocumentValidators({validateShape,canonicalSha256:hash}){
 const same=(a,b)=>hash(a)===hash(b);
 const isAction=value=>LEGISLATIVE_DOCUMENT_ACTIONS.includes(value);
 /** Exact source selections: the owner re-reads every one; an invented id or revision never normalizes. */
 function source(value){const s=data(own(value,['kind','id','revision']));
  if(!string(s.kind,40)||!string(s.id,200)||!string(s.revision,200))fail();return s;}
 function citation(value){const c=data(own(value,['kind','id','revision','locator','start','end','quote']));
  if(!string(c.kind,40)||!string(c.id,200)||!string(c.revision,200)||!string(c.locator,200)||!Number.isSafeInteger(c.start)||c.start<0||!Number.isSafeInteger(c.end)||c.end<=c.start||!string(c.quote,8000))fail();return c;}
 function documentCitation(value){const c=data(own(value,['documentId','revision','locator','start','end','quote']));
  if(!string(c.documentId,200)||!string(c.revision,200)||!string(c.locator,200)||!Number.isSafeInteger(c.start)||c.start<0||!Number.isSafeInteger(c.end)||c.end<=c.start||!string(c.quote,8000))fail();return c;}
 function briefing(value){const b=data(own(value,BRIEFING_FIELDS.filter(k=>!['jurisdiction','sessionKey'].includes(k)),['clientId','jurisdiction','sessionKey']));
  if(b.clientId!==undefined&&b.clientId!==null&&!uuid.test(b.clientId)||!uuid.test(b.folderId)||(b.jurisdiction!==undefined&&!jurisdiction(b.jurisdiction))||
   (b.sessionKey!==undefined&&!string(b.sessionKey,120))||!['research_update','daily_legislative_brief','morning_news_brief'].includes(b.template)||
   !string(b.title,200)||!string(b.analysis,30000)||typeof b.cutoff!=='string'||!instant.test(b.cutoff)||!Number.isFinite(Date.parse(b.cutoff))||
   !string(b.timezone,64)||!Array.isArray(b.sources)||b.sources.length>50||!Array.isArray(b.citations)||!b.citations.length||b.citations.length>150)fail();
  return {folderId:b.folderId,...(b.jurisdiction===undefined?{}:{jurisdiction:b.jurisdiction}),...(b.sessionKey===undefined?{}:{sessionKey:b.sessionKey}),template:b.template,title:b.title,analysis:b.analysis,
   cutoff:b.cutoff,timezone:b.timezone,sources:b.sources.map(source),citations:b.citations.map(citation),...(b.clientId==null?{}:{clientId:b.clientId})};}
 /** Preserve the canonical owner's explicit cross-session research fields and 60-character session bound. */
 function research(value){const r=data(own(value,RESEARCH_FIELDS,['clientId','folderId','allowCrossBill','rightSessionKey']));
  if(r.clientId!==undefined&&r.clientId!==null&&!uuid.test(r.clientId)||r.folderId!==undefined&&r.folderId!==null&&!uuid.test(r.folderId)||!jurisdiction(r.jurisdiction)||
   (r.allowCrossBill!==undefined&&typeof r.allowCrossBill!=='boolean')||(r.rightSessionKey!==undefined&&!string(r.rightSessionKey,60))||
   !string(r.sessionKey,60)||!string(r.title,200)||!string(r.analysis,30000)||!Array.isArray(r.documents)||!r.documents.length||r.documents.length>10||
   !Array.isArray(r.citations)||!r.citations.length||r.citations.length>100)fail();
  const documents=r.documents.map(value=>{const d=data(own(value,['id','revision'],['sessionKey']));
   if(!string(d.id,200)||!string(d.revision,200)||(d.sessionKey!==undefined&&!string(d.sessionKey,60)))fail();
   return {id:d.id,revision:d.revision,...(d.sessionKey===undefined?{}:{sessionKey:d.sessionKey})};});
  return {jurisdiction:r.jurisdiction,sessionKey:r.sessionKey,title:r.title,analysis:r.analysis,documents,citations:r.citations.map(documentCitation),
   ...(r.clientId==null?{}:{clientId:r.clientId}),...(r.folderId==null?{}:{folderId:r.folderId}),
   ...(r.allowCrossBill===undefined?{}:{allowCrossBill:r.allowCrossBill}),...(r.rightSessionKey===undefined?{}:{rightSessionKey:r.rightSessionKey})};}
 /** Canonical request without the caller-supplied key: what a proposal must reproduce exactly. */
 function normalizeInput(operation,value){if(!isAction(operation))fail();return operation===BRIEFING_ACTION?briefing(value):research(value);}
 /** The exact owner request. The caller supplies a deterministic key; a caller-chosen key is replaced upstream. */
 function request(operation,value){if(!isAction(operation))fail();
  const optional=['clientId',...(operation===BRIEFING_ACTION?['jurisdiction','sessionKey']:['folderId','allowCrossBill','rightSessionKey'])];
  const {requestKey,...rest}=data(own(value,[...(operation===BRIEFING_ACTION?BRIEFING_FIELDS:RESEARCH_FIELDS).filter(k=>!optional.includes(k)),'requestKey'],optional));
  const input=normalizeInput(operation,rest);if(!string(requestKey,180)||requestKey.length<8)fail();return {...input,clientId:input.clientId??null,...(operation===RESEARCH_ACTION?{folderId:input.folderId??null}:{}),requestKey};}
 function context(value){const c=data(own(value,['conversationId','selectedClientId','identityRevision','membershipRevision','contextRevision']));
  if(!uuid.test(c.conversationId)||c.selectedClientId!==null&&!uuid.test(c.selectedClientId)||!['identityRevision','membershipRevision','contextRevision'].every(k=>hex.test(c[k])))fail();return c;}
 /** Core's durable receipt only. A selection-only save is never relabelled as a completed document. */
 function receipt(operation,value,expected){const r=data(own(value,['state','selectionId','documentId','location','reused','request']));
  if(r.state!=='complete'&&r.state!=='selection_only'||!same(request(operation,r.request),expected)||!(r.selectionId===null||string(r.selectionId,200))||typeof r.reused!=='boolean')fail();
  if(r.state==='complete'){if(typeof r.documentId!=='string'||!draftId.test(r.documentId)||typeof r.location!=='string'||!location.test(r.location)||r.location!=='/workspace/draft/'+r.documentId)fail();}
  else if(r.documentId!==null||r.location!==null)fail();
  return r;}
 function coreResult(operation,value,expected={}){const r=data(own(value,['version','proposalId','status','operation','request','context','createdAt','expiresAt','receipt','effect']));
  if(r.version!=='0.1.0'||!isAction(operation)||r.operation!==operation||!uuid.test(r.proposalId)||!LEGISLATIVE_DOCUMENT_STATUSES.includes(r.status)||
   !Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=Date.parse(r.createdAt))fail();
  const current=request(operation,r.request);if(!same(current,r.request))fail();context(r.context);
  if(r.context.selectedClientId!==null&&(current.clientId??null)!==r.context.selectedClientId)fail();
  for(const key of ['proposalId','request','context','createdAt','expiresAt'])if(expected[key]!==undefined&&!same(r[key],expected[key]))fail();
  if(r.status==='succeeded'){if(r.receipt===null||r.effect!==r.receipt.state)fail();receipt(operation,r.receipt,r.request);}
  else if(r.receipt!==null||(r.effect!==null&&r.effect!=='unknown')||(r.status==='outcome_unknown'&&r.effect!=='unknown'))fail();
  return r;}
 function assertProposal(value){const p=data(own(value,['kind','binding','scopes','operation','proposalId','request','context','createdAt','expiresAt','commandSha256']));
  if(p.kind!=='legislative_document_action'||!isAction(p.operation)||!hex.test(p.commandSha256))fail();
  const {commandSha256,...bound}=p;if(hash(bound)!==commandSha256)fail();validateShape('RunBinding',p.binding);
  if(!Array.isArray(p.scopes)||p.scopes.length!==1)fail();for(const s of p.scopes){validateShape('Scope',s);
   if(s.tenantId!==p.binding.tenantId||s.kind!==(p.context.selectedClientId===null?'private-user':'client')||s.resourceId!==(p.context.selectedClientId??p.binding.actorId))fail();}
  coreResult(p.operation,{version:'0.1.0',proposalId:p.proposalId,status:'proposed',operation:p.operation,request:p.request,context:p.context,createdAt:p.createdAt,expiresAt:p.expiresAt,receipt:null,effect:null});
  if(p.context.conversationId!==p.binding.conversationId)fail();return p;}
 /** @param {*} expected the canonical arguments, or `{request}` from a resolved operation contract. */
 function assertOutput(operation,value,expected){const v=data(own(value,['status','proposal']));if(v.status!=='approval_required')fail();
  const p=assertProposal(v.proposal),{requestKey,...input}=p.request;
  const wanted=expected===undefined?undefined:expected!==null&&typeof expected==='object'&&Object.hasOwn(expected,'request')?expected.request:expected;
  if(wanted!==undefined&&!same(normalizeInput(operation,input),normalizeInput(operation,wanted)))fail();return v;}
 return Object.freeze({isAction,normalizeInput,request,context,receipt,coreResult,assertProposal,assertOutput});
}
