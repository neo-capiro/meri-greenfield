/** Source contract only. Native PostgreSQL schema/role/concurrency qualification and migration apply remain separate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAN,migrationBody,splitStatements} from '../../../../infra/product-preview/first-chat-migrate.mjs';
import {INTENT_DETAIL_MAX,INTENT_FAILURE_CODES} from '../faults.mjs';

const bytes=readFileSync(new URL('../migrations/0006_failed_outcome_detail.sql',import.meta.url));
const sql=bytes.toString('utf8');
const tombstone=readFileSync(new URL('../migrations/0002_memory_preparation_tombstone.sql',import.meta.url),'utf8');
const compact=value=>value.replace(/\s+/gu,' ').trim();
const sha=value=>createHash('sha256').update(value).digest('hex');

test('the amendment is appended exactly once at ordinal 85 with the committed bytes pinned, and 0002 stays unchanged',()=>{
 assert.equal(PLAN.length,85);
 const entry=PLAN[84];
 assert.equal(entry.ordinal,85);
 assert.equal(entry.path,'apps/control/intents/migrations/0006_failed_outcome_detail.sql');
 assert.equal(entry.stage,'integration');
 assert.equal(entry.pinned,sha(bytes),'the pinned bytes are the committed bytes');
 assert.equal(PLAN.filter(e=>e.path===entry.path).length,1);
 assert.equal(sha(tombstone),'8827a9ced5a5b8f3e2495ed1298d0c57f643d0fe22125b0668aade7d15610550','the compared 0002 source is the applied one');
 assert.equal(splitStatements(migrationBody(sql)).length,2,'one guarded DO block, then the one replacement ADD');
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE|INSERT)\s+meri_intents\.preparations\b|\bGRANT\b|\bCREATE\s+(?:ROLE|TABLE|INDEX)\b|\bADD\s+COLUMN\b|\bDROP\s+TABLE\b/iu);
});

test('the 0002 outcome CHECK is compared by its exact expression before it is replaced under the same name',()=>{
 const applied=/ADD CONSTRAINT preparations_memory_outcome_check CHECK \(([\s\S]*?)\n \);/u.exec(tombstone)[1];
 const expected=/ADD CONSTRAINT detail_0006_expected_outcome CHECK \(([\s\S]*?)\n \) NOT VALID;/u.exec(sql)[1];
 assert.equal(compact(expected),compact(applied),'the comparison constraint is the applied 0002 expression, verbatim');
 for(const required of ["conname='detail_0006_expected_outcome')\n THEN RAISE EXCEPTION 'INTENT_PREPARATION_0002_SCHEMA_UNVERIFIED'",
  "c.conname='preparations_memory_outcome_check'",'c.convalidated AND c.conislocal AND c.coninhcount=0','outcome_count<>1',
  'pg_get_expr(actual.conbin,actual.conrelid,false) IS DISTINCT FROM pg_get_expr(expected.conbin,expected.conrelid,false)',
  'DROP CONSTRAINT preparations_memory_outcome_check,\n  DROP CONSTRAINT detail_0006_expected_outcome'])assert.ok(sql.includes(required),required);
 assert.ok(sql.indexOf("RAISE EXCEPTION 'INTENT_PREPARATION_0002_SCHEMA_UNVERIFIED'")<sql.indexOf('DROP CONSTRAINT preparations_memory_outcome_check'));
 assert.doesNotMatch(sql,/preparations_(?:state_check|check\d*)\b/u,'generated constraint names are not a migration contract');
});

test('only the FAILED branch widens: an optional detail string within the fault bound beside the same closed code set',()=>{
 const replaced=/END \$\$;[\s\S]*?ADD CONSTRAINT preparations_memory_outcome_check CHECK \(([\s\S]*?)\n \);/u.exec(sql)[1];
 const applied=/ADD CONSTRAINT preparations_memory_outcome_check CHECK \(([\s\S]*?)\n \);/u.exec(tombstone)[1];
 const branches=value=>compact(value).split(/\) OR \(/u);
 const before=branches(applied),after=branches(replaced);
 assert.equal(before.length,4);assert.equal(after.length,4);
 assert.deepEqual([after[0],after[2],after[3]],[before[0],before[2],before[3]],'PENDING/UNKNOWN, PREPARED and REDACTED are untouched');
 assert.equal(after[1],before[1]
  .replace("outcome - 'code' = '{}'::jsonb","outcome - ARRAY['code','detail'] = '{}'::jsonb")
  .replace(/\)$/u,`) AND (NOT outcome ? 'detail' OR (jsonb_typeof(outcome->'detail') = 'string' AND length(outcome->>'detail') BETWEEN 1 AND ${INTENT_DETAIL_MAX}))`));
 assert.match(after[1],new RegExp(`IN \\(${INTENT_FAILURE_CODES.map(code=>`'${code}'`).join(',')}\\)`,'u'),'the closed code set is the fault module\'s');
});
