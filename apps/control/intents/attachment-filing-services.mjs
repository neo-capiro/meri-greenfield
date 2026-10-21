/** Attachment filing composition over the one command metadata/tool interface.
 * Preparation is read-only except immutable proposal storage. The supplied
 * executor remains the existing approved command owner, disabled until its
 * genuine source identity, registration and approval producers are supplied. */
import {commandToolValidators,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {data,own} from '../commands/protocol.mjs';
import {createPostgresApprovalMetadataStore} from '../commands/approval-metadata/postgres-store.mjs';
import {createCommandApprovalMetadataOwner} from '../commands/approval-metadata/owner.mjs';
import {artifactFileKind} from '../commands/approval-metadata/artifact-file-kind.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {createCommandIntentPreparer} from './command-preparer.mjs';
import {createAttachmentFilingPreparationPolicy} from './attachment-filing-preparation.mjs';

const kind=artifactFileKind('artifact.file'),descriptor=resolveOperationContract(kind.operation).descriptor;

export function createAttachmentFilingServices(configuration){
 const c=own(configuration,['metadata','commandContext','custody','executor','now','newId','limits']);
 const metadata=own(c.metadata,['pool','preparePolicy']),custody=own(c.custody,['artifacts','versions','readContext']),
  commandContext=data(c.commandContext),limits=data(c.limits);
 own(limits,['maxRequestMs','maxFactBytes']);
 const preparePolicy=createAttachmentFilingPreparationPolicy({commandContext,preparePolicy:metadata.preparePolicy,
  ...custody,now:c.now,maxRequestMs:limits.maxRequestMs});
 const approvalMetadataOwner=createCommandApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:metadata.pool}),
  commandContext,preparePolicy,now:c.now,newId:c.newId,maxRequestMs:limits.maxRequestMs},'artifact.file');
 const commandOptions=Object.freeze({operation:descriptor.operation,action:'artifact.file',
  outputShape:descriptor.outputSchema.id.split('#/$defs/')[1],commandContext,validators:commandToolValidators,
  assertProposal:kind.assertProposal,approvalMetadataOwner,executor:c.executor,now:c.now,limits});
 return Object.freeze({commandOptions,commands:createCommandToolInterface(commandOptions),
  preparer:createCommandIntentPreparer({commandOptions})});
}
