/** Private Control writer on the existing allocation row. No SDK, secrets, new table or DB role. */
import {randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {transact,assertPool} from '../product-persistence/transaction.mjs';
import {productFailure} from '../product-access/errors.mjs';
import {physicalKey,readNativePhysicalRow,phaseEnvelope,UUID,samePhysical,UNKNOWN_REASONS} from './native-physical-state.mjs';
import {PHYSICAL_COLUMNS,physicalTriplet,physicalRefused as fail,beginOrdinaryPhysical,reservePhysicalEvent,
 completePhysicalEvent,physicalBytes,FENCE_BYTES} from './native-physical-journal.mjs';
import {assertPhysicalFacts,sealPhysicalResources,physicalDiscoveryChain,derivePhysicalEvidence,projectOrdinaryPhysicalEvidence} from './native-physical-evidence.mjs';
import {allocationRow} from './allocation.mjs';
import {verifiedTeardownReceipt} from './teardown-receipt.mjs';
import {deriveNativeManagedProvenance,retainedManagedProvenance} from './native-physical-history.mjs';
export const PHYSICAL_LOCK='SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2 FOR UPDATE';
export const PHYSICAL_CLOCK='SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms';
/** Update only triplets actually changed, preserving every existing owner field. Row lock belongs to caller. */
export async function persistPhysicalSlots(client,row,before,after){
 const candidate={...row};
 for(const name of Object.keys(PHYSICAL_COLUMNS)){
  const [json,sha,canonical]=physicalTriplet(name,after[name]);
  Object.assign(candidate,{[`native_physical_${name}_json`]:json,[`native_physical_${name}_sha256`]:sha,
   [`native_physical_${name}_canonical`]:canonical});
 }
 readNativePhysicalRow(candidate,{hostId:row.host_id,generation:Number(row.generation),
  originalBindingSha256:hash(row.original_binding_json),declarationSha256:row.declaration_sha256});
 const values=[row.host_id,Number(row.generation)],sets=[];
 for(const name of Object.keys(PHYSICAL_COLUMNS))if(hash(before[name])!==hash(after[name])){
  const triplet=physicalTriplet(name,after[name]);
  for(const [index,suffix] of ['json','sha256','canonical'].entries()){
   values.push(triplet[index]);sets.push(`native_physical_${name}_${suffix}=$${values.length}`);
  }
 }
 if(!sets.length)return;
 const result=await client.query(`UPDATE meri_host_control.host_allocations SET ${sets.join(',')}
  WHERE host_id=$1 AND generation=$2 AND state NOT IN ('terminated','refused')`,values);
 if(result.rowCount!==1)fail();
}
const terminal=row=>['terminated','refused'].includes(row.state);
const active=(row,state,phase)=>{
 if(terminal(row)||row.state==='reserved'||!['ordinary','managed'].includes(phase)||!state.context[phase]||
  state.result?.[phase]||state.observations.closedForFullTeardown!==null)fail();
};
function captureTarget(row,state,request,phase,time){
 const events=state.observations.entries.filter(e=>e.phase===phase&&e.completion?.outcome==='success');
 if(request.api==='DescribeInstances'){
  if(request.instanceId===row.observed_instance_json?.instanceId)return;
  for(const scanId of new Set(events.filter(e=>e.stage==='discovery').map(e=>e.request.scanId))){
   try{physicalDiscoveryChain({journal:state.observations,row,phase,scanId,instanceId:request.instanceId,beforeMs:time});return;}catch{}
  }
  fail();
 }
 const instance=events.find(e=>e.stage==='capture'&&e.request.api==='DescribeInstances'&&
  (request.volumeId===e.completion.facts.root.volumeId||e.completion.facts.networkInterfaces.some(n=>n.id===request.networkInterfaceId)));
 if(!instance)fail();
}
/** requestDeadlineMs is a trusted server-lifetime accessor, not an HTTP body value. */
export function createNativePhysicalOwner({pool,now=Date.now,requestDeadlineMs=()=>null,ownerProcessId=randomUUID()}={}){
 assertPool(pool);if(!UUID.test(ownerProcessId)||typeof requestDeadlineMs!=='function')fail();
 const attempts=new Map(),transactionClock=new AsyncLocalStorage(),clock=()=>transactionClock.getStore()??now();
 async function locked(raw,required,operation,{write=true}={}){
  const args=own(raw,['key',...required],['signal']);nativeSignal(args.signal);const key=physicalKey(args.key);
  const check=()=>args.signal?.throwIfAborted();
  return transact(pool,async client=>{
   const rows=(await client.query(PHYSICAL_LOCK,[key.hostId,key.generation])).rows;check();
   if(!Array.isArray(rows)||rows.length!==1)fail();const row=rows[0],state=readNativePhysicalRow(row,key);
   if(write&&terminal(row))fail();
   const time=Number((await client.query(PHYSICAL_CLOCK)).rows?.[0]?.now_ms);
   if(!Number.isSafeInteger(time)||time<1)fail();
   const before=structuredClone(state),result=await transactionClock.run(time,()=>operation({args,key,row,state,client}));check();
   if(write)await persistPhysicalSlots(client,row,before,state);return result;
  },{check,unavailable:'NATIVE_PHYSICAL_REFUSED',uncertain:'NATIVE_PHYSICAL_COMMIT_UNKNOWN'});
 }
 function callDeadline(context,stage,time){
  const request=requestDeadlineMs();if(!Number.isSafeInteger(request)||request<=time)fail();
  let end=Math.min(request,context.deadlineMs);
  if(context.phase==='managed'&&['authentication','discovery','capture'].includes(stage))
   end=Math.min(end,time+3000,time<context.leaseDeadlineMs?context.leaseDeadlineMs:context.cleanupCeilingMs-1000);
  if(time>=end)fail();return end;
 }
 function reserve(row,state,args,dispatch=null){
  active(row,state,args.phase);if(args.stage==='capture')captureTarget(row,state,args.request,args.phase,clock());
  const time=clock(),context=state.context[args.phase];
  if(args.stage==='authentication'&&state.observations.entries.some(e=>e.sessionId===args.sessionId))fail();
  const r=reservePhysicalEvent(state.observations,args,{context,now:time,callDeadlineMs:callDeadline(context,args.stage,time),
   resources:state.resources?.[args.phase]??null,dispatch,
   phaseDeadlines:{ordinary:state.context.ordinary?.deadlineMs??0,managed:state.context.managed.deadlineMs}});
  state.observations=r.journal;return r;
 }
 const api={
  readNativePhysicalState:raw=>locked(raw,[],({row,state})=>({state:row.state,...state}),{write:false}),
  beginNativeOrdinaryPhysical:raw=>locked(raw,['requestId'],({row,state,args})=>{
   if(row.state==='reserved')fail();
   // This is the original ordinary lifecycle write, never the post-deadline read-only recovery path.
   // Expired managed intake must not strand capacity or be renewed by starting independent O.
   if(!state.result?.managed&&clock()>=state.context.managed.deadlineMs){
    for(const event of state.observations.entries.filter(e=>e.phase==='managed'&&e.completion===null))
     state.observations=completePhysicalEvent(state.observations,event.operationId,{completedAtMs:clock(),outcome:'abandoned',
      requestId:null,httpStatusCode:null,errorCode:null,facts:null},{now:clock()});
    state.result??=phaseEnvelope('result');state.result.managed={contextSha256:hash(state.context.managed),
     resourcesSha256:state.resources?.managed?hash(state.resources.managed):null,evidenceEventIds:[],status:'unknown-final',reason:'deadline',finalizedAtMs:clock()};
   }
   state.context=beginOrdinaryPhysical(state.context,args.requestId,clock());return state.context.ordinary;
  }),
  reserveNativePhysicalOperation:raw=>locked(raw,['phase','stage','sessionId','operationId','request'],({row,state,args})=>{
   if(args.stage==='termination')fail();
   const {key,signal,...event}=args,r=reserve(row,state,event);return {created:r.created,event:r.event};
  }),
  completeNativePhysicalOperation:raw=>locked(raw,['operationId','completion'],({row,state,args})=>{
   state.observations=completePhysicalEvent(state.observations,args.operationId,args.completion,{now:clock(),
    validateFacts:(event,c)=>assertPhysicalFacts(event,c,row)});
   return state.observations.entries.find(e=>e.operationId===args.operationId);
  }),
  sealNativePhysicalResources:raw=>locked(raw,['phase','preObservationEventIds','discoveryScanId'],async({row,state,args,client})=>{
   active(row,state,args.phase);
   const resources=sealPhysicalResources({journal:state.observations,row,phase:args.phase,eventIds:args.preObservationEventIds,discoveryScanId:args.discoveryScanId});
   state.resources??=phaseEnvelope('resources');const old=state.resources[args.phase];
   if(old!==null){samePhysical(old,resources);return old;}
   if(row.observed_instance_json===null){
    const event=state.observations.entries.find(e=>resources.preObservationEventIds.includes(e.operationId)&&e.request.api==='DescribeInstances');
    const observed={instanceId:resources.instanceId,privateIp:event.completion.facts.privateIp};
    const r=await client.query(`UPDATE meri_host_control.host_allocations SET observed_instance_json=$3
     WHERE host_id=$1 AND generation=$2 AND state IN ('dispatching','unknown') AND observed_instance_json IS NULL`,
    [row.host_id,Number(row.generation),observed]);if(r.rowCount!==1)fail();row.observed_instance_json=observed;
   }
   state.resources[args.phase]=resources;return resources;
  }),
  async claimNativeOrdinaryPhysicalDispatch(raw){
   const args=own(raw,['key','dispatchId','ownerProcessId','sessionId'],['signal']),key=physicalKey(args.key);
   if(args.ownerProcessId!==ownerProcessId||!UUID.test(args.dispatchId)||!UUID.test(args.sessionId))fail();
   const localKey=`${key.hostId}:${key.generation}`;
   // A same-process duplicate shares the original promise. A fresh owner can read the persisted claim,
   // but never constructs a send capability from its identifiers.
   const old=attempts.get(localKey);if(old)return old;
   const pending=(async()=>{
    let candidate=null;
    const claim=()=>locked(raw,['dispatchId','ownerProcessId','sessionId'],({row,state})=>{
     active(row,state,'ordinary');if(state.dispatch?.ordinary)return {created:false,claim:state.dispatch.ordinary};
     const resources=state.resources?.ordinary,context=state.context.ordinary;if(!resources)fail();
     const c={contextSha256:hash(context),resourcesSha256:hash(resources),dispatchId:args.dispatchId,ownerProcessId,
      requestSha256:hash({InstanceIds:[resources.instanceId]}),instanceId:resources.instanceId,claimedAtMs:clock()};
     const event={phase:'ordinary',stage:'termination',sessionId:args.sessionId,operationId:args.dispatchId,
      request:{api:'TerminateInstances',instanceId:resources.instanceId,dispatchId:args.dispatchId}};
     const r=reserve(row,state,event,c);c.claimedAtMs=r.event.startedAtMs;
     state.dispatch??=phaseEnvelope('dispatch');state.dispatch.ordinary=c;candidate={claim:c,event:r.event};
     return {created:true,...candidate};
    });
    let saved;
    try{saved=await claim();}catch(error){
     if(productFailure(error)?.code!=='NATIVE_PHYSICAL_COMMIT_UNKNOWN'||candidate===null)throw error;
     const retained=await api.readNativePhysicalState({key,signal:args.signal});
     samePhysical(retained.dispatch?.ordinary,candidate.claim);
     samePhysical(retained.observations.entries.find(e=>e.operationId===args.dispatchId),candidate.event);
     saved={created:true,...candidate};
    }
    if(!saved.created)return {...saved,sendOnce:null};
    let consumed=false;
    return {...saved,sendOnce:async send=>{
     args.signal?.throwIfAborted();if(consumed||typeof send!=='function'||now()>=saved.event.callDeadlineMs)fail();
     consumed=true;return send(saved.event);
    }};
   })();attempts.set(localKey,pending);return pending;
  },
  recordNativeOrdinaryPhysicalDispatchResult:raw=>locked(raw,['dispatchId','eventId'],({state,args})=>{
   const c=state.dispatch?.ordinary,e=state.observations.entries.find(e=>e.operationId===args.eventId);
   if(!c||c.dispatchId!==args.dispatchId||e?.stage!=='termination'||e.request.dispatchId!==c.dispatchId||e.completion===null)fail();
   const result={dispatchId:args.dispatchId,eventId:args.eventId};state.dispatch_result??=phaseEnvelope('dispatch_result');
   if(state.dispatch_result.ordinary!==null)samePhysical(state.dispatch_result.ordinary,result);
   state.dispatch_result.ordinary=result;return result;
  }),
  recordNativeManagedPhysicalProvenance:raw=>locked(raw,['provenance'],({row,state,args})=>{
   const p=own(args.provenance,['executionArn','stateMachineVersionArn','inputSha256','definitionSha256','events']);
   const w=row.declaration_json.watchdog;
   if(p.executionArn!==w.executionArn||p.stateMachineVersionArn!==w.stateMachineVersionArn||
    p.inputSha256!==w.inputSha256||p.definitionSha256!==w.definitionSha256)fail();
   let found=null;
   for(const sessionId of new Set(state.observations.entries.filter(e=>e.stage==='provenance').map(e=>e.sessionId))){
    let candidate;try{candidate=deriveNativeManagedProvenance({journal:state.observations,row,sessionId});}catch{continue;}
    if(hash(candidate.events)===hash(p.events)){found=candidate;break;}
   }
   if(found===null||state.result?.managed)fail();
   const dispatch={executionArn:found.executionArn,inputSha256:found.inputSha256,attempts:found.attempts},
    result={executionArn:found.executionArn,historyEventIds:found.historyEventIds};
   state.dispatch??=phaseEnvelope('dispatch');state.dispatch_result??=phaseEnvelope('dispatch_result');
   if(state.dispatch.managed!==null){
    const old=state.dispatch.managed;if(old.executionArn!==dispatch.executionArn||old.inputSha256!==dispatch.inputSha256)fail();
    for(const attempt of old.attempts)samePhysical(attempt,dispatch.attempts.find(a=>a.instanceId===attempt.instanceId)??null);
   }
   if(state.dispatch_result.managed!==null){const old=state.dispatch_result.managed;
    if(old.executionArn!==result.executionArn)fail();samePhysical(old.historyEventIds,result.historyEventIds.slice(0,old.historyEventIds.length));}
   state.dispatch.managed=dispatch;state.dispatch_result.managed=result;return dispatch;
  }),
  finalizeNativePhysicalPhase:raw=>locked(raw,['phase','status','reason','evidenceEventIds'],({row,state,args})=>{
   if(!['ordinary','managed'].includes(args.phase)||!state.context[args.phase])fail();
   const {phase,status,reason,evidenceEventIds}=args,time=clock(),context=state.context[phase],resources=state.resources?.[phase]??null;
   state.result??=phaseEnvelope('result');const prior=state.result[phase];
   if(prior!==null){samePhysical({status:prior.status,reason:prior.reason,evidenceEventIds:prior.evidenceEventIds},{status,reason,evidenceEventIds});return prior;}
   for(const event of state.observations.entries.filter(e=>e.phase===phase&&e.completion===null)){
    if(time<event.callDeadlineMs)fail();
    state.observations=completePhysicalEvent(state.observations,event.operationId,{completedAtMs:time,outcome:'abandoned',
     requestId:null,httpStatusCode:null,errorCode:null,facts:null},{now:time});
   }
   if(!Array.isArray(evidenceEventIds)||new Set(evidenceEventIds).size!==evidenceEventIds.length||
    evidenceEventIds.some(id=>!state.observations.entries.some(e=>e.operationId===id)))fail();
   if(status==='verified-absent'){
    const provenance=phase==='managed'?retainedManagedProvenance({journal:state.observations,row,
     dispatch:state.dispatch?.managed??null,dispatchResult:state.dispatch_result?.managed??null}):null;
    const dispatchAtMs=phase==='ordinary'?state.dispatch?.ordinary?.claimedAtMs:provenance.scheduled.find(e=>e.instanceId===resources?.instanceId)?.atMs;
    if(!Number.isSafeInteger(dispatchAtMs)||!resources||reason!==null)fail();
    derivePhysicalEvidence({journal:state.observations,row,resources,context,dispatchAtMs,
     terminalId:evidenceEventIds[0],absenceIds:evidenceEventIds.slice(1)});
   }else if(status!=='unknown-final'||!UNKNOWN_REASONS.includes(reason)||reason==='superseded-by-full-teardown'||
    (time<context.deadlineMs&&!['custody-conflict','budget-exhausted','multiple-owned-instances'].includes(reason)))fail();
   const result={contextSha256:hash(context),resourcesSha256:resources===null?null:hash(resources),
    evidenceEventIds,status,reason,finalizedAtMs:time};state.result[phase]=result;return result;
  }),
  prepareNativeFullTeardown:raw=>locked(raw,['receipt'],({row,state,args})=>{
   const verified=verifiedTeardownReceipt(args.receipt,allocationRow(row).record,clock());
   assertOrdinaryReceiptEvidence(row,state,verified);
   const receiptSha256=hash(verified),previous=state.observations.closedForFullTeardown;
   if(previous!==null){if(previous.receiptSha256!==receiptSha256)fail();return previous;}
   const next={...state.observations,closedForFullTeardown:{receiptSha256,closedAtMs:clock()}};
   if(physicalBytes(next)-physicalBytes(state.observations)>FENCE_BYTES)fail();
   state.observations=next;return next.closedForFullTeardown;
  }),
 };
 return Object.freeze(api);
}

function assertOrdinaryReceiptEvidence(row,state,receipt){
 samePhysical(receipt.physicalEvidence,projectOrdinaryPhysicalEvidence({row,state,nowMs:state.result?.ordinary?.finalizedAtMs}));
}
/** Called by the existing recordTeardown transaction after the genuine full receipt is validated. */
export async function finishPhysicalFullTeardown(client,row,receipt,now){
 const key={hostId:row.host_id,generation:Number(row.generation),originalBindingSha256:hash(row.original_binding_json),declarationSha256:row.declaration_sha256};
 const state=readNativePhysicalRow(row,key);assertOrdinaryReceiptEvidence(row,state,receipt);
 if(state.observations.closedForFullTeardown?.receiptSha256!==hash(receipt)||state.observations.entries.some(e=>e.completion===null))fail();
 const before=structuredClone(state);state.result??=phaseEnvelope('result');
 for(const phase of ['ordinary','managed'])if(state.context[phase]&&state.result[phase]===null){
  const resources=state.resources?.[phase]??null;state.result[phase]={contextSha256:hash(state.context[phase]),
   resourcesSha256:resources===null?null:hash(resources),evidenceEventIds:[],status:'unknown-final',
   reason:'superseded-by-full-teardown',finalizedAtMs:now};
 }
 await persistPhysicalSlots(client,row,before,state);
}
