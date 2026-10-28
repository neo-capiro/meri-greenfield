import {USAGE_OVERVIEW_SCHEMA,usageOverviewMetadata,overviewStates} from './overview-protocol.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable=schema=>({anyOf:[schema,{type:'null'}]});
const count={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER},date={type:'string',format:'date-time',pattern:'Z$'};
const states=object(Object.fromEntries(overviewStates.map(state=>[state,count])));
const period=object({kind:{enum:['day','week','month']},startInclusive:date,endExclusive:date,attempts:count,states,recording:object({recorded:count,unavailable:count,notRecorded:count}),knownChargeMicroUsd:count,completedAttemptsWithRecordedUsage:count,completedAttemptKnownChargeMicroUsd:count});
export function usageOverviewSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:usageOverviewMetadata.schemaId,$defs:{
 UsageOverviewRequest:object({schemaVersion:{const:USAGE_OVERVIEW_SCHEMA}}),
 UsageOverviewResponse:object({schemaVersion:{const:USAGE_OVERVIEW_SCHEMA},observedAt:date,timezone:{const:'UTC'},
  policy:{oneOf:[object({status:{const:'configured'},revision:{...count,minimum:1},monthlyCapMicroUsd:{...count,minimum:1},maxTurns:{type:'integer',minimum:1,maximum:100},maxBudgetMicroUsd:{...count,minimum:1}}),object({status:{const:'unavailable'},revision:{type:'null'},monthlyCapMicroUsd:{type:'null'},maxTurns:{type:'null'},maxBudgetMicroUsd:{type:'null'}})]},
  periods:{type:'array',items:period,minItems:3,maxItems:3},
  monthlyAdmission:object({startInclusive:date,knownChargeMicroUsd:count,unavailableRecordedAttempts:count,remainingKnownMicroUsd:nullable(count),reached:nullable({type:'boolean'})}),
  queue:object({basis:{const:'recorded-run-state'},states,physicalConcurrency:{type:'null'},availableCapacity:{type:'null'},capacityStatus:{const:'unavailable'}}),
  coverage:object({attemptPeriodBasis:{const:'run-created-at'},admissionPeriodBasis:{const:'sdk-usage-recorded-at'},chargeBasis:{const:'recorded-sdk-estimate'},providerBilledMicroUsd:{type:'null'},completeJobCost:{const:'unavailable'}})})
 }};}
