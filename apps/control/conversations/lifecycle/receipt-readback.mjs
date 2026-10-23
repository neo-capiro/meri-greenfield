/** Internal read-only lifecycle receipt projection. The product facade must supply a freshly verified principal, scopes and client,
 * recheck current membership/conversation access and retention before release. This port accepts no session credential or dispatch
 * authority. Historical source/target rows and original effect expiry remain evidence, never authority to start work again. */
import {bounded,own,uuid,validateShape,hash,same,fail} from '../boundary.mjs';

export function createLifecycleReceiptReader({tx,verifyRun,lookup,pins,readExecution}){
 const refused=()=>fail('LIFECYCLE_RECEIPT_REFUSED');
 async function conversation(c,b,scopes,policyRevision,check){
  const row=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows[0];check();
  if(!row||row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.owner_actor_id!==b.actorId||hash(row.projection)!==row.projection_sha256)refused();
  const saved=row.projection;validateShape('Conversation',saved);
  if(saved.conversationId!==b.conversationId||!same(saved.owner,{tenantId:b.tenantId,actorId:b.actorId})||!same(saved.scopes,scopes)||saved.policyRevision!==policyRevision)refused();
 }
 return async function readReceipt(value,check){
  const v=own(bounded(value),['principal','binding','scopes','selectedClientId','controlId']),b=v.binding;
  own(v.principal,['tenantId','actorId']);validateShape('RunBinding',b);uuid(v.controlId);uuid(v.selectedClientId);
  if(v.principal.tenantId!==b.tenantId||v.principal.actorId!==b.actorId||!Array.isArray(v.scopes)||!v.scopes.length||v.scopes.length>100)refused();
  for(const scope of v.scopes){validateShape('Scope',scope);if(scope.tenantId!==v.principal.tenantId)refused();}
  if(new Set(v.scopes.map(hash)).size!==v.scopes.length||new Set(v.scopes.map(s=>s.policyRevision)).size!==1||!v.scopes.some(s=>s.kind==='client'&&s.resourceId===v.selectedClientId))refused();
  async function source(c){
   const run=await verifyRun(c,b,v.scopes),p=await lookup(c,b,v.controlId);check();if(!p)refused();
   pins(p,run,b,v.scopes,v.selectedClientId);
   await conversation(c,b,v.scopes,run.projection.policyRevision,check);return {run,p};
  }
  // Discovery releases its lock before taking a fork's two conversation locks in canonical order. It releases no receipt or content.
  const discovered=await tx(b,check,async c=>(await source(c)).p.target?.binding??null);
  const targets=discovered===null?[b]:[b,discovered],ordered=targets.sort((a,z)=>`${a.tenantId}:${a.conversationId}`<`${z.tenantId}:${z.conversationId}`?-1:`${a.tenantId}:${a.conversationId}`>`${z.tenantId}:${z.conversationId}`?1:0);
  return tx(ordered[0],check,async c=>{
   if(ordered.length===2&&ordered[0].conversationId!==ordered[1].conversationId){await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${ordered[1].tenantId}:${ordered[1].conversationId}`]);check();}
   const {run,p}=await source(c),target=p.target?.binding??null;
   if(!same(target,discovered))refused();
   if(target===null&&p.retirement!==null||target!==null&&p.state==='PENDING')refused();
   if(target!==null){
    own(p.target,['binding','scopes','selectedClientId','admissionReceiptId','targetSessionId','expiresAtMs'],['versions']);if(p.target.versions!==undefined)validateShape('RuntimeVersions',p.target.versions);
    if(!['resume','fork'].includes(p.input.intent)||!p.proof||p.input.checkpointId!==p.checkpointId||p.input.checkpointSha256!==p.proof.checkpointSha256||!same(p.target.scopes,v.scopes)||p.target.selectedClientId!==v.selectedClientId||!Number.isSafeInteger(p.target.expiresAtMs)||p.target.expiresAtMs<1)refused();
    const saved=await verifyRun(c,target,v.scopes),execution=await readExecution(c,target,v.scopes,v.selectedClientId,check);check();
    if(saved.projection.policyRevision!==run.projection.policyRevision||execution?.continuation.controlId!==v.controlId)refused();
    await conversation(c,target,v.scopes,saved.projection.policyRevision,check);
    if(p.input.intent==='resume'){
     const end=Number(run.sequence_base)+Number(run.last_sequence);
     if(target.conversationId!==b.conversationId||target.writerFence!==b.writerFence+1||!p.retirement||!same(p.retirement.binding,b)||!Number.isSafeInteger(p.retirement.expiresAtMs)||p.retirement.expiresAtMs<1||!['paused','waiting-for-approval'].includes(run.projection.state)||run.sequence_end==null||!Number.isSafeInteger(end)||Number(run.sequence_end)!==end||Number(saved.sequence_base)!==end)refused();
    }else if(target.conversationId===b.conversationId||target.writerFence!==1||Number(saved.sequence_base)!==0||p.retirement!==null)refused();
   }
   check();return {controlId:p.input.controlId,intent:p.input.intent,state:p.state,sourceBinding:p.sourceBinding,targetBinding:target,checkpointId:p.checkpointId,
    admissionReceiptId:p.target?.admissionReceiptId??null,retirementReceiptId:p.retirement?.retirementReceiptId??null};
  });
 };
}
