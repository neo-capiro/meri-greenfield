/** Fixed SQL routing for the existing conversation retention row transaction.
 * No caller can supply a table, column, SQL predicate or redaction expression. */
import {own,uuid,digest,hash,fail} from './boundary.mjs';
import {assertConversationContentTarget,conversationContentTables} from '../conversations/retention-content-rows.mjs';
import {assertSdkRetentionTarget} from '../conversations/retention-sdk-rows.mjs';

const refuse=()=>fail('RETENTION_INVALID_REQUEST');
export const tombstone=conversationId=>({retentionTombstone:true,conversationId});
const definitions=new Map(conversationContentTables.map(t=>[t.name,t]));
const sdkTables=new Set(['sdk_sessions','sdk_session_streams','sdk_session_entries','sdk_session_batches'].map(t=>'meri_conversations.'+t));
const json=value=>JSON.parse(JSON.stringify(value));
const retained=new Set(['meri_conversations.initial_inputs','meri_conversations.initial_run_bindings','meri_conversations.native_executions']);
const modes={
 'meri_objective_source.run_starts':'objective',
 'meri_intents.preparations':'intent',
 'meri_commands.approval_metadata':'approval',
 'meri_commands.command_journal':'command',
 'meri_task_lookup.lookups':'lookup',
};
// FK children precede their parents. Runs/conversation identities are retained.
const rank={
 'meri_task_lookup.events':0,'meri_task_lookup.lookups':1,
 'meri_conversations.sdk_session_entries':2,'meri_conversations.sdk_session_batches':3,
 'meri_conversations.sdk_session_streams':4,'meri_conversations.sdk_sessions':5,
 'meri_conversations.checkpoints':6,'meri_conversations.controls':7,
 'meri_conversations.runs':90,'meri_conversations.conversations':100,
};
const knownDigest=(row,field,expected)=>{
 const body=field.slice(0,-'_sha256'.length);
 let actual;try{actual=hash(row[body]);}catch{fail('RETENTION_ROW_CHANGED');}
 if(row[field]!==expected||actual!==expected)fail('RETENTION_ROW_CHANGED');
};

/** Return null only for a target belonging to a different existing row owner. */
export function conversationPurgeRow(k,step){
 try{return fixedRow(k,step);}catch(error){if(String(error?.code??'').startsWith('RETENTION_'))throw error;refuse();}
}
function fixedRow(k,step){
 if(k.kind!=='conversation')return null;
 const g=step.target;if(!g||g.className!==step.className)refuse();
 let table,keys,mode='delete',verify;const sdk=Object.hasOwn(g,'sdk');
 if(sdk)assertSdkRetentionTarget(g);
 if(definitions.has(g.table)){
  try{assertConversationContentTarget(g);}catch{refuse();}
  const d=definitions.get(g.table);table=d.name;keys=g.key;mode=retained.has(table)?'identity':modes[table]??'delete';
  verify=row=>{if(hash(json(row))!==g.rowSha256)fail('RETENTION_ROW_CHANGED');};
 }else if(step.className==='conversation'&&g.table==='conversations'){
  own(g,['className','table','conversationId','projectionSha256']);uuid(g.conversationId);digest(g.projectionSha256);
  if(g.conversationId!==k.subjectId)refuse();table='meri_conversations.conversations';keys={conversation_id:g.conversationId};mode='identity';
  verify=row=>knownDigest(row,'projection_sha256',g.projectionSha256);
 }else if(step.className==='conversation'&&g.table==='runs'){
  own(g,['className','table','runId','projectionSha256','requestSha256']);uuid(g.runId);digest(g.projectionSha256);digest(g.requestSha256);
  table='meri_conversations.runs';keys={run_id:g.runId};mode='run';
  verify=row=>{knownDigest(row,'projection_sha256',g.projectionSha256);knownDigest(row,'request_sha256',g.requestSha256);};
 }else if(step.className==='conversation'&&g.table==='controls'){
  own(g,['className','table','controlId','runId','controlSequence','projectionSha256']);uuid(g.controlId);uuid(g.runId);digest(g.projectionSha256);
  if(!Number.isSafeInteger(g.controlSequence)||g.controlSequence<1)refuse();
  table='meri_conversations.controls';keys={control_id:g.controlId,run_id:g.runId,control_sequence:g.controlSequence};verify=row=>knownDigest(row,'projection_sha256',g.projectionSha256);
 }else if(step.className==='events'&&g.table==='events'){
  own(g,['className','table','runId','sequence','eventId','eventSha256']);uuid(g.runId);uuid(g.eventId);digest(g.eventSha256);
  if(!Number.isSafeInteger(g.sequence)||g.sequence<1)refuse();table='meri_conversations.events';keys={run_id:g.runId,sequence:g.sequence,event_id:g.eventId};verify=row=>knownDigest(row,'event_sha256',g.eventSha256);
 }else if(step.className==='conversation'&&g.table==='memory_proposal_contexts'){
  own(g,['className','table','runId','keySha256']);uuid(g.runId);digest(g.keySha256);table='meri_conversations.memory_proposal_contexts';keys={run_id:g.runId,key_sha256:g.keySha256};
 }else if(step.className==='lifecycle'&&g.key){
  own(g,['className','key']);table='meri_conversations.checkpoints';keys={checkpoint_id:uuid(g.key)};
 }else if(step.className==='completionCheckpoints'&&g.checkpointId){
  own(g,['className','checkpointId','runId','state']);if(g.state!=='PUBLISHED')fail('RETENTION_PURGE_BLOCKED');
  table='meri_conversations.completion_checkpoints';keys={checkpoint_id:uuid(g.checkpointId),run_id:uuid(g.runId)};
 }else if(step.className==='nextRuns'&&g.key){
  own(g,['className','key']);table='meri_conversations.next_runs';keys={target_run_id:uuid(g.key)};
 }else return null;

 const args=[k.tenantId,k.subjectId,...Object.values(keys)];
 // The supplementary snapshot already fixes each non-conversation table's exact
 // subject predicate. Redacted rows retain conversationId for recovery only.
 const d=definitions.get(table);
 let scope=d?d.where: 'r.tenant_id=$1 AND r.conversation_id=$2';
 if(['approval','command','lookup'].includes(mode))scope=`r.tenant_id=$1 AND ((${scope}) OR r.payload->>'conversationId'=$2::text)`;
 const where=`(${scope}) AND ${Object.keys(keys).map((key,i)=>`r.${key}=$${i+3}`).join(' AND ')}`;
 const marker=JSON.stringify(tombstone(k.subjectId));
 const updates={
  objective:'record=$LAST::jsonb',
  run:'request=$LAST::jsonb,continuation=NULL,continuation_sha256=NULL,feedback=NULL,feedback_sha256=NULL',
  approval:'payload=$LAST::jsonb',
  command:'payload=$LAST::jsonb,outcome=CASE WHEN outcome IS NULL THEN NULL ELSE $LAST::jsonb END',
  lookup:'payload=$LAST::jsonb,record=CASE WHEN record IS NULL THEN NULL ELSE $LAST::jsonb END',
  intent:"state='REDACTED',outcome=NULL,outcome_purged_at=clock_timestamp()",
 };
 const erased=row=>{
  if(!row)return true;
  if(mode==='identity'){verify?.(row);return true;}
  if(mode==='intent'){
   if(row.state==='FAILED'){verify?.(row);return true;}
   return row.state==='REDACTED'&&row.outcome===null&&row.outcome_purged_at!==null;
  }
  if(mode==='delete')return false;
  const body=mode==='run'?row.request:mode==='objective'?row.record:row.payload;
  return hash(body)===hash(tombstone(k.subjectId))&&
   (mode!=='run'||row.continuation===null&&row.continuation_sha256===null&&row.feedback==null&&row.feedback_sha256==null)&&
   (mode!=='command'||row.outcome===null||hash(row.outcome)===hash(tombstone(k.subjectId)))&&
   (mode!=='lookup'||row.record===null||hash(row.record)===hash(tombstone(k.subjectId)));
 };
 const check=row=>{
  if(!row)fail('RETENTION_ROW_CHANGED');verify?.(row);
  if(mode==='intent'&&!['PREPARED','FAILED','REDACTED'].includes(row.state)||mode==='command'&&row.state!=='OUTCOME'||mode==='lookup'&&!['RESULT','ERROR'].includes(row.state))fail('RETENTION_PURGE_BLOCKED');
 };
 const update=updates[mode]?.replaceAll('$LAST',`$${args.length+1}`);
 return Object.freeze({table,where,args:()=>args,mode,rank:sdk?2:rank[table]??20,verify:check,erased,...(sdk?{sdk:g}:{}),
  sql:mode==='delete'?`DELETE FROM ${table} r WHERE ${where}`:mode==='identity'?null:`UPDATE ${table} r SET ${update} WHERE ${where}`,
  mutationArgs:mode==='delete'||mode==='identity'||mode==='intent'?args:[...args,marker],
  target:{table,key:keys,rowSha256:g.rowSha256??null,mode}});
}

/** One bounded page of exact SDK keys. The caller registers these individual
 * targets under its existing suppression transaction before this bulk delete. */
export function sdkPurgePage(subject,targets){
 if(subject?.kind!=='conversation'||!Array.isArray(targets)||!targets.length||targets.length>1000)refuse();
 const page=[],keys=[],seen=new Set();let table,columns;
 for(const raw of targets){let target;try{target=assertConversationContentTarget(raw);}catch{refuse();}
  if(target.className!=='sdkSession'||Object.hasOwn(target,'sdk')||!sdkTables.has(target.table)||(table!==undefined&&target.table!==table))refuse();
  if(table===undefined){table=target.table;columns=definitions.get(table).keys;}
  // Validated scalar keys have an exact tuple identity independent of property order.
  const identity=JSON.stringify(columns.map(([name])=>target.key[name]));if(seen.has(identity))refuse();seen.add(identity);
  page.push({table,key:target.key,rowSha256:target.rowSha256,mode:'delete'});keys.push(target.key);
 }
 const first=keys[0];
 if(table==='meri_conversations.sdk_session_entries'&&keys.every(key=>key.run_id===first.run_id&&key.session_id===first.session_id&&key.subpath===first.subpath)){
  // The validated common prefix plus exact sequence membership is the full key.
  // Redundant scalar bounds expose the page envelope to the index while ANY
  // still excludes every gap. Derive both only from these validated exact keys.
  const sequences=keys.map(key=>key.sequence),lower=Math.min(...sequences),upper=Math.max(...sequences);
  return {targets:page,sql:`DELETE FROM ${table} r WHERE r.tenant_id=$1 AND r.conversation_id=$2 AND r.run_id=$3::uuid AND r.session_id=$4::uuid AND r.subpath=$5::text AND r.sequence>=$7::bigint AND r.sequence<=$8::bigint AND r.sequence=ANY($6::bigint[])`,
   args:[subject.tenantId,subject.subjectId,first.run_id,first.session_id,first.subpath,sequences,lower,upper]};
 }
 const types=columns.map(([name,type])=>`${name} ${type}`),match=columns.map(([name])=>`r.${name}=page.${name}`).join(' AND ');
 return {targets:page,sql:`DELETE FROM ${table} r USING jsonb_to_recordset($3::jsonb) AS page(${types.join(',')}) WHERE r.tenant_id=$1 AND r.conversation_id=$2 AND ${match}`,
  args:[subject.tenantId,subject.subjectId,JSON.stringify(keys)]};
}
