/** Memory-specific options for the existing command tool interface. The shared intent and execution composer selects this owner
 * for save_memory; no model request can provide the conversation client, retention gate, metadata store or executor. */
import {canonicalSha256,assertProposalIntegrity} from '../../../packages/contracts/validate.mjs';
import {assertMemoryProposeCommand,validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {commandToolValidators,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {data,deny,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createMemoryApprovalMetadataOwner,MEMORY_COMMAND_OPERATION} from './approval-metadata.mjs';
import {createPostgresMemoryApprovalMetadataStore} from './approval-metadata-store.mjs';

const entry=resolveOperationContract(MEMORY_COMMAND_OPERATION).descriptor;
export const MEMORY_COMMAND_DESCRIPTOR=Object.freeze({action:'memory.propose',operation:entry.operation,
 requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements});
export function createMemoryCommandOptions(configuration){
 const {pool,commandContext,preparePolicy,retention,executor,now,newId,limits}=own(configuration,
  ['pool','commandContext','preparePolicy','retention','executor','now','newId','limits']);
 const context=data(commandContext);validateCommandShape('MemoryProposeContext',context);
 if(typeof executor?.execute!=='function'||typeof retention?.assertServable!=='function'||typeof now!=='function'||typeof newId!=='function')deny('COMMAND_CONFIGURATION');
 const bounds=own(data(limits),['maxRequestMs','maxFactBytes']);
 const owner=createMemoryApprovalMetadataOwner({store:createPostgresMemoryApprovalMetadataStore({pool}),commandContext:context,
  preparePolicy,retention,now,newId,maxRequestMs:bounds.maxRequestMs});
 const assertProposal=(raw,expected)=>{
  const proposal=data(raw);assertProposalIntegrity(proposal);
  const c=data(expected);validateCommandShape('MemoryProposeContext',c);
  if(canonicalSha256(c)!==canonicalSha256(context))deny('COMMAND_PREPARATION_REFUSED');
  assertMemoryProposeCommand(proposal.command,c);
  return proposal;
 };
 return Object.freeze({operation:MEMORY_COMMAND_OPERATION,action:'memory.propose',outputShape:entry.outputSchema.id.split('#/$defs/')[1],
  commandContext:context,validators:commandToolValidators,assertProposal,approvalMetadataOwner:owner,executor,now,limits:bounds});
}
