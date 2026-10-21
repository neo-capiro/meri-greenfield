/** Attachment-only metadata codec. Custody, policy, storage, approvals and
 * execution remain their existing owners; model object references grant none. */
import {assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {normalizeArtifactFileInput,assertArtifactFileCommand} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {deny} from '../protocol.mjs';

const kind=Object.freeze({operation:Object.freeze({id:'save_chat_attachments',version:'0.2.0'}),
 contextShape:'ArtifactFileContext',contractVersion:'0.1.0',
 normalize:(request,context)=>normalizeArtifactFileInput(request,context).arguments,
 normalizeCommandInput:normalizeArtifactFileInput,
 assertCommand:assertArtifactFileCommand,
 assertProposal(proposal,context){assertProposalIntegrity(proposal);assertArtifactFileCommand(proposal.command,context);return proposal;},
});

export function artifactFileKind(action){
 if(action!=='artifact.file')deny('COMMAND_PREPARATION_REFUSED');
 return kind;
}
