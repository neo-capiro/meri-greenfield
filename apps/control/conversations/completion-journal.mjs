/** Completion capture identity and publication share the canonical conversation transaction.
 * A persisted CAPTURING/UNKNOWN row never authorizes another physical capture. */
import {bounded,hash,same,fail,validateShape,own,uuid,nextState} from './boundary.mjs';
import {assertWorkspacePaths} from '../../../packages/contracts/validate.mjs';
import {assertTypedResult,assertTypedSelection,MAX_OBJECTIVE_SELECTION_BYTES} from '../../../packages/runtime/objective-generation-custody.mjs';
const eventId=(id,n)=>{const h=hash({completionId:id,event:n});return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
export function createCompletionJournal({tx,rowRun}){
 const context=r=>hash({window:r.request.window,skill:r.request.skill,scopes:r.projection.scopes});
 function typedPair(result,selection,r,stored=false){
  if((result===undefined)!==(selection===undefined))fail(stored?'STORE_CORRUPT':'COMPLETION_TYPED_REFUSED');
  if(result===undefined)return {};
  try{const typedResult=assertTypedResult(bounded(result),{binding:r.projection.binding,sourceRequestSha256:r.request_sha256});
   const typedSelection=assertTypedSelection(bounded(selection,MAX_OBJECTIVE_SELECTION_BYTES),typedResult,{binding:r.projection.binding,acceptedRequest:r.request});
   return {typedResult,typedSelection};
  }catch{fail(stored?'STORE_CORRUPT':'COMPLETION_TYPED_REFUSED');}
 }
 async function run(c,b,scopes,selectedClientId){validateShape('RunBinding',b);uuid(selectedClientId);const r=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows[0]);
  if(!same(r.projection.binding,b))fail('STALE_WRITER');if(!same(r.projection.scopes,scopes)||!scopes.some(s=>s.kind==='client'&&s.resourceId===selectedClientId))fail('SCOPE_REFUSED');return r;}
 const decode=(row,r,selectedClientId)=>{if(!row)return null;const p=row.identity;
  if(hash(p)!==row.identity_sha256||row.tenant_id!==p.binding.tenantId||row.conversation_id!==p.binding.conversationId||row.run_id!==p.binding.runId||row.completion_id!==p.completionId||row.checkpoint_id!==p.checkpointId||!same(p.binding,r.projection.binding)||p.selectedClientId!==selectedClientId||!same(p.scopes,r.projection.scopes)||!same(p.versions,r.projection.versions)||!same(p.sourceRequest,r.request)||p.sourceRequestSha256!==r.request_sha256||p.contextSha256!==context(r)||!Number.isSafeInteger(p.captureSequence)||p.captureSequence<1||p.captureSequence>Number(r.last_sequence)||!['CAPTURING','UNKNOWN','PUBLISHED'].includes(row.state))fail('STORE_CORRUPT');
  uuid(p.completionId);uuid(p.checkpointId);uuid(p.verifiedEventId);uuid(p.completedEventId);
  if(Object.hasOwn(p,'typedResult')!==Object.hasOwn(p,'typedSelection'))fail('STORE_CORRUPT');
  if(Object.hasOwn(p,'typedResult'))typedPair(p.typedResult,p.typedSelection,r,true);
  if(row.proof){if(hash(row.proof)!==row.proof_sha256||row.state!=='PUBLISHED')fail('STORE_CORRUPT');validateCompletionProof(row.proof,p);}else if(row.state==='PUBLISHED'||row.proof_sha256!=null)fail('STORE_CORRUPT');
  return {...p,state:row.state,proof:row.proof??null};};
 const lookup=async(c,b)=>{const rows=(await c.query('SELECT * FROM meri_conversations.completion_checkpoints WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows;if(rows.length>1)fail('STORE_CORRUPT');return rows[0];};

 async function begin({binding:b,scopes,selectedClientId,completionId,checkpointId,typedResult,typedSelection},check){b=bounded(b);scopes=bounded(scopes);uuid(completionId);uuid(checkpointId);return tx(b,check,async c=>{const r=await run(c,b,scopes,selectedClientId),old=decode(await lookup(c,b),r,selectedClientId),pair=typedPair(typedResult,typedSelection,r);check();
  if(old){if(old.completionId!==completionId||old.checkpointId!==checkpointId||Object.hasOwn(old,'typedResult')!==Object.hasOwn(pair,'typedResult')||Object.hasOwn(pair,'typedResult')&&(!same(old.typedResult,pair.typedResult)||!same(old.typedSelection,pair.typedSelection)))fail('COMPLETION_REPLAY_REFUSED');return {...old,capture:false};}
  if(r.projection.state!=='running'||r.hold_control_id||r.sequence_end!=null)fail('COMPLETION_STATE_REFUSED');
  const identity={binding:b,scopes,selectedClientId,completionId,checkpointId,captureSequence:Number(r.last_sequence),sourceRequest:r.request,sourceRequestSha256:r.request_sha256,contextSha256:context(r),versions:r.projection.versions,verifiedEventId:eventId(completionId,'1'),completedEventId:eventId(completionId,'2'),...pair};
  await c.query('INSERT INTO meri_conversations.completion_checkpoints(tenant_id,conversation_id,run_id,completion_id,checkpoint_id,identity,identity_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[b.tenantId,b.conversationId,b.runId,completionId,checkpointId,identity,hash(identity),'CAPTURING']);check();await c.query('UPDATE meri_conversations.runs SET hold_completion_id=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[b.tenantId,b.conversationId,b.runId,completionId]);check();return {...identity,state:'CAPTURING',proof:null,capture:true};
 });}
 async function read({binding:b,scopes,selectedClientId},check){return tx(b,check,async c=>{const r=await run(c,b,scopes,selectedClientId),p=decode(await lookup(c,b),r,selectedClientId);check();return p;});}
 async function unknown({binding:b,scopes,selectedClientId,completionId},check){return tx(b,check,async c=>{const r=await run(c,b,scopes,selectedClientId),p=decode(await lookup(c,b),r,selectedClientId);check();if(!p||p.completionId!==completionId)fail('COMPLETION_REFUSED');if(p.state==='CAPTURING'){await c.query("UPDATE meri_conversations.completion_checkpoints SET state='UNKNOWN' WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3",[b.tenantId,b.conversationId,b.runId]);return {...p,state:'UNKNOWN'};}return p;});}
 async function publish({binding:b,scopes,selectedClientId,completionId,proof:rawProof,events},check){return tx(b,check,async c=>{const r=await run(c,b,scopes,selectedClientId),p=decode(await lookup(c,b),r,selectedClientId);check();if(!p||p.completionId!==completionId)fail('COMPLETION_REFUSED');const proof=validateCompletionProof(rawProof,p);
  if(p.proof){if(!same(p.proof,proof))fail('COMPLETION_REPLAY_REFUSED');return {...p,replayed:true};}
  if(r.projection.state!=='running'||r.hold_control_id||r.sequence_end!=null||Number(r.last_sequence)!==p.captureSequence)fail('COMPLETION_STATE_REFUSED');
  if(!Array.isArray(events)||events.length!==2)fail('COMPLETION_EVENTS_REFUSED');let sequence=Number(r.last_sequence),state=r.projection.state;const saved=[];
  for(let i=0;i<events.length;i++){const raw=bounded(events[i]);if(raw.eventId!==(i===0?p.verifiedEventId:p.completedEventId)||raw.type!==(i===0?'checkpoint.verified':'run.status')||!same(raw.data,i===0?{checkpointId:p.checkpointId}:{state:'completed',reasonCode:null}))fail('COMPLETION_EVENTS_REFUSED');
   const event={...raw,binding:b,scopes,sequence:++sequence};validateShape('UIEvent',event);if(!Number.isSafeInteger(sequence))fail('EVENT_LIMIT');state=nextState(state,event);saved.push(event);
   await c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.tenantId,b.conversationId,b.runId,sequence,event.eventId,event,hash(event)]);check();}
  const projection={...r.projection,state};await c.query('UPDATE meri_conversations.runs SET projection=$4,projection_sha256=$5,last_sequence=$6 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[b.tenantId,b.conversationId,b.runId,projection,hash(projection),sequence]);
  await c.query("UPDATE meri_conversations.completion_checkpoints SET state='PUBLISHED',proof=$4,proof_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3",[b.tenantId,b.conversationId,b.runId,proof,hash(proof)]);check();return {...p,state:'PUBLISHED',proof,events:saved,replayed:false};
 });}
 return Object.freeze({begin,read,publish,unknown});
}

export function validateCompletionProof(value,p){const proof=bounded(value);own(proof,['checkpoint','checkpointSha256','sourceRequestSha256','contextSha256','resumeSessionAt','readReceiptId']);uuid(proof.readReceiptId);if(proof.resumeSessionAt!==null)uuid(proof.resumeSessionAt);
  const cp=proof.checkpoint;validateShape('Checkpoint',cp);assertWorkspacePaths(cp.workspace);
  if(cp.checkpointId!==p.checkpointId||hash(cp)!==proof.checkpointSha256||!same(cp.binding,p.binding)||!same(cp.workspace.binding,p.binding)||!same(cp.scopes,p.scopes)||!same(cp.workspace.scopes,p.scopes)||!same(cp.opaqueSession.scopes,p.scopes)||!same(cp.versions,p.versions)||hash(cp.workspace)!==cp.workspaceSha256||proof.sourceRequestSha256!==p.sourceRequestSha256||proof.contextSha256!==p.contextSha256||cp.lastEventSequence!==p.captureSequence||cp.workspace.entries.some(e=>e.object.scopes.some(s=>!p.scopes.some(parent=>same(parent,s)))))fail('CHECKPOINT_REFUSED');return proof;
 }
