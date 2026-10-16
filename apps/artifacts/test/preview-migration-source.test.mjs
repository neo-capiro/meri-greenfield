/** SQL source assertions only. No SQL parser, PostgreSQL, migration execution or deployed durability claim. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const raw=readFileSync(new URL('../migrations/0003_previews.sql',import.meta.url),'utf8');
const sql=raw.replace(/--[^\n]*/gu,'');
const table=name=>sql.split(`CREATE TABLE meri_artifacts.${name} (`)[1]?.split('\n);')[0]??'';

test('source-only: both preview owners retain exact tenant/conversation/artifact/source foreign keys without purge or privileges',()=>{
 assert.match(sql,/^\s*BEGIN;[\s\S]*COMMIT;\s*$/u);assert.equal((sql.match(/CREATE TABLE/gu)??[]).length,2);
 assert.match(sql,/UNIQUE \(tenant_id, conversation_id, artifact_id, version_id\)/u);
 for(const name of ['preview_attempts','previews'])assert.match(table(name),/FOREIGN KEY \(tenant_id, conversation_id, artifact_id, version_id\)\s+REFERENCES meri_artifacts\.versions \(tenant_id, conversation_id, artifact_id, version_id\)/u);
 assert.equal(/\b(GRANT|REVOKE|DROP|TRUNCATE|CASCADE|SECURITY DEFINER)\b/iu.test(sql),false);
 assert.equal(/\b(DELETE FROM|UPDATE meri_artifacts|INSERT INTO)\b/iu.test(sql),false,'migration neither mutates historical data nor starts effects');
 assert.ok(raw.includes('record_sha256 hashes the storage envelope, NOT the canonical ArtifactVersion'));
});

test('source-only: original claim identity is immutable, physical custody is null-to-one and publication requires the exact retained object',()=>{
 const attempts=table('preview_attempts'),previews=table('previews');
 assert.match(attempts,/PRIMARY KEY \(tenant_id, version_id\)/u);assert.match(attempts,/UNIQUE \(tenant_id, object_id\)/u);
 assert.ok(attempts.includes('(object_reference IS NULL) = (object_reference_sha256 IS NULL)'));
 assert.ok(attempts.includes('(object_reference IS NULL) = (object_version_id IS NULL)'));
 assert.ok(attempts.includes("((object_reference ->> 'sha256') ~ '^[a-f0-9]{64}$') IS TRUE"),'missing digest must refuse rather than pass a nullable CHECK');
 for(const field of ['sourceVersionSha256','sourceSha256','objectId','previewId'])assert.ok(attempts.includes(`claim ->> '${field}'`));
 assert.match(previews,/object_reference_sha256 text NOT NULL/u);
 assert.match(previews,/FOREIGN KEY \(tenant_id, version_id, preview_id, claim_sha256, object_reference_sha256\)\s+REFERENCES meri_artifacts\.preview_attempts/u);
 assert.ok(sql.includes("to_jsonb(NEW) - 'object_reference' - 'object_reference_sha256' - 'object_version_id'"));
 assert.ok(sql.includes('OLD.object_reference IS NOT NULL AND'));assert.ok(sql.includes('MERI_PREVIEW_CLAIM_IMMUTABLE'));
 assert.ok(sql.includes("attempt.object_reference IS DISTINCT FROM (NEW.record #> '{preview,object}')"));
 assert.ok(sql.includes("IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'MERI_PREVIEW_RECORD_IMMUTABLE'"));
 assert.ok(sql.includes('MERI_PREVIEW_RETENTION_UNALLOCATED'));assert.ok(sql.includes('MERI_PREVIEW_CUSTODY_REQUIRED'));
});

test('source-only: custody enumerates uncertain allocations including missing physical receipts with no expiry or retry path',()=>{
 const view=sql.split('CREATE VIEW meri_artifacts.preview_custody AS')[1]??'';
 assert.match(view,/LEFT JOIN meri_artifacts\.previews p\s+ON p.tenant_id = a.tenant_id AND p.version_id = a.version_id/u);
 assert.ok(view.includes("CASE WHEN p.version_id IS NULL THEN 'UNKNOWN' ELSE 'COMMITTED' END"));
 assert.ok(view.includes('(a.object_reference IS NULL) AS potential_orphan'));
 assert.ok(view.includes('a.object_id'));assert.ok(view.includes('a.object_version_id'));assert.ok(view.includes('a.claim_sha256'));
 assert.equal(/\b(WHERE|CURRENT_TIMESTAMP|NOW|INTERVAL)\b/iu.test(view),false,'uncertain allocations cannot disappear by age or filtered publication');
});
