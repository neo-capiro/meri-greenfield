/** Private retained Core wire; validates data, never supplies trust or credentials. */
import canonicalize from 'canonicalize';
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../validate.mjs';
import {resolveOperationContract,validateShape as readShape,assertSubject} from '../retrieval-0.2/validate.mjs';
import {nativeReadFault} from './reads.mjs';
export const retainedPrincipalDomain='capiro-retained-read-principal-v1\n';
export const retainedRoutes=Object.freeze({
 get_research_portfolio:Object.freeze({authority:'/api/clio/application-authority/retained-research-portfolio',issuer:'/api/clio/application-authority/retained-research-portfolio-principal',data:'/api/clio/retained-reads/research-portfolio'}),
 get_research_portfolio_changes:Object.freeze({authority:'/api/clio/application-authority/retained-research-portfolio-changes',issuer:'/api/clio/application-authority/retained-research-portfolio-changes-principal',data:'/api/clio/retained-reads/research-portfolio-changes'}),
 get_florida_budget_project:Object.freeze({authority:'/api/clio/application-authority/retained-florida-budget',issuer:'/api/clio/application-authority/retained-florida-principal',data:'/intel-api/internal/legiwatch/retained-florida-budget'}),
});
export const retainedOperationIds=Object.freeze(Object.keys(retainedRoutes));
const fail=(code='ACCESS_DENIED')=>{throw nativeReadFault(code);},same=(a,b)=>hash(a)===hash(b);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,SHA=/^[a-f0-9]{64}$/u;
const uuid=v=>typeof v==='string'&&UUID.test(v),digest=v=>typeof v==='string'&&SHA.test(v),text=(v,min,max)=>typeof v==='string'&&v.length>=min&&v.length<=max;
export function retainedOperation(raw){const v=data(raw);readShape('OperationRef',v);if(v.version!=='0.2.0'||!retainedOperationIds.includes(v.id))fail('INVALID_ARGUMENTS');return v;}
export function retainedOrigin(raw){let url;try{url=new URL(raw);}catch{fail('CONFIGURATION');}if(typeof raw!=='string'||url.protocol!=='https:'||url.origin!==raw||url.username||url.password||url.search||url.hash||url.pathname!=='/')fail('CONFIGURATION');return raw;}
export function assertCorePrincipal(raw,withClerk=false){const p=data(raw);own(p,['tenantId','actorId',...(withClerk?['clerkUserId']:[])]);if(!uuid(p.tenantId)||!uuid(p.actorId)||withClerk&&(!text(p.clerkUserId,1,256)||!/^user_[A-Za-z0-9]+$/u.test(p.clerkUserId)))fail();return p;}
export function retainedClocks(v,{started,now,maxTtlMs=30000}){const at=now();if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||v.expiresAtMs>v.checkedAtMs+maxTtlMs)fail();}
export function coreRetainedSelector(operation,request,subject){const op=retainedOperation(operation),r=data(request);let out;
 if(op.id==='get_florida_budget_project'){readShape('FloridaBudgetRequest',r);out={schemaVersion:1,sessionKey:r.sessionKey??'',folderId:r.folderId||null,clientSelector:r.clientId?.trim().slice(0,80)||null};}
 else{if(subject.kind!=='entity'||subject.entityType!=='research-portfolio'||subject.entityIds.length!==1||subject.rosterVersionId!==null)fail();out={schemaVersion:1,portfolioId:subject.entityIds[0]};}
 return assertCoreRetainedSelector(op,out);
}
export function assertCoreRetainedSelector(operation,raw){const op=retainedOperation(operation),v=data(raw);if(op.id==='get_florida_budget_project'){
 own(v,['schemaVersion','sessionKey','folderId','clientSelector']);if(!text(v.sessionKey,0,256)||v.folderId!==null&&!uuid(v.folderId)||v.clientSelector!==null&&(!text(v.clientSelector,1,256)||v.clientSelector.trim()!==v.clientSelector))fail('INVALID_ARGUMENTS');
 }else{own(v,['schemaVersion','portfolioId']);if(!uuid(v.portfolioId))fail('INVALID_ARGUMENTS');}if(v.schemaVersion!==1)fail('INVALID_ARGUMENTS');return v;}
export function assertCoreRetainedReceipt(operation,raw,{selector,principal,identityRevision,started,now}){const op=retainedOperation(operation),v=data(raw),fl=op.id==='get_florida_budget_project';
 own(v,['schemaVersion','operation','principal','identityRevision','resourceRevision','selectorSha256',...(fl?['effectiveScope','clientResolution']:['scope']),'checkedAtMs','expiresAtMs']);
 if(v.schemaVersion!==1||v.operation!==op.id||!same(assertCorePrincipal(v.principal),principal)||!digest(v.identityRevision)||v.identityRevision!==identityRevision||!digest(v.resourceRevision)||v.selectorSha256!==hash(selector))fail();retainedClocks(v,{started,now});
 if(fl){const s=own(v.effectiveScope,['jurisdiction','sessionKey','folderId','clientId']);if(s.jurisdiction!=='FL'||s.sessionKey!==selector.sessionKey||s.folderId!==selector.folderId||s.clientId!==null&&!uuid(s.clientId))fail();
  if(selector.clientSelector===null){if(v.clientResolution!==null||s.folderId===null&&s.clientId!==null)fail();}
  else{const r=own(v.clientResolution,['selector','clientId']);if(r.selector!==selector.clientSelector||!uuid(r.clientId)||s.clientId!==r.clientId||uuid(selector.clientSelector)&&r.clientId!==selector.clientSelector)fail();}
 }else{own(v.scope,['portfolioId']);if(v.scope.portfolioId!==selector.portfolioId)fail();}return v;
}
export function assertRetainedObservation(raw){const v=data(raw);own(v,['binding','subject','operation','requestSha256','policyRevision','sourceIds','request','observationAt','deadlineMs']);validateShape('RunBinding',v.binding);assertSubject(v.subject,v.binding);const op=retainedOperation(v.operation);
 if(v.subject.policyRevision!==v.policyRevision||!digest(v.requestSha256)||v.requestSha256!==hash(v.request)||!Array.isArray(v.sourceIds)||!same([...v.sourceIds].sort(),[...new Set(resolveOperationContract(op).descriptor.sourceRequirements.map(s=>s.sourceId))].sort())||!Number.isSafeInteger(v.deadlineMs))fail();
 if(op.id==='get_florida_budget_project'){if(typeof v.observationAt!=='string'||new Date(Date.parse(v.observationAt)).toISOString()!==v.observationAt)fail('INVALID_ARGUMENTS');}else if(v.observationAt!==null)fail('INVALID_ARGUMENTS');return v;
}
export function assertRetainedPrincipalEnvelope(raw){const v=data(raw);own(v,['schemaVersion','purpose','algorithm','keyId','issuer','audienceOrigin','recipientPath','operation','principal','identityRevision','resourceRevision','rawRequestSha256','normalizedArgsSha256','normalizationContextSha256','currentAuthority','issuedAtMs','originalExpiresAtMs','signature']);
 if(v.schemaVersion!==1||v.purpose!=='capiro-retained-read-principal'||v.algorithm!=='Ed25519'||!text(v.keyId,1,256)||!text(v.issuer,1,256)||!retainedOperationIds.includes(v.operation)||retainedRoutes[v.operation].data!==v.recipientPath||![v.identityRevision,v.resourceRevision,v.rawRequestSha256,v.normalizedArgsSha256,v.normalizationContextSha256].every(digest)||!Number.isSafeInteger(v.issuedAtMs)||v.issuedAtMs<0||!Number.isSafeInteger(v.originalExpiresAtMs)||v.originalExpiresAtMs<=v.issuedAtMs||v.originalExpiresAtMs>v.issuedAtMs+30000)fail();
 retainedOrigin(v.audienceOrigin);assertCorePrincipal(v.principal,true);if(!text(v.currentAuthority,1,4096)||Buffer.byteLength(v.currentAuthority,'utf8')>4096)fail();const opaque=data(JSON.parse(v.currentAuthority));if(!opaque||Array.isArray(opaque)||opaque.schemaVersion!==1)fail();
 if(typeof v.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/u.test(v.signature)||Buffer.from(v.signature,'base64url').length!==64||Buffer.from(v.signature,'base64url').toString('base64url')!==v.signature||Buffer.byteLength(canonicalize(v),'utf8')>8192)fail();return v;
}
export function retainedPrincipalPayload(envelope){const {signature,...unsigned}=assertRetainedPrincipalEnvelope(envelope);return Buffer.from(retainedPrincipalDomain+canonicalize(unsigned),'utf8');}
export function encodeRetainedPrincipal(envelope){return Buffer.from(canonicalize(assertRetainedPrincipalEnvelope(envelope)),'utf8').toString('base64url');}
export function assertCoreDelegatedRequest(raw){const v=data(raw);own(v,['schemaVersion','request','context']);if(v.schemaVersion!==1||Buffer.byteLength(JSON.stringify(v),'utf8')>2097152)fail('RESOURCE_LIMIT');own(v.request,Object.keys(v.request??{}));own(v.context,Object.keys(v.context??{}));return v;}
export const canonicalRetainedJson=raw=>canonicalize(data(raw));
