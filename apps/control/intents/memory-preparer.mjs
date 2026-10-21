/** Prepare-only memory proposal composition. The supplied executor must be the governed pending-memory execution owner.
 * Construction is inert; borrowed metadata pool and policy/execution owners remain caller-owned. */
import {commandToolValidators,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {data,own} from '../commands/protocol.mjs';
import {createPostgresApprovalMetadataStore} from '../commands/approval-metadata/postgres-store.mjs';
import {createMemoryProposeApprovalMetadataOwner} from '../commands/approval-metadata/memory-owner.mjs';
import {memoryKind} from '../commands/approval-metadata/memory-kind.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {createCommandIntentPreparer} from './command-preparer.mjs';
import {intentFault} from './faults.mjs';

const descriptor=resolveOperationContract(memoryKind.operation).descriptor;

export function createMemoryProposalServices(configuration){
 const c=own(configuration,['metadata','commandContext','executor','now','newId','limits']);
 const metadata=own(c.metadata,['pool','preparePolicy']),commandContext=data(c.commandContext),limits=data(c.limits);
 try{validateCommandShape(memoryKind.contextShape,commandContext);}catch{throw intentFault('INTENT_CONFIGURATION');}
 const approvalMetadataOwner=createMemoryProposeApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:metadata.pool}),
  commandContext,preparePolicy:metadata.preparePolicy,now:c.now,newId:c.newId,maxRequestMs:limits.maxRequestMs});
 const commandOptions=Object.freeze({operation:descriptor.operation,action:'memory.propose',outputShape:descriptor.outputSchema.id.split('#/$defs/')[1],
  commandContext,validators:commandToolValidators,assertProposal:memoryKind.assertProposal,approvalMetadataOwner,executor:c.executor,
  now:c.now,limits});
 // Both paths use the exact same immutable metadata owner. prepare() cannot execute it.
 return Object.freeze({commandOptions,commands:createCommandToolInterface(commandOptions),preparer:createCommandIntentPreparer({commandOptions})});
}
