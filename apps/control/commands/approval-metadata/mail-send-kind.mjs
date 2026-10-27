import {normalizeMailSendInput,assertMailSendCommand,assertMailSendProposal} from '../../../../packages/contracts/commands-0.2/validate.mjs';
/** Uses the existing immutable metadata owner; preparing this command sends no mail. */
export const mailSendKind=Object.freeze({operation:Object.freeze({id:'mail_send',version:'0.2.0'}),
 contextShape:'MailSendContext',contractVersion:'0.2.0',normalize:normalizeMailSendInput,
 assertCommand:assertMailSendCommand,assertProposal:assertMailSendProposal});
