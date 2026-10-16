/** STATIC SOURCE ONLY: reserved DDL invariants. Does not parse/execute PostgreSQL or establish isolation. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const memory=read('../migrations/0001_memory_candidates.sql'),settings=read('../../settings/migrations/0001_settings.sql');
test('reserved migrations contain only their canonical schemas and no execution, role, seed or public fallback',()=>{
 for(const sql of [memory,settings]){
  assert.match(sql,/RESERVED SOURCE AUTHORING ONLY/u);assert.doesNotMatch(sql,/\bpublic\.|\bCREATE\s+(?:ROLE|EXTENSION)|\bGRANT\s|\bREVOKE\s|\bIF NOT EXISTS\b/iu);
  assert.doesNotMatch(sql,/^\s*(?:INSERT\s+INTO|UPDATE\s+meri_|DELETE\s+FROM)/imu);
 }
 assert.deepEqual([...memory.matchAll(/CREATE TABLE\s+([a-z_.]+)/gu)].map(m=>m[1]),['meri_memory.candidates']);
 assert.deepEqual([...settings.matchAll(/CREATE TABLE\s+([a-z_.]+)/gu)].map(m=>m[1]),['meri_settings.user_preferences','meri_settings.tenant_settings','meri_settings.settings_audit']);
});
test('memory preserves immutable identity/hash custody, unique proposer key and monotone acknowledged review identity',()=>{
 assert.match(memory,/UNIQUE \(tenant_id, proposer_actor_id, idempotency_key\)/u);
 for(const field of ['tenant_id','candidate_id','proposer_actor_id','idempotency_key','request_sha256','candidate','candidate_sha256','scope','client_id','created_at']){assert.ok(memory.includes('NEW.'+field));assert.ok(memory.includes('OLD.'+field));}
 assert.match(memory,/BEFORE UPDATE ON meri_memory\.candidates/u);assert.match(memory,/OLD\.submission_state = 'SUBMITTED'/u);assert.match(memory,/NEW\.review_id IS DISTINCT FROM OLD\.review_id/u);
 assert.match(memory,/\(submission_state = 'SUBMITTED'\) = \(submitted_at IS NOT NULL\)/u);
});
test('settings preserves one document revision, same-transaction audit columns and append-only update guard with retention deletion available',()=>{
 assert.match(settings,/PRIMARY KEY \(tenant_id, actor_id\)/u);assert.match(settings,/to_revision = from_revision \+ 1/u);
 assert.match(settings,/before_sha256/u);assert.match(settings,/after_sha256/u);assert.match(settings,/changed_fields\s+text\[\]/u);
 assert.match(settings,/BEFORE UPDATE ON meri_settings\.settings_audit/u);assert.doesNotMatch(settings,/BEFORE DELETE/iu);
 const proposal=read('../../../../docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql');
 assert.equal(settings.slice(settings.indexOf('CREATE SCHEMA meri_settings;')),proposal.slice(proposal.indexOf('CREATE SCHEMA meri_settings;')),'settings source preserves the reviewed proposal subsection');
});
