/** Source contract only. Native PostgreSQL schema/role/concurrency qualification and migration apply remain separate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrationBody,splitStatements} from '../../../../infra/product-preview/first-chat-migrate.mjs';

const original=readFileSync(new URL('../migrations/0001_intent_preparations.sql',import.meta.url));
const sql=readFileSync(new URL('../migrations/0002_memory_preparation_tombstone.sql',import.meta.url),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the historical intent preparation source is unchanged and the forward SQL parses in the migration runner',()=>{
 assert.equal(sha(original),'108b26fbb30d1e7aa2d38942ed5099413a09d7919f5e7fbf2c541ab92f9c68bc');
 assert.ok(splitStatements(migrationBody(sql)).length>=7);
 assert.doesNotMatch(sql,/preparations_(?:state_check|check\d*)\b/u,'generated constraint names are not a migration contract');
 assert.match(sql,/INTENT_PREPARATION_BASE_SCHEMA_UNVERIFIED/u);
 assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE)\s+meri_intents\.preparations\b|\bGRANT\b|\bCREATE\s+ROLE\b/iu);
});

test('base preflight compares the exact historical expressions on the same relation and rejects ambiguous column matches',()=>{
 const compact=value=>value.replace(/\s+/gu,' ').trim();
 const source=original.toString('utf8');
 const oldState=/state text NOT NULL CHECK \((state IN [^\n]+)\),/u.exec(source)[1];
 const oldOutcome=/CHECK \((\(state IN \('PENDING','UNKNOWN'\)[\s\S]*?)\),\s*-- New writes/u.exec(source)[1];
 const expectedState=/ADD CONSTRAINT memory_0002_expected_state CHECK \(([\s\S]*?)\) NOT VALID/u.exec(sql)[1];
 const expectedOutcome=/ADD CONSTRAINT memory_0002_expected_outcome CHECK \(([\s\S]*?)\) NOT VALID/u.exec(sql)[1];
 assert.equal(compact(expectedState),compact(oldState));
 assert.equal(compact(expectedOutcome),compact(oldOutcome));
 for(const required of ['c.convalidated AND c.conislocal AND c.coninhcount=0','c.conkey=ARRAY[state_column]',
  'cardinality(c.conkey)=2 AND c.conkey @> ARRAY[state_column,outcome_column]','state_count<>1 OR outcome_count<>1',
  'pg_get_expr(actual.conbin,actual.conrelid,false) IS DISTINCT FROM pg_get_expr(expected.conbin,expected.conrelid,false)',
  "DROP CONSTRAINT %I, DROP CONSTRAINT %I',state_name,outcome_name",'DROP CONSTRAINT memory_0002_expected_state',
  'DROP CONSTRAINT memory_0002_expected_outcome'])assert.ok(sql.includes(required),required);
 assert.ok(sql.indexOf("RAISE EXCEPTION 'INTENT_PREPARATION_BASE_SCHEMA_UNVERIFIED'")<sql.indexOf('EXECUTE format('));
});

test('only the prepared memory proposal result/release can become a terminal content-free tombstone',()=>{
 for(const required of [
  "OLD.state = 'PREPARED'", "NEW.state = 'REDACTED'",'OLD.outcome IS NOT NULL','NEW.outcome IS NULL',
  'OLD.outcome_purged_at IS NULL','NEW.outcome_purged_at IS NOT NULL',
  "OLD.record->'operation'->>'id' = 'save_memory'", "OLD.outcome->'result'->'proposal'->'command'->>'action' = 'memory.propose'",
  'NEW.delivery_id,NEW.record,NEW.record_sha256','OLD.delivery_id,OLD.record,OLD.record_sha256',
  "IF TG_OP = 'TRUNCATE' OR TG_OP = 'DELETE'", "IF TG_OP = 'INSERT'",'INTENT_PREPARATION_TERMINAL'
 ])assert.ok(sql.includes(required),required);
 assert.match(sql,/state = 'REDACTED' AND outcome IS NULL AND outcome_purged_at IS NOT NULL/u);
 assert.match(sql,/OLD\.state = 'PENDING' AND NEW\.state IN \('PREPARED','FAILED','UNKNOWN'\)/u);
});

test('the tombstone requires the same-transaction exact delivery target and current suppressed plan generation',()=>{
 for(const required of [
  "t.class='meriMemoryIntentPreparations'",'t.tenant_id=OLD.tenant_id','t.conversation_id=OLD.conversation_id',
  't.actor_id=OLD.actor_id','t.delivery_id=OLD.delivery_id',"t.state='PLANNED'",
  't.xmin=pg_current_xact_id()::xid',"s.state='SUPPRESSED'",'s.owner_actor_id=OLD.actor_id',
  "s.projection->>'ledgerSequence'", "s.projection->>'entrySha256'",
  "t.plan_sha256=s.projection->'purge'->>'planSha256'",
  "t.ledger_sequence=(s.projection->'purge'->>'ledgerSequence')::bigint",
  "s.projection->'purge'->>'state' IN ('PLANNED','UNKNOWN')",'FOR UPDATE OF t,s',
  'NEW.outcome_purged_at := clock_timestamp()'
 ])assert.ok(sql.includes(required),required);
});
