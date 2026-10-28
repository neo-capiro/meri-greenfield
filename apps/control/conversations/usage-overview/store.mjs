/** Content-free tenant accounting from the existing run ledger. No inventory, reservations, conversation
 * authority or admission writes are created here. This is the single production reader for the closed
 * usage-overview route: the canonical authenticated HTTP owner calls `read`, and every number it returns
 * comes from one borrowed read-only repeatable-read transaction over meri_conversations.runs. */
import {assertPool,transact} from '../../product-persistence/transaction.mjs';
import {ProductError} from '../../product-access/errors.mjs';
import {storedModelSettings} from '../../settings/documents.mjs';
import {overviewStates as OVERVIEW_STATES,usageOverviewPeriods as usagePeriods,USAGE_OVERVIEW_SCHEMA,USAGE_OVERVIEW_SCHEMA_V2,
 usageOverviewCostCategories,usageOverviewDenominators,usageOverviewJobStates,usageOverviewJobDefinition,usageOverviewJobLineage,
 usageOverviewJobClosure,usageOverviewJobInterface} from '../../../../packages/contracts/conversation-usage/overview-protocol.mjs';
import {projectJobEconomics,projectWholeJobs,occupiedCapacity} from './job-economics.mjs';
export {usageOverviewPeriods as usagePeriods} from '../../../../packages/contracts/conversation-usage/overview-protocol.mjs';

const refuse=()=>{throw new ProductError('USAGE_OVERVIEW_CORRUPT');};
const integer=value=>{if(typeof value!=='string'||!/^\d+$/u.test(value)||!Number.isSafeInteger(Number(value)))refuse();return Number(value);};
const counts=()=>Object.fromEntries(OVERVIEW_STATES.map(state=>[state,0]));

const add=(a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))refuse();return n;};

/** The frozen /1 projection, recovered from the version that published it, over the SAME cohort rows the
 * successor query returns. That query additionally groups by lineage, so the rows are first rolled back up
 * to the /1 grouping (period, state, recording): summing the lineage groups reproduces exactly what the /1
 * query's own GROUP BY produced, since it never saw lineage. Every /1 refusal rule and every /1 field is
 * kept, so the old wire version keeps its published semantics instead of being re-derived from the
 * successor body. No second read, store or authority is created: this is a pure projection of the one
 * canonical snapshot the single production `read` already borrows. */
export function projectUsageOverview({periods,rows,ledgerRows,currentRows,policyRows,observedAt}){
 if(ledgerRows.length!==1||policyRows.length>1)refuse();
 const merged=new Map();
 for(const row of rows){const key=[row.period,row.state,row.recording].join(':'),attempts=integer(row.attempts),charge=integer(row.charge);
  const current=merged.get(key);
  if(current){current.attempts=add(current.attempts,attempts);current.charge=add(current.charge,charge);}
  else merged.set(key,{period:row.period,state:row.state,recording:row.recording,attempts,charge});
 }
 const values=periods.map(period=>({...period,attempts:0,states:counts(),recording:{recorded:0,unavailable:0,notRecorded:0},knownChargeMicroUsd:0,completedAttemptsWithRecordedUsage:0,completedAttemptKnownChargeMicroUsd:0}));
 const seen=new Set();
 for(const row of merged.values()){const period=values.find(p=>p.kind===row.period),key=[row.period,row.state,row.recording].join(':');
  if(!period||!OVERVIEW_STATES.includes(row.state)||!['recorded','unavailable','not-recorded'].includes(row.recording)||seen.has(key))refuse();seen.add(key);
  const n=row.attempts,charge=row.charge;if(n===0||row.recording!=='recorded'&&charge!==0)refuse();
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
 return {schemaVersion:USAGE_OVERVIEW_SCHEMA,observedAt,timezone:'UTC',policy,periods:values,
  monthlyAdmission:{startInclusive:periods[2].startInclusive,knownChargeMicroUsd,unavailableRecordedAttempts,
   remainingKnownMicroUsd:policy.monthlyCapMicroUsd===null?null:Math.max(0,policy.monthlyCapMicroUsd-knownChargeMicroUsd),
   reached:policy.monthlyCapMicroUsd===null?null:knownChargeMicroUsd>=policy.monthlyCapMicroUsd},
  queue:{basis:'recorded-run-state',states:current,physicalConcurrency:null,availableCapacity:null,capacityStatus:'unavailable'},
  coverage:{attemptPeriodBasis:'run-created-at',admissionPeriodBasis:'sdk-usage-recorded-at',chargeBasis:'recorded-sdk-estimate',providerBilledMicroUsd:null,completeJobCost:'unavailable'}};
}

/** Composes the successor-version response from the SAME cohort rows the run ledger produced. */
export function projectUsageOverviewV2({periods,rows,threadRows,jobRows=[],ledgerRows,currentRows,policyRows,observedAt}){
 if(ledgerRows.length!==1||policyRows.length>1)refuse();
 const {periods:economicsPeriods}=projectJobEconomics({periods,rows,threadRows});
 const current=counts(),seen=new Set();
 for(const row of currentRows){if(!OVERVIEW_STATES.slice(0,5).includes(row.state)||seen.has(row.state))refuse();seen.add(row.state);current[row.state]=integer(row.attempts);}
 const ledger=ledgerRows[0],knownChargeMicroUsd=integer(ledger.charge),unavailableRecordedAttempts=integer(ledger.unavailable);
 let policy={status:'unavailable',revision:null,monthlyCapMicroUsd:null,maxTurns:null,maxBudgetMicroUsd:null};
 if(policyRows.length){const row=policyRows[0],revision=integer(String(row.revision));if(revision<1)refuse();let model;
  try{model=storedModelSettings(row);}catch{refuse();}
  if(model.monthlyCapMicroUsd!==null)policy={status:'configured',revision,...model};
 }
 return {schemaVersion:USAGE_OVERVIEW_SCHEMA_V2,observedAt,timezone:'UTC',currency:'USD',countersCoverage:'recorded-runs-only',
  policy,periods:economicsPeriods,
  monthlyAdmission:{startInclusive:periods[2].startInclusive,knownChargeMicroUsd,unavailableRecordedAttempts,
   remainingKnownMicroUsd:policy.monthlyCapMicroUsd===null?null:Math.max(0,policy.monthlyCapMicroUsd-knownChargeMicroUsd),
   reached:policy.monthlyCapMicroUsd===null?null:knownChargeMicroUsd>=policy.monthlyCapMicroUsd},
  queue:{basis:'recorded-run-state',states:current,physicalConcurrency:null,availableCapacity:null,capacityStatus:'unavailable'},
  coverage:{attemptPeriodBasis:'run-created-at',admissionPeriodBasis:'sdk-usage-recorded-at',chargeBasis:'sdk-list-estimate',providerBilledMicroUsd:null,completeJobCost:'estimated'},
  // The whole-job identity names the existing completion producer's closure rule once, and the
  // tenant-level `wholeJobs` denominators are the only place a job count is published.
  jobIdentity:{status:'measured',definition:usageOverviewJobDefinition,lineage:usageOverviewJobLineage,closure:usageOverviewJobClosure,
   owner:usageOverviewJobInterface.owner,states:[...usageOverviewJobStates]},
  wholeJobs:projectWholeJobs({rows:jobRows}),
  denominators:usageOverviewDenominators,categories:usageOverviewCostCategories,occupiedCapacity};
}

export function createUsageOverviewStore({pool,now=Date.now,continuationCustody}){
 assertPool(pool);if(typeof now!=='function'||continuationCustody!==undefined&&typeof continuationCustody!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 return Object.freeze({async read({principal,version='2'},check){
  if(typeof principal?.tenantId!=='string'||!principal.tenantId)throw new ProductError('ACCESS_DENIED');
  if(version!=='1'&&version!=='2')throw new ProductError('PRODUCT_CONFIGURATION');
  return transact(pool,async client=>{
   const at=now(),observedAt=new Date(at).toISOString(),periods=usagePeriods(at);
   const parameters=[principal.tenantId,observedAt,...periods.flatMap(p=>[p.kind,p.startInclusive,p.endExclusive])];
   // `delta` is keyed by model name, so per-run totals must be summed inside a scalar subquery over the
   // jsonb VALUE. A key-expansion lateral join would multiply each run by its model count and inflate both
   // COUNT(*) and every charge/counter sum; one row per run keeps the denominators honest.
   // The writerFence guard is bounded to nine digits before any ::integer cast, so huge malformed numeric
   // text stays `unknown-lineage` instead of overflowing the cast and aborting the whole read.
   const rows=(await client.query(`WITH periods(kind,start_at,end_at) AS (VALUES ($3::text,$4::timestamptz,$5::timestamptz),($6::text,$7::timestamptz,$8::timestamptz),($9::text,$10::timestamptz,$11::timestamptz)),
    runs AS (SELECT p.kind AS period,r.projection->>'state' AS state,
     CASE WHEN r.sdk_usage IS NULL THEN 'not-recorded' ELSE r.sdk_usage->>'status' END AS recording,
     CASE WHEN r.sdk_usage->>'parentRunId' IS NULL THEN 'root'
      WHEN (r.projection->'binding'->>'writerFence') ~ '^[1-9][0-9]{0,8}$' THEN
       CASE WHEN (r.projection->'binding'->>'writerFence')::integer=1 THEN 'fork' ELSE 'resume' END
      ELSE 'unknown-lineage' END AS lineage,
     COALESCE(r.sdk_charge_micro_usd,0) AS charge,
     CASE WHEN r.sdk_usage->>'status'='recorded' THEN COALESCE((SELECT SUM(COALESCE((m.value->>'inputTokens')::bigint,0)) FROM jsonb_each(COALESCE(r.sdk_usage->'delta','{}'::jsonb)) AS m),0) ELSE 0 END AS "inputTokens",
     CASE WHEN r.sdk_usage->>'status'='recorded' THEN COALESCE((SELECT SUM(COALESCE((m.value->>'outputTokens')::bigint,0)) FROM jsonb_each(COALESCE(r.sdk_usage->'delta','{}'::jsonb)) AS m),0) ELSE 0 END AS "outputTokens",
     CASE WHEN r.sdk_usage->>'status'='recorded' THEN COALESCE((SELECT SUM(COALESCE((m.value->>'cacheReadInputTokens')::bigint,0)) FROM jsonb_each(COALESCE(r.sdk_usage->'delta','{}'::jsonb)) AS m),0) ELSE 0 END AS "cacheReadInputTokens",
     CASE WHEN r.sdk_usage->>'status'='recorded' THEN COALESCE((SELECT SUM(COALESCE((m.value->>'cacheCreationInputTokens')::bigint,0)) FROM jsonb_each(COALESCE(r.sdk_usage->'delta','{}'::jsonb)) AS m),0) ELSE 0 END AS "cacheCreationInputTokens",
     CASE WHEN r.sdk_usage->>'status'='recorded' THEN COALESCE((SELECT SUM(COALESCE((m.value->>'webSearchRequests')::bigint,0)) FROM jsonb_each(COALESCE(r.sdk_usage->'delta','{}'::jsonb)) AS m),0) ELSE 0 END AS "webSearchRequests",
     CASE WHEN r.sdk_usage->>'status'='recorded' THEN COALESCE(jsonb_array_length(r.sdk_usage->'toolsUsed'->'tools'),0) ELSE 0 END AS "toolInvocations",
     CASE WHEN r.sdk_usage->>'status'='recorded' THEN COALESCE((SELECT count(*) FROM jsonb_array_elements(r.sdk_usage->'toolsUsed'->'tools') e WHERE e->>'outcome'='failed'),0) ELSE 0 END AS "toolFailures"
    FROM periods p JOIN meri_conversations.runs r ON r.tenant_id=$1 AND (r.projection->>'createdAt')::timestamptz>=p.start_at
     AND (r.projection->>'createdAt')::timestamptz<LEAST(p.end_at,$2::timestamptz))
    SELECT period,state,recording,lineage,COUNT(*)::text AS attempts,COALESCE(SUM(charge),0)::text AS charge,
     COALESCE(SUM("inputTokens"),0)::text AS "inputTokens",COALESCE(SUM("outputTokens"),0)::text AS "outputTokens",
     COALESCE(SUM("cacheReadInputTokens"),0)::text AS "cacheReadInputTokens",COALESCE(SUM("cacheCreationInputTokens"),0)::text AS "cacheCreationInputTokens",
     COALESCE(SUM("webSearchRequests"),0)::text AS "webSearchRequests",COALESCE(SUM("toolInvocations"),0)::text AS "toolInvocations",
     COALESCE(SUM("toolFailures"),0)::text AS "toolFailures"
    FROM runs GROUP BY period,state,recording,lineage`,parameters)).rows;check();
   // A separate period-level observation: distinct conversations with at least one run created in the
   // period. Threads are not additive with the cohort attempt counts, so they stay their own row set.
   const threadRows=(await client.query(`WITH periods(kind,start_at,end_at) AS (VALUES ($3::text,$4::timestamptz,$5::timestamptz),($6::text,$7::timestamptz,$8::timestamptz),($9::text,$10::timestamptz,$11::timestamptz))
    SELECT p.kind AS period,COUNT(DISTINCT r.conversation_id)::text AS threads,COUNT(*)::text AS attempts
    FROM periods p JOIN meri_conversations.runs r ON r.tenant_id=$1 AND (r.projection->>'createdAt')::timestamptz>=p.start_at
     AND (r.projection->>'createdAt')::timestamptz<LEAST(p.end_at,$2::timestamptz)
    GROUP BY p.kind`,parameters)).rows;check();
   const ledgerRows=(await client.query(`SELECT COALESCE(SUM(sdk_charge_micro_usd),0)::text AS charge,
    COUNT(*) FILTER (WHERE sdk_usage->>'status'='unavailable')::text AS unavailable FROM meri_conversations.runs
    WHERE tenant_id=$1 AND sdk_usage_recorded_at >= $2::timestamptz AND sdk_usage_recorded_at <= $3::timestamptz`,[principal.tenantId,periods[2].startInclusive,observedAt])).rows;check();
   const currentRows=(await client.query(`SELECT projection->>'state' AS state,COUNT(*)::text AS attempts FROM meri_conversations.runs
    WHERE tenant_id=$1 AND projection->>'state'=ANY($2::text[]) GROUP BY projection->>'state'`,[principal.tenantId,OVERVIEW_STATES.slice(0,5)])).rows;check();
   const policyRows=(await client.query('SELECT revision,monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd FROM meri_settings.tenant_settings WHERE tenant_id=$1',[principal.tenantId])).rows;check();
   // Whole-job objectives are read ONLY for the successor version, so the /1 body keeps its published
   // five-statement snapshot and a /1 read never touches job custody. One row per run whose stored request
   // carries request.work, selected with the stored column names the canonical continuation owner reads
   // (continuation, continuation_sha256, request, projection) so that owner verifies this row itself, inside
   // THIS transaction, and never a reconstructed envelope of our own: the completion producer's own evidence
   // for that revision (never a second opinion), its last APPLIED steer control and its child receipt counts.
   // A malformed control sequence is left NULL by the same bounded guard the cohort query uses, so corrupt
   // control text cannot abort the read; the createdAt cast is the one the outer row set already uses.
   // A successor is unresolved unless its control is APPLIED and its successor revision is a work revision
   // inside this read window. The successor is located by the control's OWN target binding — a canonical fork
   // targets another conversation — so a PENDING/DISPATCHING/UNKNOWN successor, or one whose target this window
   // does not contain, can never leave a settled revision looking closed, and an APPLIED fork can close its
   // source objective while its own forked objective stays separate.
   let jobRows=[];
   if(version==='2'){
    const stored=(await client.query(`SELECT r.request_sha256 AS "requestSha256",r.request,r.projection,
     r.continuation,r.continuation_sha256,r.projection->>'state' AS state,
     r.request#>>'{work,entry}' AS entry,r.request#>>'{work,jobKind}' AS "jobKind",
     CASE WHEN r.sdk_usage IS NULL THEN 'not-recorded' ELSE r.sdk_usage->>'status' END AS recording,
     COALESCE(r.sdk_charge_micro_usd,0)::text AS charge,
     CASE WHEN cc.state='PUBLISHED' AND cc.proof->>'kind'='native-session' AND cc.identity->>'sourceRequestSha256'=r.request_sha256 THEN 'published'
      WHEN cc.state IS NOT NULL THEN 'capture-pending' ELSE 'none' END AS closure,
     COALESCE((SELECT count(*) FROM jsonb_array_elements(COALESCE(r.child_assignments,'[]'::jsonb)) e WHERE e->>'kind'='assignment'),0)::text AS "childAssignments",
     COALESCE((SELECT count(*) FROM jsonb_array_elements(COALESCE(r.child_assignments,'[]'::jsonb)) e WHERE e->>'kind'='result'),0)::text AS "childResults",
     (SELECT count(*) FROM meri_conversations.controls c WHERE c.tenant_id=r.tenant_id AND c.conversation_id=r.conversation_id AND c.run_id=r.run_id
      AND c.projection#>>'{input,intent}' IN ('resume','fork') AND (c.projection->>'state'<>'APPLIED' OR NOT EXISTS (SELECT 1 FROM meri_conversations.runs t
       WHERE t.tenant_id=c.tenant_id AND t.conversation_id::text=c.projection#>>'{target,binding,conversationId}' AND t.run_id::text=c.projection#>>'{target,binding,runId}'
        AND t.request ? 'work' AND (t.projection->>'createdAt')::timestamptz>=$2::timestamptz AND (t.projection->>'createdAt')::timestamptz<=$3::timestamptz)))::text AS "unresolvedSuccessors",
     st.control_id AS "steerControlId",st.control_sequence::text AS "steerSequence",st.input_sha256 AS "steerInputSha256"
    FROM meri_conversations.runs r
    LEFT JOIN meri_conversations.completion_checkpoints cc ON cc.tenant_id=r.tenant_id AND cc.conversation_id=r.conversation_id AND cc.run_id=r.run_id
    LEFT JOIN LATERAL (SELECT c.control_id,c.control_sequence,c.projection->>'inputSha256' AS input_sha256 FROM meri_conversations.controls c
     WHERE c.tenant_id=r.tenant_id AND c.conversation_id=r.conversation_id AND c.run_id=r.run_id AND c.projection#>>'{input,intent}'='steer'
      AND c.projection->>'state'='APPLIED' ORDER BY c.control_sequence DESC LIMIT 1) st ON true
    WHERE r.tenant_id=$1 AND r.request ? 'work' AND (r.projection->>'createdAt')::timestamptz>=$2::timestamptz AND (r.projection->>'createdAt')::timestamptz<=$3::timestamptz`,[principal.tenantId,periods[2].startInclusive,observedAt])).rows;check();
    // The objective link is the canonical continuation owner's verdict on this exact stored row, taken in the
    // caller's own transaction and never re-derived here. readContinuation starts no transaction, takes no
    // source lock and validates no run row beyond the fields it needs, so this read's lock order is unchanged
    // and nothing is added to its preconditions. A continued run whose custody cannot be verified refuses the
    // read instead of being projected from its own jsonb; the raw stored columns are stripped before projection.
    for(const row of stored){
     const {request:_request,projection:_projection,continuation:_continuation,continuation_sha256:_continuationSha256,...counted}=row;
     let custody=null;
     if(_continuation!==null&&_continuation!==undefined){
      if(typeof continuationCustody!=='function')refuse();
      try{custody=await continuationCustody(client,{...row},check);}catch(error){if(error?.code!=='STORE_CORRUPT')throw error;refuse();}
      if(!custody)refuse();
     }
     jobRows.push({...counted,mode:custody===null?null:custody.mode,parentSha256:custody===null?null:custody.sourceRequestSha256});
    }
   }
   // One snapshot, one projection per requested wire version: the /1 body is the frozen /1 projection of
   // these same rows, the /2 body the successor projection. No version opens a second read or transaction.
   const facts={periods,rows,threadRows,jobRows,ledgerRows,currentRows,policyRows,observedAt};
   return version==='1'?projectUsageOverview(facts):projectUsageOverviewV2(facts);
  },{check,readOnly:true,unavailable:'USAGE_OVERVIEW_UNAVAILABLE',uncertain:'USAGE_OVERVIEW_UNAVAILABLE'});
 }});
}
