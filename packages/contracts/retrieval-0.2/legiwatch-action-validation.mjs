/** Closed LegiWatch proposal/receipt binding; Core remains the current authority and effect owner. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const LEGIWATCH_ACTION='apply_legiwatch_suggestion';
export const LEGIWATCH_STATUSES=Object.freeze(['proposed','approved','executing','succeeded','failed_retryable','failed_terminal','outcome_unknown','blocked','dismissed','expired']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,hex=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
const actions=['add','dismiss','exclude','restore','undo'];
const string=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n;
export function createLegiwatchValidators({validateShape,canonicalSha256:hash,relevanceValidators:relevance}){
 const same=(a,b)=>hash(a)===hash(b);
 function normalizeInput(value){const r=data(own(value,['clientId','folderId','jurisdiction','sessionKey','suggestionId','expectedVersion','action']));
  if(r.clientId!==null&&!uuid.test(r.clientId)||!uuid.test(r.folderId)||!uuid.test(r.suggestionId)||typeof r.jurisdiction!=='string'||!/^[A-Z]{2}$/u.test(r.jurisdiction)||!string(r.sessionKey,120)||!Number.isSafeInteger(r.expectedVersion)||r.expectedVersion<1||r.expectedVersion>2147483646||!actions.includes(r.action))fail();return r;
 }
 function request(value){if(Object.hasOwn(value??{},'previewHash'))return relevance.request(value);const {requestKey,...input}=data(own(value,['clientId','folderId','jurisdiction','sessionKey','suggestionId','expectedVersion','action','requestKey']));
  normalizeInput(input);if(!string(requestKey,180)||requestKey.length<8)fail();return {...input,requestKey};}
 function context(value){const c=data(own(value,['conversationId','selectedClientId','identityRevision','membershipRevision','contextRevision']));
  if(!uuid.test(c.conversationId)||c.selectedClientId!==null&&!uuid.test(c.selectedClientId)||!['identityRevision','membershipRevision','contextRevision'].every(k=>hex.test(c[k])))fail();return c;}
 function receipt(value,expected){if(Object.hasOwn(expected,'previewHash'))return relevance.receipt(value,expected);const r=data(own(value,['request','outcome','payload'])),p=own(r.payload,['binding','suggestionId','decisionId','version','action']);request(r.request);
  if(!same(r.request,expected)||!['added','already_present','dismissed','excluded','pending','stale','undone','undo_conflict','held'].includes(r.outcome)||!hex.test(p.binding)||p.suggestionId!==expected.suggestionId||p.action!==expected.action||p.version!==expected.expectedVersion+1||p.decisionId!==null&&!uuid.test(p.decisionId))fail();return r;}
 function coreResult(value,expected={}){const r=data(own(value,['version','proposalId','status','request','context','createdAt','expiresAt','receipt']));
  if(r.version!=='0.1.0'||!uuid.test(r.proposalId)||!LEGIWATCH_STATUSES.includes(r.status)||!Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=Date.parse(r.createdAt))fail();
  request(r.request);context(r.context);if(r.context.selectedClientId!==null&&r.request.clientId!==r.context.selectedClientId)fail();
  for(const key of ['proposalId','request','context','createdAt','expiresAt'])if(expected[key]!==undefined&&!same(r[key],expected[key]))fail();
  if(r.status==='succeeded'){if(r.receipt===null)fail();receipt(r.receipt,r.request);}else if(r.receipt!==null)fail();return r;
 }
 function assertProposal(value){const p=data(own(value,['kind','binding','scopes','operation','proposalId','request','context','createdAt','expiresAt','commandSha256']));
  if(p.kind!=='legiwatch_action'||p.operation!==(Object.hasOwn(p.request??{},'previewHash')?'save_legiwatch_relevance':LEGIWATCH_ACTION)||!hex.test(p.commandSha256))fail();
  const {commandSha256,...bound}=p;if(hash(bound)!==commandSha256)fail();validateShape('RunBinding',p.binding);
  if(!Array.isArray(p.scopes)||p.scopes.length!==1)fail();for(const s of p.scopes){validateShape('Scope',s);if(s.tenantId!==p.binding.tenantId||s.kind!==(p.context.selectedClientId===null?'private-user':'client')||s.resourceId!==(p.context.selectedClientId??p.binding.actorId))fail();}
  coreResult({version:'0.1.0',proposalId:p.proposalId,status:'proposed',request:p.request,context:p.context,createdAt:p.createdAt,expiresAt:p.expiresAt,receipt:null});
  if(p.context.conversationId!==p.binding.conversationId)fail();return p;
 }
 function assertOutput(value,expectedInput){const v=data(own(value,['status','proposal']));if(v.status!=='approval_required')fail();const p=assertProposal(v.proposal),{requestKey,...input}=p.request;if(expectedInput&&!same(input,(p.operation==='save_legiwatch_relevance'?relevance.saveInput(expectedInput):normalizeInput(expectedInput))))fail();return v;}
 return Object.freeze({normalizeInput,request,context,receipt,coreResult,assertProposal,assertOutput});
}
