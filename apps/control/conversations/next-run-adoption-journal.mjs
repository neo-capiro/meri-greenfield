/** Historical effective pins and a closed, append-only adoption claim over the canonical conversation transaction.
 * A descriptor is not execution authority. Migration 0020 is centrally allocated source only; no runtime mount or
 * live SQL is implied. Its SECURITY DEFINER trigger is the atomic cross-schema first-writer/absence fence. */
import {bounded,fail,hash,own,same,validateShape} from './boundary.mjs';
import {assertNextRunReservation} from './next-run-reservation.mjs';
import {assertConfigurationAdoptionReceipt,resolveEffectiveAdmissionFromRows} from './effective-admission.mjs';
import {assertAuthorityIdentityReceipt,assertAuthorityContextReceipt} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {FORECLOSED,foreclosed} from './native-preparation-journal.mjs';

const refuse=code=>fail('NEXT_RUN_ADOPTION_'+code);
const rowsOf=result=>{if(!Array.isArray(result?.rows))refuse('CORRUPT');return result.rows;};
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const instant=value=>Number.isSafeInteger(value)&&value>=0;
const MAX_DECISION_MS=5000,MAX_CROSS_HOST_SKEW_MS=5000;

export function createNextRunAdoptionJournal({tx,now,authority,retention,revocation}){
 if(typeof tx!=='function')refuse('CONFIGURATION');
 const clock=()=>{const value=now?.();if(!instant(value))refuse('CLOCK');return value;};
 /** The caller must already hold the canonical tenant/conversation lock. This is shared by current, accept and execution
  * so they resolve exactly the same lineage inside their own transaction, without opening a nested snapshot. */
 async function readEffectiveFromClient(raw){
  const {client,binding,check}=own(raw,['client','binding','check']);validateShape('RunBinding',binding);
  if(typeof check!=='function')refuse('CONFIGURATION');
  if(typeof client?.query!=='function')refuse('CONFIGURATION');
   const key=[binding.tenantId,binding.conversationId];
   const originals=rowsOf(await client.query('SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2',key));check();
   if(originals.length!==1)refuse('CORRUPT');
   const originalRow=originals[0],original={record:originalRow.record,recordSha256:originalRow.record_sha256};
   const root=resolveEffectiveAdmissionFromRows({binding:original.record?.binding,original,reservations:[],adoptions:[]});
   if(originalRow.tenant_id!==binding.tenantId||originalRow.conversation_id!==binding.conversationId||originalRow.run_id!==root.binding.runId||root.binding.actorId!==binding.actorId)refuse('CORRUPT');

   const nextRows=rowsOf(await client.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2',key));check();
   const path=[];let preceding=root.binding;
   while(!same(preceding,binding)){
    const candidates=nextRows.filter(row=>row.source_run_id===preceding.runId);
    if(!candidates.length)refuse('NOT_FOUND');if(candidates.length!==1||path.length>=nextRows.length)refuse('CORRUPT');
    const rawRow=candidates[0],reservation=assertNextRunReservation(rawRow.reservation);
    if(rawRow.tenant_id!==binding.tenantId||rawRow.conversation_id!==binding.conversationId||rawRow.source_run_id!==reservation.source.runId||rawRow.target_run_id!==reservation.target.runId||rawRow.reservation_sha256!==hash(reservation)||!same(reservation.source,preceding))refuse('CORRUPT');
    const row={reservation,reservationSha256:rawRow.reservation_sha256,state:rawRow.state};path.push(row);preceding=reservation.target;
    if(row.state==='RESERVED'&&!same(preceding,binding))refuse('CORRUPT');
   }

   // Always read the proposed table, including for the original. A missing table is an unavailable authority, not zero adoptions.
   const adoptionRows=rowsOf(await client.query('SELECT * FROM meri_conversations.next_run_adoptions WHERE tenant_id=$1 AND conversation_id=$2',key));check();
   const pathTargets=new Set(path.map(row=>row.reservation.target.runId));
   const adoptions=adoptionRows.filter(row=>pathTargets.has(row.target_run_id)).map(row=>{
    const receipt=assertConfigurationAdoptionReceipt(row.receipt);
    if(row.tenant_id!==binding.tenantId||row.conversation_id!==binding.conversationId||row.target_run_id!==receipt.target.runId||row.receipt_sha256!==hash(receipt))refuse('CORRUPT');
    return {receipt,receiptSha256:row.receipt_sha256};
   });
   const descriptor=resolveEffectiveAdmissionFromRows({binding,original,reservations:path,adoptions});check();
   // Every accepted link has a saved target run with the exact effective pins. A RESERVED target has none. Only this lineage
   // is checked, so later damaged descendants cannot erase the historical original needed for stop-only cleanup.
   const runIds=[root.binding.runId,...path.map(row=>row.reservation.target.runId)];
   const runs=rowsOf(await client.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=ANY($3::uuid[])',[...key,runIds]));check();
   const byRun=new Map();for(const row of runs){if(!runIds.includes(row.run_id)||byRun.has(row.run_id)||row.tenant_id!==binding.tenantId||row.conversation_id!==binding.conversationId)refuse('CORRUPT');byRun.set(row.run_id,row);}
   const projection=(row,expectedBinding,expectedVersions,expectedTransitionSha256)=>{
    if(!row||row.projection_sha256!==hash(row.projection))refuse('CORRUPT');
    try{validateShape('Run',row.projection);}catch{refuse('CORRUPT');}
    if(!same(row.projection.binding,expectedBinding)||!same(row.projection.scopes,root.scopes)||row.projection.policyRevision!==root.policyRevision||!same(row.projection.versions,expectedVersions)||row.transition_sha256!==expectedTransitionSha256)refuse('CORRUPT');
   };
   const originalRun=byRun.get(root.binding.runId);if(originalRun)projection(originalRun,root.binding,root.versions,null);else if(path.length)refuse('CORRUPT');
   let effectiveVersions=root.versions,transitionSha256=null;for(const row of path){
    const adopted=adoptions.find(a=>same(a.receipt.target,row.reservation.target));if(adopted){effectiveVersions=adopted.receipt.toVersions;transitionSha256=adopted.receiptSha256;}
    const saved=byRun.get(row.reservation.target.runId);
    if(row.state==='ACCEPTED'){
     projection(saved,row.reservation.target,effectiveVersions,transitionSha256);
     const createdAtMs=Date.parse(saved.projection.createdAt),reservedAtMs=Date.parse(row.reservation.reservedAt);
     if(!Number.isSafeInteger(createdAtMs)||!Number.isSafeInteger(reservedAtMs)||createdAtMs<reservedAtMs||adopted&&adopted.receipt.adoptedAtMs>=createdAtMs)refuse('CORRUPT');
    }
    else if(saved||row.state!=='RESERVED')refuse('CORRUPT');
   }
   const matching=adoptions.find(a=>same(a.receipt.target,binding))??null;
   const effectiveAdoption=descriptor.transitionSha256===null?null:adoptions.find(a=>a.receiptSha256===descriptor.transitionSha256)??null;
   if(descriptor.transitionSha256!==null&&!effectiveAdoption)refuse('CORRUPT');
   return {descriptor,adoption:matching,effectiveAdoption,state:path.at(-1)?.state??null,reservation:path.at(-1)??null};
 }
 /** The transaction callback must hold the same tenant/conversation advisory lock as the canonical conversation store. */
 async function readEffective(raw,check){
  const {binding}=own(bounded(raw),['binding']);validateShape('RunBinding',binding);
  if(typeof check!=='function')refuse('CONFIGURATION');
  return tx(binding,check,async client=>(await readEffectiveFromClient({client,binding,check})).descriptor);
 }
 const current=()=>{
  if(typeof now!=='function'||typeof authority?.readCurrent!=='function'||typeof retention?.assertServable!=='function'||typeof revocation?.readRevoked!=='function')refuse('CONFIGURATION');
 };
 const until=(start,deadline)=>{const at=clock();if(at<start||at>=deadline)refuse('EXPIRED');return at;};
 /** Existing Core identity/context receipts are the observation evidence. No caller-supplied digest or expiry is accepted. */
 async function observeAuthority({target,selectedClientId,scopes,policyRevision,deadlineMs,signal},check){
  const started=clock();until(started,deadlineMs);
  const raw=own(bounded(await authority.readCurrent({target,selectedClientId,scopes,policyRevision,deadlineMs,signal})),['identity','context']);check();
  const ended=until(started,deadlineMs),identity=assertAuthorityIdentityReceipt(raw.identity),context=assertAuthorityContextReceipt(raw.context);
  const principal={tenantId:target.tenantId,actorId:target.actorId};
  const coreCheckedAtMs=Math.max(identity.checkedAtMs,context.checkedAtMs),expiresAtMs=Math.min(identity.expiresAtMs,context.expiresAtMs)-MAX_CROSS_HOST_SKEW_MS;
  if(!same(identity.principal,principal)||!same(context.principal,principal)||context.identitySha256!==hash(identity)||context.identityRevision!==identity.identityRevision||context.conversationId!==target.conversationId||context.selectedClientId!==selectedClientId||identity.checkedAtMs<started-MAX_CROSS_HOST_SKEW_MS||context.checkedAtMs<started-MAX_CROSS_HOST_SKEW_MS||coreCheckedAtMs>ended+MAX_CROSS_HOST_SKEW_MS||expiresAtMs<=ended)refuse('AUTHORITY');
  const stable={principal,identityRevision:identity.identityRevision,contextRevision:context.contextRevision,selectedClientId};
  // Receipt times use the local trusted clock; the raw signed facts remain in the decision digest.
  return {checkedAtMs:ended,expiresAtMs,stable,decisionSha256:hash({target,selectedClientId,scopes,policyRevision,identity,context})};
 }
 async function servable(target,check){
  // The canonical retention read gate checks the current ledger, recovery watermark and suppression state.
  await retention.assertServable({tenantId:target.tenantId,kind:'conversation',subjectId:target.conversationId});check();
 }
 async function revoked(source,record,facts,signal,check){
  if(!facts.revocation)return;
  // This must be a read of the original historical capsule, never admission.revoke() or current-config retargeting.
  const actual=own(bounded(await revocation.readRevoked({binding:source,record,receiptSha256:facts.revocation.receiptSha256,grantIds:facts.revocation.grantIds,signal})),['receiptSha256','grantIds']);check();
  if(actual.receiptSha256!==facts.revocation.receiptSha256||!same([...actual.grantIds].sort(),[...facts.revocation.grantIds].sort()))refuse('REVOCATION');
 }
 /** Source-only claim. `tx` must acquire the canonical advisory lock; migration 0020 then checks target absence and
  * first-write fences under that same lock, including claims in the product budget schema hidden from the app role. */
 async function claim(raw,check){
  const input=own(raw,['target','toConfigurationSha256','toVersions'],['signal']);
  const {target,toConfigurationSha256,toVersions,signal}=input;validateShape('RunBinding',target);validateShape('RuntimeVersions',toVersions);nativeSignal(signal);
  if(!digest(toConfigurationSha256)||typeof check!=='function')refuse('CONFIGURATION');current();
  return tx(target,check,async client=>{
   if(typeof client?.query!=='function')refuse('CONFIGURATION');const key=[target.tenantId,target.conversationId,target.runId];
   const rows=rowsOf(await client.query('SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3 FOR UPDATE',key));check();
   if(rows.length!==1)refuse('NOT_RESERVED');const locked=rows[0],reservation=assertNextRunReservation(locked.reservation);
   if(locked.tenant_id!==target.tenantId||locked.conversation_id!==target.conversationId||locked.target_run_id!==target.runId||locked.source_run_id!==reservation.source.runId||locked.reservation_sha256!==hash(reservation)||!same(reservation.target,target)||locked.state!=='RESERVED'||reservation.facts.checkpoint!==null)refuse('NOT_RESERVED');
   const saved=await readEffectiveFromClient({client,binding:target,check}),effective=saved.descriptor;
   if(saved.state!=='RESERVED'||saved.reservation?.reservationSha256!==locked.reservation_sha256||effective.reservationSha256!==locked.reservation_sha256)refuse('LINEAGE');
   if(effective.transitionSha256!==null&&!saved.adoption)refuse('HOLD');
   if(!saved.adoption&&effective.configurationSha256===toConfigurationSha256)refuse('LINEAGE');
   const source=reservation.source,sourceSaved=await readEffectiveFromClient({client,binding:source,check}),sourceEffective=sourceSaved.descriptor;
   if(sourceEffective.transitionSha256!==null||sourceSaved.state==='RESERVED'||sourceEffective.selectedClientId!==effective.selectedClientId||!same(sourceEffective.scopes,effective.scopes)||sourceEffective.policyRevision!==effective.policyRevision)refuse('HOLD');
   const runRows=rowsOf(await client.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',key.slice(0,2)));check();
   const fences=new Set();let latest=null;for(const row of runRows){if(row.tenant_id!==target.tenantId||row.conversation_id!==target.conversationId||row.projection_sha256!==hash(row.projection))refuse('CORRUPT');try{validateShape('Run',row.projection);}catch{refuse('CORRUPT');}const b=row.projection.binding;if(fences.has(b.writerFence))refuse('CORRUPT');fences.add(b.writerFence);if(!latest||b.writerFence>latest.projection.binding.writerFence)latest=row;}
   if(!latest||latest.run_id!==source.runId||!same(latest.projection.binding,source)||!['failed','cancelled'].includes(latest.projection.state)||!same(latest.projection.scopes,sourceEffective.scopes)||latest.projection.policyRevision!==sourceEffective.policyRevision||!same(latest.projection.versions,sourceEffective.versions))refuse('SOURCE');
   const allocationRows=rowsOf(await client.query('SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[...key.slice(0,2),source.runId]));check();
   if(allocationRows.length!==1)refuse('SOURCE');const allocation=allocationRows[0],record=allocation.record;
   if(allocation.tenant_id!==target.tenantId||allocation.conversation_id!==target.conversationId||allocation.run_id!==source.runId||allocation.record_sha256!==hash(record))refuse('SOURCE');
   if(reservation.facts.noAuthority){if(record.state!==FORECLOSED||!foreclosed(record,source)||record.foreclosure.state!==latest.projection.state||allocation.record_sha256!==reservation.facts.noAuthority.foreclosureSha256)refuse('SOURCE');}
   else if(record.state!=='RETIRED'||record.resource?.physicalStopProven!==true||!same(record.original?.binding,source)||!same(record.grantIntents?.map(g=>g.grantId).sort(),[...reservation.facts.revocation.grantIds].sort()))refuse('SOURCE');
   const deadlineMs=clock()+MAX_DECISION_MS;
   await servable(target,check);await revoked(source,record,reservation.facts,signal,check);
   const observed=await observeAuthority({target,selectedClientId:effective.selectedClientId,scopes:effective.scopes,policyRevision:effective.policyRevision,deadlineMs,signal},check);
   const adoptedAtMs=clock(),validUntilMs=Math.min(observed.expiresAtMs,deadlineMs);
   if(observed.checkedAtMs<Date.parse(reservation.reservedAt)||observed.checkedAtMs>adoptedAtMs||validUntilMs<=adoptedAtMs)refuse('AUTHORITY');
   if(saved.adoption){const existing=saved.adoption.receipt;
    if(saved.adoption.receiptSha256!==effective.transitionSha256||existing.toConfigurationSha256!==toConfigurationSha256||!same(existing.toVersions,toVersions)||clock()>=existing.validUntilMs)refuse('HOLD');
    return {descriptor:effective,receipt:existing,receiptSha256:saved.adoption.receiptSha256,replayed:true};
   }
   const receipt=assertConfigurationAdoptionReceipt({schemaVersion:1,source,target,originalAdmissionSha256:sourceEffective.originalAdmissionSha256,reservationSha256:locked.reservation_sha256,selectedClientId:sourceEffective.selectedClientId,scopes:sourceEffective.scopes,policyRevision:sourceEffective.policyRevision,fromConfigurationSha256:sourceEffective.configurationSha256,fromVersions:sourceEffective.versions,toConfigurationSha256,toVersions,authorityDecisionSha256:observed.decisionSha256,authorityCheckedAtMs:observed.checkedAtMs,authorityExpiresAtMs:observed.expiresAtMs,adoptedAtMs,validUntilMs});
   const receiptSha256=hash(receipt);
   const inserted=rowsOf(await client.query('INSERT INTO meri_conversations.next_run_adoptions(tenant_id,conversation_id,target_run_id,receipt,receipt_sha256) VALUES($1,$2,$3,$4,$5) RETURNING *',[...key,receipt,receiptSha256]));check();
   if(inserted.length!==1||inserted[0].receipt_sha256!==receiptSha256||!same(inserted[0].receipt,receipt))refuse('CORRUPT');
   const result=await readEffectiveFromClient({client,binding:target,check});
   if(result.adoption?.receiptSha256!==receiptSha256||result.descriptor.transitionSha256!==receiptSha256||result.descriptor.configurationSha256!==toConfigurationSha256||!same(result.descriptor.versions,toVersions))refuse('CORRUPT');
   // An awaited SQL trigger can outlast external facts; any failure throws and rolls the INSERT back with this transaction.
   await servable(target,check);await revoked(source,record,reservation.facts,signal,check);
   const after=await observeAuthority({target,selectedClientId:effective.selectedClientId,scopes:effective.scopes,policyRevision:effective.policyRevision,deadlineMs:validUntilMs,signal},check);
   if(!same(after.stable,observed.stable)||clock()>=validUntilMs)refuse('AUTHORITY');
   return {descriptor:result.descriptor,receipt,receiptSha256,replayed:false};
  });
 }
 return Object.freeze({readEffective,readEffectiveFromClient,claim});
}
