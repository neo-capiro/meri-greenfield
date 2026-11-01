/** The Lane 6 finite procurement inventory: candidate selection with explicit materialization.
 *
 * The one allocated inventory attempt on the serving clone (31 October 2026) completed as HOLD: its candidate SELECT
 * hit SQLSTATE 57014 (statement timeout) under 15 s and returned no candidate. The source diagnosis attributed the cost
 * to the eligible-candidate subquery being re-evaluated inside the projection and proposed materializing the small
 * ordered eligible set (26 rows for that allocation) once, before any projection joins. This module is that proposal
 * as source: it composes the statement text and bound parameters, and nothing else. It never connects, never runs
 * EXPLAIN, changes no index and populates nothing; the DB owner binds and executes it under a fresh allocation.
 *
 * Shape (PostgreSQL 16):
 *   WITH eligible AS MATERIALIZED (        -- evaluated exactly once, never folded into the projection
 *     SELECT <full award identity>, <ordering keys>
 *     FROM <award relation>
 *     WHERE <eligibility predicates, all parameterized>
 *     ORDER BY <deterministic total order>
 *     LIMIT $n)                             -- the allocated candidate count
 *   SELECT ... FROM eligible JOIN <projection relations> ON <full award identity>
 *   ORDER BY <the same total order>;
 *
 * The eligibility predicate accepts numeric and short PIIDs (no quarantine) and the join uses the full award identity
 * (PIID, awarding subtier, parent PIID, parent subtier), never PIID alone. */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const IDENTIFIER=/^[a-z_][a-z0-9_]{0,62}$/u;
export const CANDIDATE_SELECTION_DEFAULTS=Object.freeze({limit:26,awardRelation:'federal_award',transactionRelation:'acquisition_award_transaction_revision',statementTimeoutMs:15000});
/** The deterministic total order every candidate read must share, so paging and re-runs select the same rows. */
export const CANDIDATE_ORDER=Object.freeze(['awarding_subtier_code','piid','parent_subtier_code','parent_piid','award_unique_id']);
const identifier=value=>{if(typeof value!=='string'||!IDENTIFIER.test(value))fail('CANDIDATE_RELATION_MALFORMED');return value;};
/** @param {{limit?:number,awardRelation?:string,transactionRelation?:string,observedBefore:string,subtierCodes?:readonly string[]}} options */
export function candidateSelectionStatement(options){
 if(options===null||typeof options!=='object'||Array.isArray(options))fail('CANDIDATE_OPTIONS_MALFORMED');
 const limit=options.limit===undefined?CANDIDATE_SELECTION_DEFAULTS.limit:options.limit;
 if(!Number.isSafeInteger(limit)||limit<1||limit>1000)fail('CANDIDATE_LIMIT_MALFORMED');
 const awardRelation=identifier(options.awardRelation===undefined?CANDIDATE_SELECTION_DEFAULTS.awardRelation:options.awardRelation);
 const transactionRelation=identifier(options.transactionRelation===undefined?CANDIDATE_SELECTION_DEFAULTS.transactionRelation:options.transactionRelation);
 const observedBefore=options.observedBefore;
 if(typeof observedBefore!=='string'||!Number.isFinite(Date.parse(observedBefore))||new Date(Date.parse(observedBefore)).toISOString()!==observedBefore)fail('CANDIDATE_OBSERVATION_BOUND_MALFORMED');
 const subtierCodes=options.subtierCodes===undefined?null:options.subtierCodes;
 if(subtierCodes!==null&&(!Array.isArray(subtierCodes)||!subtierCodes.length||subtierCodes.length>64||subtierCodes.some(code=>typeof code!=='string'||!/^[0-9A-Z]{2,8}$/u.test(code))))fail('CANDIDATE_SUBTIER_MALFORMED');
 const order=CANDIDATE_ORDER.map(column=>`a.${column}`).join(', '),orderProjected=CANDIDATE_ORDER.map(column=>`e.${column}`).join(', ');
 const values=[observedBefore,limit,...(subtierCodes?[subtierCodes]:[])];
 const text=[
  'WITH eligible AS MATERIALIZED (',
  `  SELECT a.piid, a.awarding_subtier_code, a.parent_piid, a.parent_subtier_code, a.award_unique_id, a.recipient_uei`,
  `  FROM ${awardRelation} a`,
  '  WHERE a.piid IS NOT NULL',
  "    AND a.piid <> ''",
  '    AND a.awarding_subtier_code IS NOT NULL',
  '    AND ((a.parent_piid IS NULL) = (a.parent_subtier_code IS NULL))',
  '    AND a.source_observed_at < $1::timestamptz',
  ...(subtierCodes?['    AND a.awarding_subtier_code = ANY($3::text[])']:[]),
  `  ORDER BY ${order}`,
  '  LIMIT $2::int',
  ')',
  'SELECT e.piid, e.awarding_subtier_code, e.parent_piid, e.parent_subtier_code, e.award_unique_id, e.recipient_uei,',
  '       t.modification_number, t.transaction_number, t.action_date, t.federal_action_obligation, t.source_observed_at, t.revision_id',
  'FROM eligible e',
  `LEFT JOIN ${transactionRelation} t`,
  '  ON t.piid = e.piid',
  '  AND t.awarding_subtier_code = e.awarding_subtier_code',
  '  AND t.parent_piid IS NOT DISTINCT FROM e.parent_piid',
  '  AND t.parent_subtier_code IS NOT DISTINCT FROM e.parent_subtier_code',
  '  AND t.source_observed_at < $1::timestamptz',
  `ORDER BY ${orderProjected}, t.modification_number, t.transaction_number, t.source_observed_at`,
 ].join('\n');
 return Object.freeze({text,values:Object.freeze(values),limit,awardRelation,transactionRelation,order:CANDIDATE_ORDER,materialized:true,
  statementTimeoutMs:CANDIDATE_SELECTION_DEFAULTS.statementTimeoutMs,readOnly:true});
}
