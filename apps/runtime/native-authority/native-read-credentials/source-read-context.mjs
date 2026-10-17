/** Finite CONTROL contexts over current native facts. Selectors never create a client grant. */
import {publicDomainDatasetRegistry} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {captureHearingClientSelection} from '../../../gateway/sources/public-domain-hearings/request-context.mjs';
import {assertUnscopedLegalRequest,legalLegislationContext} from '../../../gateway/sources/research-legal-legislation/request-context.mjs';
import {assertUnscopedNewsRequest,newsSliceContext} from '../../../gateway/sources/research-legal-news/request-context.mjs';
import {captureOutreachListClientSelection} from '../../../gateway/sources/outreach-query/request-context.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const refuse=code=>{throw nativeReadFault(code);};
const lineageGroups=new Set(['facility-representation','district-nexus','tracked-bills']);
const subjectSelection=({authorizationDecisionId,...rest})=>rest;

/** Decision receipts may rotate; no other lineage or context field may drift. */
export function sourceReadContextSelection(group,context){
 return lineageGroups.has(group)?{...context,subject:subjectSelection(context.subject)}:context;
}

export function assertNativeResultClientIds(clientIds){
 if(!Array.isArray(clientIds)||clientIds.length>1||clientIds.some(id=>typeof id!=='string'||!UUID.test(id)))refuse('ACCESS_DENIED');
}

export function assertNativeVisibleClients(native,clientIds){
 assertNativeResultClientIds(clientIds);
 if(!Object.hasOwn(native,'clientIds'))refuse('UNAVAILABLE');
 if(clientIds.some(id=>!native.clientIds.includes(id)))refuse('ACCESS_DENIED');
}

function clientSubject(proof,native){
 const s=proof.subject;
 if(s.kind!=='client'||s.entityType!=='client'||s.entityIds.length!==1||!UUID.test(s.entityIds[0]))refuse('ACCESS_DENIED');
 if(!s.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===s.entityIds[0]))refuse('ACCESS_DENIED');
 assertNativeVisibleClients(native,s.entityIds);return s.entityIds[0];
}

function visibleSelector(native,subject,id){
 if((subject.kind==='client'||subject.entityType==='client')&&(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0].toLowerCase()!==id||!subject.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===id)))refuse('ACCESS_DENIED');
 assertNativeVisibleClients(native,[id]);
}

/** Reject unsupported source fallback before observing or disclosing any native credential. */
export function assertSourceReadRequest(contract,request){
 if(contract.binding.group==='state-status-votes'&&contract.normalizeInput(request,{}).metadata.selector.kind!=='canonical')refuse('UNAVAILABLE');
 if(contract.binding.group==='tracked-bills'&&!UUID.test(request.clientId.trim().slice(0,80).trim().toLowerCase()))refuse('UNAVAILABLE');
 if(contract.binding.group==='public-domain-hearings')captureHearingClientSelection(request);
 if(contract.binding.group==='research-legal-legislation')assertUnscopedLegalRequest(contract.descriptor.operation,request);
 if(contract.binding.group==='research-legal-news')assertUnscopedNewsRequest(contract.descriptor.operation,request);
 if(contract.binding.group==='outreach-query')captureOutreachListClientSelection(request);
}

export function createSourceReadContext({contract,proof,native,defaultCongress,now,priorContext}){
 const group=contract.binding.group;
 if(['bill-text','federal-legislation'].includes(group))return {defaultCongress};
 if(group==='acquisition-personnel')return {actorRole:native.actorRole};
 if(group==='research-legal-legislation'){
  if(proof.subject.kind==='client'||proof.subject.entityType==='client')refuse('ACCESS_DENIED');
  return legalLegislationContext;
 }
 if(group==='research-legal-news'){
  if(proof.subject.kind==='client'||proof.subject.entityType==='client')refuse('ACCESS_DENIED');
  return newsSliceContext(contract.descriptor.operation,proof.request);
 }
 if(group==='outreach-query'){
  const clientResolution=captureOutreachListClientSelection(proof.request);
  if(clientResolution.clientId!==clientSubject(proof,native))refuse('ACCESS_DENIED');
  return {clientResolution};
 }
 if(group==='public-domain-hearings'){
  const clientResolution=captureHearingClientSelection(proof.request),s=proof.subject;
  if(clientResolution===null){if(s.kind==='client'||s.entityType==='client')refuse('ACCESS_DENIED');}
  else visibleSelector(native,s,clientResolution.clientId);
  return {tenantId:proof.binding.tenantId,clientResolution};
 }
 if(group==='client-knowledge-search'){
  const input=contract.normalizeInput(proof.request,{}).input,selected=input.clientId,s=proof.subject;
  // Core returns the canonical malformed-selector note before loading any graph.
  if(selected!==null&&!UUID.test(selected.toLowerCase()))return {};
  if(selected===null){if(s.kind==='client'||s.entityType==='client')refuse('ACCESS_DENIED');}
  else{
   const id=selected.toLowerCase();
   visibleSelector(native,s,id);
  }
  if(input.seed?.startsWith('client:')&&UUID.test(input.seed.slice(7).toLowerCase()))visibleSelector(native,s,input.seed.slice(7).toLowerCase());
  return {};
 }
 if(group==='tracked-bills'){
  const selected=clientSubject(proof,native),clientReference=proof.request.clientId.trim().slice(0,80);
  if(clientReference.trim().toLowerCase()!==selected)refuse('ACCESS_DENIED');
  const context={binding:proof.binding,subject:proof.subject,clientReference};
  contract.normalizeInput(proof.request,context);return context;
 }
 if(lineageGroups.has(group)){
  const selected=clientSubject(proof,native),context={binding:proof.binding,subject:proof.subject};
  const input=contract.normalizeInput(proof.request,context).input;
  // Facility's missing-selector branch is an explicit note, never an implicit client selection.
  if(input.clientId!==null&&input.clientId!==selected)refuse('ACCESS_DENIED');
  return context;
 }
 if(group==='federal-market'){
  const input=contract.normalizeInput(proof.request,{}).input,selected=input.clientId??null,s=proof.subject;
  if(selected!==null){
   const id=typeof selected==='string'?selected.toLowerCase():'';
   if(!UUID.test(id))refuse('ACCESS_DENIED');
   // Forecast selectors must be admitted too, although Core intentionally discards them from the global query.
   visibleSelector(native,s,id);
  }
  return {};
 }
 if(group==='public-domain-query'){
  const supportsAsOf=publicDomainDatasetRegistry.resolveDatasetSnapshot(proof.request.dataset).metadata.supportsAsOf;
  if(!supportsAsOf||Object.hasOwn(proof.request,'asOfDate'))return {defaultAsOf:null};
  if(priorContext)return {defaultAsOf:priorContext.defaultAsOf};
  const at=now();if(!Number.isSafeInteger(at)||at<0)refuse('ACCESS_DENIED');
  return {defaultAsOf:new Date(at).toISOString()};
 }
 return {};
}
