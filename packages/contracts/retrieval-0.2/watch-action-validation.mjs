/** Closed watch proposal/receipt binding; Core remains the current authority and each canonical owner remains the effect. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const WATCH_ACTION='watch_action';
export const WATCH_FAMILIES=Object.freeze(['legiwatch_keyword','business_development_prospect','defense_budget_target','client_watchlist']);
export const WATCH_OPERATIONS=Object.freeze(['subscribe','pause','resume','unsubscribe','set_delivery']);
export const WATCH_SUPPORTED=Object.freeze({legiwatch_keyword:['subscribe','pause','resume','unsubscribe','set_delivery'],business_development_prospect:['subscribe','pause','resume','unsubscribe'],defense_budget_target:['subscribe','resume','unsubscribe'],client_watchlist:['subscribe','pause']});
export const WATCH_TARGET_KINDS=Object.freeze({legiwatch_keyword:['keyword_rule'],business_development_prospect:['prospect'],defense_budget_target:['program','pe','project','capability'],client_watchlist:['client_tracker_watchlist']});
export const WATCH_STATUSES=Object.freeze(['proposed','approved','executing','succeeded','failed_retryable','failed_terminal','outcome_unknown','blocked','dismissed','expired']);
export const WATCH_STATES=Object.freeze(['active','paused','needs_review','ended','unsubscribed','absent']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,hex=/^[a-f0-9]{64}$/u,tokenText=/^[A-Za-z0-9._:-]{1,180}$/u;
const fail=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
const string=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n;
const version=v=>Number.isSafeInteger(v)&&v>=1&&v<=2147483646;
export function createWatchValidators({validateShape,canonicalSha256:hash}){
 const same=(a,b)=>hash(a)===hash(b);
 const inputKeys=['family','clientId','targetKind','targetKey','operation','expectedVersion','sourceRevision','reason','enabled'];
 function normalizeInput(value){const r=data(own(value,inputKeys));
  if(!WATCH_FAMILIES.includes(r.family)||r.clientId!==null&&!uuid.test(r.clientId)||!string(r.targetKind,40)||!tokenText.test(r.targetKey)||!WATCH_OPERATIONS.includes(r.operation)||!version(r.expectedVersion))fail();
  if(!WATCH_SUPPORTED[r.family].includes(r.operation)||!WATCH_TARGET_KINDS[r.family].includes(r.targetKind))fail();
  if(r.sourceRevision!==null&&!tokenText.test(r.sourceRevision)||r.reason!==null&&!string(r.reason,2000)||r.enabled!==null&&typeof r.enabled!=='boolean')fail();
  if((r.operation==='set_delivery')!==(r.enabled!==null))fail();
  return r;
 }
 function request(value){const {requestKey,...input}=data(own(value,[...inputKeys,'requestKey']));
  normalizeInput(input);if(!string(requestKey,180)||requestKey.length<8)fail();return {...input,requestKey};}
 function context(value){const c=data(own(value,['conversationId','selectedClientId','identityRevision','membershipRevision','contextRevision']));
  if(!uuid.test(c.conversationId)||c.selectedClientId!==null&&!uuid.test(c.selectedClientId)||!['identityRevision','membershipRevision','contextRevision'].every(k=>hex.test(c[k])))fail();return c;}
 function target(value){const t=data(own(value,['family','clientId','targetKind','targetKey']));
  if(!WATCH_FAMILIES.includes(t.family)||t.clientId!==null&&!uuid.test(t.clientId)||!string(t.targetKind,40)||!WATCH_TARGET_KINDS[t.family].includes(t.targetKind)||!tokenText.test(t.targetKey))fail();return t;}
 function receipt(value,expected){const r=data(own(value,['request','owner','binding','operation','targetKey','identity','state','version','deliveryEnabled','eventId','alreadyInState']));request(r.request);
  if(!same(r.request,expected)||r.owner!==expected.family||r.operation!==expected.operation||r.targetKey!==expected.targetKey||!hex.test(r.binding)||!string(r.identity,180)||!WATCH_STATES.includes(r.state)||r.version!==null&&!version(r.version)||r.deliveryEnabled!==null&&typeof r.deliveryEnabled!=='boolean'||r.eventId!==null&&!string(r.eventId,180)||typeof r.alreadyInState!=='boolean')fail();return r;}
 function coreResult(value,expected={}){const r=data(own(value,['version','proposalId','status','request','context','createdAt','expiresAt','receipt']));
  if(r.version!=='0.1.0'||!uuid.test(r.proposalId)||!WATCH_STATUSES.includes(r.status)||!Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=Date.parse(r.createdAt))fail();
  request(r.request);context(r.context);if(r.context.selectedClientId!==null&&r.request.clientId!==r.context.selectedClientId)fail();
  for(const key of ['proposalId','request','context','createdAt','expiresAt'])if(expected[key]!==undefined&&!same(r[key],expected[key]))fail();
  if(r.status==='succeeded'){if(r.receipt===null)fail();receipt(r.receipt,r.request);}else if(r.receipt!==null)fail();return r;}
 function inspectResult(value,expected){const r=data(own(value,['version','state']));
  const s=data(own(r.state,['family','clientId','targetKind','targetKey','identity','state','version','deliveryEnabled','facts']));
  if(r.version!=='0.1.0')fail();
  const t={family:s.family,clientId:s.clientId,targetKind:s.targetKind,targetKey:s.targetKey};target(t);
  if(!same(t,expected))fail();
  const f=data(own(s.facts,Object.keys(s.facts)));
  for(const v of Object.values(f))if(v!==null&&typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean')fail();
  if(s.identity!==null&&!string(s.identity,180)||!WATCH_STATES.includes(s.state)||s.version!==null&&!version(s.version)||s.deliveryEnabled!==null&&typeof s.deliveryEnabled!=='boolean')fail();
  return r;}
 function assertProposal(value){const p=data(own(value,['kind','binding','scopes','operation','proposalId','request','context','createdAt','expiresAt','commandSha256']));
  if(p.kind!=='watch_action'||p.operation!==WATCH_ACTION||!hex.test(p.commandSha256))fail();
  const {commandSha256,...bound}=p;if(hash(bound)!==commandSha256)fail();validateShape('RunBinding',p.binding);
  if(!Array.isArray(p.scopes)||p.scopes.length!==1)fail();for(const s of p.scopes){validateShape('Scope',s);if(s.tenantId!==p.binding.tenantId||s.kind!==(p.context.selectedClientId===null?'private-user':'client')||s.resourceId!==(p.context.selectedClientId??p.binding.actorId))fail();}
  coreResult({version:'0.1.0',proposalId:p.proposalId,status:'proposed',request:p.request,context:p.context,createdAt:p.createdAt,expiresAt:p.expiresAt,receipt:null});
  if(p.context.conversationId!==p.binding.conversationId)fail();return p;
 }
 function assertOutput(value,expectedInput){const v=data(own(value,['status','proposal']));if(v.status!=='approval_required')fail();const p=assertProposal(v.proposal),{requestKey,...input}=p.request;if(expectedInput&&!same(input,normalizeInput(expectedInput)))fail();return v;}
 return Object.freeze({normalizeInput,request,context,target,receipt,coreResult,inspectResult,assertProposal,assertOutput});
}
