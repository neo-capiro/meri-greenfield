/** Static source checks of the objective-source migration family with the Stage 1 runner's own parser. They do not execute
 * SQL; PostgreSQL syntax, triggers, roles and concurrency of 0002/0003 remain unqualified. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrationBody,splitStatements} from '../../../infra/product-preview/first-chat-migrate.mjs';

const read=name=>readFileSync(new URL('./migrations/'+name,import.meta.url));
// Proposed plan pins (report: first-chat-migrate.mjs 'integration' stage, after 0001_objective_custody.sql).
const PINS={'0002_objective_run_starts.sql':'659b5b400d3fe85ed122fbf75653cd5f7c60e5f2c99f055af90304f9fd1e8598',
 '0003_objective_reader_replays.sql':'13241e96f5294dffc3e616ef0163bd7eaee5c2e5f6030fd7ca05244314b89286'};

for(const [name,pin] of Object.entries(PINS))test(`${name} is CREATE-only inside meri_objective_source, one transaction, pinned`,()=>{
 const bytes=read(name),text=bytes.toString('utf8');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),pin);
 const statements=splitStatements(migrationBody(text)).map(s=>s.text);
 assert.equal(statements.length,4);
 for(const s of statements)assert.match(s,/^CREATE (TABLE|FUNCTION|TRIGGER) /u);
 assert.doesNotMatch(text,/\b(ALTER|DROP|GRANT|REVOKE|SECURITY DEFINER|CREATE (ROLE|SCHEMA|EXTENSION|INDEX)|INSERT INTO|DELETE FROM|UPDATE meri)\b/u);
 assert.match(statements[0],/^CREATE TABLE meri_objective_source\.[a-z_]+ \(/u);
 assert.match(statements[1],/^CREATE FUNCTION meri_objective_source\.[a-z_]+\(\) RETURNS trigger\s+LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS/u);
 assert.match(statements[2],/BEFORE (INSERT OR )?UPDATE OR DELETE ON meri_objective_source\./u);assert.match(statements[3],/BEFORE TRUNCATE ON meri_objective_source\./u);
 assert.doesNotMatch(text,/REFERENCES meri_conversations/u,'no foreign key into the conversation family');
});

test('0002 binds the run start to writer fence 1, one job and one run; 0003 keys replays by (issuer, subject, jti)',()=>{
 const runStarts=read('0002_objective_run_starts.sql').toString('utf8'),replays=read('0003_objective_reader_replays.sql').toString('utf8');
 assert.match(runStarts,/generation_job_id uuid PRIMARY KEY/u);assert.match(runStarts,/issuance_key text NOT NULL UNIQUE/u);
 assert.match(runStarts,/UNIQUE \(tenant_id, conversation_id, run_id\)/u);assert.match(runStarts,/binding->'writerFence' = '1'::jsonb/u);
 assert.match(runStarts,/RAISE EXCEPTION 'OBJECTIVE_RUN_START_IMMUTABLE'/u);
 assert.match(replays,/PRIMARY KEY \(issuer, subject, token_id\)/u);assert.match(replays,/OBJECTIVE_READER_REPLAY_TRANSITION/u);
});
