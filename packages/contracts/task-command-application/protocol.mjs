/** Receiving metadata describes transport and integrity only; it grants no authority. */
export const taskCommandVersion='0.1.0';
export const taskCommandSchemaId='urn:meri:task-command-application:0.1.0';
export const taskCommandPaths=Object.freeze({prepare:'/api/task-commands/prepare',execute:'/api/task-commands/execute'});
export const taskCommandLimits=Object.freeze({requestBytes:16777216,responseBytes:16777216,jsonNodes:100000,jsonDepth:64});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const createTaskCommandMetadata=(errorStatuses,errorOutcomes)=>freeze({contractVersion:taskCommandVersion,schemaId:taskCommandSchemaId,
 routes:{prepare:{method:'POST',path:taskCommandPaths.prepare,response:'json'},execute:{method:'POST',path:taskCommandPaths.execute,response:'json'}},
 authentication:{scheme:'Bearer',authority:'trusted session resolution and current server approval/command owners',expectedContext:'independently authenticated tenantId, actorId, conversationId and runId'},
 limits:taskCommandLimits,errorStatuses,errorOutcomes,
 semantics:{preparation:'approval_required is an immutable proposal, never approval',execution:'observed requires a succeeded receipt and matching task result; indeterminate is not success',expiry:'caller checks createdAt/expiresAt against a fresh clock before display and execution; server rechecks current authority',resume:'attemptId, workerId and writerFence may change within the same stable tenant/actor/conversation/run binding'}});
