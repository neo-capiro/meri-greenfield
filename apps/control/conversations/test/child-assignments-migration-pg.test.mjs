/** Native 0030 protocol harness — NOT run by the scripted fixture family and never by CI without the explicit
 * isolated-disposable attestation. It proves only what a real server can prove about 0030's own text:
 *   - the two child custody columns, the run_child_assignments_consistent CHECK and the UPDATE grant exist;
 *   - the append-only trigger refuses a rewritten prefix, a second assignment for one tool-use identity, a receipt whose
 *     revision.requestSha256 is not the row's request_sha256, a result before its assignment, and a second result;
 *   - the run tombstone path stays gated on the real expired-conversation purge target (CONVERSATION_PURGE_TARGET_REQUIRED).
 * The retention-PERMITTED erasure branch (retentionTombstone marker + both child columns NULL + a committed expired target)
 * needs the parent's expired-target fixture and is NOT proven here; this file never claims it. It also does not prove that a
 * deployed worker reaches the child routes end to end. No implicit skip: without the attestation it throws.
 * Environment (all optional except the attestation):
 *   MERI_CHILD_PG_ATTEST=isolated-disposable
 *   MERI_CHILD_PG_SOCKET | MERI_INSPECTION_TEST_SOCKET      Unix socket directory of the disposable cluster
 *   MERI_CHILD_PG_DATABASE | MERI_INSPECTION_TEST_DATABASE   database already holding 0001..0029
 *   MERI_CHILD_PG_USER (default postgres)
 * The base schema must already contain meri_conversations.runs from 0001..0029; 0030 is applied here only when its
 * columns are absent. Re-running against an already-migrated database is supported. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';

const attest=process.env.MERI_CHILD_PG_ATTEST;
const socket=process.env.MERI_CHILD_PG_SOCKET??process.env.MERI_INSPECTION_TEST_SOCKET;
const database=process.env.MERI_CHILD_PG_DATABASE??process.env.MERI_INSPECTION_TEST_DATABASE;
const user=process.env.MERI_CHILD_PG_USER??'postgres';
// The attestation is evaluated before the driver is imported, so a misconfigured run refuses here instead of skipping.
if(attest!=='isolated-disposable'||!socket||!database)
 throw Error('CHILD_ASSIGNMENTS_PG_ATTESTATION_REQUIRED');
const {default:pg}=await import('pg');
const sql=new URL('../migrations/0030_child_assignments.sql',import.meta.url);
const tenant='tenant-child-pg',conversation=randomUUID(),run=randomUUID(),requestId=randomUUID();
const revision={requestSha256:hash({requestId,runId:run}),steer:null};
const assignmentId=randomUUID();
const assignment={kind:'assignment',assignmentId,toolUseId:'toolu_pg_1',role:'research',inputSha256:'a'.repeat(64),
 narrowing:{tools:['Read'],maxTurns:8,disallowedTools:['Bash']},revision,dispatchedAtMs:1700000000000};
const result={kind:'result',assignmentId,toolUseId:'toolu_pg_1',outcome:'completed',resultSha256:'b'.repeat(64),resultBytes:12,
 custody:{sessionId:null,agentId:null},revision,settledAtMs:1700000000001};
const projection={binding:{tenantId:tenant,conversationId:conversation,runId:run},state:'running'};
const row={tenant_id:tenant,conversation_id:conversation,run_id:run,request_id:requestId,projection,
 projection_sha256:hash(projection),request:{requestId,runId:run},request_sha256:revision.requestSha256,last_sequence:1};

/** The refusal a trigger raises is a PostgreSQL error carrying the owned code as its message. */
const refuses=async(client,code,fn)=>{const e=await fn().then(()=>null,error=>error);assert.ok(e,`expected the server to refuse ${code}`);assert.match(String(e.message),new RegExp(code));};
const set=async(client,receipts,sha=hash(receipts))=>client.query('UPDATE meri_conversations.runs SET child_assignments=$1::jsonb,child_assignments_sha256=$2 WHERE tenant_id=$3 AND conversation_id=$4 AND run_id=$5',[receipts,sha,tenant,conversation,run]);
const read=async client=>(await client.query('SELECT child_assignments,child_assignments_sha256 FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[tenant,conversation,run])).rows[0];

test('0030 installs the child custody columns, CHECK, grant and append-only trigger on the existing run row',async t=>{
 const client=new pg.Client({host:socket,database,user});await client.connect();
 t.after(async()=>{try{await client.query('DELETE FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2',[tenant,conversation]);}finally{await client.end();}});
 const columns=await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='meri_conversations' AND table_name='runs' AND column_name IN ('child_assignments','child_assignments_sha256') ORDER BY column_name");
 const names=columns.rows.map(r=>r.column_name);
 if(names.length===0)await client.query(await readFile(sql,'utf8'));
 else assert.deepEqual(names,['child_assignments','child_assignments_sha256'],'0030 columns exist');
 const check=await client.query("SELECT conname FROM pg_constraint WHERE conrelid='meri_conversations.runs'::regclass AND conname='run_child_assignments_consistent'");
 assert.equal(check.rowCount,1,'the child custody CHECK is installed');
 const trigger=await client.query("SELECT tgname FROM pg_trigger WHERE tgrelid='meri_conversations.runs'::regclass AND tgname='run_child_assignments' AND NOT tgisinternal");
 assert.equal(trigger.rowCount,1,'the append-only trigger is installed');
 const grant=await client.query("SELECT has_column_privilege('meri_control_runtime','meri_conversations.runs','child_assignments','UPDATE') AS ok");
 assert.equal(grant.rows[0].ok,true,'the control runtime may append child custody on the run row');
});

test('the append-only guard accepts one assignment and one bound result, and refuses every rewrite or duplicate',async t=>{
 const client=new pg.Client({host:socket,database,user});await client.connect();
 t.after(async()=>{try{await client.query('DELETE FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2',[tenant,conversation]);}finally{await client.end();}});
 await client.query('DELETE FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2',[tenant,conversation]);
 await client.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,request_id,projection,projection_sha256,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9)',
  [row.tenant_id,row.conversation_id,row.run_id,row.request_id,row.projection,row.projection_sha256,row.request,row.request_sha256,row.last_sequence]);
 await set(client,[assignment]);
 let stored=await read(client);assert.equal(stored.child_assignments.length,1,'the assignment append committed');
 assert.equal(stored.child_assignments_sha256,hash(stored.child_assignments),'the digest covers the persisted receipts');
 // A re-issued SDK call must read the persisted assignment, never append a second child for the same tool-use identity.
 await refuses(client,'CHILD_ASSIGNMENT_APPEND_REFUSED|CHILD_ASSIGNMENT_RECEIPT_REFUSED',()=>set(client,[assignment,assignment]));
 // A rewritten prefix is refused even when the new array is longer.
 await refuses(client,'CHILD_ASSIGNMENT_APPEND_REFUSED',()=>set(client,[{...assignment,role:'rewritten'},result]));
 // A receipt whose persisted goal revision is not the row's own request revision is refused.
 await refuses(client,'CHILD_ASSIGNMENT_RECEIPT_REFUSED',()=>set(client,[assignment,{...result,revision:{requestSha256:'c'.repeat(64),steer:null}}]));
 // A result before its assignment is refused.
 await refuses(client,'CHILD_ASSIGNMENT_RECEIPT_REFUSED',()=>set(client,[result]));
 await set(client,[assignment,result]);
 stored=await read(client);assert.equal(stored.child_assignments.length,2,'the result append committed once');
 assert.deepEqual(stored.child_assignments[1].custody,{sessionId:null,agentId:null});
 // The result receipt is written once.
 await refuses(client,'CHILD_ASSIGNMENT_APPEND_REFUSED|CHILD_ASSIGNMENT_RECEIPT_REFUSED',()=>set(client,[assignment,result,{...result,settledAtMs:1700000000002}]));
});

test('a run tombstone stays gated on the real expired purge target and cannot erase live child custody',async t=>{
 const client=new pg.Client({host:socket,database,user});await client.connect();
 t.after(async()=>{try{await client.query('DELETE FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2',[tenant,conversation]);}finally{await client.end();}});
 const marker={retentionTombstone:true,conversationId:conversation};
 // No committed expired target exists for this synthetic row, so the retention path cannot open.
 await refuses(client,'CONVERSATION_PURGE_TARGET_REQUIRED',()=>client.query('UPDATE meri_conversations.runs SET request=$1::jsonb WHERE tenant_id=$2 AND conversation_id=$3 AND run_id=$4',[marker,tenant,conversation,run]));
 const stored=await read(client);assert.equal(stored.child_assignments.length,2,'the refused tombstone left the child custody receipts intact');
});
