/** Complete SDK retention commitments. Reads use the caller's existing snapshot
 * or locked purge transaction; this module never grants authority or mutates SQL. */
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {data,hash,same,own,uuid,validateShape,fail} from './boundary.mjs';
import {assertNativeConversationScope,assertNativeSessionReference,assertSdkSessionKey,assertSdkSessionResponseHeaders} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {copySessionEntries,scopedSessionKey} from '../../worker/qualification/checkpoint/bound-session-store.mjs';

const prefix='meri_conversations.',MAX_ENTRIES=100000,MAX_BYTES=33554432,MAX_SESSIONS=4096;
export const SDK_RETENTION_PAGE_ROWS=1000,SDK_RETENTION_PAGE_BYTES=16*1024*1024;
const definition=(name,keys)=>Object.freeze({name:prefix+name,keys:Object.freeze(keys)});
export const sdkRetentionTables=Object.freeze([
 definition('sdk_sessions',[['run_id','uuid'],['session_id','uuid']]),
 definition('sdk_session_streams',[['run_id','uuid'],['session_id','uuid'],['subpath','text']]),
 definition('sdk_session_entries',[['run_id','uuid'],['session_id','uuid'],['subpath','text'],['sequence','bigint']]),
 definition('sdk_session_batches',[['run_id','uuid'],['session_id','uuid'],['append_id','uuid']]),
]);
const [HEAD,STREAM,ENTRY,BATCH]=sdkRetentionTables;
// Complete scan results are local, short-lived values, never a wire assertion a
// caller can fabricate in place of reading the SDK tables.
const completeScans=new WeakSet();
const completed=(headers,targets)=>{const result=Object.freeze({headers:data(headers.map(json)),targets:data(targets)});completeScans.add(result);return result;};
const corrupt=()=>fail('STORE_CORRUPT'),fact=value=>{if(!value)corrupt();};
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const integer=value=>{fact(typeof value==='number'||typeof value==='string'&&/^(0|[1-9][0-9]*)$/u.test(value));const n=Number(value);fact(Number.isSafeInteger(n)&&n>=0);return n;};
const pin=(row,field)=>fact(row[field]!=null&&digest(row[field+'_sha256'])&&hash(row[field])===row[field+'_sha256']);
const subjectId=s=>{const id=s.subjectId??s.conversationId;uuid(id);fact(typeof s.tenantId==='string'&&s.tenantId.length>0);return id;};
const tuple=(row,s)=>fact(row?.tenant_id===s.tenantId&&row.conversation_id===subjectId(s));
const json=row=>JSON.parse(JSON.stringify(row));
const keyFor=(row,t)=>Object.fromEntries(t.keys.map(([key,type])=>{let value=row[key];
 if(type==='uuid')uuid(value);else if(type==='text')fact(typeof value==='string'&&value.length<=1024);else{value=integer(value);fact(value>0);}return [key,value];}));
const rowTarget=(row,t)=>({className:'sdkSession',table:t.name,key:keyFor(row,t),rowSha256:hash(json(row))});
const compare=(a,b,t)=>{for(const [key,type] of t.keys){const x=a[key],y=b[key];if(x===y)continue;const n=type==='bigint'?integer(x)-integer(y):type==='uuid'?(x<y?-1:1):Buffer.compare(Buffer.from(x),Buffer.from(y));if(n)return n;}return 0;};

/** Existing header row hash is preserved; sdk commits every exact child row. */
export function assertSdkRetentionTarget(raw){
 const t=own(raw,['className','table','key','rowSha256','sdk']);fact(t.className==='sdkSession'&&t.table===HEAD.name&&digest(t.rowSha256));
 own(t.key,['run_id','session_id']);uuid(t.key.run_id);uuid(t.key.session_id);
 const s=own(t.sdk,['ownerSha256','entriesCount','entryBytes','counts','rowsSha256']),c=own(s.counts,['sessions','streams','entries','batches']);
 fact(digest(s.ownerSha256)&&digest(s.rowsSha256)&&c.sessions===1);
 for(const n of [s.entriesCount,s.entryBytes,...Object.values(c)])fact(typeof n==='number'&&Number.isSafeInteger(n)&&n>=0);
 fact(s.entriesCount<=MAX_ENTRIES&&s.entryBytes<=MAX_BYTES&&c.streams<=256&&c.entries===s.entriesCount);
 return t;
}

function accumulator(header,subject){
 tuple(header,subject);pin(header,'owner');const owner=own(header.owner,['binding','scopes','selectedClientId','policyRevision','key','expiresAtMs'],['executionSha256','allocationSha256','observationId','sessionEventSha256']);
 validateShape('RunBinding',owner.binding);assertNativeConversationScope(owner);const key=assertSdkSessionKey(owner.key,{main:true});
 fact(owner.binding.tenantId===subject.tenantId&&owner.binding.conversationId===subjectId(subject)&&
  (subject.ownerActorId===undefined||owner.binding.actorId===subject.ownerActorId)&&owner.binding.runId===header.run_id&&key.sessionId===header.session_id&&key.projectKey===header.project_key&&
  typeof owner.policyRevision==='string'&&owner.policyRevision.length>0&&integer(owner.expiresAtMs)>0&&
  Object.hasOwn(owner,'executionSha256')!==Object.hasOwn(owner,'allocationSha256')&&digest(owner.executionSha256??owner.allocationSha256)&&integer(header.entries_count)<=MAX_ENTRIES&&integer(header.bytes)<=MAX_BYTES);
 const root=rowTarget(header,HEAD),commit=createHash('sha256').update('meri-sdk-retention-rows/1\n'),streams=new Map();
 const counts={sessions:1,streams:0,entries:0,batches:0};let bytes=0,lastEntryPath=null,uuids=new Set();
 const add=t=>commit.update(canonicalize([t.table,t.key,t.rowSha256])+'\n');add(root);
 function accept(row,t){tuple(row,subject);fact(row.run_id===header.run_id&&row.session_id===header.session_id);const target=rowTarget(row,t);add(target);
  if(t===STREAM){fact(!streams.has(row.subpath)&&++counts.streams<=256);if(row.subpath)scopedSessionKey({...key,subpath:row.subpath},key);
   const total=integer(row.last_sequence);fact(total<=MAX_ENTRIES);streams.set(row.subpath,{total,count:0,bytes:2,target});
  }else if(t===ENTRY){pin(row,'entry');const stream=streams.get(row.subpath);fact(stream&&integer(row.sequence)===stream.count+1&&row.entry_uuid===(row.entry.uuid??null));
   if(lastEntryPath!==row.subpath){uuids=new Set();lastEntryPath=row.subpath;}
   if(row.entry_uuid!==null){fact(typeof row.entry_uuid==='string'&&row.entry_uuid.length>0&&row.entry_uuid.length<=256&&!uuids.has(row.entry_uuid));uuids.add(row.entry_uuid);}
   copySessionEntries([row.entry]);const size=Buffer.byteLength(JSON.stringify(row.entry));stream.bytes+=size+(stream.count?1:0);stream.count++;bytes+=size;counts.entries++;
   fact(counts.entries<=MAX_ENTRIES&&bytes<=MAX_BYTES&&stream.bytes<=MAX_BYTES);
  }else if(t===BATCH){pin(row,'receipt');fact(digest(row.request_sha256));const r=assertSdkSessionResponseHeaders('append',row.receipt,row.request_sha256,owner.binding,row.receipt.key);
   scopedSessionKey(r.key,key);const stream=streams.get(r.key.subpath??'');fact(stream&&r.committed===true&&r.appendId===row.append_id&&digest(r.entriesSha256)&&integer(r.added)<=1000&&integer(r.offset)<=stream.total&&r.added<=r.offset);
   counts.batches++;fact(Number.isSafeInteger(counts.batches));
  }else corrupt();return target;
 }
 function finish(){for(const stream of streams.values())fact(stream.count===stream.total);
  fact(counts.entries===integer(header.entries_count)&&bytes===integer(header.bytes));
  return data({...root,sdk:{ownerSha256:header.owner_sha256,entriesCount:counts.entries,entryBytes:bytes,counts,rowsSha256:commit.digest('hex')}});
 }
 return {accept,finish,root,streams};
}

/** The pure decoder and the SQL scanner use the same row validation/commitment. */
export function summarizeSdkRetentionRows(raw,subject){
 for(const t of sdkRetentionTables)fact(Array.isArray(raw[t.name]));fact(raw[HEAD.name].length<=MAX_SESSIONS);
 const headers=raw[HEAD.name].slice().sort((a,b)=>compare(a,b,HEAD)),owners=new Map(),targets=[];
 for(const h of headers){const k=JSON.stringify([h.run_id,h.session_id]);fact(!owners.has(k));owners.set(k,accumulator(h,subject));}
 for(const t of [STREAM,ENTRY,BATCH]){let previous=null;for(const row of raw[t.name].slice().sort((a,b)=>compare(a,b,t))){if(previous)fact(compare(previous,row,t)<0);previous=row;
   const a=owners.get(JSON.stringify([row.run_id,row.session_id]));fact(a);a.accept(row,t);}}
 for(const a of owners.values())targets.push(a.finish());return completed(headers,targets);
}

export function validateSdkRetentionInventory(scan,{owner,byRun,nativeReferences=[]}){
 fact(completeScans.has(scan));
 own(scan,['headers','targets']);fact(Array.isArray(scan.headers)&&Array.isArray(scan.targets)&&scan.headers.length===scan.targets.length&&scan.headers.length<=MAX_SESSIONS);
 const sessions=new Map();
 for(let i=0;i<scan.headers.length;i++){const h=scan.headers[i],t=assertSdkRetentionTarget(scan.targets[i]),o=h.owner,r=byRun.get(h.run_id);tuple(h,owner.subject);pin(h,'owner');
  fact(r&&!sessions.has(h.run_id)&&same(rowTarget(h,HEAD),{className:t.className,table:t.table,key:t.key,rowSha256:t.rowSha256})&&
   same(o.binding,r.projection.binding)&&same(o.scopes,r.projection.scopes)&&o.policyRevision===r.projection.policyRevision&&o.binding.actorId===owner.subject.ownerActorId&&
   h.owner_sha256===t.sdk.ownerSha256&&integer(h.entries_count)===t.sdk.entriesCount&&integer(h.bytes)===t.sdk.entryBytes);sessions.set(h.run_id,{h,t});
 }
 for(const value of nativeReferences){const ref=assertNativeSessionReference(value);if(ref.binding.conversationId!==owner.subject.subjectId)continue;const s=sessions.get(ref.binding.runId);
  fact(s&&same(s.h.owner.binding,ref.binding)&&same(s.h.owner.key,ref.key)&&s.h.owner_sha256===ref.ownerSha256&&s.t.sdk.entriesCount>=ref.entriesCount);}
 return scan.targets;
}

// Keys and row sizes are fetched first. A corrupt oversized row is never loaded;
// raw SDK payload working memory is capped independently of the transcript size.
async function pages(reader,t,subject,{session,check=()=>{},lock=false}={},visit){
 const base='r.tenant_id=$1 AND r.conversation_id=$2'+(session?' AND r.run_id=$3::uuid AND r.session_id=$4::uuid':''),args=[subject.tenantId,subjectId(subject),...(session?[session.run_id,session.session_id]:[])];
 const columns=t.keys.map(([k,type])=>`r.${k}`+(type==='text'?' COLLATE "C"':''));
 const params=offset=>t.keys.map(([,type],i)=>`$${offset+i+1}::${type}`+(type==='text'?' COLLATE "C"':''));
 const expression=(a,op,b)=>`(${a.join(',')})${op}(${b.join(',')})`;let cursor=null;
 for(;;){check();const lower=cursor?` AND ${expression(columns,'>',params(args.length))}`:'',lowerArgs=[...args,...(cursor??[])];
  const metadata=(await reader.query(`SELECT ${t.keys.map(([k])=>'r.'+k).join(',')},octet_length(row_to_json(r)::text)::bigint AS retention_row_bytes FROM ${t.name} r WHERE ${base}${lower} ORDER BY ${columns.join(',')} LIMIT ${SDK_RETENTION_PAGE_ROWS+1}${lock?' FOR UPDATE OF r':''}`,lowerArgs)).rows;check();
  fact(Array.isArray(metadata)&&metadata.length<=SDK_RETENTION_PAGE_ROWS+1);if(!metadata.length)break;
  const selected=[];let size=0,previous=cursor?Object.fromEntries(t.keys.map(([k],i)=>[k,cursor[i]])):null;
  for(const row of metadata){keyFor(row,t);if(previous)fact(compare(previous,row,t)<0);previous=row;const n=integer(row.retention_row_bytes);fact(n>0&&n<=SDK_RETENTION_PAGE_BYTES);
   if(selected.length===SDK_RETENTION_PAGE_ROWS||size+n>SDK_RETENTION_PAGE_BYTES)break;selected.push(row);size+=n;}
  fact(selected.length>0);const upper=selected.at(-1),upperArgs=t.keys.map(([k])=>upper[k]);
  const result=(await reader.query(`SELECT r.* FROM ${t.name} r WHERE ${base}${lower} AND ${expression(columns,'<=',params(lowerArgs.length))} ORDER BY ${columns.join(',')} LIMIT ${SDK_RETENTION_PAGE_ROWS+1}`, [...lowerArgs,...upperArgs])).rows;check();
  fact(Array.isArray(result)&&result.length===selected.length);let actualBytes=0;
  for(let i=0;i<result.length;i++){fact(compare(result[i],selected[i],t)===0);actualBytes+=Buffer.byteLength(JSON.stringify(result[i]));}
  fact(actualBytes<=SDK_RETENTION_PAGE_BYTES);await visit(result);check();cursor=upperArgs;
  if(selected.length===metadata.length&&metadata.length<=SDK_RETENTION_PAGE_ROWS)break;
 }
}

async function sessionScan(reader,{subject,header,check=()=>{},lock=false,visit}){
 const a=accumulator(header,subject),session={run_id:header.run_id,session_id:header.session_id},streamTargets=[];
 await pages(reader,STREAM,subject,{session,check,lock},rows=>{for(const row of rows)streamTargets.push(a.accept(row,STREAM));});
 for(const t of [ENTRY,BATCH])await pages(reader,t,subject,{session,check},async rows=>{const targets=[];for(const row of rows){check();targets.push(a.accept(row,t));}if(visit)await visit(targets);});
 const result=a.finish();if(visit){if(streamTargets.length)await visit(streamTargets);await visit([a.root]);}check();return result;
}

/** Complete discovery includes children whose owner is absent; absence is never
 * inferred merely from an empty header query. */
export async function scanSdkRetentionInventory(reader,{subject,check=()=>{}}){
 const headers=[],targets=[];let headerBytes=0;
 await pages(reader,HEAD,subject,{check},rows=>{for(const row of rows){headers.push(row);headerBytes+=Buffer.byteLength(JSON.stringify(row));fact(headers.length<=MAX_SESSIONS&&headerBytes<=SDK_RETENTION_PAGE_BYTES);}});
 for(const t of [STREAM,ENTRY,BATCH]){check();const parent=t===ENTRY?STREAM:HEAD;
  const match=parent.keys.map(([k])=>`p.${k}=r.${k}`).join(' AND ');
  const rows=(await reader.query(`SELECT 1 AS orphan FROM ${t.name} r WHERE r.tenant_id=$1 AND r.conversation_id=$2 AND NOT EXISTS (SELECT 1 FROM ${parent.name} p WHERE p.tenant_id=r.tenant_id AND p.conversation_id=r.conversation_id AND ${match}) LIMIT 1`,[subject.tenantId,subjectId(subject)])).rows;check();fact(Array.isArray(rows)&&rows.length===0);}
 for(const header of headers)targets.push(await sessionScan(reader,{subject,header,check}));return completed(headers,targets);
}

async function targetScan(reader,{subject,target,check=()=>{},lock=false},visit){
 const expected=assertSdkRetentionTarget(target),headers=[];
 await pages(reader,HEAD,subject,{session:expected.key,check,lock},rows=>headers.push(...rows));fact(headers.length===1);
 const actual=await sessionScan(reader,{subject,header:headers[0],check,lock,visit});fact(same(actual,expected));return actual;
}
export const verifySdkRetentionTarget=(reader,options)=>targetScan(reader,options);
/** Caller must already have verified/locked this target and hold the same atomic
 * transaction. A callback or final commitment failure requires its rollback. */
export const forEachSdkRetentionTargetPage=(reader,options,visit)=>{fact(typeof visit==='function');return targetScan(reader,options,visit);};
export async function sdkRetentionTargetPresent(reader,{subject,target,check=()=>{}}){
 const t=assertSdkRetentionTarget(target),args=[subject.tenantId,subjectId(subject),t.key.run_id,t.key.session_id];
 for(const table of sdkRetentionTables){check();const rows=(await reader.query(`SELECT 1 AS present FROM ${table.name} r WHERE r.tenant_id=$1 AND r.conversation_id=$2 AND r.run_id=$3::uuid AND r.session_id=$4::uuid LIMIT 1`,args)).rows;check();fact(Array.isArray(rows)&&rows.length<=1);if(rows.length)return true;}return false;
}
