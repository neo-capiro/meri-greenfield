/** Finite CONTROL contexts over current native facts. Selectors never create a client grant. */
import {watchValidators,publicDomainDatasetRegistry} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {MODE_READ_OPERATIONS} from '../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {captureHearingClientReference,captureHearingClientSelection} from '../../gateway/sources/public-domain-hearings/request-context.mjs';
import {assertLegalRawRequest,captureResearchClientReference,legalSliceContext} from '../../gateway/sources/research-legal-legislation/request-context.mjs';
import {assertNewsRawRequest,newsSliceContext} from '../../gateway/sources/research-legal-news/request-context.mjs';
import {assertResearchCandidatesRequest,researchCandidatesContext} from '../../gateway/sources/research-legal-candidates/request-context.mjs';
import {captureOutreachListClientReference,captureOutreachListClientSelection} from '../../gateway/sources/outreach-query/request-context.mjs';
import {assertStoredStateRequest} from '../../gateway/sources/state-status-votes/request-context.mjs';
import {captureBusinessDevelopmentResource} from '../../gateway/sources/business-development/request-context.mjs';
import {captureFundingClientSelection,assertFundingClientSubject} from '../../gateway/sources/funding-opportunities/request-context.mjs';
import {captureClientKnowledgeSearchSelection,assertClientKnowledgeSearchSubject} from '../../gateway/sources/client-knowledge-search/request-context.mjs';
import {attachmentSelection} from '../../gateway/sources/client-knowledge-attachments/request-context.mjs';

import {savedRecordClientSelector} from '../../../packages/contracts/retrieval-0.2/saved-records-validation.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const refuse=code=>{throw nativeReadFault(code);};
const lineageGroups=new Set(['facility-representation','district-nexus','tracked-bills']);

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

/** A name is selection data only. The current selected client and native roster establish its upper bound first. */
export function assertSourceReadReferenceSubject(contract,proof,native){
 // Hearings already permit a General run’s explicit UUID under the actual current native client wall.
 // Resolving a name follows that same admission; it never turns the roster into a run scope.
 if(contract.binding.group==='public-domain-hearings'&&proof.subject.kind!=='client'&&proof.subject.entityType!=='client'){
  assertNativeVisibleClients(native,[]);return null;
 }
 return clientSubject(proof,native);
}

export function sourceReadClientReference(contract,request){
 let reference=null;
 if(contract.binding.group==='tracked-bills'){
  if(typeof request.clientId!=='string')refuse('INVALID_ARGUMENTS');
  reference=request.clientId.trim().slice(0,80);
  if(!reference.trim())refuse('INVALID_ARGUMENTS');
 }else if(contract.binding.group==='public-domain-hearings')reference=captureHearingClientReference(request);
 else if(['research-legal-legislation','research-legal-news','research-legal-candidates'].includes(contract.binding.group))reference=captureResearchClientReference(request);
 else if(contract.binding.group==='outreach-query')reference=captureOutreachListClientReference(request);
 return reference!==null&&!UUID.test(reference.trim().toLowerCase())?reference:null;
}

function visibleSelector(native,subject,id){
 if((subject.kind==='client'||subject.entityType==='client')&&(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0].toLowerCase()!==id||!subject.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===id)))refuse('ACCESS_DENIED');
 assertNativeVisibleClients(native,[id]);
}

function privateDataContext(proof,native){
 const request=proof.request,selected=proof.subject.kind==='client'||proof.subject.entityType==='client'?clientSubject(proof,native):null;
 if(selected===null&&(proof.subject.kind!=='personal'||proof.subject.entityType!=='user'))refuse('ACCESS_DENIED');
 if(Object.hasOwn(request,'clientId')&&(typeof request.clientId!=='string'||!UUID.test(request.clientId)))refuse('INVALID_ARGUMENTS');
 const clientId=request.clientId??selected;
 if(selected!==null&&clientId!==selected)refuse('ACCESS_DENIED');
 assertNativeVisibleClients(native,clientId===null?[]:[clientId]);
 // Saved jobs have no interactive native revisions. Never manufacture one from a role or UUID.
 if(![native.identityRevision,native.membershipRevision].every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value)))refuse('UNAVAILABLE');
 return {capiroDataScope:{clientId,identityRevision:native.identityRevision,membershipRevision:native.membershipRevision}};
}

function savedOwnerContext(proof,native,group){
 const selected=proof.subject.kind==='client'||proof.subject.entityType==='client'?clientSubject(proof,native):null;
 if(selected===null&&(proof.subject.kind!=='personal'||proof.subject.entityType!=='user'))refuse('ACCESS_DENIED');
 const selector=['strategy-saved-records','legiwatch-review','legiwatch-relevance','legislative-comparisons'].includes(group)?proof.request.clientId:savedRecordClientSelector(proof.request);
 const clientId=typeof selector==='string'?selector.toLowerCase():null;
 if(selector!==null&&(clientId===null||!UUID.test(clientId)))refuse('INVALID_ARGUMENTS');
 if(selected!==null&&clientId!==selected)refuse('ACCESS_DENIED');
 assertNativeVisibleClients(native,clientId===null?[]:[clientId]);
 if(![native.identityRevision,native.membershipRevision].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)))refuse('UNAVAILABLE');
 const revisions={identityRevision:native.identityRevision,membershipRevision:native.membershipRevision};
 return ['legiwatch-review','legiwatch-relevance','legislative-comparisons'].includes(group)?{legiwatchReviewScope:{clientId,...revisions}}:group==='strategy-saved-records'?{strategySavedScope:{clientId,...revisions}}:
  {savedRecordScope:{clientId:selected,tenantId:proof.subject.tenantId,...revisions}};
}

/** Reject unsupported source fallback before observing or disclosing any native credential. */
export function assertSourceReadRequest(contract,request,subject){
 if(contract.binding.group==='state-status-votes')assertStoredStateRequest(contract.descriptor.operation,request);
 if(contract.binding.group==='tracked-bills'||contract.binding.group==='public-domain-hearings')sourceReadClientReference(contract,request);
 if(contract.binding.group==='research-legal-legislation'){
  assertLegalRawRequest(contract.descriptor.operation,request);
 }
 if(contract.binding.group==='research-legal-news')assertNewsRawRequest(contract.descriptor.operation,request);
 if(contract.binding.group==='research-legal-candidates')assertResearchCandidatesRequest(contract.descriptor.operation,request);
 if(contract.binding.group==='outreach-query')captureOutreachListClientReference(request);
 if(contract.binding.group==='business-development')captureBusinessDevelopmentResource(contract.descriptor.operation,request,subject);
 if(['funding-opportunities','funding-analysis'].includes(contract.binding.group))assertFundingClientSubject(subject,captureFundingClientSelection(contract.descriptor.operation,request));
 if(contract.binding.group==='client-knowledge-search'&&contract.descriptor.operation.id==='search_client_knowledge')assertClientKnowledgeSearchSubject(subject,captureClientKnowledgeSearchSelection(contract.descriptor.operation,request));
}

export function createSourceReadContext({contract,proof,native,defaultCongress,now,priorContext,clientReferenceObservation,modeObservation,attachmentObservation}){
 const group=contract.binding.group;
 if(group==='client-knowledge-attachments'){
  const selection=attachmentSelection(proof.request,proof.subject,proof.binding),observation=attachmentObservation;
  assertNativeVisibleClients(native,selection.selectedClientId===null?[]:[selection.selectedClientId]);
  if(!observation||observation.scope.tenantId!==native.principal.tenantId||observation.scope.userId!==native.principal.actorId||observation.scope.conversationId!==selection.sourceConversationId||observation.scope.clientId!==selection.selectedClientId)refuse('ACCESS_DENIED');
  return {asOf:priorContext?.asOf??observation.asOf,scope:observation.scope};
 }
 if(group==='watch-state'){
  const target=watchValidators.target(proof.request),selectedClientId=proof.subject.kind==='client'||proof.subject.entityType==='client'?clientSubject(proof,native):null;
  if(selectedClientId===null&&(proof.subject.kind!=='personal'||proof.subject.entityType!=='user'||proof.subject.entityIds.length!==1||proof.subject.entityIds[0]!==proof.binding.actorId))refuse('ACCESS_DENIED');
  if(selectedClientId!==null&&target.clientId!==selectedClientId)refuse('ACCESS_DENIED');
  assertNativeVisibleClients(native,target.clientId===null?[]:[target.clientId]);
  if(![native.identityRevision,native.membershipRevision].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)))refuse('UNAVAILABLE');
  return {watchStateScope:{selectedClientId,identityRevision:native.identityRevision,membershipRevision:native.membershipRevision}};
 }
 if(group==='research-portfolio-sharing'||group==='research-portfolio-workflow'){
  if(proof.request.conversationId!==proof.binding.conversationId||!Array.isArray(native.clientIds))refuse('ACCESS_DENIED');
  const selectedClientId=proof.subject.kind==='client'?clientSubject(proof,native):null;
  if(selectedClientId===null&&(proof.subject.kind!=='personal'||proof.subject.entityType!=='user'||proof.subject.entityIds[0]!==proof.binding.actorId))refuse('ACCESS_DENIED');
  return {binding:proof.binding,selectedClientId,visibleClientIds:[...native.clientIds]};
 }
 if(['saved-records','strategy-saved-records','legiwatch-review','legiwatch-relevance','legislative-comparisons'].includes(group))return savedOwnerContext(proof,native,group);
 if(group==='florida-budget'){
  const asOf=priorContext?.asOf??new Date(now()).toISOString();
  const request=contract.normalizeInput(proof.request,{asOf}).input;
  return {asOf,...savedOwnerContext({...proof,request},native,'legislative-comparisons')};
 }
 // Recompute on final release: membership changes must also fence aggregate rows with no client IDs.
 if(['capiro-data','capiro-data-v3'].includes(group)&&proof.request.source==='client_records')return privateDataContext(proof,native);
 if(group==='connected-apps'||group==='teams-channels'){
  const selected=contract.normalizeInput(proof.request,{}).input.clientId??null;
  if(proof.subject.kind==='client'||proof.subject.entityType==='client'){
   if(selected!==clientSubject(proof,native))refuse('ACCESS_DENIED');
  }else if(selected!==null)refuse('ACCESS_DENIED');
  return {};
 }
 if(group==='certification-status')return priorContext??{comparisonLocale:Intl.getCanonicalLocales(new Intl.Collator().resolvedOptions().locale)[0]};
 if(group==='rule-status'||group==='sam-opportunities'){
  if(priorContext)return priorContext;
  const at=now();if(!Number.isSafeInteger(at)||at<0||at>8640000000000000)refuse('ACCESS_DENIED');
  const instant=new Date(at).toISOString();
  if(group==='rule-status')return {stageAsOf:instant,commentAsOf:instant};
  if(!modeObservation||!['off','shadow','enforce'].includes(modeObservation.evidenceAccuracyMode))refuse('UNAVAILABLE');
  return {asOf:instant,sourceStatusAsOf:instant,sourceHealthAsOf:instant,evidenceAccuracyMode:modeObservation.evidenceAccuracyMode};
 }
 if(MODE_READ_OPERATIONS.includes(contract.descriptor.operation.id)){
  if(!modeObservation||!['off','shadow','enforce'].includes(modeObservation.evidenceAccuracyMode))refuse('UNAVAILABLE');
  const context={evidenceAccuracyMode:modeObservation.evidenceAccuracyMode};
  if(priorContext&&priorContext.evidenceAccuracyMode!==context.evidenceAccuracyMode)refuse('ACCESS_DENIED');
  return context;
 }
 if(group==='client-knowledge-search'&&contract.descriptor.operation.id==='search_client_knowledge'){
  const selected=captureClientKnowledgeSearchSelection(contract.descriptor.operation,proof.request);
  assertClientKnowledgeSearchSubject(proof.subject,selected);
  if(selected.clientId!==null)assertNativeVisibleClients(native,[selected.clientId]);
  if(priorContext)return {asOf:priorContext.asOf};
  const at=now();if(!Number.isSafeInteger(at)||at<0||at>8640000000000000)refuse('ACCESS_DENIED');
  return {asOf:new Date(at).toISOString()};
 }
 if(['funding-opportunities','funding-analysis'].includes(group)){
  const selected=captureFundingClientSelection(contract.descriptor.operation,proof.request);
  assertFundingClientSubject(proof.subject,selected);assertNativeVisibleClients(native,[selected.clientId]);
  if(priorContext)return {asOf:priorContext.asOf};
  const at=now();if(!Number.isSafeInteger(at)||at<0||at>8640000000000000)refuse('ACCESS_DENIED');
  return {asOf:new Date(at).toISOString()};
 }
 if(['bill-text','federal-legislation'].includes(group))return {defaultCongress};
 if(group==='acquisition-personnel')return {actorRole:native.actorRole};
 if(['research-legal-legislation','research-legal-news','research-legal-candidates'].includes(group)){
  const context=(group==='research-legal-legislation'?legalSliceContext:group==='research-legal-news'?newsSliceContext:researchCandidatesContext)(contract.descriptor.operation,proof.request,clientReferenceObservation);
  if(context.clientResolution===null){if(proof.subject.kind==='client'||proof.subject.entityType==='client')refuse('ACCESS_DENIED');}
  else if(context.clientResolution.clientId!==clientSubject(proof,native))refuse('ACCESS_DENIED');
  return context;
 }
 if(group==='outreach-query'){
  const clientResolution=captureOutreachListClientSelection(proof.request,clientReferenceObservation);
  if(clientResolution.clientId!==clientSubject(proof,native))refuse('ACCESS_DENIED');
  return {clientResolution};
 }
 if(group==='public-domain-hearings'){
  const clientResolution=captureHearingClientSelection(proof.request,clientReferenceObservation),s=proof.subject;
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
 if(group==='graph-paths'){
  const input=contract.normalizeInput(proof.request,{}).input,selected=input.clientId??null,s=proof.subject;
  if(selected===null){if(s.kind==='client'||s.entityType==='client')refuse('ACCESS_DENIED');}
  else visibleSelector(native,s,selected);
  return {};
 }
 if(group==='tracked-bills'){
  const clientReference=proof.request.clientId.trim().slice(0,80),s=proof.subject;
  const personal=s.kind==='personal'&&s.entityType==='user'&&s.entityIds.length===1&&s.entityIds[0]===proof.binding.actorId;
  const selected=personal?clientReference.toLowerCase():clientSubject(proof,native);
  if(personal)assertNativeVisibleClients(native,[selected]);
  if(UUID.test(clientReference.trim().toLowerCase())){if(clientReference.trim().toLowerCase()!==selected)refuse('ACCESS_DENIED');}
  else if(!clientReferenceObservation||clientReferenceObservation.reference!==clientReference||clientReferenceObservation.clientId!==selected)refuse('ACCESS_DENIED');
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
