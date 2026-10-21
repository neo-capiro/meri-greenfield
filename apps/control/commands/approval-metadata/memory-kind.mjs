/** Pending memory command codec only. Policy, immutable storage and review/publication remain their canonical owners. */
import {assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {normalizeMemoryProposeInput,assertMemoryProposeCommand} from '../../../../packages/contracts/commands-0.2/validate.mjs';

export function assertMemoryProposeProposal(proposal,context){
 assertProposalIntegrity(proposal);
 assertMemoryProposeCommand(proposal.command,context);
 return proposal;
}

export const memoryKind=Object.freeze({
 operation:Object.freeze({id:'save_memory',version:'0.2.0'}),contextShape:'MemoryProposeContext',contractVersion:'0.1.0',
 normalize:normalizeMemoryProposeInput,assertCommand:assertMemoryProposeCommand,assertProposal:assertMemoryProposeProposal,
});
