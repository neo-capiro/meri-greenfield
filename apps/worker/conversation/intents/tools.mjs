// @ts-check
/** Intent rows → SDK tool definitions. One tool per intent name (for example `request_document`), whose `operation`
 * selects among that tool's available capabilities. Descriptions derive only from canonical catalog descriptors.
 * Annotations are never read-only: governed writes prepare review; direct policy-PASS notes may save immediately. */
import {tool} from '@anthropic-ai/claude-agent-sdk';
import {z} from 'zod';
import {intentDescriptor,intentToolName} from './catalog.mjs';
import {intentToolArguments,offeredDocumentFormats} from './schema.mjs';
import {userVocabulary} from '../user-vocabulary.mjs';
const MAX_DESCRIPTION=4096;
export const INTENT_ANNOTATIONS=Object.freeze({readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false});
/** The Word row's model-facing routing for the formats this run offers. The catalog calls it "a Word document", so without this
 * line a request for a PDF never reaches it (2 Nov: the model went looking for a command line instead). A PDF has no separate
 * export operation: it is the same typed content requested with format "pdf".
 * @param {readonly string[]} offered */
const wordFormats=offered=>offered.includes('pdf')
 ?`  Formats: ${offered.join(', ')}. For a PDF, use this operation with format "pdf" and the same content as a Word document; the user receives a PDF file. To give a document already drafted here as a PDF, request it again with format "pdf".`
 :`  Formats: ${offered.join(', ')}. PDF is not available right now; offer a Word document instead.`;
/** @param {readonly import('./catalog.mjs').IntentRow[]} rows @param {Map<string,readonly string[]>} [formats] */
function description(rows,formats){
 const lines=[rows.every(row=>row.owner==='note')?'Save the requested note once through the current Core owner. A static PASS may write immediately; there is no approval step. Report only the returned saved, withheld, blocked, unknown or failed outcome. Never retry an unknown save.':rows.every(row=>row.owner==='memory')?'Prepare the exact memory text and destination scope for review. Preparation does not create a memory candidate or publish memory. The user can approve submission of this exact proposal; successful submission is pending review, not publication.':'Prepare a request for the user\'s approval. This never applies a change: it returns an immutable proposal that the user must approve in Meri, or an immutable draft version.'];
 for(const r of rows){const d=intentDescriptor(r.operation);
  if(r.operation.id==='manage_research_portfolio')lines.push('Management lists and gets return current owner data directly with no approval. Changes, including rule preview which persists a record, still prepare a proposal for approval.',
   "Research Portfolio requests work only in the conversation opened from that portfolio, which is the portfolio they change; it is never a parameter. Anywhere else, tell the user to open the portfolio and ask Meri there instead of trying. parameters are only the selected action's own fields (Core names any it refuses; do not retry the same call): member_create, which adds a bill, program or award, takes expectedRevision (the portfolio's current revision from a read), targetKind (federal_bill, state_bill, program, program_element, project, budget_line or award), targetId (that record's id from a read) and an optional label; only client_link_create and client_link_delete take a clientId.");
  if(r.operation.id==='propose_office_edit')lines.push('action "read" returns the selected Office version identity and its addressable outline directly with no approval; quote a unit\'s current text exactly as "before". action "propose" prepares bounded operations the user applies as a new version of the same document; nothing changes until they apply it.');
  if(r.operation.id==='mail_send')lines.push('Write the email the user asked for, then propose it: mode "send", to, cc, bcc, subject, bodyHtml (plain HTML paragraphs), files [] and original null. The sending mailbox and client come from the connected account of the user; give senderEmail only when the user says which of several addresses to send from. To reply, reply all or forward, read the thread with mail_read_thread and copy one of its nativeActions exactly (mode, senderEmail, to, cc, subject, original; not originalBodyText), adding bodyHtml. To attach a client file, give attachmentId (the document id), fileName, contentType, bytes (its byteSize) and sha256 (its contentHash) from read_client_documents. The user approves the exact message in the approval card: until the result says the provider accepted it, say it is ready to send, never that it was sent. If the refusal says no mailbox is connected, tell the user to connect Outlook or Gmail in Settings.');
  lines.push(`operation "${r.operation.id}": ${d.displayName}. ${d.whenToUse}`);
  for(const example of d.negativeExamples??[])lines.push(`  Do not: ${example}`);
  if(r.operation.id==='create_word')lines.push(wordFormats(offeredDocumentFormats(r.operation,formats)));
  if(r.operation.id==='schedule_task'){
   lines.push('  Give only: taskInstruction (what to do on each run, in full, including which client, portfolio, committee or topic), cadence ("daily", "weekdays", "weekly" or "monthly"), day (weekly: the weekday name; monthly: the day of the month, 1 to 28; omit otherwise), time (24-hour "HH:MM") and timezone (IANA name such as "America/New_York"; UTC when omitted). Each run\'s result goes to the user\'s Meri inbox; the trusted run sets the schedule policy and run limits.');
   lines.push(`  the trusted run completes these into canonical input schema ${d.inputSchema.id}, SHA256 ${d.inputSchema.sha256}; the owner validates the completed request.`);
  }else lines.push(`  arguments follow canonical input schema ${d.inputSchema.id}, SHA256 ${d.inputSchema.sha256}; the owner validates them.`);}
 if(rows.some(r=>r.owner==='document'))lines.push('Every Word, PDF, Excel or PowerPoint file Meri produces comes from this tool. There is no command line, shell or script in Meri: never try one or mention one to the user.');
 lines.push('Supply literal arguments only; identity, tenant, approval, permissions and client selection come from the trusted run, never from arguments. Where a schema names conversationId, the trusted run binds this conversation\'s id; you may omit it, and any value you supply is replaced.');
 // Catalog bytes stay frozen; the model-facing text is projected into the user's vocabulary (`user-vocabulary.mjs`).
 const text=userVocabulary(lines.join('\n'));return text.length>MAX_DESCRIPTION?text.slice(0,MAX_DESCRIPTION):text;
}
/** @param {string} name intent tool name @param {readonly import('./catalog.mjs').IntentRow[]} rows available rows of this tool
 * @param {(raw:any,extra:any)=>Promise<any>} handler @param {Map<string,readonly string[]>} [formats] offered document formats by operation key */
export function defineIntentTool(name,rows,handler,formats){
 const ids=/** @type {[string,...string[]]} */(rows.map(r=>r.operation.id));
 // The advertised arguments are the owner's canonical request schema (proof of the narrowing in `schema.mjs`),
 // never an untyped object: an untyped object tells the model nothing and accepts calls the owner must refuse.
 const shape={operation:z.enum(ids),arguments:intentToolArguments(rows,formats).arguments.describe('The request object for the selected operation'),
  _meriInvocation:z.string().optional().describe('Reserved correlation supplied only by the trusted SDK hook')};
 return Object.freeze({name:intentToolName(name),definition:tool(name,description(rows,formats),shape,handler,{annotations:INTENT_ANNOTATIONS,alwaysLoad:true})});
}
