/** Immutable selected-output journal and compiler-bound recovery; no grant or artifact writer. */
import {bounded,hash,same,fail,own,validateShape,uuid} from '../boundary.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v,assertSubject} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {assertSelectedOutput} from '../../../../packages/contracts/selected-skills/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {admitPreparedCommitmentsAudit} from '../../document-application/commitments-audit/compose.mjs';
import {admitPreparedRelationshipBrief} from '../../document-application/relationship-brief/compose.mjs';
const candidates=new WeakSet(),journals=new WeakSet(),digest=x=>{if(typeof x!=='string'||!/^[a-f0-9]{64}$/u.test(x))fail('SELECTED_OUTPUT_PINS_REFUSED');return x;};
const stableSubject=s=>{const {authorizationDecisionId,...rest}=s;return rest;};
const originalGuard=(skill,p,c)=>skill.skillId==='quick_skill.commitments_audit'?admitPreparedCommitmentsAudit(p,c):
 skill.skillId==='quick_skill.relationship_brief'?admitPreparedRelationshipBrief(p,c):fail('SELECTED_OUTPUT_SKILL_REFUSED');
function pins(record){const {pending:p,prepared}=record;return {sourceBinding:p.sourceBinding,requestSha256:p.requestSha256,selectionSha256:p.selectionSha256,
 inputSha256:p.inputSha256,preparationSha256:p.preparationSha256,artifactRequestSha256:p.artifactRequestSha256,sourceContextSha256:hash(prepared.context),
 compilerReadsSha256:prepared.provenance.readsSha256,readsSha256:hash(record.reads),sourceEvidenceSha256:hash(prepared.context.evidence),sourceScopes:prepared.context.scopes};}
function validateRecord(raw){
 const r=bounded(raw,2097152);own(r,['recipe','pending','request','prepared','reads']);
 if(r.recipe!=='original-selected-output-retention/1')fail('SELECTED_OUTPUT_PINS_REFUSED');
 const p=r.prepared,c=v.context(p.context),spec=v.request(p.request),selection=p.provenance.selection,selected=selectSkill(p.provenance.skill.skillId,p.provenance.skill.skillVersion);
 if(!['quick_skill.commitments_audit','quick_skill.relationship_brief'].includes(selected.pin.skillId)||!same(p.provenance.skill,selected.pin)||!same(r.request.skill,selected.pin)||
  !same(selection.window,r.request.window)||!same(selection.subject.scopes,c.scopes)||!same(selection.subject.tenantId,c.binding.tenantId)||!same(selection.subject.actorId,c.binding.actorId)||
  spec.operation!=='create_word'||spec.format!=='docx'||c.assets.length||c.analysisAdmission)fail('SELECTED_OUTPUT_PINS_REFUSED');
 assertSubject(selection.subject,c.binding);
 const pending={...r.pending,prepared:p};assertSelectedOutput(pending,{binding:c.binding,request:r.request,selection,inputSha256:p.provenance.inputSha256,prepared:p});
 if(r.pending.state!=='awaiting-output-approval'||Object.hasOwn(r.pending,'prepared')||!same(r.pending.sourceBinding,c.binding))fail('SELECTED_OUTPUT_PINS_REFUSED');
 const compiled=p.reads??p.receipts;if(!Array.isArray(compiled)||hash(compiled)!==p.provenance.readsSha256||!Array.isArray(r.reads)||r.reads.length>selected.manifest.budgets.maxToolCalls)fail('SELECTED_OUTPUT_READS_REFUSED');
 const deliveryIds=new Set();for(const read of r.reads){own(read,['deliveryId','operation','request','resultSha256','result']);
  if(typeof read.deliveryId!=='string'||! /^(?:sdk|compiler):[a-f0-9]{64}$/u.test(read.deliveryId)||hash(read.result)!==read.resultSha256||!selected.manifest.allowedOperations.some(op=>same(op,read.operation))||
   !same(read.result.binding,c.binding)||!read.result.subject||!same(stableSubject(read.result.subject),stableSubject(selection.subject))||deliveryIds.has(read.deliveryId))fail('SELECTED_OUTPUT_READS_REFUSED');
  assertSubject(read.result.subject,c.binding);deliveryIds.add(read.deliveryId);}
 for(const read of compiled)if(!r.reads.some(s=>same(s.operation,read.operation)&&same(s.request,read.request)&&s.resultSha256===read.resultSha256))fail('SELECTED_OUTPUT_READS_REFUSED');
 // Closed compiler/preparation/read shapes exclude provider envelopes. These keys
 // are never retained even if a trusted caller accidentally appends credentials.
 const forbidden=new Set(['bearerToken','serviceSecret','credential','opaqueSession','providerData','sdkSession']);const queue=[r];
 while(queue.length){const item=queue.pop();if(item&&typeof item==='object')for(const [key,value]of Object.entries(item)){if(forbidden.has(key))fail('SELECTED_OUTPUT_PRIVATE_DATA_REFUSED');queue.push(value);}}
 return r;
}
/** Constructed only by the canonical store with its private pool transaction/run decoder. */
export function createSelectedOutputJournal({tx,rowRun}){
 if(typeof tx!=='function'||typeof rowRun!=='function')fail('STORE_CONFIGURATION');
 async function run(c,b,check){const row=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows[0]);check();
  if(!same(row.projection.binding,b))fail('STALE_WRITER');
  const conversation=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows[0];check();
  if(!conversation||hash(conversation.projection)!==conversation.projection_sha256||conversation.owner_actor_id!==b.actorId||conversation.projection.owner.actorId!==b.actorId||
   conversation.projection.owner.tenantId!==b.tenantId||conversation.projection.conversationId!==b.conversationId||!same(conversation.projection.scopes,row.projection.scopes))fail('SELECTED_OUTPUT_OWNER_REFUSED');return row;}
 function decode(row,r,b,preparationSha256){if(!row||hash(row.projection)!==row.projection_sha256||row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId)fail('STORE_CORRUPT');
  const value=validateRecord(row.projection),p=pins(value);
  if(row.preparation_sha256!==p.preparationSha256||preparationSha256!==undefined&&p.preparationSha256!==preparationSha256||!same(p.sourceBinding,b)||
   p.requestSha256!==r.request_sha256||!same(value.request,r.request)||!same(p.sourceScopes,r.projection.scopes)||!same(value.request.skill,r.request.skill))fail('SELECTED_OUTPUT_PINS_REFUSED');return value;}
 async function retain(record,check){if(!candidates.has(record))fail('SELECTED_OUTPUT_PREPARATION_REFUSED');const value=validateRecord(record),p=pins(value),b=p.sourceBinding;
  return tx(b,check,async c=>{const r=await run(c,b,check);if(r.projection.state!=='running'||r.hold_control_id)fail('SELECTED_OUTPUT_SOURCE_STATE_REFUSED');
   if(p.requestSha256!==r.request_sha256||!same(value.request,r.request)||!same(p.sourceScopes,r.projection.scopes))fail('SELECTED_OUTPUT_PINS_REFUSED');
   const rows=(await c.query('SELECT * FROM meri_conversations.selected_outputs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows;check();
   if(rows.length){if(rows.length!==1||!same(decode(rows[0],r,b),value))fail('SELECTED_OUTPUT_REPLAY_REFUSED');return {preparationSha256:p.preparationSha256,projectionSha256:hash(value),replayed:true};}
   await c.query('INSERT INTO meri_conversations.selected_outputs(tenant_id,conversation_id,run_id,preparation_sha256,projection,projection_sha256) VALUES($1,$2,$3,$4,$5,$6)',[b.tenantId,b.conversationId,b.runId,p.preparationSha256,value,hash(value)]);check();
   return {preparationSha256:p.preparationSha256,projectionSha256:hash(value),replayed:false};});}
 async function load({sourceBinding:b,preparationSha256},check){validateShape('RunBinding',b);digest(preparationSha256);
  return tx(b,check,async c=>{const r=await run(c,b,check);if(r.projection.state!=='completed'||r.hold_control_id)fail('SELECTED_OUTPUT_SOURCE_STATE_REFUSED');
   const rows=(await c.query('SELECT * FROM meri_conversations.selected_outputs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows;check();
   if(rows.length!==1)fail('SELECTED_OUTPUT_UNAVAILABLE');return decode(rows[0],r,b,preparationSha256);});}
 const journal=Object.freeze({retain,load});journals.add(journal);return journal;
}
function accessRecord(raw,record,started,now,life,previous){
 const expected=pins(record),a=bounded(raw);own(a,[...Object.keys(expected),'outputBinding','outputContextSha256','outputScopes','policyRevision','outputAllocationSha256',
  'outputGrantId','approvalReceiptId','sourceAccessReceiptId','sessionReceiptId','checkedAtMs','expiresAtMs']);
 if(Object.keys(expected).some(key=>!same(a[key],expected[key])))fail('SELECTED_OUTPUT_ACCESS_REFUSED');validateShape('RunBinding',a.outputBinding);
 for(const key of ['outputContextSha256','outputAllocationSha256'])digest(a[key]);for(const key of ['outputGrantId','approvalReceiptId','sourceAccessReceiptId','sessionReceiptId'])uuid(a[key]);
 if(['tenantId','actorId','conversationId'].some(key=>a.outputBinding[key]!==expected.sourceBinding[key])||['runId','attemptId','workerId'].some(key=>a.outputBinding[key]===expected.sourceBinding[key])||
  !same(a.outputScopes,expected.sourceScopes)||a.outputScopes.some(scope=>scope.policyRevision!==a.policyRevision)||!Number.isSafeInteger(a.checkedAtMs)||a.checkedAtMs<started||a.checkedAtMs>now()||
  !Number.isSafeInteger(a.expiresAtMs)||a.expiresAtMs<=now())fail('SELECTED_OUTPUT_ACCESS_REFUSED');
 if(previous&&!same({...a,checkedAtMs:0,expiresAtMs:0},{...previous,checkedAtMs:0,expiresAtMs:0}))fail('SELECTED_OUTPUT_ACCESS_REFUSED');life.limitDeadline(a.expiresAtMs);return a;
}
/** Current access is an injected trusted owner, not a model boolean or old source grant. */
export function createSelectedOutputRetention(configuration){
 const {journal,currentOutputAccess,now,maxRequestMs=3000}=own(configuration,['journal','currentOutputAccess','now'],['maxRequestMs']);
 if(!journals.has(journal)||typeof currentOutputAccess!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('SELECTED_OUTPUT_CONFIGURATION');
 const loaded=new WeakMap();
 const lifetime=signal=>{nativeSignal(signal);let deadlineMs=now()+maxRequestMs;const owner=createOperationLifetime({deadlineMs,now,signal,errorFactory:code=>Object.assign(Error('SELECTED_OUTPUT_'+code),{code:'SELECTED_OUTPUT_'+code})});
  return {...owner,get deadlineMs(){return deadlineMs;},limitDeadline(next){owner.limitDeadline(next);deadlineMs=Math.min(deadlineMs,next);}};};
 async function retain(value){const fields=own(value,['pending','request','reads'],['signal']),rawPending=own(fields.pending,['state','sourceBinding','skill','requestSha256','selectionSha256','inputSha256','preparationSha256','artifactRequestSha256','baseVersionId','prepared']);
  const p=rawPending.prepared,snapshot=bounded(p,2097152);originalGuard(snapshot.provenance.skill,p,snapshot.context)({request:snapshot.request,context:snapshot.context,baseVersionId:snapshot.baseVersionId??null});
  const {prepared:ignored,...pending}=rawPending,record=validateRecord({recipe:'original-selected-output-retention/1',pending,prepared:p,request:fields.request,reads:fields.reads});
  candidates.add(record);const life=lifetime(fields.signal);life.limitDeadline(record.prepared.context.deadlineMs);
  try{return await life.run(()=>journal.retain(record,life.check));}finally{life.close();candidates.delete(record);}}
 async function load(value){const fields=own(value,['sourceBinding','preparationSha256'],['signal']),selector=bounded({sourceBinding:fields.sourceBinding,preparationSha256:fields.preparationSha256});
  validateShape('RunBinding',selector.sourceBinding);digest(selector.preparationSha256);const life=lifetime(fields.signal);
  try{const record=validateRecord(await life.run(()=>journal.load(selector,life.check))),input={...selector,pins:pins(record),sourceEvidence:record.prepared.context.evidence,reads:record.reads};
   const current=phase=>life.run(async signal=>{try{return await currentOutputAccess({...input,phase,deadlineMs:life.deadlineMs,signal});}catch{fail('SELECTED_OUTPUT_ACCESS_REFUSED');}});
   let started=now();const before=accessRecord(await current('before'),record,started,now,life);
   const verified=validateRecord(await life.run(()=>journal.load(selector,life.check)));if(!same(verified,record))fail('SELECTED_OUTPUT_PINS_REFUSED');
   started=now();const after=accessRecord(await current('after'),record,started,now,life,before);life.check();
   const prepared=verified.prepared,pending={...verified.pending,prepared};loaded.set(prepared,{record:verified,access:after,preparedSha256:hash(prepared)});
   return {prepared,pending,request:verified.request,reads:verified.reads,pins:pins(verified),access:after};
  }finally{life.close();}}
 function brand(prepared){const pin=loaded.get(prepared),stamp=now();if(!pin||hash(prepared)!==pin.preparedSha256||!Number.isSafeInteger(stamp)||stamp<pin.access.checkedAtMs||stamp>=pin.access.expiresAtMs)fail('SELECTED_OUTPUT_RETAINED_PREPARATION_REFUSED');return pin;}
 function admitRetained(prepared,context){const pin=brand(prepared);if(hash(context)!==pin.access.sourceContextSha256)fail('SELECTED_OUTPUT_RETAINED_PREPARATION_REFUSED');return intent=>{
  brand(prepared);own(intent,['request','context','baseVersionId']);if(hash(intent.request)!==pin.access.artifactRequestSha256||hash(intent.context)!==pin.access.sourceContextSha256||intent.baseVersionId!==(pin.record.pending.baseVersionId??null))fail('SELECTED_OUTPUT_REQUEST_SUBSTITUTION');};}
 function sourceCall(prepared){const {record}=brand(prepared),p=record.pending;return {prepared,binding:p.sourceBinding,requestSha256:p.requestSha256,selectionSha256:p.selectionSha256,inputSha256:p.inputSha256,preparationSha256:p.preparationSha256,reads:bounded(record.reads,2097152)};}
 return Object.freeze({retain,load,admitRetained,admit:admitRetained,sourceCall});
}
