/** Source checks for centrally reserved conversation migration 0019.
 * These checks do not execute SQL or qualify database roles/installation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../migrations/0019_memory_proposal_contexts.sql',import.meta.url),'utf8');
const rowSource=await readFile(new URL('../../retention/postgres-journal.mjs',import.meta.url),'utf8');
const continuationSource=await readFile(new URL('../memory-proposal-context-journal.mjs',import.meta.url),'utf8');
const table=name=>{
 const match=migration.match(new RegExp(`CREATE TABLE meri_conversations\\.${name} \\(([\\s\\S]*?)\\n\\);`,'u'));
 assert.ok(match,`${name} relation is present`);
 return match[1];
};

test('0019 owns only the continuation row and distinct retention target, without data changes or grants',()=>{
 assert.match(migration,/^BEGIN;$/mu);
 assert.match(migration,/^COMMIT;$/mu);
 assert.deepEqual([...migration.matchAll(/^CREATE TABLE meri_conversations\.([a-z_]+) \(/gmu)].map(row=>row[1]),[
  'memory_proposal_contexts','memory_proposal_retention_targets']);
 assert.doesNotMatch(migration,/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|GRANT|REVOKE)\s/miu);
 assert.doesNotMatch(migration,/CREATE TABLE\s+meri_conversations\.memory_candidate_targets/iu);
});

test('continuation keys, size, expiry, and target columns match the source owners',()=>{
 const rows=table('memory_proposal_contexts'),targets=table('memory_proposal_retention_targets');
 assert.match(rows,/PRIMARY KEY \(tenant_id,conversation_id,run_id,key_sha256\)/u);
 assert.match(rows,/FOREIGN KEY \(tenant_id,conversation_id,run_id\) REFERENCES meri_conversations\.runs/u);
 assert.match(rows,/octet_length\(record::text\) <= 1048576/u);
 assert.match(rows,/expires_at_ms BETWEEN 1 AND 9007199254740991/u);
 assert.match(targets,/workflow_id text PRIMARY KEY/u);
 assert.match(targets,/FOREIGN KEY \(tenant_id,conversation_id\) REFERENCES meri_conversations\.retention_subjects/u);
 for(const column of ['run_id','key_sha256','plan_sha256','state','ledger_sequence'])assert.match(targets,new RegExp(`\\b${column}\\b`,'u'));
 assert.match(migration,/CREATE UNIQUE INDEX memory_proposal_one_planned_target_per_row[\s\S]*?\(tenant_id,conversation_id,run_id,key_sha256\) WHERE state = 'PLANNED'/u);
 assert.match(continuationSource,/INSERT INTO meri_conversations\.memory_proposal_contexts\(tenant_id,conversation_id,run_id,key_sha256,record,record_sha256,expires_at_ms\)/u);
 assert.match(rowSource,/INSERT INTO meri_conversations\.memory_proposal_retention_targets\(workflow_id,tenant_id,conversation_id,run_id,key_sha256,plan_sha256,state,ledger_sequence\)/u);
});

test('only an exact current, same-transaction planned target admits DELETE',()=>{
 const guard=migration.match(/CREATE FUNCTION meri_conversations\.reject_memory_proposal_context_mutation\(\) RETURNS trigger[\s\S]*?END \$\$;/u)?.[0];
 assert.ok(guard);
 assert.match(guard,/IF TG_OP <> 'DELETE' THEN[\s\S]*?RAISE EXCEPTION 'MEMORY_PROPOSAL_CONTEXT_IMMUTABLE'/u);
 for(const key of ['tenant_id','conversation_id','run_id','key_sha256'])assert.match(guard,new RegExp(`t\\.${key} = OLD\\.${key}`,'u'));
 assert.match(guard,/t\.state = 'PLANNED' AND t\.xmin = pg_current_xact_id\(\)::xid/u);
 assert.match(guard,/s\.state = 'SUPPRESSED'/u);
 assert.match(guard,/s\.projection#>>'\{purge,planSha256\}' = t\.plan_sha256/u);
 assert.match(guard,/s\.projection#>>'\{purge,ledgerSequence\}' = t\.ledger_sequence::text/u);
 assert.match(migration,/BEFORE UPDATE OR DELETE ON meri_conversations\.memory_proposal_contexts/u);
 assert.match(migration,/BEFORE TRUNCATE ON meri_conversations\.memory_proposal_contexts/u);
 assert.match(rowSource,/DELETE FROM \$\{w\.table\} WHERE \$\{w\.where\}/u);
});
