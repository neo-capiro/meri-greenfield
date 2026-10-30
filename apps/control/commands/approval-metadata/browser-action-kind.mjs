/** Browser-action metadata codec. Policy, immutable storage, approval and every effect stay with their
 * existing owners; the browser subject is closed in the shared runtime contract and never reinterpreted
 * as a native command. */
import {assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {assertBrowserActionCommand,assertBrowserActionContext,normalizeBrowserActionArguments}
 from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';

export const browserActionKind=Object.freeze({
 operation:Object.freeze({id:'request_browser_action',version:'0.2.0'}),
 contractVersion:'0.1.0',
 assertContext:value=>assertBrowserActionContext(value),
 normalizeCommandInput:request=>normalizeBrowserActionArguments(request),
 assertCommand(command,context){assertBrowserActionCommand(command);assertBrowserActionContext(context);return command;},
 assertProposal(proposal,context){assertProposalIntegrity(proposal);assertBrowserActionCommand(proposal.command);assertBrowserActionContext(context);return proposal;},
});
