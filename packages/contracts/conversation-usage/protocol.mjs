/** Recorded accounting facts only. This read grants no authority and establishes no external effect. */
import {historyErrorStatuses} from '../conversation-history/protocol.mjs';
export const CONVERSATION_USAGE_SCHEMA='meri.conversation-usage/1';
export const CONVERSATION_USAGE_PATH='/api/conversations/usage';
export const usageUnavailableReasons=Object.freeze(['configuration_mismatch','result_unavailable','baseline_mismatch','baseline_unavailable',
 'baseline_configuration_mismatch','lineage_unavailable','counters_reset','estimate_mismatch','rates_unavailable','amount_out_of_range']);
export const usageCounterNames=Object.freeze(['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens','webSearchRequests']);
export const conversationUsageErrors=Object.freeze({...historyErrorStatuses,USAGE_REQUEST_INVALID:Object.freeze([400]),
 USAGE_RECORD_CORRUPT:Object.freeze([500]),USAGE_UNAVAILABLE:Object.freeze([503])});
export const conversationUsageMetadata=Object.freeze({version:'1.0.0',packageVersion:'0.1.15',schemaId:'urn:meri:conversation-usage:1.0.0',
 path:CONVERSATION_USAGE_PATH,method:'POST',requestBytes:4096,responseBytes:131072,maxModels:32,maxTools:128,
 authentication:'current native product bearer and Core access',currency:'USD',money:'recorded SDK estimate; provider billing unavailable',
 counters:'original token/cache-token counts and web-search request counts',durationUnit:'milliseconds; null means unknown',
 cumulativeScope:'SDK query pipeline including subagents/compaction and prior resumed/forked usage',runScope:'existing accounting run delta',
 tools:'recorded post-tool execution outcomes only; not external-effect confirmation',coverage:'recorded hooks only; omitted count is explicit',
 correlation:'none with UI tool.call requestId, source references or other rows',identifiers:'bounded inert text; never links, commands or authority'});
