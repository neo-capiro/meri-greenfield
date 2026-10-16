/** Accepted additive history wire. Validation supplies no identity, membership, writer or provider authority. */
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const conversationHistoryVersion='1.0.0';
export const DISCOVERY_SCHEMA='meri.conversation-list/1',HISTORY_SCHEMA='meri.conversation-transcript/1',TURN_SCHEMA='meri.conversation-turn/1';
export const HISTORY_PATHS=freeze({list:'/api/conversations/list',transcript:'/api/conversations/transcript',nextTurn:'/api/conversations/next-turn'});
export const historyDomainErrorStatuses=freeze({CONVERSATION_REQUEST_INVALID:400,CONVERSATION_CURSOR_INVALID:400,CONVERSATION_NOT_FOUND:404,CONVERSATION_TURN_CONFLICT:409,CONVERSATION_STORE_CORRUPT:500,CONVERSATION_TURN_UNAVAILABLE:503,CONVERSATION_UNAVAILABLE:503});
export const historyErrorStatuses=freeze({INVALID_REQUEST:[400],UNAUTHENTICATED:[401],ACCESS_DENIED:[403],MEMBERSHIP_REVOKED:[403],NOT_FOUND:[404],METHOD_NOT_ALLOWED:[405],DEADLINE:[408],MEMBERSHIP_CHANGED:[409],REQUEST_TOO_LARGE:[413],UNSUPPORTED_MEDIA_TYPE:[415],CANCELLED:[499],PRODUCT_UNAVAILABLE:[502],...Object.fromEntries(Object.entries(historyDomainErrorStatuses).map(([code,status])=>[code,[status]]))});
export const conversationHistoryMetadata=freeze({packageVersion:'0.1.6',historyVersion:conversationHistoryVersion,schemaId:'urn:meri:conversation-history:1.0.0',
 routes:Object.fromEntries(Object.entries(HISTORY_PATHS).map(([route,path])=>[route,{method:'POST',path}])),
 authentication:{owner:'native identity and current Core membership',header:'authorization',scheme:'Bearer',serverSideCredentialOnly:true,validationGrantsAuthority:false},
 limits:{requestBytes:131072,responseBytes:2097152,pageItems:100},defaults:{limit:50,after:0,before:null},
 cursor:{transcript:'conversation sequence',runLocal:'UIEvent.sequence',translation:'conversation sequence = sequenceBase + UIEvent.sequence'},
 promptIdentity:'conversationId + promptLineage.logicalRequestId',turnRecovery:'same sourceRunId returns same targetBinding; retain exact submit requestId/prompt',
 errorOutcomes:['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED'],errorStatuses:historyErrorStatuses});
