/** Independent read-only run wire. These selectors never create execution authority. */
import {historyDomainErrorStatuses,historyErrorStatuses} from './protocol.mjs';
export const RUN_INDEX_SCHEMA='meri.run-index/1';
export const RUN_DETAIL_SCHEMA='meri.run-detail/1';
export const RUN_INDEX_PATHS=Object.freeze({list:'/api/conversations/runs/list',detail:'/api/conversations/runs/detail'});
export const runIndexMetadata=Object.freeze({version:'1.0.0',schemaId:'urn:meri:run-index:1.0.0',requestBytes:4096,responseBytes:131072,pageItems:20,
 order:'createdAt-desc/runId-desc/conversationId-desc',inventory:'current actor owned durable runs; current client access and retention',
 freshness:'current durable observation, not worker liveness or a cross-page snapshot',
 cursor:'opaque selection bound to current principal, membership revision and normalized query; never authority',
 usage:'exact existing accounting reference; missing is not zero; provider billing is unavailable'});
export const runIndexErrors=Object.freeze({...historyDomainErrorStatuses,RUN_INDEX_REQUEST_INVALID:400,RUN_INDEX_CURSOR_INVALID:400,RUN_INDEX_NOT_FOUND:404,RUN_INDEX_CORRUPT:500,RUN_INDEX_UNAVAILABLE:503});
export const runIndexErrorStatuses=Object.freeze({...historyErrorStatuses,...Object.fromEntries(Object.entries(runIndexErrors).map(([code,status])=>[code,[status]]))});
