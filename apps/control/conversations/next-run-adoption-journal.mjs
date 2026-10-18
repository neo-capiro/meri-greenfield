/** Read-only effective admission over the existing conversation transaction. The proposed 0020 adoption table has no allocated
 * migration or production mount yet. A missing table refuses; this owner never claims a transition or creates authority. */
import {bounded,fail,hash,own,same,validateShape} from './boundary.mjs';
import {assertNextRunReservation} from './next-run-reservation.mjs';
import {assertConfigurationAdoptionReceipt,resolveEffectiveAdmissionFromRows} from './effective-admission.mjs';

const refuse=code=>fail('NEXT_RUN_ADOPTION_'+code);
const rowsOf=result=>{if(!Array.isArray(result?.rows))refuse('CORRUPT');return result.rows;};

export function createNextRunAdoptionJournal({tx}){
 if(typeof tx!=='function')refuse('CONFIGURATION');
 /** The transaction callback must hold the same tenant/conversation advisory lock as the canonical conversation store. */
 async function readEffective(raw,check){
  const {binding}=own(bounded(raw),['binding']);validateShape('RunBinding',binding);
  if(typeof check!=='function')refuse('CONFIGURATION');
  return tx(binding,check,async client=>{
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
   const projection=(row,expectedBinding,expectedVersions)=>{
    if(!row||row.projection_sha256!==hash(row.projection))refuse('CORRUPT');
    try{validateShape('Run',row.projection);}catch{refuse('CORRUPT');}
    if(!same(row.projection.binding,expectedBinding)||!same(row.projection.scopes,root.scopes)||row.projection.policyRevision!==root.policyRevision||!same(row.projection.versions,expectedVersions))refuse('CORRUPT');
   };
   const originalRun=byRun.get(root.binding.runId);if(originalRun)projection(originalRun,root.binding,root.versions);else if(path.length)refuse('CORRUPT');
   let effectiveVersions=root.versions;for(const row of path){
    const adopted=adoptions.find(a=>same(a.receipt.target,row.reservation.target));if(adopted)effectiveVersions=adopted.receipt.toVersions;
    const saved=byRun.get(row.reservation.target.runId);
    if(row.state==='ACCEPTED'){
     projection(saved,row.reservation.target,effectiveVersions);
     const createdAtMs=Date.parse(saved.projection.createdAt),reservedAtMs=Date.parse(row.reservation.reservedAt);
     if(!Number.isSafeInteger(createdAtMs)||!Number.isSafeInteger(reservedAtMs)||createdAtMs<reservedAtMs||adopted&&adopted.receipt.adoptedAtMs>=createdAtMs)refuse('CORRUPT');
    }
    else if(saved||row.state!=='RESERVED')refuse('CORRUPT');
   }
   return descriptor;
  });
 }
 return Object.freeze({readEffective});
}
