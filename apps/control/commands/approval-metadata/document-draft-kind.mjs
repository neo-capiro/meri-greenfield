/** The existing metadata owner retains the exact prepared document hashes. It never renders or approves. */
import {normalizeDocumentDraftInput,assertDocumentDraftCommand,assertDocumentDraftProposal} from '../../../../packages/contracts/commands-0.2/validate.mjs';

export const documentDraftKind=Object.freeze({
 operation:Object.freeze({id:'create_word',version:'0.2.0'}),contextShape:'DocumentDraftContext',contractVersion:'0.2.0',
 normalize:normalizeDocumentDraftInput,assertCommand:assertDocumentDraftCommand,assertProposal:assertDocumentDraftProposal,
});
