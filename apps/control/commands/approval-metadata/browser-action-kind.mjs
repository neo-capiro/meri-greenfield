/** Browser-action metadata codec. Policy, immutable storage, approval and every effect stay with their
 * existing owners. The browser variant is admitted by the shared browser contract's OWN integrity
 * validator: the frozen generic command/ApprovalProposal schema is never widened for it. */
import {assertBrowserActionCommand,assertBrowserActionContext,assertBrowserMetadataProposal,
 browserPreparationArguments} from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';

export const browserActionKind=Object.freeze({
 operation:Object.freeze({id:'browser_action',version:'0.2.0'}),
 contractVersion:'0.1.0',
 assertContext:value=>assertBrowserActionContext(value),
 normalizeCommandInput:request=>({arguments:browserPreparationArguments(request),attachments:[]}),
 assertCommand(command,context){assertBrowserActionCommand(command);assertBrowserActionContext(context);return command;},
 assertProposal(proposal,context){assertBrowserMetadataProposal(proposal);assertBrowserActionContext(context);return proposal;},
});
