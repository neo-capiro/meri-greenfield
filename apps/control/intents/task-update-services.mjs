/** Task-update composition over the existing durable owners and fixed Core HTTP source. Inert until called.
 * Borrowed pools, authority, approval and credential owners remain caller-owned. Source connectivity defaults off. */
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {assertTaskUpdateProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {createCommandIntentValidator} from '../../../packages/contracts/commands-0.2/execution-intent.mjs';
import {taskUpdateValidators} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {commandToolValidators,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data,deny} from '../commands/protocol.mjs';
import {createPostgresApprovalMetadataStore,createTaskUpdateApprovalMetadataOwner} from '../commands/approval-metadata/index.mjs';
import {createPostgresCommandJournal} from '../commands/postgres-command-journal.mjs';
import {createPostgresCommandExecutor} from '../commands/durable-executor.mjs';
import {createCommandHttpSource} from '../commands/source-http.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {createCommandIntentPreparer} from './command-preparer.mjs';
const descriptor=resolveOperationContract({id:'update_task',version:'0.2.0'}).descriptor;
export function createTaskUpdateServices(configuration){
 const c=own(configuration,['metadata','command','source','commandContext','now','newId','limits'],['sourceEnabled']);
 const meta=own(c.metadata,['pool','preparePolicy']),cmd=own(c.command,['journalPool','budgetPool','allocationJson','producerContext','authority','approvalStore']);
 const source=own(c.source,['origin','getCredentials','fetchImpl']),context=data(c.commandContext),limits=data(c.limits),producerContext=data(cmd.producerContext);
 own(producerContext,['context','producer']);validateShape('RunBinding',producerContext.context?.binding);
 own(limits,['maxRequestMs','maxFactBytes','maxResponseBytes','maxCleanupMs']);
 if(typeof c.now!=='function'||typeof c.newId!=='function'||typeof(c.sourceEnabled??false)!=='boolean'||
  !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>60000||
  ['tenantId','actorId','conversationId','runId'].some(k=>producerContext.context.binding[k]!==context.binding?.[k]))deny('COMMAND_CONFIGURATION');
 const approvalMetadataOwner=createTaskUpdateApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:meta.pool}),commandContext:context,
  preparePolicy:meta.preparePolicy,now:c.now,newId:c.newId,maxRequestMs:limits.maxRequestMs});
 const executor=createPostgresCommandExecutor({pool:cmd.budgetPool,allocationJson:cmd.allocationJson,producerContext,
  journal:createPostgresCommandJournal({pool:cmd.journalPool}),authority:cmd.authority,approvalStore:cmd.approvalStore,
  source:createCommandHttpSource({...source,now:c.now,maxResponseBytes:limits.maxResponseBytes}),
  contracts:createCommandIntentValidator({taskUpdate:taskUpdateValidators}),
  descriptor:data({action:'task.update',operation:descriptor.operation,requiredGrants:descriptor.requiredGrants,sourceRequirements:descriptor.sourceRequirements}),
  context,now:c.now,newId:c.newId,limits:{maxRequestMs:limits.maxRequestMs,maxResponseBytes:limits.maxResponseBytes,maxCleanupMs:limits.maxCleanupMs},sourceEnabled:c.sourceEnabled??false});
 const commandOptions=Object.freeze({operation:descriptor.operation,action:'task.update',outputShape:descriptor.outputSchema.id.split('#/$defs/')[1],
  commandContext:context,validators:commandToolValidators,assertProposal:assertTaskUpdateProposal,approvalMetadataOwner,executor,now:c.now,
  limits:data({maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes})});
 return Object.freeze({commandOptions,commandExecutor:executor,commands:createCommandToolInterface(commandOptions),preparer:createCommandIntentPreparer({commandOptions})});
}
