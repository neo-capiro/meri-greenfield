/** Supplemental conversation rows from the SAME bounded snapshot as runs/events.
 * Fixed SQL owners only. Targets identify retained bytes; they grant no erasure. */
import {data,hash,same,own,uuid,validateShape,fail} from './boundary.mjs';
import {assertOriginalInputFacts} from './initial-input-facts.mjs';
import {decodeExecutionRow} from './execution-boundary.mjs';
import {immutablePayload,context as commandContext} from '../commands/approval-metadata/binding.mjs';
import {taskKind} from '../commands/approval-metadata/task-kind.mjs';
import {assertNativeApprovalProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {storedBinding,retained,storedEvent} from '../task-lookup/binding.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {assertSdkRetentionTarget,sdkRetentionTables,summarizeSdkRetentionRows,validateSdkRetentionInventory} from './retention-sdk-rows.mjs';
import {preparedSchedule} from '../intents/postgres-journal.mjs';
import {decodeObjectiveRunStartRow} from '../../runtime/objective-source/run-starts.mjs';
import {decodeUploadRow} from '../uploads/postgres-store.mjs';

const scope='r.tenant_id=$1 AND r.conversation_id=$2';
const table=(name,className,keys,where=scope)=>Object.freeze({name,className,keys:Object.freeze(keys),where});
// Primary-key columns after the subject's tenant/conversation. No caller supplies
// a table, column or predicate. Historical rows remain data, never runtime owners.
export const conversationContentTables=Object.freeze([
 table('meri_uploads.originals','uploads',[['upload_id','uuid']]),
 table('meri_conversations.initial_run_bindings','conversation',[['generation','integer']]),
 table('meri_conversations.initial_inputs','conversation',[['run_id','uuid']]),
 table('meri_objective_source.run_starts','conversation',[['generation_job_id','uuid']]),
 table('meri_conversations.sdk_sessions','sdkSession',[['run_id','uuid'],['session_id','uuid']]),
 table('meri_conversations.sdk_session_streams','sdkSession',[['run_id','uuid'],['session_id','uuid'],['subpath','text']]),
 table('meri_conversations.sdk_session_entries','sdkSession',[['run_id','uuid'],['session_id','uuid'],['subpath','text'],['sequence','bigint']]),
 table('meri_conversations.sdk_session_batches','sdkSession',[['run_id','uuid'],['session_id','uuid'],['append_id','uuid']]),
 table('meri_conversations.native_executions','nativeJournals',[['run_id','uuid']]),
 table('meri_conversations.native_allocations','nativeJournals',[['run_id','uuid']]),
 table('meri_conversations.native_restorations','nativeJournals',[['run_id','uuid']]),
 table('meri_conversations.selected_outputs','selectedOutputs',[['run_id','uuid']]),
 table('meri_conversations.selected_reads','selectedOutputs',[['run_id','uuid'],['delivery_sha256','text']]),
 table('meri_intents.preparations','receipts',[['actor_id','text'],['delivery_id','text']]),
 table('meri_commands.approval_metadata','receipts',[['actor_id','text'],['proposal_id','uuid']],
  "r.tenant_id=$1 AND r.payload#>>'{record,binding,conversationId}'=$2::text"),
 table('meri_commands.command_journal','receipts',[['actor_id','text'],['idempotency_key','text']],
  "r.tenant_id=$1 AND r.payload#>>'{proposal,command,binding,conversationId}'=$2::text"),
 table('meri_task_lookup.lookups','receipts',[['lookup_id','uuid']],
  "r.tenant_id=$1 AND r.payload#>>'{context,binding,conversationId}'=$2::text"),
 table('meri_task_lookup.events','receipts',[['run_id','uuid'],['sequence','bigint']],
  'r.tenant_id=$1 AND EXISTS (SELECT 1 FROM meri_conversations.runs parent WHERE parent.tenant_id=r.tenant_id AND parent.conversation_id=$2 AND parent.run_id=r.run_id)'),
]);
const tables=new Map(conversationContentTables.map(t=>[t.name,t]));
const corrupt=()=>fail('STORE_CORRUPT'),fact=v=>{if(!v)corrupt();};
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const integer=v=>{fact(typeof v==='number'||typeof v==='string'&&/^(0|[1-9][0-9]*)$/u.test(v));const n=Number(v);fact(Number.isSafeInteger(n)&&n>=0);return n;};
const pin=(row,field)=>fact(row[field]!=null&&digest(row[field+'_sha256'])&&hash(row[field])===row[field+'_sha256']);
const tuple=(...values)=>JSON.stringify(values);
function keyFor(row,t){return Object.fromEntries(t.keys.map(([key,type])=>{const v=row[key];
 if(type==='uuid')uuid(v);else if(type==='text')fact(typeof v==='string'&&v.length<=1024&&(key==='subpath'||v.length>0));
 else fact(integer(v)>0);return [key,type==='integer'||type==='bigint'?integer(v):v];}));}

/** `page` is the original inventory's accounted, deadline-bound keyset reader. */
export async function scanConversationContentRows(reader,page,{streamSdk=false}={}){
 const result={};
 for(const t of conversationContentTables){
  if(streamSdk&&t.className==='sdkSession'){result[t.name]=[];continue;}
  const columns=t.keys.map(([name])=>'r.'+name),params=t.keys.map(([,type],i)=>`$${i+3}::${type}`);
  const compare=columns.length===1?`${columns[0]}>${params[0]}`:`(${columns.join(',')})>(${params.join(',')})`;
  result[t.name]=await page(reader,`SELECT r.* FROM ${t.name} r WHERE ${t.where} AND (${params[0]} IS NULL OR ${compare}) ORDER BY ${columns.join(',')} LIMIT 33`,
   row=>t.keys.map(([name])=>row[name]),t.keys.map(()=>null));
 }
 return result;
}

/** Closed content-free row target, also checked by the existing enumerator. */
export function assertConversationContentTarget(raw){
 if(Object.hasOwn(raw??{},'sdk'))return assertSdkRetentionTarget(raw);
 const v=own(raw,['className','table','key','rowSha256']),t=tables.get(v.table);fact(t&&v.className===t.className&&digest(v.rowSha256));
 own(v.key,t.keys.map(([key])=>key));const key=keyFor(v.key,t);
 fact(t.keys.every(([name])=>v.key[name]===key[name]));return v;
}

export function decodeConversationContentRows(raw,{subject,projection},byRun,nativeReferences=[],sdkInventory){
 own(raw,conversationContentTables.map(t=>t.name));
 if(sdkInventory)for(const t of sdkRetentionTables)fact(Array.isArray(raw[t.name])&&raw[t.name].length===0);
 const targets=[...validateSdkRetentionInventory(sdkInventory??summarizeSdkRetentionRows(raw,subject),{owner:{subject,projection},byRun,nativeReferences})],seen=new Set(),lookups=new Map(),initials=new Map();
 const binding=(value,{requireRun=true}={})=>{validateShape('RunBinding',value);
  fact(value.tenantId===subject.tenantId&&value.conversationId===subject.subjectId&&value.actorId===subject.ownerActorId);
  const run=byRun.get(value.runId);if(requireRun)fact(run&&same(run.projection.binding,value));return run;};
 const runFor=row=>{const run=byRun.get(row.run_id);fact(run);return run;};
 const exactScopes=(value,run)=>fact(same(value,run.projection.scopes));
 // An attended task can be prepared before its original run exists. Retained
 // initial custody supplies historical scopes only, never a fabricated run or
 // fresh authority. A present run must still match the entire original binding.
 const taskActions={'task.create':'create_task','task.update':'update_task'};
 const scheduleOperations=['schedule_task','update_scheduled_task','cancel_scheduled_task'];
 const commandScopes=(value,action,createdAt)=>{
  const run=binding(value,{requireRun:false});if(run){fact(same(run.projection.binding,value));return run.projection.scopes;}
  const original=initials.get(value.runId);
  fact(Object.hasOwn(taskActions,action)&&original&&same(original.binding,value)&&original.createdAtMs<=Date.parse(createdAt));
  return [{tenantId:value.tenantId,kind:original.selectedClientId===null?'private-user':'client',resourceId:original.selectedClientId??value.actorId,policyRevision:original.policyRevision}];
 };
 for(const t of conversationContentTables){if(t.className==='sdkSession')continue;const list=raw[t.name];fact(Array.isArray(list)&&list.length<=4096);
  for(const row of list){fact(row?.tenant_id===subject.tenantId);
   if(Object.hasOwn(row,'conversation_id'))fact(row.conversation_id===subject.subjectId);
   if(Object.hasOwn(row,'actor_id'))fact(row.actor_id===subject.ownerActorId);
   const key=keyFor(row,t),identity=tuple(t.name,key);fact(!seen.has(identity));seen.add(identity);
   // Date-valued pg columns are canonicalized once; no raw body escapes.
   targets.push({className:t.className,table:t.name,key,rowSha256:hash(JSON.parse(JSON.stringify(row)))});
   switch(t.name){
    case 'meri_uploads.originals':{const r=decodeUploadRow(row);
     fact(r.owner.tenantId===subject.tenantId&&r.owner.actorId===subject.ownerActorId&&r.owner.conversationId===subject.subjectId);
     // A durable attempt may still create its original after a lost ACK. Its
     // absence is not evidence of settlement; never plan a partial purge.
     if(['writing','removing'].includes(r.state))fail('STORE_CORRUPT');break;}
    case 'meri_conversations.initial_run_bindings':{pin(row,'record');const r=own(row.record,['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs']);binding(r.binding,{requireRun:false});
     fact(r.binding.runId===row.run_id&&r.binding.writerFence===1&&r.schemaVersion===1&&r.state==='ADMITTED');
     validateShape('RuntimeVersions',r.versions);fact(typeof r.policyRevision==='string'&&r.policyRevision.length>0&&r.policyRevision.length<=256&&digest(r.configurationSha256)&&Number.isSafeInteger(r.createdAtMs)&&r.createdAtMs>=0&&Number.isSafeInteger(r.expiresAtMs)&&r.expiresAtMs>r.createdAtMs);
     assertNativeConversationScope({binding:r.binding,scopes:projection.scopes,selectedClientId:r.selectedClientId});
     fact(!initials.has(row.run_id));initials.set(row.run_id,r);break;}
    case 'meri_conversations.initial_inputs':{pin(row,'allocation');const a=assertOriginalInputFacts(row.allocation),run=binding(a.binding,{requireRun:false});
     fact(a.binding.runId===row.run_id&&a.requestId===row.request_id&&['RESERVED','ACCEPTED'].includes(row.state));
     assertNativeConversationScope({binding:a.binding,scopes:projection.scopes,selectedClientId:a.selectedClientId});
     if(row.state==='ACCEPTED')fact(run&&row.accepted_request_sha256===a.requestSha256&&run.row.request_sha256===a.requestSha256);
     else fact(row.accepted_request_sha256===null&&!run);break;}
    case 'meri_objective_source.run_starts':{let r;try{r=decodeObjectiveRunStartRow(row,{tenantId:subject.tenantId});}catch{corrupt();}
     const run=binding(r.binding,{requireRun:false});
     assertNativeConversationScope({binding:r.binding,scopes:projection.scopes,selectedClientId:r.selection.sourceAdmission.canonical.clientId});
     if(run)fact(same(run.projection.binding,r.binding)&&run.row.request_sha256===r.sourceRequestSha256);
     // The run-start is committed before admission. Its actual registered
     // conversation owns the private selection even if no run was accepted.
     break;}
    case 'meri_conversations.native_executions':decodeExecutionRow(row,runFor(row).projection.binding);break;
    case 'meri_conversations.native_allocations':
    case 'meri_conversations.native_restorations':{pin(row,'record');const r=runFor(row),b=row.record.original?.binding??row.record.binding;binding(b);fact(same(b,r.projection.binding)&&digest(row.intent_key));break;}
    case 'meri_conversations.selected_outputs':{pin(row,'projection');const run=runFor(row),p=row.projection;
     // This is the canonical prepared-output row, not a published artifact. Its
     // content remains opaque to purge; storage custody is elsewhere.
     fact(p.recipe==='original-selected-output-retention/1'&&same(p.request,run.row.request)&&same(p.pending?.sourceBinding,run.projection.binding)&&
      p.pending.preparationSha256===row.preparation_sha256&&digest(row.preparation_sha256)&&same(p.prepared?.context?.binding,run.projection.binding));
     exactScopes(p.prepared.context.scopes,run);fact(Array.isArray(p.prepared.context.assets)&&p.prepared.context.assets.length===0);break;}
    case 'meri_conversations.selected_reads':{runFor(row);fact(digest(row.delivery_sha256)&&digest(row.allocation_sha256)&&row.selector&&['PENDING','RETAINED','UNKNOWN'].includes(row.stage));
     fact(row.stage==='RETAINED'?typeof row.result_text==='string'&&row.completion!==null:row.result_text===null&&row.completion===null);break;}
    case 'meri_intents.preparations':{pin(row,'record');fact(/^sdk:[a-f0-9]{64}$/u.test(row.delivery_id)&&digest(row.record.argumentsSha256)&&['PENDING','PREPARED','FAILED','UNKNOWN','REDACTED'].includes(row.state));
     own(row.record,['operation','argumentsSha256']);own(row.record.operation,['id','version']);
     fact(/^[a-z][a-z_]{0,62}$/u.test(row.record.operation.id)&&row.record.operation.version==='0.2.0');
     fact(byRun.size>0||initials.size>0&&[...Object.values(taskActions),...scheduleOperations].includes(row.record.operation.id));
     if(row.state==='REDACTED'){fact(row.outcome===null&&row.outcome_purged_at!==null&&row.outcome_purged_at!==undefined&&Number.isFinite(new Date(row.outcome_purged_at).getTime())&&row.settled_at!==null&&row.settled_at!==undefined&&Number.isFinite(new Date(row.settled_at).getTime()));break;}
     fact(row.outcome_purged_at===null);
     if(row.state==='PREPARED'){
      const r=binding(row.outcome?.release?.binding,{requireRun:false});
      if(r){fact(same(r.projection.binding,row.outcome.release.binding));exactScopes(row.outcome.release.scopes,r);fact(row.outcome.result&&typeof row.outcome.result==='object');}
      else if(scheduleOperations.includes(row.record.operation.id)){
       const proposed=row.outcome?.result?.proposal,stored=Object.fromEntries(['tenant_id','actor_id','conversation_id','delivery_id','record','record_sha256','state','outcome'].map(k=>[k,row[k]]));
       const custody=preparedSchedule(stored,{tenantId:subject.tenantId,proposalId:proposed?.proposalId,intentSha256:proposed?.intentSha256},false).outcome;
       // Dedicated first-use routines retain only the canonical pending proposal;
       // SDK result.request belongs to an accepted run and cannot borrow this path.
       own(custody.result,['status','proposal']);const release=custody.release,p=custody.result.proposal,original=initials.get(release.binding.runId);
       fact(original&&same(original.binding,release.binding)&&p.projection.owner.actorId===subject.ownerActorId&&
        release.expiresAtMs>original.createdAtMs&&release.expiresAtMs<=original.expiresAtMs&&
        same(release.scopes,[{tenantId:subject.tenantId,kind:original.selectedClientId===null?'private-user':'client',resourceId:original.selectedClientId??subject.ownerActorId,policyRevision:original.policyRevision}]));
      }else{const outcome=own(row.outcome,['result','release']),result=own(outcome.result,['status','proposal']),release=own(outcome.release,['binding','scopes','expiresAtMs']),p=result.proposal;
       assertNativeApprovalProposal(p);fact(result.status==='approval_required'&&Object.hasOwn(taskActions,p.command.action)&&taskActions[p.command.action]===row.record.operation.id&&same(release.binding,p.command.binding)&&Number.isSafeInteger(release.expiresAtMs)&&release.expiresAtMs>0);
       fact(same(release.scopes,p.command.scopes)&&same(p.command.scopes,commandScopes(p.command.binding,p.command.action,p.createdAt)));}
     }
     else fact(row.state==='FAILED'?typeof row.outcome?.code==='string':row.outcome===null);break;}
    case 'meri_commands.approval_metadata':{pin(row,'payload');const p=immutablePayload(row.payload),r=p.record;fact(same(r.scopes,commandScopes(r.binding,r.action,r.createdAt)));
     fact(row.proposal_id===r.proposalId&&row.command_id===r.commandId&&row.idempotency_key===r.idempotencyKey&&row.command_sha256===p.commandSha256);break;}
    case 'meri_commands.command_journal':{pin(row,'payload');const p=own(row.payload,['proposal','context']),c=p.proposal?.command;fact(same(c.scopes,commandScopes(c?.binding,c?.action,p.proposal?.createdAt)));
     if(!byRun.has(c.binding.runId)){const kind=taskKind(c.action),context=commandContext(p.context,c.action);kind.assertCommand(c,context);kind.assertProposal(p.proposal,context);}
     fact(row.command_id===c.commandId&&row.idempotency_key===c.idempotencyKey&&row.command_sha256===hash(c)&&row.proposal_sha256===hash(p.proposal)&&['CLAIMED','UNKNOWN','OUTCOME'].includes(row.state)&&
      (row.state==='OUTCOME')===(row.outcome!==null));validateShape('CommandExecutionRequest',row.executor);binding(row.executor.executorBinding,{requireRun:false});
     fact(row.executor.commandSha256===row.command_sha256&&row.executor.proposalId===p.proposal.proposalId&&row.executor.idempotencyKey===c.idempotencyKey&&
      ['tenantId','actorId','conversationId','runId'].every(k=>row.executor.executorBinding[k]===c.binding[k]));break;}
    case 'meri_task_lookup.lookups':{const p=storedBinding(row.payload),run=binding(p.context.binding);exactScopes(p.context.scopes,run);
     fact(row.lookup_id===p.context.lookupId&&row.result_reference===p.context.resultReference&&['CLAIMED','DISPATCHING','RESULT','ERROR'].includes(row.state));
     if(row.state==='RESULT'){const r=retained(row.record);fact(same(r.binding,p));}else fact(row.record===null);lookups.set(row.lookup_id,{row,events:new Set()});break;}
    case 'meri_task_lookup.events':{const p=lookups.get(row.lookup_id);fact(p&&['started','terminal'].includes(row.kind)&&!p.events.has(row.kind));
     const c=p.row.payload.context,slot=c.slots[row.kind];fact(row.run_id===c.binding.runId&&integer(row.sequence)===slot.sequence&&row.event_id===slot.eventId);p.events.add(row.kind);
     if(row.kind==='started')storedEvent(row.event,p.row.payload,'tool.started');
     else if(['CLAIMED','DISPATCHING'].includes(p.row.state))fact(row.event===null);
     else storedEvent(row.event,p.row.payload,p.row.state==='RESULT'?'tool.completed':'run.error');break;}
    default:corrupt();
   }
  }
 }
 for(const p of lookups.values())fact(p.events.size===2);
 // Each content owner above requires its actual run, except original generation
 // facts and typed task/schedule receipts whose initial custody was checked explicitly.
 return data(targets.sort((a,b)=>tuple(a.table,a.key).localeCompare(tuple(b.table,b.key))));
}
