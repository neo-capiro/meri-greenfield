/** Fourteen offline checks of the materialized candidate selection. No connection, EXPLAIN, index or population. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateSelectionStatement,CANDIDATE_ORDER,CANDIDATE_SELECTION_DEFAULTS} from '../candidate-selection.mjs';
const observedBefore='2026-10-31T11:00:00.000Z';
const statement=(over={})=>candidateSelectionStatement({observedBefore,...over});

test('1. the eligible set is a MATERIALIZED CTE that the projection cannot fold or re-evaluate',()=>{
 const s=statement();assert.match(s.text,/^WITH eligible AS MATERIALIZED \(/u);assert.equal(s.materialized,true);
 assert.equal((s.text.match(/MATERIALIZED/gu)??[]).length,1);assert.doesNotMatch(s.text,/NOT MATERIALIZED/u);
});
test('2. the candidate count is bound as a parameter inside the CTE, defaulting to the allocated 26 rows',()=>{
 const s=statement();assert.equal(s.limit,26);assert.equal(CANDIDATE_SELECTION_DEFAULTS.limit,26);assert.equal(s.values[1],26);
 assert.match(s.text,/\n  LIMIT \$2::int\n\)/u);assert.equal(statement({limit:5}).values[1],5);
});
test('3. the ordering is a deterministic total order over the full award identity, used identically in the CTE and the projection',()=>{
 const s=statement();assert.deepEqual(s.order,CANDIDATE_ORDER);
 assert.match(s.text,new RegExp(`ORDER BY ${CANDIDATE_ORDER.map(c=>'a\\.'+c).join(', ')}\\n  LIMIT`,'u'));
 assert.match(s.text,new RegExp(`\\nORDER BY ${CANDIDATE_ORDER.map(c=>'e\\.'+c).join(', ')}, t\\.modification_number, t\\.transaction_number, t\\.source_observed_at$`,'u'));
 assert.ok(CANDIDATE_ORDER.includes('award_unique_id'),'the composite award id breaks any remaining tie');
});
test('4. eligibility never quarantines a numeric or short PIID: only null and empty PIIDs are excluded',()=>{
 const s=statement();assert.match(s.text,/a\.piid IS NOT NULL\n\s+AND a\.piid <> ''/u);
 assert.doesNotMatch(s.text,/~|SIMILAR TO|LIKE|regexp|length\(a\.piid\)|\\d/u);
});
test('5. the projection joins on the full award identity, never on PIID alone',()=>{
 const s=statement();
 for(const clause of ['t.piid = e.piid','t.awarding_subtier_code = e.awarding_subtier_code','t.parent_piid IS NOT DISTINCT FROM e.parent_piid','t.parent_subtier_code IS NOT DISTINCT FROM e.parent_subtier_code'])assert.ok(s.text.includes(clause),clause);
 assert.equal((s.text.match(/ON t\.piid = e\.piid\n/gu)??[]).length,1);
});
test('6. a partial parent (PIID without subtier or the reverse) is ineligible',()=>{
 assert.match(statement().text,/\(\(a\.parent_piid IS NULL\) = \(a\.parent_subtier_code IS NULL\)\)/u);
});
test('7. the observation bound is one parameter applied to both the eligible set and the joined transactions',()=>{
 const s=statement();assert.equal(s.values[0],observedBefore);assert.equal((s.text.match(/< \$1::timestamptz/gu)??[]).length,2);
});
test('8. the statement is read-only and carries no DDL, write, lock, EXPLAIN or settings change',()=>{
 const s=statement();assert.equal(s.readOnly,true);
 assert.doesNotMatch(s.text,/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|EXPLAIN|ANALYZE|SET |LOCK|FOR UPDATE|FOR SHARE|VACUUM|REINDEX|COPY)\b/u);
});
test('9. no timeout increase is authorized: the statement declares the existing 15 s budget it must meet',()=>{
 assert.equal(statement().statementTimeoutMs,15000);assert.doesNotMatch(statement().text,/statement_timeout/u);
});
test('10. relation names are validated identifiers and default to the serving award and transaction relations',()=>{
 const s=statement();assert.equal(s.awardRelation,'federal_award');assert.equal(s.transactionRelation,'acquisition_award_transaction_revision');
 for(const bad of ['federal_award; DROP TABLE x','"quoted"','1abc','',null,'a'.repeat(64)])assert.throws(()=>statement({awardRelation:bad}),{code:'CANDIDATE_RELATION_MALFORMED'});
});
test('11. every variable value is bound, never interpolated into the text',()=>{
 const s=statement({subtierCodes:['9700','2100']});assert.deepEqual([...s.values],[observedBefore,26,['9700','2100']]);
 assert.doesNotMatch(s.text,/9700|2100|2026-10-31/u);assert.match(s.text,/a\.awarding_subtier_code = ANY\(\$3::text\[\]\)/u);
 assert.equal(statement().values.length,2);assert.doesNotMatch(statement().text,/\$3/u);
});
test('12. malformed options fail closed before any text is produced',()=>{
 assert.throws(()=>statement({limit:0}),{code:'CANDIDATE_LIMIT_MALFORMED'});assert.throws(()=>statement({limit:1001}),{code:'CANDIDATE_LIMIT_MALFORMED'});assert.throws(()=>statement({limit:'26'}),{code:'CANDIDATE_LIMIT_MALFORMED'});
 assert.throws(()=>candidateSelectionStatement({}),{code:'CANDIDATE_OBSERVATION_BOUND_MALFORMED'});assert.throws(()=>statement({observedBefore:'2026-10-31'}),{code:'CANDIDATE_OBSERVATION_BOUND_MALFORMED'});
 assert.throws(()=>statement({subtierCodes:[]}),{code:'CANDIDATE_SUBTIER_MALFORMED'});assert.throws(()=>statement({subtierCodes:['97 00']}),{code:'CANDIDATE_SUBTIER_MALFORMED'});
 assert.throws(()=>candidateSelectionStatement(null),{code:'CANDIDATE_OPTIONS_MALFORMED'});
});
test('13. the projection keeps the full identity, the action identity and the observation on every row, so Money Flow can key it',()=>{
 const s=statement();
 for(const column of ['e.piid','e.awarding_subtier_code','e.parent_piid','e.parent_subtier_code','e.award_unique_id','e.recipient_uei','t.modification_number','t.transaction_number','t.action_date','t.federal_action_obligation','t.source_observed_at','t.revision_id'])assert.ok(s.text.includes(column),column);
 assert.match(s.text,/\nLEFT JOIN acquisition_award_transaction_revision t\n/u,'an eligible award without transactions is still a candidate row');
});
test('14. the statement is deterministic and frozen: equal options give byte-identical text and immutable results',()=>{
 const a=statement(),b=statement();assert.equal(a.text,b.text);assert.deepEqual(a.values,b.values);
 assert.ok(Object.isFrozen(a));assert.ok(Object.isFrozen(a.values));assert.throws(()=>{a.values.push('x');});
});
