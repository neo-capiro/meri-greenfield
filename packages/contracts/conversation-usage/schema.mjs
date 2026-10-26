import canonical from '../meri.schema.json' with {type:'json'};
import {CONVERSATION_USAGE_SCHEMA,conversationUsageMetadata,usageCounterNames,usageUnavailableReasons} from './protocol.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const ref=name=>({$ref:'#/$defs/'+name});
const nullable=value=>({anyOf:[value,{type:'null'}]});
const count={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER};
const money={type:'number',minimum:0,maximum:Number.MAX_SAFE_INTEGER/1e6};
const identifier={type:'string',minLength:1,maxLength:200,pattern:'^[a-zA-Z0-9][a-zA-Z0-9_:\\-./]{0,199}$'};
const counters=Object.fromEntries(usageCounterNames.map(name=>[name,count]));
const models=name=>({type:'array',minItems:1,maxItems:32,items:ref(name)});
export function conversationUsageSchema(){
 const identity={schemaVersion:{const:CONVERSATION_USAGE_SCHEMA},conversationId:structuredClone(canonical.$defs.RunBinding.properties.conversationId),runId:structuredClone(canonical.$defs.RunBinding.properties.runId)};
 return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:conversationUsageMetadata.schemaId,$defs:{
  ConversationUsageRequest:object(identity),
  UsageModelCounters:object({model:identifier,...counters}),
  UsageModelEstimate:object({model:identifier,...counters,sdkEstimateUsd:money,provider:{enum:['bedrock','firstParty','unknown']},costBasis:{enum:['list','unknown']}}),
  UsageBasis:object({sdk:{type:'string',maxLength:64,pattern:'^\\d+\\.\\d+\\.\\d+$'},cli:{type:'string',maxLength:64,pattern:'^\\d+\\.\\d+\\.\\d+$'},provider:{enum:['bedrock','claude-api']},cacheWriteTtl:{enum:['5m','1h']},priceRevision:identifier}),
  UsageRunDelta:object({sdkEstimateUsd:money,modelCounters:models('UsageModelCounters')}),
  UsageCumulative:object({sdkEstimateUsd:money,basis:ref('UsageBasis'),models:models('UsageModelEstimate')}),
  RecordedUsage:object({status:{enum:['recorded','unavailable']},reason:nullable({enum:usageUnavailableReasons}),currency:{const:'USD'},
   runDelta:nullable(ref('UsageRunDelta')),cumulative:nullable(ref('UsageCumulative')),providerBilledUsd:{type:'null'}}),
  RecordedToolOutcome:object({name:identifier,executionOutcome:{enum:['completed','failed']},durationMs:nullable(count)}),
  RecordedToolAudit:object({coverage:{const:'recorded-hooks-only'},partial:{type:'boolean'},omitted:count,tools:{type:'array',maxItems:128,items:ref('RecordedToolOutcome')}}),
  ConversationUsageResponse:object({...identity,recording:{enum:['not-recorded','recorded']},usage:nullable(ref('RecordedUsage')),toolAudit:nullable(ref('RecordedToolAudit'))}),
 }};
}
