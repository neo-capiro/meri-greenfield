/** STATIC ONLY: source assertions, no SQL parsing/execution or policy/DB qualification. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {INTENT_FAILURE_CODES} from '../faults.mjs';
const sql=readFileSync(new URL('../migrations/0001_intent_preparations.sql',import.meta.url),'utf8');
test('allocated intent schema keeps one scoped non-reusable delivery fence and one PENDING-to-terminal transition',()=>{
 assert.match(sql,/CREATE TABLE meri_intents\.preparations/u);assert.match(sql,/PRIMARY KEY \(tenant_id,actor_id,conversation_id,delivery_id\)/u);
 assert.match(sql,/OLD\.state <> 'PENDING' OR NEW\.state = 'PENDING'/u);assert.match(sql,/BEFORE UPDATE OR DELETE/u);assert.match(sql,/INTENT_PREPARATION_FENCE_REQUIRED/u);
 for(const name of ['tenant_id','actor_id','conversation_id','delivery_id','record','record_sha256','created_at']){assert.ok(sql.includes('NEW.'+name));assert.ok(sql.includes('OLD.'+name));}
 assert.doesNotMatch(sql,/\bpublic\.|CREATE TABLE meri_intent_preparations|\bCREATE\s+(?:ROLE|EXTENSION)|\bGRANT\s|\bIF NOT EXISTS\b/iu);
});
test('new intent custody requires SQL NULL uncertainty or indivisible result/release with the closed failure codes',()=>{
 assert.match(sql,/state IN \('PENDING','UNKNOWN'\) AND outcome IS NULL/u);assert.match(sql,/outcome \?& ARRAY\['result','release'\]/u);
 assert.match(sql,/ARRAY\['binding','scopes','expiresAtMs'\]/u);assert.match(sql,/conversation_id::text/u);assert.match(sql,/trunc\(/u);
 for(const code of INTENT_FAILURE_CODES)assert.ok(sql.includes("'"+code+"'"));
});
