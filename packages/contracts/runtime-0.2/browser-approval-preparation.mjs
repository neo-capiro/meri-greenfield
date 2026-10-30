/** Closed immutable browser approval preparation retained by Meri's approval-metadata owner.
 *
 * The host captures `meri-browser-approval-request/3`; Meri stores the SAME subject/input/window as
 * `meri-browser-approval-preparation/1`, an explicit mapping whose only difference is the outer schema
 * tag. This is PROVENANCE the human was shown, never a permission: Core owns the decision, the one-time
 * consumption and the effect.
 *
 * The frozen generic command/ApprovalProposal schema stays untouched: the browser variant is admitted by
 * this module's own integrity validator, never by widening the native command enum.
 *
 * Four independent digests, deliberately different and never forced equal:
 *   C  = metadata command envelope   -> metadata.commandSha256 (internal integrity/recovery)
 *   A  = {arguments:A,attachments:[]} -> record.inputSha256    (internal normalization)
 *   S  = subject                      -> preparation.subjectSha256 (Core's decision.commandSha256)
 *   I  = input                        -> S.inputSha256
 */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {own,data} from '../commands-0.2/execution-boundary.mjs';

export const BROWSER_ACTION='browser.action';
export const BROWSER_ACTION_KIND_VERSION='0.1.0';
export const BROWSER_ACTION_OPERATION=Object.freeze({id:'browser_action',version:'0.2.0'});
export const BROWSER_ACTION_SCHEMA='meri-browser-action/1';
export const BROWSER_APPROVAL_REQUEST_SCHEMA='meri-browser-approval-request/3';
export const BROWSER_APPROVAL_PREPARATION_SCHEMA='meri-browser-approval-preparation/1';
const HEX=/^[0-9a-f]{64}$/u;
const fail=code=>{throw Object.assign(Error(code),{code});};
const deny=()=>fail('COMMAND_PREPARATION_REFUSED');
const shape=fn=>{try{return fn();}catch{deny();}};
const hex=value=>{if(typeof value!=='string'||!HEX.test(value))deny();return value;};
const text=(value,max)=>{if(typeof value!=='string'||!value||value.length>max)deny();return value;};
const millis=value=>{if(!Number.isSafeInteger(value)||value<1)deny();return value;};
/** Bounded display copy: the exact approved input, JSON data only. */
const displayCopy=value=>{const copy=data(value);if(Buffer.byteLength(JSON.stringify(copy),'utf8')>65536)deny();return copy;};
const origin=value=>{
 let url;try{url=new URL(value);}catch{deny();}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.hash||url.pathname!=='/'||url.search)deny();
 return url.origin;
};
const SUBJECT_KEYS=['schema','binding','server','tool','toolUseId','inputSha256','pageOrigin','policySha256'];
const WINDOW_KEYS=['subject','subjectSha256','input','requestedAtMs','expiresAtMs'];
const windowOf=v=>({subject:v.subject,subjectSha256:v.subjectSha256,input:v.input,requestedAtMs:v.requestedAtMs,expiresAtMs:v.expiresAtMs});
/** S: the exact subject one approval authorizes, including the COMPLETE RunBinding. */
export function assertBrowserSubject(raw){
 const s=data(own(raw,SUBJECT_KEYS));
 if(s.schema!==BROWSER_ACTION_SCHEMA)deny();
 shape(()=>validateShape('RunBinding',data(s.binding)));
 return Object.freeze({schema:BROWSER_ACTION_SCHEMA,binding:Object.freeze(data(s.binding)),
  server:text(s.server,256),tool:text(s.tool,256),toolUseId:text(s.toolUseId,256),
  inputSha256:hex(s.inputSha256),pageOrigin:origin(s.pageOrigin),policySha256:hex(s.policySha256)});
}
/** The inner window exactly as the host captured it: subject, its digest, the display input and window. */
export function assertBrowserWindow(raw){
 const w=data(own(raw,WINDOW_KEYS));
 const subject=assertBrowserSubject(w.subject),subjectSha256=hex(w.subjectSha256);
 if(canonicalSha256(subject)!==subjectSha256)deny();
 const requestedAtMs=millis(w.requestedAtMs),expiresAtMs=millis(w.expiresAtMs);
 if(requestedAtMs>=expiresAtMs)deny();
 const input=displayCopy(w.input);
 if(canonicalSha256(input)!==subject.inputSha256)deny();
 return Object.freeze({subject,subjectSha256,input,requestedAtMs,expiresAtMs});
}
/** The host request (v3), accepted verbatim at the authenticated producer. */
export function assertBrowserApprovalRequest(raw){
 const r=data(own(raw,['schema',...WINDOW_KEYS]));
 if(r.schema!==BROWSER_APPROVAL_REQUEST_SCHEMA)deny();
 return Object.freeze({schema:BROWSER_APPROVAL_REQUEST_SCHEMA,...assertBrowserWindow(windowOf(r))});
}
export function assertBrowserApprovalPreparation(raw){
 const p=data(own(raw,['schema',...WINDOW_KEYS]));
 if(p.schema!==BROWSER_APPROVAL_PREPARATION_SCHEMA)deny();
 return Object.freeze({schema:BROWSER_APPROVAL_PREPARATION_SCHEMA,...assertBrowserWindow(windowOf(p))});
}
/** Explicit, lossless mapping request/3 -> preparation/1: only the outer schema tag changes. */
export function browserPreparationFromRequest(raw){
 const request=assertBrowserApprovalRequest(raw);
 return Object.freeze({schema:BROWSER_APPROVAL_PREPARATION_SCHEMA,subject:request.subject,
  subjectSha256:request.subjectSha256,input:request.input,requestedAtMs:request.requestedAtMs,expiresAtMs:request.expiresAtMs});
}
/** Explicit reverse mapping, used to check what Core reconstructs as the original host request. */
export function browserRequestFromPreparation(raw){
 const p=assertBrowserApprovalPreparation(raw);
 return Object.freeze({schema:BROWSER_APPROVAL_REQUEST_SCHEMA,subject:p.subject,subjectSha256:p.subjectSha256,
  input:p.input,requestedAtMs:p.requestedAtMs,expiresAtMs:p.expiresAtMs});
}
/** A: the command argument object carried inside C. */
export function browserPreparationArguments(preparation){
 const p=assertBrowserApprovalPreparation(preparation);
 return Object.freeze({subject:p.subject,subjectSha256:p.subjectSha256,input:p.input,
  requestedAtMs:p.requestedAtMs,expiresAtMs:p.expiresAtMs});
}
/** C: the existing immutable metadata-command reconstruction. Its hash is INTERNAL identity only. */
export function browserMetadataCommand(record){
 return Object.freeze({contractVersion:BROWSER_ACTION_KIND_VERSION,commandId:record.commandId,
  binding:record.binding,action:BROWSER_ACTION,arguments:browserPreparationArguments(record.request),
  attachments:Object.freeze([]),scopes:record.scopes,idempotencyKey:record.idempotencyKey});
}
export const browserCommandSha256=record=>canonicalSha256(browserMetadataCommand(record));
export const browserInputSha256=record=>canonicalSha256({arguments:browserPreparationArguments(record.request),attachments:[]});
/** Deterministic identity: same attempt + tool use always maps to one row. A SELECTOR, never proof. */
export function browserPreparationProposalId({binding,toolUseId}){
 shape(()=>validateShape('RunBinding',data(binding)));
 const digest=canonicalSha256({kind:'browser-preparation',binding:data(binding),toolUseId:text(toolUseId,256)});
 const variant=((parseInt(digest[16],16)&0x3)|0x8).toString(16);
 return `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-${variant}${digest.slice(17,20)}-${digest.slice(20,32)}`;
}
/** Owner-level context retained with the record: binding plus the canonical authority the policy
 * receipt returned. Provenance of one preparation, not a live grant. */
export function assertBrowserActionContext(raw){
 const c=data(own(raw,['binding','scopes','requiredApprover']));
 shape(()=>validateShape('RunBinding',data(c.binding)));
 if(!Array.isArray(c.scopes)||c.scopes.length===0||c.scopes.length>100)deny();
 for(const scope of c.scopes){shape(()=>validateShape('Scope',data(scope)));if(scope.tenantId!==c.binding.tenantId)deny();}
 const approver=data(own(c.requiredApprover,['tenantId','actorId']));
 shape(()=>validateShape('Identity',approver));
 if(approver.tenantId!==c.binding.tenantId)deny();
 return Object.freeze({binding:Object.freeze(data(c.binding)),scopes:Object.freeze(c.scopes.map(s=>Object.freeze(data(s)))),
  requiredApprover:Object.freeze(approver)});
}
/** Command-level admission for the browser variant: no generic Command schema, no native command. */
export function assertBrowserActionCommand(command){
 const c=data(own(command,['contractVersion','commandId','binding','action','arguments','attachments','scopes','idempotencyKey']));
 if(c.action!==BROWSER_ACTION||c.contractVersion!==BROWSER_ACTION_KIND_VERSION)deny();
 if(!Array.isArray(c.attachments)||c.attachments.length!==0)deny();
 const w=assertBrowserWindow(c.arguments);
 if(canonicalSha256(data(w.subject.binding))!==canonicalSha256(data(c.binding)))deny();
 return Object.freeze(w);
}
/** Proposal-level admission: C is rehashed here, never trusted from a record or a caller. */
export function assertBrowserMetadataProposal(proposal){
 const p=data(own(proposal,['proposalId','command','commandSha256','createdAt','expiresAt','requiredApprover']));
 const w=assertBrowserActionCommand(p.command);
 if(canonicalSha256(data(p.command))!==hex(p.commandSha256))deny();
 if(Date.parse(p.expiresAt)<=Date.parse(p.createdAt))deny();
 const approver=data(own(p.requiredApprover,['tenantId','actorId']));
 if(approver.tenantId!==w.subject.binding.tenantId)deny();
 return Object.freeze({proposalId:p.proposalId,commandSha256:p.commandSha256});
}
/** Independent verification of C, A, S and I against a stored record and its preparation. */
export function assertBrowserPreparationDigests({preparation,record,commandSha256}){
 const p=assertBrowserApprovalPreparation(preparation);
 if(record.action!==BROWSER_ACTION||canonicalSha256(data(record.binding))!==canonicalSha256(data(p.subject.binding)))deny();
 if(canonicalSha256(data(p.subject))!==p.subjectSha256)deny();
 if(canonicalSha256(data(p.input))!==p.subject.inputSha256)deny();
 if(hex(record.inputSha256)!==browserInputSha256({...record,request:p}))deny();
 if(hex(commandSha256??record.commandSha256??'')!==browserCommandSha256({...record,request:p}))deny();
 return true;
}
/** Exact refusal of a substituted preparation: identical identity with different contents never resolves. */
export function sameBrowserPreparation(a,b){return canonicalSha256(data(a))===canonicalSha256(data(b));}
