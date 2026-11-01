/** Money Flow reproduced from serving-data shapes with the corrected consumer semantics.
 *
 * The applied procurement enrichment migration (clone receipt of 31 October 2026) builds `v_defproc_money_flow` by
 * choosing `DISTINCT ON (piid)`, joining award transactions by PIID and summing physical revision rows. The Lane 6
 * correction review rejected those semantics: a shared PIID misattributes money across awards, and repeated
 * observations of the same source action are summed more than once. This module is the reviewed consumer projection
 * that a forward migration must reproduce, expressed over the serving row shapes so it can be checked with fixtures
 * only (no clone population, no DEV copy, no live SQL):
 *
 * - award rows: `{piid, awardingSubtierCode, parentPiid, parentSubtierCode, awardUniqueId, recipientUei,
 *   recipientName}` (the federal_award identity columns the clone probe exposed);
 * - transaction revision rows: `{piid, awardingSubtierCode, parentPiid, parentSubtierCode, modificationNumber,
 *   transactionNumber, actionDate, federalActionObligation, sourceObservedAt, revisionId}` (one physical row per
 *   observation of one source action; a corrected observation of the same action carries a later sourceObservedAt).
 *
 * Every award is keyed by its full identity (`award-identity.mjs`), every logical action by that identity plus the
 * validated modification/transaction numbers, and only the latest observation of each logical action contributes
 * its obligation. Amounts are USD as supplied; actionDate is a calendar date and fiscalYear is the federal fiscal
 * year it falls in (October to September). Nothing here authorizes population or publishes a figure. */
import {awardIdentity,resolveAward,transactionKey} from './award-identity.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
/** Federal fiscal year of a calendar date: October to December belong to the next fiscal year. @param {string} date */
export function federalFiscalYear(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(date))fail('ACTION_DATE_MALFORMED');
 const [year,month]=date.split('-').map(Number);
 if(month<1||month>12)fail('ACTION_DATE_MALFORMED');
 return month>=10?year+1:year;
}
const instant=value=>{const stamp=typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(stamp))fail('OBSERVATION_MALFORMED');return stamp;};
const amount=value=>{if(typeof value!=='number'||!Number.isFinite(value))fail('OBLIGATION_MALFORMED');return value;};
/** Project the logical actions of one serving population: one row per (award identity, modification, transaction),
 * carrying the latest observation and the count of physical observations it collapses.
 * @param {ReadonlyArray<object>} awards @param {ReadonlyArray<object>} revisions */
export function logicalActions(awards,revisions){
 if(!Array.isArray(awards)||!Array.isArray(revisions))fail('POPULATION_MALFORMED');
 const actions=new Map();
 for(const revision of revisions){
  const {identity,award}=resolveAward(awards,revision);
  const key=transactionKey(identity,revision),observedAt=instant(revision.sourceObservedAt),obligation=amount(revision.federalActionObligation);
  if(typeof revision.revisionId!=='string'||revision.revisionId==='')fail('REVISION_ID_MISSING');
  const row=actions.get(key);
  if(row===undefined){actions.set(key,{key,identity,award,modificationNumber:String(revision.modificationNumber).trim(),transactionNumber:revision.transactionNumber,actionDate:revision.actionDate,fiscalYear:federalFiscalYear(revision.actionDate),
   federalActionObligation:obligation,sourceObservedAt:revision.sourceObservedAt,revisionId:revision.revisionId,observations:1});continue;}
  row.observations+=1;
  // A later observation of the same action is a correction or a re-observation; it replaces, never adds.
  if(observedAt>instant(row.sourceObservedAt)){Object.assign(row,{actionDate:revision.actionDate,fiscalYear:federalFiscalYear(revision.actionDate),federalActionObligation:obligation,sourceObservedAt:revision.sourceObservedAt,revisionId:revision.revisionId});}
  else if(observedAt===instant(row.sourceObservedAt)&&(obligation!==row.federalActionObligation||revision.actionDate!==row.actionDate))fail('OBSERVATION_CONFLICT');
 }
 return [...actions.values()].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
}
/** Money Flow: obligations per award, vendor and awarding subtier by federal fiscal year, over the logical actions.
 * Each award line reports how many logical actions and how many physical observations it summarises, so a consumer
 * can see that repeated observations were collapsed and that no award was merged by PIID alone.
 * @param {ReadonlyArray<object>} awards @param {ReadonlyArray<object>} revisions */
export function moneyFlow(awards,revisions){
 const actions=logicalActions(awards,revisions),byAward=new Map();
 for(const action of actions){
  const line=byAward.get(action.identity.key)??byAward.set(action.identity.key,{awardKey:action.identity.key,piid:action.identity.piid,awardingSubtierCode:action.identity.awardingSubtierCode,
   parentPiid:action.identity.parentPiid,awardUniqueId:action.identity.awardUniqueId,recipientUei:action.award.recipientUei??null,recipientName:action.award.recipientName??null,
   currency:'USD',byFiscalYear:{},totalObligation:0,logicalActions:0,physicalObservations:0}).get(action.identity.key);
  line.byFiscalYear[action.fiscalYear]=(line.byFiscalYear[action.fiscalYear]??0)+action.federalActionObligation;
  line.totalObligation+=action.federalActionObligation;line.logicalActions+=1;line.physicalObservations+=action.observations;
 }
 const awardLines=[...byAward.values()].sort((a,b)=>a.awardKey<b.awardKey?-1:a.awardKey>b.awardKey?1:0);
 const rollup=(keyOf)=>{const rows=new Map();for(const line of awardLines){const key=keyOf(line);if(key===null)continue;const row=rows.get(key)??rows.set(key,{key,currency:'USD',totalObligation:0,awards:0}).get(key);row.totalObligation+=line.totalObligation;row.awards+=1;}return [...rows.values()].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);};
 return Object.freeze({basis:'latest_observation_per_logical_action',identity:'full_award_identity',currency:'USD',fiscalYearBasis:'federal_fiscal_year_of_action_date',
  awards:awardLines,byVendor:rollup(line=>line.recipientUei),byAwardingSubtier:rollup(line=>line.awardingSubtierCode)});
}
export {awardIdentity};
