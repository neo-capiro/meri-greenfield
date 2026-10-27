/** Closed SavedNote request/receipt/envelope binding; Core remains the current authority and effect owner.
 *  `request` is the closed caller request Core accepts, `publicRequest` the body-free request view Core
 *  returns, `receipt` the canonical owner's receipt for each of the three destinations, `coreResult` the
 *  finite attended prepare/read envelope, and `envelope`/`result` the recorded saved-note result this side
 *  releases. Nothing here holds note text: only the body hash and length cross the boundary. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const SAVED_NOTE_ACTION='save_note';
export const SAVED_NOTE_CORE_STATUSES=Object.freeze(['succeeded','failed_terminal','failed_retryable','outcome_unknown','blocked','proposed','executing','dismissed','expired']);
export const SAVED_NOTE_STATUSES=Object.freeze(['saved','withheld','blocked','unknown','failed']);
export const SAVED_NOTE_DESTINATIONS=Object.freeze(['meeting','client_document','general']);
export const SAVED_NOTE_READINESS=Object.freeze(['ready','indexing','indexed','private','scanning','unavailable']);
export const SAVED_NOTE_INDEXING=Object.freeze(['indexed','pending','not_indexed']);
export const SAVED_NOTE_POLICY_OUTCOMES=Object.freeze(['PASS','WARN','BLOCK']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,hex=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
const string=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n;
const optionalString=(s,n)=>s===null||s===undefined||string(s,n);
const instant=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
export function createSavedNoteValidators({validateShape,canonicalSha256:hash}){
 const same=(a,b)=>hash(a)===hash(b);
 /** The closed request a caller may carry. The attended conversation is never caller-supplied. */
 function request(value){const r={...data(own(value,['body'],['title','clientId','meetingId','confidential','accessLevel']))};
  if(typeof r.body!=='string'||r.body.length<1||r.body.length>40000)fail();
  r.body=r.body.trim();if(!r.body)fail();
  for(const key of ['title','accessLevel'])if(r[key]!==undefined){if(typeof r[key]!=='string')fail();r[key]=r[key].trim();}
  if(r.title!==undefined&&!string(r.title,160))fail();
  if(r.clientId!==undefined&&!uuid.test(r.clientId))fail();
  if(r.meetingId!==undefined&&!uuid.test(r.meetingId))fail();
  if(r.confidential!==undefined&&typeof r.confidential!=='boolean')fail();
  if(r.accessLevel!==undefined&&!string(r.accessLevel,80))fail();
  if(Object.hasOwn(r,'conversationId'))fail();
  if(new TextEncoder().encode(JSON.stringify(r)).length>65536)fail();
  return r;
 }
 /** The body-free request view every read returns; the exact immutable request identity. */
 function publicRequest(value){const r=data(own(value,['tool','bodyHash','bodyLength','title','clientId','meetingId','confidential','accessLevel']));
  if(r.tool!==SAVED_NOTE_ACTION)fail();
  if(!hex.test(r.bodyHash))fail();
  if(!Number.isSafeInteger(r.bodyLength)||r.bodyLength<1||r.bodyLength>40000)fail();
  if(!optionalString(r.title,160))fail();
  if(r.clientId!==null&&!uuid.test(r.clientId))fail();
  if(r.meetingId!==null&&!uuid.test(r.meetingId))fail();
  if(r.confidential!==null&&typeof r.confidential!=='boolean')fail();
  if(!optionalString(r.accessLevel,80))fail();
  return r;
 }
 /** The caller's current attended scope, as Core re-derives and records it. */
 function context(value){const c=data(own(value,['conversationId','selectedClientId','identityRevision','membershipRevision','contextRevision']));
  if(!uuid.test(c.conversationId)||c.selectedClientId!==null&&!uuid.test(c.selectedClientId))fail();
  if(!['identityRevision','membershipRevision','contextRevision'].every(k=>hex.test(c[k])))fail();
  return c;
 }
 /** The canonical owner's receipt. A meeting note, a client Files document and a General ClioNote each
  *  carry exactly the identity that destination has: never an invented index, link or body. */
 function receipt(value){
  if(!SAVED_NOTE_DESTINATIONS.includes(value?.destination))fail();
  if(!uuid.test(value.noteId)||!hex.test(value.bodyHash))fail();
  if(!optionalString(value.generatedAt,60))fail();
  if(value.destination==='meeting'){
   const r=data(own(value,['destination','noteId','meetingNoteId','meetingNoteStatus','confidential','accessLevel','readiness','bodyHash'],['generatedAt']));
   if(!uuid.test(r.meetingNoteId))fail();
   if(!optionalString(r.meetingNoteStatus,128))fail();
   if(r.confidential!==null&&r.confidential!==undefined&&typeof r.confidential!=='boolean')fail();
   if(!optionalString(r.accessLevel,80))fail();
   if(r.readiness!=='ready')fail();
   return r;
  }
  if(value.destination==='client_document'){
   const r=data(own(value,['destination','noteId','documentId','location','indexingStatus','reused','readiness','bodyHash'],['generatedAt']));
   if(!uuid.test(r.documentId))fail();
   if(!string(r.location,1024))fail();
   if(r.indexingStatus!==null&&!SAVED_NOTE_INDEXING.includes(r.indexingStatus))fail();
   if(!SAVED_NOTE_READINESS.includes(r.readiness))fail();
   if(typeof r.reused!=='boolean')fail();
   return r;
  }
  const r=data(own(value,['destination','noteId','clientId','readiness','bodyHash'],['generatedAt']));
  if(r.clientId!==null)fail();
  if(r.readiness!=='ready')fail();
  return r;
 }
 /** Core's finite attended prepare/read envelope. `expected` is the closed caller request, so the returned
  *  body hash and length must be that exact body's. A saved note is PASS: a WARN is never a receipt and a
  *  BLOCK never carries one. */
 function coreResult(value,expected={}){
  const r=data(own(value,['version','proposalId','status','request','context','policyOutcome','createdAt','expiresAt','receipt'],['errorCode','errorMessage']));
  if(r.version!=='0.1.0'||!uuid.test(r.proposalId))fail();
  if(!SAVED_NOTE_CORE_STATUSES.includes(r.status))fail();
  if(!SAVED_NOTE_POLICY_OUTCOMES.includes(r.policyOutcome))fail();
  if(!instant(r.createdAt)||!instant(r.expiresAt)||Date.parse(r.expiresAt)<=Date.parse(r.createdAt))fail();
  const view=publicRequest(r.request),ctx=context(r.context);
  if(r.status==='succeeded'){if(r.receipt===null||r.receipt===undefined)fail();if(r.errorCode!==null&&r.errorCode!==undefined)fail();if(r.errorMessage!==null&&r.errorMessage!==undefined)fail();receipt(r.receipt);if(r.receipt.bodyHash!==view.bodyHash||r.receipt.destination!==(view.meetingId!==null?'meeting':view.clientId!==null?'client_document':'general'))fail();}
  else{if(r.receipt!==null&&r.receipt!==undefined)fail();if((['failed_terminal','failed_retryable','outcome_unknown'].includes(r.status)?!string(r.errorCode,128):!optionalString(r.errorCode,128))||!optionalString(r.errorMessage,1024))fail();}
  if(expected.body!==undefined){expected=request(expected);
   if(view.bodyHash!==hash({body:expected.body,length:expected.body.length}))fail();
   if(view.bodyLength!==expected.body.length)fail();
  }
  if(expected.title!==undefined&&view.title!==expected.title)fail();
  if(Object.hasOwn(expected,'clientId')&&view.clientId!==expected.clientId)fail();
  if(Object.hasOwn(expected,'meetingId')&&view.meetingId!==expected.meetingId)fail();
  if(Object.hasOwn(expected,'confidential')&&view.confidential!==expected.confidential)fail();
  if(Object.hasOwn(expected,'accessLevel')&&view.accessLevel!==expected.accessLevel)fail();
  for(const key of ['proposalId','status','policyOutcome','createdAt','expiresAt'])if(expected[key]!==undefined&&!same(r[key],expected[key]))fail();
  return {...r,context:ctx};
 }
 /** The prepared saved-note result this side records and releases. It mirrors Core's outcome truthfully:
  *  `saved` is a PASS with a receipt identity, `withheld` a WARN with none, `blocked` a BLOCK, and
  *  `unknown`/`failed` carry a code and no receipt identity at all. */
 function envelope(value){const r=data(own(value,['status','operation','binding','scopes','bodyHash','bodyLength','proposalId','policyOutcome','createdAt','expiresAt','recordedAt'],
   ['destination','noteId','meetingNoteId','documentId','location','indexingStatus','readiness','reused','generatedAt','errorCode','errorMessage']));
  if(!SAVED_NOTE_STATUSES.includes(r.status)||r.operation!==SAVED_NOTE_ACTION)fail();
  validateShape('RunBinding',r.binding);
  if(!Array.isArray(r.scopes)||r.scopes.length!==1)fail();
  validateShape('Scope',r.scopes[0]);
  if(r.scopes[0].tenantId!==r.binding.tenantId)fail();
  if(!hex.test(r.bodyHash)||!Number.isSafeInteger(r.bodyLength)||r.bodyLength<1||r.bodyLength>40000)fail();
  if(!uuid.test(r.proposalId)||!SAVED_NOTE_POLICY_OUTCOMES.includes(r.policyOutcome))fail();
  if(!instant(r.createdAt)||!instant(r.expiresAt)||Date.parse(r.expiresAt)<=Date.parse(r.createdAt))fail();
  if(!instant(r.recordedAt))fail();
  if(!optionalString(r.generatedAt,60))fail();
  const identity=['destination','noteId','meetingNoteId','documentId','location','indexingStatus','readiness','reused'];
  if(r.status==='saved'){
   if(r.policyOutcome!=='PASS')fail();
   if(!SAVED_NOTE_DESTINATIONS.includes(r.destination)||!uuid.test(r.noteId)||!SAVED_NOTE_READINESS.includes(r.readiness))fail();
   if(r.errorCode!==undefined&&r.errorCode!==null)fail();
   if(r.destination==='meeting'){
    if(!uuid.test(r.meetingNoteId))fail();
    if(r.readiness!=='ready')fail();
    if(['documentId','location','indexingStatus','reused'].some(k=>r[k]!==null&&r[k]!==undefined))fail();
   }else if(r.destination==='client_document'){
    if(!uuid.test(r.documentId)||!string(r.location,1024)||!SAVED_NOTE_READINESS.includes(r.readiness)||typeof r.reused!=='boolean')fail();
    if(r.indexingStatus!==null&&r.indexingStatus!==undefined&&!SAVED_NOTE_INDEXING.includes(r.indexingStatus))fail();
    if(r.meetingNoteId!==null&&r.meetingNoteId!==undefined)fail();
   }else{
    if(r.documentId!==null&&r.documentId!==undefined)fail();
    if(r.location!==null&&r.location!==undefined)fail();
    if(r.indexingStatus!==null&&r.indexingStatus!==undefined)fail();
    if(r.reused!==null&&r.reused!==undefined)fail();
    if(r.meetingNoteId!==null&&r.meetingNoteId!==undefined)fail();
    if(r.readiness!=='ready')fail();
   }
  }else{
   // Withheld, blocked, unknown and failed never claim a receipt identity.
   for(const key of identity)if(r[key]!==null&&r[key]!==undefined)fail();
   if(r.status==='withheld'&&r.policyOutcome!=='WARN')fail();
   if(r.status==='blocked'&&r.policyOutcome!=='BLOCK')fail();
   if((r.status==='unknown'||r.status==='failed')&&!string(r.errorCode,128))fail();
   if(r.errorMessage!==undefined&&!optionalString(r.errorMessage,1024))fail();
  }
  return r;
 }
 /** The released result must be the body the caller carried: same hash, same length. */
 function result(value,expected){const r=envelope(value);expected=request(expected);
  if(!expected||typeof expected.body!=='string'||expected.body.length<1)fail();
  if(r.bodyHash!==hash({body:expected.body,length:expected.body.length}))fail();
  if(r.bodyLength!==expected.body.length)fail();
  return r;
 }
 return Object.freeze({request,publicRequest,context,receipt,coreResult,envelope,result});
}
