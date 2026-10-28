/** Content-free tenant accounting from the existing run ledger. No inventory,
 * reservations, conversation authority or admission writes are created here. */
import {assertPool,transact} from '../../product-persistence/transaction.mjs';
import {ProductError} from '../../product-access/errors.mjs';
import {storedModelSettings} from '../../settings/documents.mjs';
import {overviewStates as OVERVIEW_STATES,usageOverviewPeriods as usagePeriods} from '../../../../packages/contracts/conversation-usage/overview-protocol.mjs';
export {usageOverviewPeriods as usagePeriods} from '../../../../packages/contracts/conversation-usage/overview-protocol.mjs';

const refuse=()=>{throw new ProductError('USAGE_OVERVIEW_CORRUPT');};
const integer=value=>{if(typeof value!=='string'||!/^\d+$/u.test(value)||!Number.isSafeInteger(Number(value)))refuse();return Number(value);};
const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))refuse();return n;};
const counts=()=>Object.fromEntries(OVERVIEW_STATES.map(state=>[state,0]));
export function projectUsageOverview({periods,rows,ledgerRows,currentRows,policyRows,observedAt}){
 if(ledgerRows.length!==1||policyRows.length>1)refuse();
 const values=periods.map(period=>({...period,attempts:0,states:counts(),recording:{recorded:0,unavailable:0,notRecorded:0},knownChargeMicroUsd:0,completedAttemptsWithRecordedUsage:0,completedAttemptKnownChargeMicroUsd:0}));
 const seen=new Set();
 for(const row of rows){const period=values.find(p=>p.kind===row.period),key=[row.period,row.state,row.recording].join(':');
  if(!period||!OVERVIEW_STATES.includes(row.state)||!['recorded','unavailable','not-recorded'].includes(row.recording)||seen.has(key))refuse();seen.add(key);
  const n=integer(row.attempts),charge=integer(row.charge);if(n===0||row.recording!=='recorded'&&charge!==0)refuse();
  period.attempts=add(period.attempts,n);period.states[row.state]=add(period.states[row.state],n);
  const recording=row.recording==='not-recorded'?'notRecorded':row.recording;period.recording[recording]=add(period.recording[recording],n);
  period.knownChargeMicroUsd=add(period.knownChargeMicroUsd,charge);
  if(row.state==='completed'&&row.recording==='recorded'){period.completedAttemptsWithRecordedUsage=add(period.completedAttemptsWithRecordedUsage,n);period.completedAttemptKnownChargeMicroUsd=add(period.completedAttemptKnownChargeMicroUsd,charge);}
 }
 const current=counts(),currentSeen=new Set();for(const row of currentRows){if(!OVERVIEW_STATES.slice(0,5).includes(row.state)||currentSeen.has(row.state))refuse();currentSeen.add(row.state);current[row.state]=integer(row.attempts);}
 const ledger=ledgerRows[0],knownChargeMicroUsd=integer(ledger.charge),unavailableRecordedAttempts=integer(ledger.unavailable);
 let policy={status:'unavailable',revision:null,monthlyCapMicroUsd:null,maxTurns:null,maxBudgetMicroUsd:null};
 if(policyRows.length){const row=policyRows[0],revision=integer(String(row.revision));if(revision<1)refuse();let model;
  try{model=storedModelSettings(row);}catch{refuse();}
  if(model.monthlyCapMicroUsd!==null)policy={status:'configured',revision,...model};
 }
 return {schemaVersion:'meri.usage-overview/1',observedAt,timezone:'UTC',policy,periods:values,
  monthlyAdmission:{startInclusive:periods[2].startInclusive,knownChargeMicroUsd,unavailableRecordedAttempts,
   remainingKnownMicroUsd:policy.monthlyCapMicroUsd===null?null:Math.max(0,policy.monthlyCapMicroUsd-knownChargeMicroUsd),
   reached:policy.monthlyCapMicroUsd===null?null:knownChargeMicroUsd>=policy.monthlyCapMicroUsd},
  queue:{basis:'recorded-run-state',states:current,physicalConcurrency:null,availableCapacity:null,capacityStatus:'unavailable'},
  coverage:{attemptPeriodBasis:'run-created-at',admissionPeriodBasis:'sdk-usage-recorded-at',chargeBasis:'recorded-sdk-estimate',providerBilledMicroUsd:null,completeJobCost:'unavailable'}};
}
export function createUsageOverviewStore({pool,now=Date.now}){
 assertPool(pool);if(typeof now!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 return Object.freeze({async read({principal},check){
  if(typeof principal?.tenantId!=='string'||!principal.tenantId)throw new ProductError('ACCESS_DENIED');
  return transact(pool,async client=>{
   const at=now(),observedAt=new Date(at).toISOString(),periods=usagePeriods(at);
   const parameters=[principal.tenantId,observedAt,...periods.flatMap(p=>[p.kind,p.startInclusive,p.endExclusive])];
   const rows=(await client.query(`WITH periods(kind,start_at,end_at) AS (VALUES ($3::text,$4::timestamptz,$5::timestamptz),($6::text,$7::timestamptz,$8::timestamptz),($9::text,$10::timestamptz,$11::timestamptz))
    SELECT p.kind AS period,r.projection->>'state' AS state,CASE WHEN r.sdk_usage IS NULL THEN 'not-recorded' ELSE r.sdk_usage->>'status' END AS recording,
     COUNT(*)::text AS attempts,COALESCE(SUM(r.sdk_charge_micro_usd),0)::text AS charge
    FROM periods p JOIN meri_conversations.runs r ON r.tenant_id=$1 AND (r.projection->>'createdAt')::timestamptz>=p.start_at
     AND (r.projection->>'createdAt')::timestamptz<LEAST(p.end_at,$2::timestamptz)
    GROUP BY p.kind,r.projection->>'state',CASE WHEN r.sdk_usage IS NULL THEN 'not-recorded' ELSE r.sdk_usage->>'status' END`,parameters)).rows;check();
   const ledgerRows=(await client.query(`SELECT COALESCE(SUM(sdk_charge_micro_usd),0)::text AS charge,
    COUNT(*) FILTER (WHERE sdk_usage->>'status'='unavailable')::text AS unavailable FROM meri_conversations.runs
    WHERE tenant_id=$1 AND sdk_usage_recorded_at >= $2::timestamptz AND sdk_usage_recorded_at <= $3::timestamptz`,[principal.tenantId,periods[2].startInclusive,observedAt])).rows;check();
   const currentRows=(await client.query(`SELECT projection->>'state' AS state,COUNT(*)::text AS attempts FROM meri_conversations.runs
    WHERE tenant_id=$1 AND projection->>'state'=ANY($2::text[]) GROUP BY projection->>'state'`,[principal.tenantId,OVERVIEW_STATES.slice(0,5)])).rows;check();
   const policyRows=(await client.query('SELECT revision,monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd FROM meri_settings.tenant_settings WHERE tenant_id=$1',[principal.tenantId])).rows;check();
   return projectUsageOverview({periods,rows,ledgerRows,currentRows,policyRows,observedAt});
  },{check,readOnly:true,unavailable:'USAGE_OVERVIEW_UNAVAILABLE',uncertain:'USAGE_OVERVIEW_UNAVAILABLE'});
 }});
}
