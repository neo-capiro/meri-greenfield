/**
 * Closed, phase-specific decoders for Core's initial Objective-generation replies
 * (capiro-backend PR66 49f328eb, unchanged since backend 81dd):
 *  - POST generation-admissions      {schemaVersion,sourceAdmission,sourceAdmissionSha256}
 *  - GET  generation-admissions/:id  the same plus acceptance {availability,value}
 *  - POST/GET generation-requests    {schemaVersion,sourceAdmissionSha256,request,requestSha256,executionContext}
 *  - POST generation-acceptances     {schemaVersion,sourceAdmissionSha256,sourceBinding,sourceRequestSha256,issuance}
 *    (no acceptedAtMs; the GET acceptance value carries acceptedAtMs).
 * Pure data checks against the caller's trusted expected source. A decoded reply
 * is evidence for comparison, never authority: it authenticates no caller, issues
 * nothing and cannot create the accepted run, issuance or custody it is compared to.
 * Initial Strategy only: regeneration replies and non-null Strategy versions refuse.
 */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertRequest} from '../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {strategyTypes} from '../../../packages/contracts/strategy-operations-candidate/shapes.mjs';
import {coreApplicationSha256} from '../../../packages/runtime/core-application-digest.mjs';
import {ProductError} from '../product-access/errors.mjs';

export const OBJECTIVE_ADMISSION_NAMESPACE='capiro.objective-strategy.admission:v1';
const TIME_MAX=8_640_000_000_000_000,MAX_PROMPT=100000;
const tokenKeys=['canonicalPlanId','tenantId','clientId','objectiveId','canonicalStrategyId','canonicalProjectId','bindingVersion','epoch','requestedIntentId','requestedObjectiveRevisionId','requestedObjectiveVersion','snapshotHash'];
const admissionKeys=['schemaVersion','namespace','canonical','actorUserId','clerkUserId','consentId','controlVersion','generationJobId','generationRequestId','admittedAtMs','effectExpiresAtMs','expectedStrategyVersionId'];
const issuanceKeys=['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256','factsSha256'];
const refuse=()=>{throw new ProductError('OBJECTIVE_GENERATION_CORE_REPLY_REFUSED');};
const same=(a,b)=>hash(a)===hash(b);

/** Plain closed JSON object with exactly `keys`; no accessors, proxies or prototypes. */
function closed(raw,keys){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||types.isProxy(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))refuse();
 const names=Reflect.ownKeys(raw);if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))refuse();
 const out={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(raw,key);if(!d||!d.enumerable||!('value' in d))refuse();out[key]=d.value;}
 return out;
}
const uuid=v=>{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v))refuse();return v;};
const sha=v=>{if(typeof v!=='string'||!/^[0-9a-f]{64}$/u.test(v))refuse();return v;};
const integer=(v,min,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(v)||v<min||v>max)refuse();return v;};
const opaque=v=>{if(typeof v!=='string'||v.length<1||v.length>128)refuse();return v;};
const frozen=value=>JSON.parse(JSON.stringify(value),(key,v)=>v&&typeof v==='object'?Object.freeze(v):v);

/** Trusted comparison source: the job and its full accepted seven-field binding. */
function expectedSource(raw){
 const s=closed(raw,['generationJobId','binding']);uuid(s.generationJobId);validateShape('RunBinding',s.binding);return s;
}

function admission(raw,source){
 const a=closed(raw,admissionKeys),c=closed(a.canonical,tokenKeys);
 for(const key of tokenKeys){
  if(['bindingVersion','epoch','requestedObjectiveVersion'].includes(key))integer(c[key],1,2147483647);
  else if(key==='snapshotHash')sha(c[key]);else uuid(c[key]);
 }
 for(const key of ['actorUserId','consentId','generationJobId','generationRequestId'])uuid(a[key]);
 opaque(a.clerkUserId);integer(a.controlVersion,1,2147483647);integer(a.admittedAtMs,0,TIME_MAX);integer(a.effectExpiresAtMs,0,TIME_MAX);
 // Initial Strategy only: a non-null expected version is a regeneration admission.
 if(a.schemaVersion!==1||a.namespace!==OBJECTIVE_ADMISSION_NAMESPACE||c.epoch!==1||a.effectExpiresAtMs<=a.admittedAtMs||
    a.expectedStrategyVersionId!==null||a.generationJobId!==source.generationJobId||
    a.clerkUserId!==source.binding.actorId||c.tenantId!==source.binding.tenantId)refuse();
 return {...a,canonical:c};
}

function binding(raw){const b=closed(raw,['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence']);validateShape('RunBinding',b);return b;}

function acceptance(raw,{admitted,sourceAdmissionSha256,source,issuance,observed}){
 const keys=['schemaVersion','sourceAdmissionSha256','sourceBinding','sourceRequestSha256','issuance',...(observed?['acceptedAtMs']:[])];
 const r=closed(raw,keys),b=binding(r.sourceBinding),i=closed(r.issuance,issuanceKeys);binding(i.binding);
 for(const key of ['issuanceKey','requestSha256','capabilitySha256','factsSha256'])sha(i[key]);uuid(i.grantId);integer(i.expiresAtMs,1,TIME_MAX);
 if(r.schemaVersion!==1||r.sourceAdmissionSha256!==sourceAdmissionSha256||sha(r.sourceRequestSha256)!==i.requestSha256||
    !same(b,source.binding)||!same(i.binding,b)||i.issuanceKey!==hash(b)||i.expiresAtMs>admitted.effectExpiresAtMs)refuse();
 // The genuine original Meri ISSUED receipt is the comparator; a reply cannot introduce one.
 if(issuance!==undefined&&!same({...i},issuance))refuse();
 if(observed){integer(r.acceptedAtMs,0,TIME_MAX);
  if(r.acceptedAtMs<admitted.admittedAtMs||r.acceptedAtMs>=admitted.effectExpiresAtMs||i.expiresAtMs<=r.acceptedAtMs)refuse();}
 return {...r,sourceBinding:b,issuance:{...i,binding:b}};
}

/** POST generation-admissions. */
export function decodeAdmissionReply(raw,expected){
 try{
  const source=expectedSource(expected),r=closed(raw,['schemaVersion','sourceAdmission','sourceAdmissionSha256']),a=admission(r.sourceAdmission,source);
  if(r.schemaVersion!==1||sha(r.sourceAdmissionSha256)!==coreApplicationSha256(a))refuse();
  return frozen({sourceAdmission:a,sourceAdmissionSha256:r.sourceAdmissionSha256});
 }catch{refuse();}
}

/** GET generation-admissions/:id. Unavailable acceptance is not absence of an acceptance write. */
export function decodeAdmissionReadReply(raw,expected,{issuance}={}){
 try{
  const source=expectedSource(expected),r=closed(raw,['schemaVersion','sourceAdmission','sourceAdmissionSha256','acceptance']);
  const a=admission(r.sourceAdmission,source),digest=sha(r.sourceAdmissionSha256),p=closed(r.acceptance,['availability','value']);
  if(r.schemaVersion!==1||digest!==coreApplicationSha256(a)||!['available','unavailable'].includes(p.availability)||(p.availability==='unavailable')!==(p.value===null))refuse();
  const accepted=p.availability==='available'?acceptance(p.value,{admitted:a,sourceAdmissionSha256:digest,source,issuance,observed:true}):null;
  return frozen({sourceAdmission:a,sourceAdmissionSha256:digest,acceptance:accepted});
 }catch{refuse();}
}

/** POST/GET generation-requests: the bare initial publication bound to its admission. */
export function decodePublicationReply(raw,expected,{admission:admitted}){
 try{
  const source=expectedSource(expected),a=admission(admitted,source),c=a.canonical,digest=coreApplicationSha256(a);
  const r=closed(raw,['schemaVersion','sourceAdmissionSha256','request','requestSha256','executionContext']);
  if(r.schemaVersion!==1||r.sourceAdmissionSha256!==digest||!r.request||typeof r.request!=='object'||Object.hasOwn(r.request,'requestVersion'))refuse();
  const q=assertRequest(r.request),e=closed(r.executionContext,['schemaVersion','prompt','promptSha256','ownerRefs','contextPacketId']);
  if(q.operation!=='strategy.draft'||q.basis!==null||sha(r.requestSha256)!==hash(q)||q.jobId!==a.generationJobId||q.requestId!==a.generationRequestId||
     q.principal.tenantId!==c.tenantId||q.principal.actorId!==a.clerkUserId||q.principal.clientId!==c.clientId||q.source.kind!=='objective'||
     q.source.objectiveId!==c.objectiveId||q.source.objectiveRevisionId!==c.requestedObjectiveRevisionId||
     q.source.objectiveVersion!==c.requestedObjectiveVersion||q.source.snapshotSha256!==c.snapshotHash||
     q.originalExpiresAtMs>a.effectExpiresAtMs||!strategyTypes.includes(q.input.typeHint))refuse();
  if(e.schemaVersion!==1||typeof e.prompt!=='string'||!e.prompt.trim()||e.prompt.length>MAX_PROMPT||
     createHash('sha256').update(e.prompt,'utf8').digest('hex')!==sha(e.promptSha256)||e.contextPacketId!==q.context.packetId||
     !Array.isArray(e.ownerRefs)||e.ownerRefs.length!==q.context.ownerRefs.length)refuse();
  const refs=new Set();for(const raw of e.ownerRefs){const o=closed(raw,['ownerRef','clerkUserId']);opaque(o.clerkUserId);
   if(typeof o.ownerRef!=='string'||refs.has(o.ownerRef)||!q.context.ownerRefs.includes(o.ownerRef))refuse();refs.add(o.ownerRef);}
  return frozen({sourceAdmissionSha256:digest,request:q,requestSha256:r.requestSha256,executionContext:e,queuedType:q.input.typeHint});
 }catch{refuse();}
}

/** POST generation-acceptances, compared to the genuine original Meri ISSUED receipt. */
export function decodeAcceptanceReply(raw,expected,{admission:admitted,issuance}){
 try{
  const source=expectedSource(expected),a=admission(admitted,source);if(issuance===undefined)refuse();
  return frozen(acceptance(raw,{admitted:a,sourceAdmissionSha256:coreApplicationSha256(a),source,issuance,observed:false}));
 }catch{refuse();}
}

/** Raw protected-facts input for compileObjectiveProtectedFacts: Core-owned source
 * plus the separately issued Meri execution selection. Validation only. */
export function objectiveSourceSelection({admission:admitted,publication,executionSelection}){
 try{
  const s=closed(executionSelection,['provider','model']);if([s.provider,s.model].some(v=>typeof v!=='string'||!v.trim()||v.length>128))refuse();
  if(publication.sourceAdmissionSha256!==coreApplicationSha256(admitted))refuse();
  return frozen({sourceAdmission:admitted,request:publication.request,executionContext:publication.executionContext,queuedType:publication.queuedType,executionSelection:s});
 }catch{refuse();}
}
