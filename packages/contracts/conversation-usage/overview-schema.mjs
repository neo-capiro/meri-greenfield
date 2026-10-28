import {USAGE_OVERVIEW_SCHEMA,usageOverviewMetadata,overviewStates,USAGE_OVERVIEW_SCHEMA_V2,usageOverviewMetadataV2,usageOverviewBases,usageOverviewCounterNames,usageOverviewLineageClasses,usageOverviewLineageBasis,usageOverviewCostCategories,usageOverviewDenominators,usageOverviewJobInterface,usageOverviewJobStates,usageOverviewJobWindow,usageOverviewJobWindowEdge,usageOverviewJobDefinition,usageOverviewJobLineage,usageOverviewJobClosure} from './overview-protocol.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable=schema=>({anyOf:[schema,{type:'null'}]});
const count={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},date={type:'string',format:'date-time',pattern:'Z$'};
const states=object(Object.fromEntries(overviewStates.map(state=>[state,count])));
const period=object({kind:{enum:['day','week','month']},startInclusive:date,endExclusive:date,attempts:count,states,recording:object({recorded:count,unavailable:count,notRecorded:count}),knownChargeMicroUsd:count,completedAttemptsWithRecordedUsage:count,completedAttemptKnownChargeMicroUsd:count});
const money={type:'number',minimum:0,maximum:Number.MAX_SAFE_INTEGER/1e6};
const basis={enum:usageOverviewBases};
/** Successor-version sub-defs. Run-level attempts and threads, a measured/estimated/unresolved basis map
 * and honest unknowns; no member, client, conversation or run identifier crosses this boundary. */
const countersV2=object(Object.fromEntries(usageOverviewCounterNames.map(name=>[name,count])));
const lineageClass=object({attempts:count,chargeMicroUsd:count});
const lineageV2=object({basis:{const:usageOverviewLineageBasis},...Object.fromEntries(usageOverviewLineageClasses.map(name=>[name,lineageClass]))});
const threadsV2=object({status:{enum:['measured','unavailable']},basis:{const:'distinct-conversation-id-by-run-created-at'},threads:nullable(count),attempts:nullable(count)});
const completedV2=object({status:{enum:['estimated','unavailable']},chargeBasis:{const:'sdk-list-estimate'},jobIdentity:{const:'not-a-job-denominator'},attempts:count,knownChargeMicroUsd:count,microUsdPerCompletedAttempt:nullable(money),attemptsWithoutRecordedUsage:count});
const partialV2=object({status:{enum:['estimated','unavailable']},chargeBasis:{const:'sdk-list-estimate'},failedAttempts:count,cancelledAttempts:count,recordedAttempts:count,knownChargeMicroUsd:count,microUsdPerRecordedAttempt:nullable(money)});
const liabilityV2=object({chargeBasis:{const:'sdk-list-estimate'},recordedAttempts:count,knownChargeMicroUsd:count,microUsdPerRecordedAttempt:nullable(money),unavailableAttempts:count,notRecordedAttempts:count});
const periodV2=object({kind:{enum:['day','week','month']},startInclusive:date,endExclusive:date,attempts:count,states,recording:object({recorded:count,unavailable:count,notRecorded:count}),knownChargeMicroUsd:count,recorded:states,conversationThreads:threadsV2,completedAttempts:completedV2,partialOrFailed:partialV2,liability:liabilityV2,lineage:lineageV2,counters:countersV2});
const categoriesV2=object(Object.fromEntries(Object.keys(usageOverviewCostCategories).map(name=>[name,basis])));
const jobIdentityV2=object({status:{const:'measured'},definition:{const:usageOverviewJobDefinition},lineage:{const:usageOverviewJobLineage},
 closure:{const:usageOverviewJobClosure},owner:{const:usageOverviewJobInterface.owner},states:{type:'array',items:{enum:usageOverviewJobStates},minItems:5,maxItems:5}});
const occupiedV2=object({status:{const:'unavailable'},reason:{type:'string',minLength:1,maxLength:1024}});
const jobStateV2=object({jobs:count,attempts:count,knownChargeMicroUsd:count});
const wholeJobsV2=object({basis:{const:usageOverviewDenominators.sustainedJobs},window:{const:usageOverviewJobWindow},
 states:object(Object.fromEntries(usageOverviewJobStates.map(name=>[name,jobStateV2]))),
 jobs:count,attempts:count,revisions:count,steerRevisions:count,tails:count,settledRevisions:count,closurePending:count,unresolvedSuccessors:count,unsettledChildren:count,knownChargeMicroUsd:count,
 microUsdPerSuccessfulJob:nullable(money),
 coverage:object({jobsWithRecordedUsage:count,jobsWithUnavailableUsage:count,revisionsWithRootOutsideWindow:count,chargeAttribution:{const:'whole-job-lineage-at-root-revision-window'},
  windowEdge:{const:usageOverviewJobWindowEdge},providerBilledMicroUsd:{type:'null'},completeJobCost:{const:'estimated'}})});
const denominatorsV2=object({attempts:{const:usageOverviewDenominators.attempts},conversationThreads:{const:usageOverviewDenominators.conversationThreads},sustainedJobs:{const:usageOverviewDenominators.sustainedJobs}});
const policy={oneOf:[object({status:{const:'configured'},revision:{...count,minimum:1},monthlyCapMicroUsd:{...count,minimum:1},maxTurns:{type:'integer',minimum:1,maximum:100},maxBudgetMicroUsd:{...count,minimum:1}}),object({status:{const:'unavailable'},revision:{type:'null'},monthlyCapMicroUsd:{type:'null'},maxTurns:{type:'null'},maxBudgetMicroUsd:{type:'null'}})]};
const admission=object({startInclusive:date,knownChargeMicroUsd:count,unavailableRecordedAttempts:count,remainingKnownMicroUsd:nullable(count),reached:nullable({type:'boolean'})});
const queue=object({basis:{const:'recorded-run-state'},states,physicalConcurrency:{type:'null'},availableCapacity:{type:'null'},capacityStatus:{const:'unavailable'}});
/** The successor request/response definitions live ONLY in the successor's own resolvable document
 * below. The /1-named document keeps its exact published two-def bytes (the document physically
 * shipped in the 0.1.25 and 0.1.26 packages), so re-stating the successor shapes here would silently
 * change the digest of a published file. */
const overviewV2Defs={UsageOverviewRequest2:object({schemaVersion:{const:USAGE_OVERVIEW_SCHEMA_V2}}),
 UsageOverviewResponse2:object({schemaVersion:{const:USAGE_OVERVIEW_SCHEMA_V2},observedAt:date,timezone:{const:'UTC'},currency:{const:'USD'},countersCoverage:{const:'recorded-runs-only'},
  policy,periods:{type:'array',items:periodV2,minItems:3,maxItems:3},
  monthlyAdmission:admission,queue,coverage:object({attemptPeriodBasis:{const:'run-created-at'},admissionPeriodBasis:{const:'sdk-usage-recorded-at'},chargeBasis:{const:'sdk-list-estimate'},providerBilledMicroUsd:{type:'null'},completeJobCost:{const:'estimated'}}),
  denominators:denominatorsV2,jobIdentity:jobIdentityV2,wholeJobs:wholeJobsV2,categories:categoriesV2,occupiedCapacity:occupiedV2})};
export function usageOverviewSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:usageOverviewMetadata.schemaId,$defs:{
 UsageOverviewRequest:object({schemaVersion:{const:USAGE_OVERVIEW_SCHEMA}}),
 UsageOverviewResponse:object({schemaVersion:{const:USAGE_OVERVIEW_SCHEMA},observedAt:date,timezone:{const:'UTC'},
  policy:{oneOf:[object({status:{const:'configured'},revision:{...count,minimum:1},monthlyCapMicroUsd:{...count,minimum:1},maxTurns:{type:'integer',minimum:1,maximum:100},maxBudgetMicroUsd:{...count,minimum:1}}),object({status:{const:'unavailable'},revision:{type:'null'},monthlyCapMicroUsd:{type:'null'},maxTurns:{type:'null'},maxBudgetMicroUsd:{type:'null'}})]},
  periods:{type:'array',items:period,minItems:3,maxItems:3},
  monthlyAdmission:object({startInclusive:date,knownChargeMicroUsd:count,unavailableRecordedAttempts:count,remainingKnownMicroUsd:nullable(count),reached:nullable({type:'boolean'})}),
  queue:object({basis:{const:'recorded-run-state'},states,physicalConcurrency:{type:'null'},availableCapacity:{type:'null'},capacityStatus:{const:'unavailable'}}),
  coverage:object({attemptPeriodBasis:{const:'run-created-at'},admissionPeriodBasis:{const:'sdk-usage-recorded-at'},chargeBasis:{const:'recorded-sdk-estimate'},providerBilledMicroUsd:{type:'null'},completeJobCost:{const:'unavailable'}})})
 }};}
/** The successor's own resolvable document. Its `$id` is the advertised `urn:meri:usage-overview:2.0.0`,
 * so a consumer that resolves that urn reaches this document and its `$defs` anchor directly instead of
 * the /1-named document; the /1-named document above keeps its exact published bytes. */
export function usageOverviewSchemaV2(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:usageOverviewMetadataV2.schemaId,$defs:{...overviewV2Defs}};}

