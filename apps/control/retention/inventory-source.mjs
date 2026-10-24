/** Current conversation purge facts from the canonical snapshot and fixed owners.
 * The caller holds the existing subject transition/recovery lease. No private
 * content is cached across decisions or supplied by an external caller. */
import {fail,hash,subject} from './boundary.mjs';
import {enumerateReferences,classes,externalClasses} from './inventory.mjs';
import {createConversationRetentionInventory} from '../conversations/retention-inventory.mjs';
import {decodeExecutionRow,executionOutcomeSettled,readLegacySettlement} from '../conversations/execution-boundary.mjs';
import {parseRetentionPolicy} from './policy.mjs';

const day=86400000;
export const conversationTrashPolicy=parseRetentionPolicy({policyId:'conversation-trash-30-days',version:1,coolingPeriodMs:30*day,
 classes:Object.fromEntries(classes.map(c=>[c,{retentionMs:30*day,purgeable:!externalClasses.includes(c)&&!['artifactVersions','schedules'].includes(c)}]))});
// Existing canonical object-bearing fields only. No caller supplies SQL or a
// locator. A surviving artifact is independent even when this chat created it.
const references=[
 ['meri_conversations.runs','conversation_id','continuation','continuation_sha256','conversation'],
 ['meri_conversations.controls','conversation_id','projection','projection_sha256','conversation'],
 ['meri_conversations.checkpoints','conversation_id','proof','proof_sha256','conversation'],
 ['meri_conversations.completion_checkpoints','conversation_id','proof','proof_sha256','conversation'],
 ['meri_conversations.selected_outputs','conversation_id','projection','projection_sha256','conversation'],
 ['meri_artifacts.versions','artifact_id','record','record_sha256','artifact'],
];
const matching="jsonb_path_exists(%s, '$.** ? (@.objectId == $id && @.versionId == $version)', $3::jsonb)";
const unavailable=()=>fail('RETENTION_AUTHORITY_UNAVAILABLE');
export function createConversationPurgeFacts({pool,journal,core,storage,keyFor,now=Date.now}){
 if(typeof journal?.withSnapshot!=='function'||typeof core?.read!=='function'||typeof storage?.holdsFor!=='function'||typeof keyFor!=='function')fail('RETENTION_CONFIGURATION');
 const source=createConversationRetentionInventory({pool,withSnapshot:journal.withSnapshot,now});
 // Observations belong to these exact inventory objects. Another concurrent
 // subject/decision cannot replace them, and discarded inventories retain no cache.
 const holds=new WeakMap();
 async function trashFor(raw,options={}){options.check?.();const s=subject(raw);if(s.kind!=='conversation')unavailable();
  const r=await core.read(s,options);options.check?.();if(r.status!=='trashed')unavailable();
  return {requestId:r.trashRequestId,revision:r.revision,trashedAtMs:Date.parse(r.trashedAt),restoreUntilMs:Date.parse(r.restoreUntil),checkedAtMs:r.checkedAtMs};
 }
 async function inventoryFor(raw,options={}){options.check?.();const s=subject(raw);
  const snapshot=await source.inventoryForConversation({tenantId:s.tenantId,conversationId:s.subjectId,ownerActorId:s.ownerActorId},options);
  const inventory=enumerateReferences(snapshot);
  for(const o of inventory.objects){options.check?.();holds.set(o,await storage.holdsFor({key:keyFor(o),versionId:o.versionId},options));}
  return inventory;
 }
 async function sharedFor(raw,inventory,options={}){options.check?.();const s=subject(raw);
  return journal.withSnapshot(async c=>{const shared=[];
   for(const object of inventory.objects){options.check?.();const heldBy=[];
    const vars=JSON.stringify({id:object.objectId,version:object.versionId});
    for(const [table,id,body,pin,kind] of references){
     const sql=`SELECT ${id} AS owner_id,${body} AS body,${pin} AS digest FROM ${table} WHERE tenant_id=$1 `+
      (kind==='conversation'?`AND conversation_id<>$2::uuid `:'AND $2::uuid IS NOT NULL ')+
      `AND ${matching.replace('%s',body)} ORDER BY ${id} LIMIT 1`;
     const result=await c.query(sql,[s.tenantId,s.subjectId,vars]);if(!Array.isArray(result.rows)||result.rows.length>1)unavailable();
     for(const row of result.rows){if(typeof row.owner_id!=='string'||hash(row.body)!==row.digest)unavailable();heldBy.push(`${s.tenantId}:${kind}:${row.owner_id}`);}
    }
    if(heldBy.length)shared.push({object,heldBy:[...new Set(heldBy)].sort(),blocking:[]});
   }
   return shared;
  },options);
 }
 async function liabilities(raw,options={}){options.check?.();const s=subject(raw);
  return journal.withSnapshot(async c=>{
   const runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY run_id LIMIT 4097',[s.tenantId,s.subjectId])).rows;
   if(!Array.isArray(runs)||runs.length>4096)unavailable();const out=[];
   for(const r of runs){options.check?.();const run=r.projection,b=run?.binding;
    if(hash(run)!==r.projection_sha256||b?.tenantId!==s.tenantId||b.conversationId!==s.subjectId||b.actorId!==s.ownerActorId||b.runId!==r.run_id)unavailable();
    const executions=(await c.query('SELECT * FROM meri_conversations.native_executions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[s.tenantId,s.subjectId,r.run_id])).rows;
    if(executions.length>1)unavailable();
    let settled=false;
    if(executions.length)settled=executionOutcomeSettled(decodeExecutionRow(executions[0],b),run.state);
    else if(['failed','cancelled'].includes(run.state)){
     try{await readLegacySettlement(c,b,()=>{});settled=true;}catch{settled=false;}
    }else if(run.state==='completed'){
     try{settled=(await readLegacySettlement(c,b,()=>{}))?.record.state==='RETIRED';}catch{settled=false;}
    }
    if(!settled)out.push({runId:r.run_id,kind:'UNSETTLED_EXECUTION'});
   }
   return out;
  },options);
 }
 return Object.freeze({policy:async()=>conversationTrashPolicy,trashFor,inventoryFor,sharedFor,liabilities,
  lastActivityFor:async (s,options={})=>{options.check?.();const r=await core.read(subject(s),options);if(r.status!=='trashed')unavailable();return Date.parse(r.trashedAt);},
  holds:o=>{const value=holds.get(o);if(!value)unavailable();return value;}});
}
