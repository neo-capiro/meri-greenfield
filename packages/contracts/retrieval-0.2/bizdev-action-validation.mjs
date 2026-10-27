/** Closed business-development brief proposal/receipt binding; Core remains the current prospect-scope authority and the saved-version effect owner. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const BIZDEV_ACTION='save_business_development_brief';
export const BIZDEV_STATUSES=Object.freeze(['proposed','approved','executing','succeeded','failed_retryable','failed_terminal','outcome_unknown','blocked','dismissed','expired']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,hex=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
// The exact five saved-brief sections. The model states text plus indexes into
// the version's existing citations; provenance and citation records are never
// model-submitted, and no sixth section is accepted.
const sectionKeys=Object.freeze(['companyAndFirmImplication','verifiedEvidence','judgment','practicalAction','missingInformation']);
const string=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n;
export function createBizdevValidators({validateShape,canonicalSha256:hash}){
 const same=(a,b)=>hash(a)===hash(b);
 // The exact five sections are validated and copied WITHOUT rewriting them: the
 // journal binds the published proposal to the arguments the run actually
 // submitted, so a normalizer must not silently rewrite the model's text or
 // citation indexes. The saved-version owner remains the authority on trimming,
 // index validity and idempotency.
 function sections(value){const s=data(own(value,[...sectionKeys])),out={};
  for(const key of sectionKeys){const section=data(own(s[key],['text','citationIndexes']));
   if(!string(section.text,4000)||!Array.isArray(section.citationIndexes)||section.citationIndexes.length>64||!section.citationIndexes.every(i=>Number.isSafeInteger(i)&&i>=0))fail();
   out[key]={text:section.text,citationIndexes:[...section.citationIndexes]};
  }
  return out;}
 function normalizeInput(value){const r=data(own(value,['conversationId','expectedVersionNumber','sections'],['title']));
  if(!uuid.test(r.conversationId)||!Number.isSafeInteger(r.expectedVersionNumber)||r.expectedVersionNumber<1||r.expectedVersionNumber>2147483646||r.title!==undefined&&!string(r.title,300))fail();
  return {conversationId:r.conversationId,expectedVersionNumber:r.expectedVersionNumber,...(r.title===undefined?{}:{title:r.title}),sections:sections(r.sections)};}
 function request(value){const {requestKey,...input}=data(own(value,['conversationId','expectedVersionNumber','sections','requestKey'],['title']));
  const normalized=normalizeInput(input);if(!string(requestKey,180)||requestKey.length<8)fail();return {...normalized,requestKey};}
 function context(value){const c=data(own(value,['conversationId','prospectId','prospectName','canonicalOrganizationId','linkedClientId','scopeVersion']));
  if(!uuid.test(c.conversationId)||!uuid.test(c.prospectId)||!string(c.prospectName,200)||c.canonicalOrganizationId!==null&&!uuid.test(c.canonicalOrganizationId)||c.linkedClientId!==null&&!uuid.test(c.linkedClientId)||!hex.test(c.scopeVersion))fail();return c;}
 function receipt(value,expected){const r=data(own(value,['request','binding','tool','status','generatedAt','brief','version','reused','prospectName'])),b=own(r.brief,['id','title','status','currentVersionNumber','updatedAt']),v=own(r.version,['id','versionNumber','createdAt','citationCount']);
  request(r.request);
  // The receipt must describe this exact edit: the same request, the expected
  // version's immediate successor, and a brief whose current version is that
  // same saved version. Nothing partial or foreign is released as saved.
  if(!same(r.request,expected)||r.tool!==BIZDEV_ACTION||r.status!=='saved'||!hex.test(r.binding)||!Number.isFinite(Date.parse(r.generatedAt))||!uuid.test(b.id)||typeof b.title!=='string'||!['draft','archived'].includes(b.status)||!Number.isSafeInteger(b.currentVersionNumber)||b.currentVersionNumber<1||!Number.isFinite(Date.parse(b.updatedAt))||!uuid.test(v.id)||!Number.isSafeInteger(v.versionNumber)||v.versionNumber!==expected.expectedVersionNumber+1||!Number.isFinite(Date.parse(v.createdAt))||!Number.isSafeInteger(v.citationCount)||v.citationCount<0||typeof r.reused!=='boolean'||!string(r.prospectName,200)||b.currentVersionNumber!==v.versionNumber)fail();return r;}
 function coreResult(value,expected={}){const r=data(own(value,['version','proposalId','status','request','context','createdAt','expiresAt','receipt']));
  if(r.version!=='0.1.0'||!uuid.test(r.proposalId)||!BIZDEV_STATUSES.includes(r.status)||!Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=Date.parse(r.createdAt))fail();
  request(r.request);context(r.context);
  for(const key of ['proposalId','request','context','createdAt','expiresAt'])if(expected[key]!==undefined&&!same(r[key]??null,expected[key]??null))fail();
  if(r.status==='succeeded'){if(r.receipt===null)fail();receipt(r.receipt,r.request);}else if(r.receipt!==null)fail();return r;
 }
 function assertProposal(value){const p=data(own(value,['kind','binding','scopes','operation','proposalId','request','context','createdAt','expiresAt','commandSha256']));
  if(p.kind!=='bizdev_action'||p.operation!==BIZDEV_ACTION||!hex.test(p.commandSha256))fail();
  const {commandSha256,...bound}=p;if(hash(bound)!==commandSha256)fail();validateShape('RunBinding',p.binding);
  // The run's current scope is the prospect's own scope: an unlinked prospect is
  // private to the actor, a linked prospect is that client's scope. A null
  // client is never silently widened into a general or another tenant's scope.
  if(!Array.isArray(p.scopes)||p.scopes.length!==1)fail();for(const s of p.scopes){validateShape('Scope',s);if(s.tenantId!==p.binding.tenantId||s.kind!==(p.context.linkedClientId===null?'private-user':'client')||s.resourceId!==(p.context.linkedClientId??p.binding.actorId))fail();}
  coreResult({version:'0.1.0',proposalId:p.proposalId,status:'proposed',request:p.request,context:p.context,createdAt:p.createdAt,expiresAt:p.expiresAt,receipt:null});
  if(p.context.conversationId!==p.binding.conversationId)fail();return p;
 }
 function assertOutput(value,expectedInput){const v=data(own(value,['status','proposal']));if(v.status!=='approval_required')fail();const p=assertProposal(v.proposal),{requestKey,...input}=p.request;if(expectedInput&&!same(input,normalizeInput(expectedInput)))fail();return v;}
 return Object.freeze({normalizeInput,request,context,receipt,coreResult,assertProposal,assertOutput});
}
