/** Finite CONTROL contexts over current native facts. Selectors never create a client grant. */
import {publicDomainDatasetRegistry} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const refuse=code=>{throw nativeReadFault(code);};
const lineageGroups=new Set(['facility-representation','district-nexus']);
const subjectSelection=({authorizationDecisionId,...rest})=>rest;

/** Decision receipts may rotate; no other lineage or context field may drift. */
export function sourceReadContextSelection(group,context){
 return lineageGroups.has(group)?{binding:context.binding,subject:subjectSelection(context.subject)}:context;
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
 assertNativeVisibleClients(native,s.entityIds);return s.entityIds[0];
}

export function createSourceReadContext({contract,proof,native,defaultCongress,now,priorContext}){
 const group=contract.binding.group;
 if(['bill-text','federal-legislation'].includes(group))return {defaultCongress};
 if(group==='acquisition-personnel')return {actorRole:native.actorRole};
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
   if((s.kind==='client'||s.entityType==='client')&&(s.kind!=='client'||s.entityType!=='client'||s.entityIds.length!==1||s.entityIds[0].toLowerCase()!==id))refuse('ACCESS_DENIED');
   // Forecast selectors must be admitted too, although Core intentionally discards them from the global query.
   assertNativeVisibleClients(native,[id]);
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
