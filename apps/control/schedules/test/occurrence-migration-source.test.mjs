/** STATIC source witnesses only: no SQL parser, database, migration execution, Temporal or worker registration. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../migrations/0002_occurrences.sql',import.meta.url),'utf8');
const owner=readFileSync(new URL('../postgres-schedule-owner.mjs',import.meta.url),'utf8');
test('allocated occurrence source covers the canonical open/settle owner columns and retains parent ownership',()=>{
 const columns=/INSERT INTO meri_schedules\.occurrences\(([^)]+)\)/u.exec(owner)[1].split(',');
 for(const name of columns)assert.match(sql,new RegExp(`\\b${name}\\s+(?:text|uuid|bigint|jsonb)\\s+NOT NULL`,'u'),name);
 assert.match(sql,/updated_at timestamptz NOT NULL DEFAULT clock_timestamp\(\)/u);
 assert.match(sql,/PRIMARY KEY \(tenant_id, occurrence_key\)/u);
 assert.match(sql,/FOREIGN KEY \(tenant_id, schedule_id\) REFERENCES meri_schedules\.projections\(tenant_id, schedule_id\)/u);
 assert.doesNotMatch(sql,/ON DELETE CASCADE|DROP\s|TRUNCATE\s/iu);
});
test('OPEN partial uniqueness blocks across generations and source never expires or reopens uncertainty',()=>{
 assert.match(sql,/CREATE UNIQUE INDEX occurrences_one_open ON meri_schedules\.occurrences\(tenant_id, schedule_id\) WHERE state = 'OPEN'/u);
 assert.match(sql,/state text NOT NULL CHECK \(state IN \('OPEN','DISPATCHED','REFUSED'\)\)/u);
 assert.match(sql,/generation bigint NOT NULL CHECK \(generation >= 1\)/u);
 assert.equal((sql.match(/\^\[a-f0-9\]\{64\}\$/gu)??[]).length,2,'occurrence and effect digests remain constrained');
 assert.doesNotMatch(sql,/expires_at|DELETE FROM|UPDATE meri_schedules/iu);
 assert.match(sql,/\nBEGIN;[\s\S]*\nCOMMIT;\s*$/u);
});
