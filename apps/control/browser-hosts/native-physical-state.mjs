/** Retained /2 state must pass semantic joins as well as canonical-byte integrity. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeHostAllocation,assertHostRunBindingPin} from '../../../packages/contracts/native-lifecycle.mjs';
import {assertNativeDeclaration,assertNativeObserverAllocationJoin} from './native-reservations.mjs';
import {NATIVE_DECLARATION_V2} from '../../../packages/contracts/native-observer.mjs';
import {readPhysicalSlots,initialPhysicalContexts,beginOrdinaryPhysical,emptyPhysicalJournal,assertPhysicalRequest,
 completePhysicalEvent,physicalRefused as fail,physicalBytes,MAX_EVENTS,COMPLETION_BYTES,FENCE_BYTES} from './native-physical-journal.mjs';
import {assertPhysicalFacts,sealPhysicalResources,derivePhysicalEvidence} from './native-physical-evidence.mjs';
import {retainedManagedProvenance} from './native-physical-history.mjs';
export const PHYSICAL_SCHEMAS=Object.freeze({resources:'meri-native-physical-resource-sets/2',dispatch:'meri-native-physical-dispatches/2',
 dispatch_result:'meri-native-physical-dispatch-results/2',result:'meri-native-physical-results/2'});
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export const samePhysical=(a,b)=>{if(hash(a)!==hash(b))fail();};
export const phaseEnvelope=(name)=>({schema:PHYSICAL_SCHEMAS[name],ordinary:null,managed:null});
export function physicalKey(raw){
 const k=own(data(raw),['hostId','generation','originalBindingSha256','declarationSha256']);
 if(!UUID.test(k.hostId)||!Number.isSafeInteger(k.generation)||k.generation<1||
  !['originalBindingSha256','declarationSha256'].every(n=>/^[0-9a-f]{64}$/u.test(k[n])))fail();return k;
}
export function readNativePhysicalRow(row,key){
 const a=assertNativeHostAllocation(row.allocation_json),b=assertHostRunBindingPin(a,row.original_binding_json),
  d=assertNativeDeclaration(row.declaration_json);
 if(d.schema!==NATIVE_DECLARATION_V2||row.host_id!==key.hostId||Number(row.generation)!==key.generation||
  a.hostId!==key.hostId||a.generation!==key.generation||hash(a)!==row.allocation_sha256||
  hash(b)!==key.originalBindingSha256||hash(d)!==key.declarationSha256||row.declaration_sha256!==key.declarationSha256||
  !['reserved','dispatching','unknown','active','revoked','quarantined','terminated','refused'].includes(row.state))fail();
 assertNativeObserverAllocationJoin(a,d);
 const slots=readPhysicalSlots(row),initial=initialPhysicalContexts({allocation:a,binding:b,declaration:d});
 const context=own(data(slots.context),['schema','ordinary','managed']);
 samePhysical(context.managed,initial.managed);if(context.schema!==initial.schema)fail();
 if(context.ordinary!==null){
  const o=context.ordinary;if(!Number.isSafeInteger(o.startedAtMs)||o.startedAtMs<1)fail();
  samePhysical(context,beginOrdinaryPhysical(initial,o.authority?.requestId,o.startedAtMs));
 }
 for(const [name,schema] of Object.entries(PHYSICAL_SCHEMAS))if(slots[name]!==null){
  const e=own(data(slots[name]),['schema','ordinary','managed']);if(e.schema!==schema)fail();
 }
 const journal=slots.observations??emptyPhysicalJournal(),j=own(data(journal),['schema','entries','closedForFullTeardown']);
 if(j.schema!=='meri-native-physical-journal/2'||!Array.isArray(j.entries)||j.entries.length>MAX_EVENTS)fail();
 if(j.closedForFullTeardown!==null){const f=own(j.closedForFullTeardown,['receiptSha256','closedAtMs']);
  if(!/^[0-9a-f]{64}$/u.test(f.receiptSha256)||!Number.isSafeInteger(f.closedAtMs)||f.closedAtMs<1)fail();}
 const seen=new Set(),authenticated=new Map();let replay=emptyPhysicalJournal();
 for(const raw of j.entries){
  const e=own(raw,['sequence','operationId','phase','stage','sessionId','request','startedAtMs','callDeadlineMs','completion']);
  if(!UUID.test(e.operationId)||!UUID.test(e.sessionId)||seen.has(e.operationId)||e.sequence!==seen.size+1||
   !['ordinary','managed'].includes(e.phase))fail();seen.add(e.operationId);
  const c=context[e.phase];if(c===null||!Number.isSafeInteger(e.startedAtMs)||e.startedAtMs<1||
   !Number.isSafeInteger(e.callDeadlineMs)||e.startedAtMs>=e.callDeadlineMs||e.callDeadlineMs>c.deadlineMs||
   (e.phase==='ordinary'&&e.startedAtMs<c.startedAtMs))fail();
  assertPhysicalRequest(e.request,e);
  if(e.stage==='provenance'&&e.request.executionArn!==c.authority.executionArn)fail();
  if(e.stage==='discovery'&&e.request.provisionToken!==c.provisionToken)fail();
  if(e.stage!=='authentication'){
   const auth=authenticated.get(e.sessionId);
   if(!auth||auth.phase!==e.phase||auth.completedAtMs>e.startedAtMs)fail();
  }
  replay={...replay,entries:[...replay.entries,{...e,completion:null}]};
  if(e.completion!==null){
   replay=completePhysicalEvent(replay,e.operationId,e.completion,{now:Math.max(e.callDeadlineMs,e.completion.completedAtMs),
    validateFacts:(event,completion)=>assertPhysicalFacts(event,completion,row)});
   if(e.stage==='authentication'&&e.completion.outcome==='success'){
    if(authenticated.has(e.sessionId))fail();authenticated.set(e.sessionId,{...e.completion,phase:e.phase});
   }
  }
 }
 const pending=j.entries.filter(e=>e.completion===null);
 if(physicalBytes(journal)+pending.length*(COMPLETION_BYTES-4)+(j.closedForFullTeardown===null?FENCE_BYTES:0)>524288)fail();
 for(const phase of ['ordinary','managed']){
  const resources=slots.resources?.[phase];
  if(resources){const v=own(data(resources),['instanceId','rootVolumeId','networkInterfaceIds','preObservationEventIds','completedAtMs','discovery']);
   samePhysical(v,sealPhysicalResources({journal,row,phase,eventIds:v.preObservationEventIds,discoveryScanId:v.discovery?.scanId??null}));}
 }
 const claim=slots.dispatch?.ordinary;
 if(claim){
  own(data(claim),['contextSha256','resourcesSha256','dispatchId','ownerProcessId','requestSha256','instanceId','claimedAtMs']);
  const resources=slots.resources?.ordinary,c=context.ordinary;
  if(!resources||!c||claim.contextSha256!==hash(c)||claim.resourcesSha256!==hash(resources)||
   !UUID.test(claim.dispatchId)||!UUID.test(claim.ownerProcessId)||claim.instanceId!==resources.instanceId||
   claim.requestSha256!==hash({InstanceIds:[resources.instanceId]})||claim.claimedAtMs<resources.completedAtMs||claim.claimedAtMs>=c.deadlineMs)fail();
  const events=j.entries.filter(e=>e.stage==='termination');
  if(events.length!==1||events[0].request.dispatchId!==claim.dispatchId||events[0].request.instanceId!==claim.instanceId||
   events[0].startedAtMs!==claim.claimedAtMs)fail();
 }else if(j.entries.some(e=>e.stage==='termination'))fail();
 if(slots.dispatch_result?.ordinary){const r=own(data(slots.dispatch_result.ordinary),['dispatchId','eventId']);
  const e=j.entries.find(e=>e.operationId===r.eventId);if(!claim||r.dispatchId!==claim.dispatchId||
   e?.stage!=='termination'||e.request.dispatchId!==r.dispatchId||e.completion===null)fail();}
 const managed=slots.dispatch?.managed??null,managedResult=slots.dispatch_result?.managed??null;
 if((managed===null)!==(managedResult===null))fail();
 const provenance=managed===null?null:retainedManagedProvenance({journal,row,dispatch:managed,dispatchResult:managedResult});
 for(const phase of ['ordinary','managed'])if(slots.result?.[phase]){
  const r=own(data(slots.result[phase]),['contextSha256','resourcesSha256','evidenceEventIds','status','reason','finalizedAtMs']);
  const c=context[phase],resources=slots.resources?.[phase]??null;
  if(!c||r.contextSha256!==hash(c)||r.resourcesSha256!==(resources===null?null:hash(resources))||
   !Number.isSafeInteger(r.finalizedAtMs)||!Array.isArray(r.evidenceEventIds)||new Set(r.evidenceEventIds).size!==r.evidenceEventIds.length||
   r.evidenceEventIds.some(id=>!seen.has(id))||j.entries.some(e=>e.phase===phase&&e.completion===null))fail();
  if(r.status==='verified-absent'){
   const dispatchAtMs=phase==='ordinary'?claim?.claimedAtMs:provenance?.scheduled.find(e=>e.instanceId===resources?.instanceId)?.atMs;
   if(!Number.isSafeInteger(dispatchAtMs)||!resources||r.reason!==null)fail();
   derivePhysicalEvidence({journal,row,resources,context:c,dispatchAtMs,
    terminalId:r.evidenceEventIds[0],absenceIds:r.evidenceEventIds.slice(1)});
  }else if(r.status!=='unknown-final'||!UNKNOWN_REASONS.includes(r.reason))fail();
 }
 return {...slots,observations:journal};
}
export const UNKNOWN_REASONS=Object.freeze(['deadline','discovery-incomplete','no-owned-instance','multiple-owned-instances',
 'custody-conflict','preobservation-missing','metadata-missing','operation-unknown','budget-exhausted','superseded-by-full-teardown']);
