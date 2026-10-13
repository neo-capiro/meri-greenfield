/** Concrete borrowed PostgreSQL owners. No service, SQL or source calls during import/construction. */
import {canonicalSha256,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {commandToolValidators,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {data,own,deny} from '../../commands/protocol.mjs';
import {createTaskLookupDelivery,createPostgresTaskLookupStore} from '../../task-lookup/index.mjs';
import {createPostgresApprovalMetadataStore,createTaskCreateApprovalMetadataOwner} from '../../commands/approval-metadata/index.mjs';
import {createPostgresCommandJournal} from '../../commands/postgres-command-journal.mjs';
import {createPostgresCommandExecutor} from '../../commands/durable-executor.mjs';
import {createCommandToolInterface} from '../../commands/tool-interface.mjs';
const entry=resolveOperationContract({id:'create_task',version:'0.2.0'}).descriptor;
const expected=data({action:'task.create',operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements});
export function createDurableActionServices(options){
 const {lookup,metadata,command,commandContext,now,newId,limits,sourceEnabled=false}=own(options,['lookup','metadata','command','commandContext','now','newId','limits'],['sourceEnabled']);
 const read=own(lookup,['pool','gateway','authorize']),meta=own(metadata,['pool','preparePolicy']);
 const cmd=own(command,['journalPool','budgetPool','allocationJson','producerContext','authority','approvalStore','source','contracts','descriptor']);
 const trusted=data({commandContext,producerContext:cmd.producerContext,descriptor:cmd.descriptor,limits});
 own(trusted.limits,['maxRequestMs','maxFactBytes','maxResponseBytes','maxCleanupMs']);
 if(typeof sourceEnabled!=='boolean'||typeof now!=='function'||typeof newId!=='function'||!Number.isSafeInteger(trusted.limits.maxRequestMs)||trusted.limits.maxRequestMs<1||trusted.limits.maxRequestMs>60000||canonicalSha256(trusted.descriptor)!==canonicalSha256(expected)||canonicalSha256(trusted.producerContext.context?.binding)!==canonicalSha256(trusted.commandContext.binding))deny('COMMAND_CONFIGURATION');
 const clock=now,context=trusted.commandContext;
 const delivery=createTaskLookupDelivery({gateway:read.gateway,store:createPostgresTaskLookupStore({pool:read.pool}),authorize:read.authorize,clock});
 const approvalMetadataOwner=createTaskCreateApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:meta.pool}),commandContext:context,preparePolicy:meta.preparePolicy,now:clock,newId,maxRequestMs:trusted.limits.maxRequestMs});
 const commandExecutor=createPostgresCommandExecutor({pool:cmd.budgetPool,allocationJson:cmd.allocationJson,producerContext:trusted.producerContext,journal:createPostgresCommandJournal({pool:cmd.journalPool}),authority:cmd.authority,approvalStore:cmd.approvalStore,source:cmd.source,contracts:cmd.contracts,descriptor:trusted.descriptor,context,now:clock,newId,limits:{maxRequestMs:trusted.limits.maxRequestMs,maxResponseBytes:trusted.limits.maxResponseBytes,maxCleanupMs:trusted.limits.maxCleanupMs},sourceEnabled});
 const commandOptions=Object.freeze({operation:entry.operation,action:'task.create',outputShape:entry.outputSchema.id.split('#/$defs/')[1],commandContext:context,validators:commandToolValidators,assertProposal:assertProposalIntegrity,approvalMetadataOwner,executor:commandExecutor,now:clock,limits:data({maxRequestMs:trusted.limits.maxRequestMs,maxFactBytes:trusted.limits.maxFactBytes})});
 // Canonical interface validates its own boundaries; no approval or effect occurs.
 createCommandToolInterface(commandOptions);
 return Object.freeze({lookup:Object.freeze({lookup:sourceEnabled?delivery.lookup:()=>deny('UNAVAILABLE'),read:delivery.read}),commandOptions,commandExecutor});
}
