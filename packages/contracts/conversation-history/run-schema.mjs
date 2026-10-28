import {RUN_INDEX_SCHEMA,RUN_DETAIL_SCHEMA,runIndexMetadata,runIndexErrorStatuses} from './run-protocol.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable=schema=>({anyOf:[schema,{type:'null'}]});
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'};
const date={type:'string',format:'date-time',pattern:'Z$'};
const integer={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER};
const cursor=nullable({type:'string',minLength:1,maxLength:1024,pattern:'^[A-Za-z0-9_-]+$'});
const state={enum:['queued','starting','running','waiting-for-approval','paused','completed','failed','cancelled']};
const scope={oneOf:[object({kind:{enum:['all','general']}}),object({kind:{const:'client'},clientId:uuid})]};
const summary=object({conversationId:uuid,runId:uuid,createdAt:date,state,statusAt:date,lastSequence:{...integer,minimum:1},
 clientIds:{type:'array',items:uuid,uniqueItems:true,maxItems:4096},
 usage:object({recording:{enum:['not-recorded','recorded','unavailable']},sdkEstimateUsd:nullable({type:'number',minimum:0,maximum:Number.MAX_SAFE_INTEGER/1e6}),providerBilledUsd:{type:'null'}}),
 references:object({conversationId:uuid,runId:uuid})});
export function runIndexSchema(){return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:runIndexMetadata.schemaId,$defs:{
 RunIndexListRequest:object({schemaVersion:{const:RUN_INDEX_SCHEMA},scope,status:{enum:['all','active','terminal']},cursor,limit:{type:'integer',minimum:1,maximum:20}}),
 RunIndexDetailRequest:object({schemaVersion:{const:RUN_DETAIL_SCHEMA},conversationId:uuid,runId:uuid}),
 RunIndexSummary:summary,
 RunIndexListResponse:object({schemaVersion:{const:RUN_INDEX_SCHEMA},observedAt:date,scope,status:{enum:['all','active','terminal']},runs:{type:'array',items:summary,maxItems:20},nextCursor:cursor,
  coverage:object({kind:{const:'current-authorized-durable-runs'},complete:{type:'boolean'},snapshot:{const:false}})}),
 RunIndexDetailResponse:object({schemaVersion:{const:RUN_DETAIL_SCHEMA},observedAt:date,run:summary,
  continuation:object({kind:{const:'conversation-owner'},physicalStopVerified:{const:false}})}),
 RunIndexErrorResponse:object({error:object({code:{enum:Object.keys(runIndexErrorStatuses)}})})
 }};}
