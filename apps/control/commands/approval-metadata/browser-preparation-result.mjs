/** ONE strict validator for the retained RESULT of a browser approval preparation.
 *
 * The journal stores exactly {proposalId,subjectSha256,requestSha256,record,recordSha256}. This module is
 * the only place that decides whether such a stored result is genuine: it reuses the canonical browser
 * contracts (request/preparation mapping, deterministic proposal id, C/A/S/I digests, action context) rather
 * than copying DTOs, and it never accepts a partial, legacy or ids-only outcome as "recovered".
 *
 * A producer's acknowledgement may also carry the two observation fields {checkedAtMs, resolved}. They are
 * validated by type and ARE part of the retained fingerprint (stored identity covers the whole ACK object),
 * but they never enter command validation — canonical content is compared separately from them.
 */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {data,own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {BROWSER_ACTION,BROWSER_ACTION_OPERATION,assertBrowserActionContext,
 assertBrowserPreparationDigests,browserCommandSha256,browserPreparationProposalId,
 browserRequestFromPreparation} from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const REFUSED='BROWSER_PREPARATION_RESULT_REFUSED';
const CONFLICT='BROWSER_PREPARATION_CONFLICT';
const HEX=/^[0-9a-f]{64}$/u;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const RECORD=['operation','action','binding','request','inputSha256','commandId','idempotencyKey','proposalId',
 'scopes','createdAt','expiresAt','requiredApprover'];
const FIELDS=['proposalId','subjectSha256','requestSha256','record','recordSha256'];
// The producer's ACK record carries the closed canonical record PLUS two observation fields. They are part
// of the retained fingerprint (so identity is not stripped) but never part of command validation.
const ACK=['checkedAtMs','resolved'];

/** Build the closed result from a producer record. Identity is derived, never accepted from the caller. */
export function browserPreparationResult(record,{requestSha256}={}){
 // Hash the SAME inert snapshot that is stored, so writer and validator can never disagree on bytes.
 const canonical=data(record);
 const value={proposalId:canonical.proposalId,subjectSha256:canonical.request.subjectSha256,requestSha256,
  record:canonical,recordSha256:canonicalSha256(canonical)};
 return assertBrowserPreparationResult(value,{binding:canonical.binding,
  toolUseId:canonical.request.subject.toolUseId});
}

/** Validate a retained prepared result against the ORIGINAL request and binding.
 *  `binding` is the full acting binding, `requestSha256` is the canonical digest of the original request/3
 *  when the caller knows it (always required here). Everything else is re-derived. */
export function assertBrowserPreparationResult(value,{binding,toolUseId}={}){
 let result,record,ackRecord;
 try{
  result=own(data(value),FIELDS);
  if(!HEX.test(String(result.requestSha256)))fail(REFUSED);
  if(!HEX.test(String(result.recordSha256)))fail(REFUSED);
  if(typeof result.proposalId!=='string'||result.proposalId.length===0)fail(REFUSED);
  if(!HEX.test(String(result.subjectSha256)))fail(REFUSED);
  // The hash is over the EXACT stored object, so its key order is preserved: validate the closed key set
  // (canonical record + the two ACK observation fields) without re-keying it.
  const ack=data(result.record);ackRecord=ack;
  const keys=Object.keys(ack);
  if(keys.length<RECORD.length||keys.length>RECORD.length+ACK.length)fail(REFUSED);
  for(const key of RECORD)if(!Object.hasOwn(ack,key))fail(REFUSED);
  for(const key of keys)if(!RECORD.includes(key)&&!ACK.includes(key))fail(REFUSED);
  if(canonicalSha256(ack)!==result.recordSha256)fail(CONFLICT);
  record=Object.fromEntries(RECORD.map(key=>[key,ack[key]]));
  // Canonical action and identity.
  if(record.action!==BROWSER_ACTION)fail(REFUSED);
  if(canonicalSha256(data(record.operation))!==canonicalSha256(data(BROWSER_ACTION_OPERATION)))fail(REFUSED);
  if(record.proposalId!==result.proposalId)fail(CONFLICT);
  // S: the stored request is the canonical PREPARATION; the ORIGINAL request must reconstruct exactly.
  if(record.request.subjectSha256!==result.subjectSha256)fail(CONFLICT);
  const rebuilt=browserRequestFromPreparation(record.request);
  if(canonicalSha256(rebuilt)!==result.requestSha256)fail(CONFLICT);
  // The acting binding, the SDK tool use and the deterministic proposal id must all agree.
  const action=assertBrowserActionContext({binding:record.binding,scopes:record.scopes,
   requiredApprover:record.requiredApprover});
  if(binding!==undefined){
   if(canonicalSha256(data(action.binding))!==canonicalSha256(data(binding)))fail(CONFLICT);
  }
  const tool=record.request.subject.toolUseId;
  if(toolUseId!==undefined&&tool!==toolUseId)fail(CONFLICT);
  const expected=browserPreparationProposalId({binding:action.binding,toolUseId:tool});
  if(expected!==result.proposalId)fail(CONFLICT);
  // C/A/S/I: independent reconstruction against the stored preparation.
  try{assertBrowserPreparationDigests({preparation:record.request,record,
   commandSha256:browserCommandSha256(record)});}catch{fail(CONFLICT);}
  if(canonicalSha256(rebuilt.subject)!==rebuilt.subjectSha256)fail(CONFLICT);
  // S/I domains are verified by the digest helper above; never compare I to the metadata A digest.
  if(typeof rebuilt.subject.inputSha256!=='string')fail(CONFLICT);
  // IDs and times stay canonical: the metadata owner mints UUIDs and ISO instants, so a rehashed string
  // is a tampered record, not an alternative spelling.
  for(const key of ['commandId','idempotencyKey'])
   if(typeof record[key]!=='string'||!UUID.test(record[key]))fail(REFUSED);
  if(typeof record.createdAt!=='string'||!ISO.test(record.createdAt)||
   typeof record.expiresAt!=='string'||!ISO.test(record.expiresAt))fail(REFUSED);
  // Observation fields are typed, never free text: a string clock or string verdict is a tampered ACK.
  if(Object.hasOwn(ack,'checkedAtMs')&&!Number.isSafeInteger(ack.checkedAtMs))fail(REFUSED);
  if(Object.hasOwn(ack,'resolved')&&typeof ack.resolved!=='boolean')fail(REFUSED);
  const created=Date.parse(record.createdAt),expires=Date.parse(record.expiresAt);
 if(!Number.isFinite(created)||!Number.isFinite(expires)||expires<=created)fail(REFUSED);
 }catch(error){if(error?.code)throw error;fail(REFUSED);}
 return Object.freeze({proposalId:result.proposalId,subjectSha256:result.subjectSha256,
  requestSha256:result.requestSha256,record:Object.freeze(data(ackRecord)),recordSha256:result.recordSha256});
}
