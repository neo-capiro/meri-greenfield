/** Pure, closed effective-pin decoder for one original-to-target lineage. The adoption receipt is evidence only: its
 * persistence owner must prove source settlement, unused-target absence, current authority and ordering before writing it. */
import {bounded,fail,hash,own,same,uuid,validateShape} from './boundary.mjs';
import {assertNextRunReservation} from './next-run-reservation.mjs';

const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const instant=value=>Number.isSafeInteger(value)&&value>=0;
const refuse=code=>fail('EFFECTIVE_ADMISSION_'+code);
const guarded=body=>{try{return body();}catch(error){if(typeof error?.code==='string'&&error.code.startsWith('EFFECTIVE_ADMISSION_'))throw error;refuse('CORRUPT');}};
const descriptorKeys=['schemaVersion','binding','selectedClientId','scopes','policyRevision','configurationSha256','versions','originalAdmissionSha256','reservationSha256','transitionSha256'];
const adoptionKeys=['schemaVersion','source','target','originalAdmissionSha256','reservationSha256','selectedClientId','scopes','policyRevision','fromConfigurationSha256','fromVersions','toConfigurationSha256','toVersions','authorityDecisionSha256','authorityCheckedAtMs','authorityExpiresAtMs','adoptedAtMs','validUntilMs'];

/** The hash commits to every effective pin. A state change from RESERVED to ACCEPTED does not change this descriptor. */
export function assertEffectiveAdmissionDescriptor(raw){return guarded(()=>{
 const value=own(bounded(raw),[...descriptorKeys,'descriptorSha256']);
 validateShape('RunBinding',value.binding);validateShape('RuntimeVersions',value.versions);uuid(value.selectedClientId);
 if(value.schemaVersion!==1||typeof value.policyRevision!=='string'||!value.policyRevision||value.policyRevision.length>256||!digest(value.configurationSha256)||!digest(value.originalAdmissionSha256)||value.reservationSha256!==null&&!digest(value.reservationSha256)||value.transitionSha256!==null&&!digest(value.transitionSha256)||value.binding.writerFence===1&&value.reservationSha256!==null||value.binding.writerFence>1&&value.reservationSha256===null||value.transitionSha256!==null&&value.reservationSha256===null)refuse('CORRUPT');
 const scopes=[{kind:'client',tenantId:value.binding.tenantId,resourceId:value.selectedClientId,policyRevision:value.policyRevision}];
 if(!same(value.scopes,scopes))refuse('CORRUPT');
 const pins=Object.fromEntries(descriptorKeys.map(key=>[key,value[key]]));
 if(!digest(value.descriptorSha256)||value.descriptorSha256!==hash(pins))refuse('CORRUPT');
 return Object.freeze(value);
});}

/** Signed/committed authority lineage is represented by a digest, never by a copied bearer or inferred grant.
 * `validUntilMs` bounds the adoption decision, not the inherited configuration's lifetime after acceptance. */
export function assertConfigurationAdoptionReceipt(raw){return guarded(()=>{
 const value=own(bounded(raw),adoptionKeys);
 validateShape('RunBinding',value.source);validateShape('RunBinding',value.target);
 validateShape('RuntimeVersions',value.fromVersions);validateShape('RuntimeVersions',value.toVersions);uuid(value.selectedClientId);
 if(value.schemaVersion!==1||value.source.tenantId!==value.target.tenantId||value.source.actorId!==value.target.actorId||value.source.conversationId!==value.target.conversationId||value.target.writerFence!==value.source.writerFence+1||value.source.runId===value.target.runId||value.source.attemptId===value.target.attemptId||value.source.workerId===value.target.workerId||typeof value.policyRevision!=='string'||!value.policyRevision||value.policyRevision.length>256||![value.originalAdmissionSha256,value.reservationSha256,value.fromConfigurationSha256,value.toConfigurationSha256,value.authorityDecisionSha256].every(digest)||value.fromConfigurationSha256===value.toConfigurationSha256||!instant(value.authorityCheckedAtMs)||!instant(value.authorityExpiresAtMs)||!instant(value.adoptedAtMs)||!instant(value.validUntilMs)||value.authorityCheckedAtMs>value.adoptedAtMs||value.adoptedAtMs>=value.validUntilMs||value.validUntilMs>value.authorityExpiresAtMs)refuse('CORRUPT');
 const scopes=[{kind:'client',tenantId:value.target.tenantId,resourceId:value.selectedClientId,policyRevision:value.policyRevision}];
 if(!same(value.scopes,scopes))refuse('CORRUPT');
 return Object.freeze(value);
});}

function originalRow(raw){const row=own(raw,['record','recordSha256']),record=own(row.record,['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs']);
 validateShape('RunBinding',record.binding);validateShape('RuntimeVersions',record.versions);uuid(record.selectedClientId);
 if(!digest(row.recordSha256)||hash(record)!==row.recordSha256||record.schemaVersion!==1||record.state!=='ADMITTED'||record.binding.writerFence!==1||typeof record.policyRevision!=='string'||!record.policyRevision||record.policyRevision.length>256||!digest(record.configurationSha256)||!instant(record.createdAtMs)||!instant(record.expiresAtMs)||record.createdAtMs>=record.expiresAtMs)refuse('CORRUPT');
 return {record,recordSha256:row.recordSha256};}
function reservationRow(raw){const row=own(raw,['reservation','reservationSha256','state']),reservation=assertNextRunReservation(row.reservation);
 if(!digest(row.reservationSha256)||hash(reservation)!==row.reservationSha256||!['RESERVED','ACCEPTED'].includes(row.state))refuse('CORRUPT');return {reservation,reservationSha256:row.reservationSha256,state:row.state};}
function adoptionRow(raw){const row=own(raw,['receipt','receiptSha256']),receipt=assertConfigurationAdoptionReceipt(row.receipt);
 if(!digest(row.receiptSha256)||hash(receipt)!==row.receiptSha256)refuse('CORRUPT');return {receipt,receiptSha256:row.receiptSha256};}
function descriptor(pins){return assertEffectiveAdmissionDescriptor({...pins,descriptorSha256:hash(pins)});}

/** `reservations` is the complete ordered path from the original to `binding`, not an arbitrary conversation scan. A
 * descendant inherits the ancestor's transition SHA while its own immutable reservation SHA changes. */
export function resolveEffectiveAdmissionFromRows(raw){return guarded(()=>{
 const input=own(bounded(raw,2097152),['binding','original','reservations','adoptions']);validateShape('RunBinding',input.binding);
 if(!Array.isArray(input.reservations)||!Array.isArray(input.adoptions))refuse('CORRUPT');
 const original=originalRow(input.original),root=original.record;
 let current=descriptor({schemaVersion:1,binding:root.binding,selectedClientId:root.selectedClientId,scopes:[{kind:'client',tenantId:root.binding.tenantId,resourceId:root.selectedClientId,policyRevision:root.policyRevision}],policyRevision:root.policyRevision,configurationSha256:root.configurationSha256,versions:root.versions,originalAdmissionSha256:original.recordSha256,reservationSha256:null,transitionSha256:null});
 const adoptionRows=input.adoptions.map(adoptionRow),unique=new Map(adoptionRows.map(row=>[row.receiptSha256,row]));
 if(unique.size>1)refuse('HOLD');
 const adoption=unique.values().next().value??null;
 for(const [index,rawRow] of input.reservations.entries()){
  const row=reservationRow(rawRow),r=row.reservation;
  if(!same(r.source,current.binding)||r.policyRevision!==current.policyRevision||!same(r.scopes,current.scopes)||!same(r.versions,current.versions)||index<input.reservations.length-1&&row.state!=='ACCEPTED')refuse('CORRUPT');
  let configurationSha256=current.configurationSha256,versions=current.versions,transitionSha256=current.transitionSha256;
  if(adoption&&same(adoption.receipt.target,r.target)){
   const a=adoption.receipt;
   if(current.transitionSha256!==null)refuse('HOLD');
   if(r.facts.checkpoint!==null||!same(a.source,r.source)||a.reservationSha256!==row.reservationSha256||a.originalAdmissionSha256!==original.recordSha256||a.selectedClientId!==current.selectedClientId||!same(a.scopes,current.scopes)||a.policyRevision!==current.policyRevision||a.fromConfigurationSha256!==current.configurationSha256||!same(a.fromVersions,current.versions)||a.authorityCheckedAtMs<root.createdAtMs||a.adoptedAtMs<Date.parse(r.reservedAt))refuse('CORRUPT');
   configurationSha256=a.toConfigurationSha256;versions=a.toVersions;transitionSha256=adoption.receiptSha256;
  }
  current=descriptor({schemaVersion:1,binding:r.target,selectedClientId:current.selectedClientId,scopes:current.scopes,policyRevision:current.policyRevision,configurationSha256,versions,originalAdmissionSha256:original.recordSha256,reservationSha256:row.reservationSha256,transitionSha256});
 }
 if(!same(current.binding,input.binding)||adoption&&!input.reservations.some(row=>same(row.reservation.target,adoption.receipt.target)))refuse('CORRUPT');
 return current;
});}
