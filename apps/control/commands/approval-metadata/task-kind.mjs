/** The two canonical task command codecs. Policy, storage and execution belong to their existing owners. */
import {assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {normalizeTaskCreateInput,assertTaskCreateCommand,normalizeTaskUpdateInput,assertTaskUpdateCommand,
 assertTaskUpdateProposal} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {deny} from '../protocol.mjs';
const kinds=Object.freeze({
 'task.create':Object.freeze({operation:Object.freeze({id:'create_task',version:'0.2.0'}),contextShape:'TaskCreateContext',
  contractVersion:'0.1.0',normalize:normalizeTaskCreateInput,assertCommand:assertTaskCreateCommand,assertProposal:assertProposalIntegrity}),
 'task.update':Object.freeze({operation:Object.freeze({id:'update_task',version:'0.2.0'}),contextShape:'TaskUpdateContext',
  contractVersion:'0.2.0',normalize:normalizeTaskUpdateInput,assertCommand:assertTaskUpdateCommand,assertProposal:assertTaskUpdateProposal}),
});
export function taskKind(action){if(typeof action!=='string'||!Object.hasOwn(kinds,action))deny('COMMAND_PREPARATION_REFUSED');return kinds[action];}
