/** Supplemental conversation rows from the SAME bounded snapshot as runs/events.
 * Fixed SQL owners only. Targets identify retained bytes; they grant no erasure. */
import {data,hash,same,own,uuid,validateShape,fail} from './boundary.mjs';
import {assertOriginalInputFacts} from './initial-input-facts.mjs';
import {decodeExecutionRow} from './execution-boundary.mjs';
import {immutablePayload} from '../commands/approval-metadata/binding.mjs';
import {storedBinding,retained,storedEvent} from '../task-lookup/binding.mjs';
import {assertNativeConversationScope,assertNativeSessionReference,assertSdkSessionKey,assertSdkSessionResponseHeaders} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {copySessionTranscript,scopedSessionKey} from '../../worker/qualification/checkpoint/bound-session-store.mjs';

const scope='r.tenant_id=$1 AND r.conversation_id=$2';
const table=(name,className,keys,where=scope)=>Object.freeze({name,className,keys:Object.freeze(keys),where});
// Primary-key columns after the subject's tenant/conversation. No caller supplies
// a table, column or predicate. Historical rows remain data, never runtime owners.
export const conversationContentTables=Object.freeze([
 table('meri_conversations.initial_run_bindings','conversation',[['generation','integer']]),
 table('meri_conversations.initial_inputs','conversation',[['run_id','uuid']]),
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
export async function scanConversationContentRows(reader,page){
 const result={};
 for(const t of conversationContentTables){
  const columns=t.keys.map(([name])=>'r.'+name),params=t.keys.map(([,type],i)=>`$${i+3}::${type}`);
  const compare=columns.length===1?`${columns[0]}>${params[0]}`:`(${columns.join(',')})>(${params.join(',')})`;
  result[t.name]=await page(reader,`SELECT r.* FROM ${t.name} r WHERE ${t.where} AND (${params[0]} IS NULL OR ${compare}) ORDER BY ${columns.join(',')} LIMIT 33`,
   row=>t.keys.map(([name])=>row[name]),t.keys.map(()=>null));
 }
 return result;
}

/** Closed content-free row target, also checked by the existing enumerator. */
export function assertConversationContentTarget(raw){
 const v=own(raw,['className','table','key','rowSha256']),t=tables.get(v.table);fact(t&&v.className===t.className&&digest(v.rowSha256));
 own(v.key,t.keys.map(([key])=>key));fact(same(v.key,keyFor(v.key,t)));return v;
}

export function decodeConversationContentRows(raw,{subject,projection},byRun,nativeReferences=[]){
 own(raw,conversationContentTables.map(t=>t.name));
 const targets=[],seen=new Set(),sessions=new Map(),streams=new Map(),lookups=new Map();
 const binding=(value,{requireRun=true}={})=>{validateShape('RunBinding',value);
  fact(value.tenantId===subject.tenantId&&value.conversationId===subject.subjectId&&value.actorId===subject.ownerActorId);
  const run=byRun.get(value.runId);if(requireRun)fact(run&&same(run.projection.binding,value));return run;};
 const runFor=row=>{const run=byRun.get(row.run_id);fact(run);return run;};
 const exactScopes=(value,run)=>fact(same(value,run.projection.scopes));
 for(const t of conversationContentTables){const list=raw[t.name];fact(Array.isArray(list)&&list.length<=4096);
  for(const row of list){fact(row?.tenant_id===subject.tenantId);
   if(Object.hasOwn(row,'conversation_id'))fact(row.conversation_id===subject.subjectId);
   if(Object.hasOwn(row,'actor_id'))fact(row.actor_id===subject.ownerActorId);
   const key=keyFor(row,t),identity=tuple(t.name,key);fact(!seen.has(identity));seen.add(identity);
   // Date-valued pg columns are canonicalized once; no raw body escapes.
   targets.push({className:t.className,table:t.name,key,rowSha256:hash(JSON.parse(JSON.stringify(row)))});
   switch(t.name){
    case 'meri_conversations.initial_run_bindings':{pin(row,'record');const r=row.record;binding(r.binding,{requireRun:false});
     fact(r.binding.runId===row.run_id&&r.binding.writerFence===1&&r.schemaVersion===1&&r.state==='ADMITTED');
     validateShape('RuntimeVersions',r.versions);fact(typeof r.policyRevision==='string'&&r.policyRevision&&digest(r.configurationSha256)&&integer(r.expiresAtMs)>integer(r.createdAtMs));
     assertNativeConversationScope({binding:r.binding,scopes:projection.scopes,selectedClientId:r.selectedClientId});break;}
    case 'meri_conversations.initial_inputs':{pin(row,'allocation');const a=assertOriginalInputFacts(row.allocation),run=binding(a.binding,{requireRun:false});
     fact(a.binding.runId===row.run_id&&a.requestId===row.request_id&&['RESERVED','ACCEPTED'].includes(row.state));
     assertNativeConversationScope({binding:a.binding,scopes:projection.scopes,selectedClientId:a.selectedClientId});
     if(row.state==='ACCEPTED')fact(run&&row.accepted_request_sha256===a.requestSha256&&run.row.request_sha256===a.requestSha256);
     else fact(row.accepted_request_sha256===null&&!run);break;}
    case 'meri_conversations.sdk_sessions':{pin(row,'owner');const o=own(row.owner,['binding','scopes','selectedClientId','policyRevision','key','expiresAtMs'],['executionSha256','allocationSha256','observationId','sessionEventSha256']);
     const r=binding(o.binding),k=assertSdkSessionKey(o.key,{main:true});assertNativeConversationScope(o);exactScopes(o.scopes,r);
     fact(o.binding.runId===row.run_id&&k.sessionId===row.session_id&&k.projectKey===row.project_key&&o.policyRevision===r.projection.policyRevision&&integer(o.expiresAtMs)>0&&
      Object.hasOwn(o,'executionSha256')!==Object.hasOwn(o,'allocationSha256')&&digest(o.executionSha256??o.allocationSha256));
     fact(!sessions.has(row.run_id)&&integer(row.entries_count)<=100000&&integer(row.bytes)<=33554432);
     sessions.set(row.run_id,{row,count:0,bytes:0,streamCount:0});break;}
    case 'meri_conversations.sdk_session_streams':{const s=sessions.get(row.run_id);fact(s&&s.row.session_id===row.session_id);if(row.subpath)scopedSessionKey({...s.row.owner.key,subpath:row.subpath},s.row.owner.key);
     fact(++s.streamCount<=256&&integer(row.last_sequence)<=100000);streams.set(tuple(row.run_id,row.session_id,row.subpath),{row,entries:[],uuids:new Set()});break;}
    case 'meri_conversations.sdk_session_entries':{const s=sessions.get(row.run_id),stream=streams.get(tuple(row.run_id,row.session_id,row.subpath));pin(row,'entry');
     fact(s&&stream&&integer(row.sequence)===stream.entries.length+1&&row.entry_uuid===(row.entry.uuid??null));
     if(row.entry_uuid!==null){fact(typeof row.entry_uuid==='string'&&row.entry_uuid.length>0&&row.entry_uuid.length<=256&&!stream.uuids.has(row.entry_uuid));stream.uuids.add(row.entry_uuid);}
     stream.entries.push(row.entry);s.count++;s.bytes+=Buffer.byteLength(JSON.stringify(row.entry));break;}
    case 'meri_conversations.sdk_session_batches':{pin(row,'receipt');const s=sessions.get(row.run_id),r=row.receipt;fact(s&&s.row.session_id===row.session_id&&digest(row.request_sha256));
     const receipt=assertSdkSessionResponseHeaders('append',r,row.request_sha256,s.row.owner.binding,r.key);scopedSessionKey(receipt.key,s.row.owner.key);
     const stream=streams.get(tuple(row.run_id,row.session_id,r.key.subpath??''));
     fact(stream&&receipt.committed===true&&receipt.appendId===row.append_id&&digest(receipt.entriesSha256)&&integer(receipt.added)<=1000&&integer(receipt.offset)<=integer(stream.row.last_sequence)&&receipt.added<=receipt.offset);break;}
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
    case 'meri_intents.preparations':{pin(row,'record');fact(byRun.size>0&&/^sdk:[a-f0-9]{64}$/u.test(row.delivery_id)&&digest(row.record.argumentsSha256)&&['PENDING','PREPARED','FAILED','UNKNOWN','REDACTED'].includes(row.state));
     own(row.record,['operation','argumentsSha256']);own(row.record.operation,['id','version']);
     fact(/^[a-z][a-z_]{0,62}$/u.test(row.record.operation.id)&&row.record.operation.version==='0.2.0');
     if(row.state==='REDACTED'){fact(row.outcome===null&&row.outcome_purged_at!==null&&row.outcome_purged_at!==undefined&&Number.isFinite(new Date(row.outcome_purged_at).getTime())&&row.settled_at!==null&&row.settled_at!==undefined&&Number.isFinite(new Date(row.settled_at).getTime()));break;}
     fact(row.outcome_purged_at===null);
     if(row.state==='PREPARED'){const r=binding(row.outcome?.release?.binding);exactScopes(row.outcome.release.scopes,r);fact(row.outcome.result&&typeof row.outcome.result==='object');}
     else fact(row.state==='FAILED'?typeof row.outcome?.code==='string':row.outcome===null);break;}
    case 'meri_commands.approval_metadata':{pin(row,'payload');const p=immutablePayload(row.payload),r=p.record,run=binding(r.binding);exactScopes(r.scopes,run);
     fact(row.proposal_id===r.proposalId&&row.command_id===r.commandId&&row.idempotency_key===r.idempotencyKey&&row.command_sha256===p.commandSha256);break;}
    case 'meri_commands.command_journal':{pin(row,'payload');const p=own(row.payload,['proposal','context']),c=p.proposal?.command,run=binding(c?.binding);exactScopes(c.scopes,run);
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
 for(const s of sessions.values())fact(s.count===integer(s.row.entries_count)&&s.bytes===integer(s.row.bytes));
 for(const s of streams.values()){fact(s.entries.length===integer(s.row.last_sequence));copySessionTranscript(s.entries);}
 // Local captures must name an actual retained SDK owner. A fork's source in a
 // different conversation remains that subject's obligation, not this scan's.
 for(const value of nativeReferences){const ref=assertNativeSessionReference(value);
  if(ref.binding.conversationId!==subject.subjectId)continue;
  const s=sessions.get(ref.binding.runId);fact(s&&same(s.row.owner.binding,ref.binding)&&same(s.row.owner.key,ref.key)&&s.row.owner_sha256===ref.ownerSha256&&s.count>=ref.entriesCount);
 }
 for(const p of lookups.values())fact(p.events.size===2);
 // A registered empty conversation has no run-owned content. Reserved original
 // generations remain real facts and do not manufacture a run.
 if(!byRun.size)fact(targets.every(t=>t.table==='meri_conversations.initial_run_bindings'||t.table==='meri_conversations.initial_inputs'));
 return data(targets.sort((a,b)=>tuple(a.table,a.key).localeCompare(tuple(b.table,b.key))));
}
