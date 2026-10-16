/** SQL source contract only: no PostgreSQL parser, connection or migration execution. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('0013 defines only the bounded singleton watermark expected by the canonical adapter, with no seed or privileges',()=>{
 const sql=readFileSync(new URL('../../conversations/migrations/0013_retention_recovery_watermark.sql',import.meta.url),'utf8').replace(/--[^\n]*/gu,'');
 assert.match(sql,/^\s*BEGIN;[\s\S]*COMMIT;\s*$/u);assert.equal((sql.match(/CREATE TABLE/gu)??[]).length,1);
 assert.match(sql,/CREATE TABLE meri_conversations\.retention_recovery_watermark\s*\(/u);
 assert.match(sql,/singleton boolean PRIMARY KEY DEFAULT true CHECK \(singleton\)/u);
 assert.match(sql,/sequence bigint NOT NULL CHECK \(sequence BETWEEN 0 AND 9007199254740991\)/u);
 assert.ok(sql.includes("entry_sha256 IS NULL OR entry_sha256 ~ '^[a-f0-9]{64}$'"));
 assert.equal(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|REVOKE|TRUNCATE)\b/iu.test(sql),false);
});
