/** Closed immutable browser approval preparation retained by Meri's approval-metadata owner.
 *
 * This is PROVENANCE the human was shown, never a permission: Core owns the decision, the one-time
 * consumption and the effect result. The subject carries the complete RunBinding and the exact
 * tool-use identity so a correlation hash alone can never authorize an action. */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const BROWSER_APPROVAL_PREPARATION_SCHEMA='meri-browser-approval-preparation/1';
export const BROWSER_ACTION_SCHEMA='meri-browser-action/1';
export const BROWSER_ACTION='browser.action';
export const BROWSER_ACTION_OPERATION=Object.freeze({id:'request_browser_action',version:'0.2.0'});
const HEX=/^[0-9a-f]{64}$/u;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const fail=code=>{throw Object.assign(Error(code),{code});};
const deny=()=>fail('COMMAND_PREPARATION_REFUSED');
const hex=value=>{if(typeof value!=='string'||!HEX.test(value))deny();return value;};
const text=(value,max)=>{if(typeof value!=='string'||!value||value.length>max)deny();return value;};
const ms=value=>{if(!Number.isSafeInteger(value)||value<1)deny();return value;};
/** Bounded display copy: the exact approved input, JSON data only. */
const displayCopy=value=>{const copy=data(value);if(Buffer.byteLength(JSON.stringify(copy),'utf8')>65536)deny();return copy;};
const origin=value=>{
 let url;try{url=new URL(value);}catch{deny();}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.hash||url.pathname!=='/'||url.search)deny();
 return url.origin;
};
/** The exact browser subject: complete RunBinding plus the tool-use identity the host captured. */
export function assertBrowserActionSubject(raw){
 const s=data(own(raw,['schema','binding','server','tool','toolUseId','inputSha256','pageOrigin','policySha256']));
 if(s.schema!==BROWSER_ACTION_SCHEMA)deny();
 validateShape('RunBinding',data(s.binding));
 return Object.freeze({schema:BROWSER_ACTION_SCHEMA,binding:Object.freeze(data(s.binding)),
  server:text(s.server,256),tool:text(s.tool,256),toolUseId:text(s.toolUseId,256),
  inputSha256:hex(s.inputSha256),pageOrigin:origin(s.pageOrigin),policySha256:hex(s.policySha256)});
}
/** Command arguments carried inside the stored command: the whole preparation minus its own schema tag. */
export function assertBrowserActionArguments(raw){
 const a=data(own(raw,['subject','subjectSha256','input','requestedAtMs','expiresAtMs']));
 const subject=assertBrowserActionSubject(a.subject),subjectSha256=hex(a.subjectSha256);
 if(canonicalSha256(subject)!==subjectSha256)deny();
 if(ms(a.requestedAtMs)>=ms(a.expiresAtMs))deny();
 const input=displayCopy(a.input);
 if(canonicalSha256(input)!==subject.inputSha256)deny();
 return Object.freeze({subject,subjectSha256,input,requestedAtMs:a.requestedAtMs,expiresAtMs:a.expiresAtMs});
}
/** The closed preparation the owner stores: arguments plus the explicit schema tag. */
export function assertBrowserApprovalPreparation(raw){
 const p=data(own(raw,['schema','subject','subjectSha256','input','requestedAtMs','expiresAtMs']));
 if(p.schema!==BROWSER_APPROVAL_PREPARATION_SCHEMA)deny();
 const args=assertBrowserActionArguments({subject:p.subject,subjectSha256:p.subjectSha256,input:p.input,
  requestedAtMs:p.requestedAtMs,expiresAtMs:p.expiresAtMs});
 return Object.freeze({schema:BROWSER_APPROVAL_PREPARATION_SCHEMA,...args});
}
export function normalizeBrowserActionArguments(request,{requireInputSha}={}){
 const p=assertBrowserApprovalPreparation(request);
 if(requireInputSha!==undefined&&requireInputSha!==canonicalSha256(argumentsOf(p)))deny();
 return {arguments:Object.freeze({...argumentsOf(p)}),attachments:Object.freeze([])};
}
const argumentsOf=p=>Object.freeze({subject:p.subject,subjectSha256:p.subjectSha256,input:p.input,
 requestedAtMs:p.requestedAtMs,expiresAtMs:p.expiresAtMs});
/** Command-level revalidation inside the immutable envelope: the subject must still hash to its digest,
 * must belong to this exact binding, and must carry no attachments. */
export function assertBrowserActionCommand(command){
 const c=data(own(command,['contractVersion','commandId','binding','action','arguments','attachments','scopes','idempotencyKey'],['requiredApprover']));
 if(c.action!==BROWSER_ACTION||c.contractVersion!=='0.1.0')deny();
 if(!Array.isArray(c.attachments)||c.attachments.length!==0)deny();
 const args=assertBrowserActionArguments(c.arguments);
 if(canonicalSha256(data(args.subject.binding))!==canonicalSha256(data(c.binding)))deny();
 return Object.freeze(args);
}
/** Deterministic identity: the same attempt + tool use always maps to one row. It is a SELECTOR, never
 * proof — the stored payload is always re-read and compared before a repeat resolves. */
export function browserPreparationProposalId({binding,toolUseId}){
 validateShape('RunBinding',data(binding));
 const digest=canonicalSha256({kind:'browser-preparation',binding:data(binding),toolUseId:text(toolUseId,256)});
 const variant=((parseInt(digest[16],16)&0x3)|0x8).toString(16);
 return `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-${variant}${digest.slice(17,20)}-${digest.slice(20,32)}`;
}
/** Owner-level context retained with the record: the binding and the canonical authority the policy
 * receipt returned. It is provenance, not a live grant. */
export function assertBrowserActionContext(raw){
 const c=data(own(raw,['binding','scopes','requiredApprover']));
 validateShape('RunBinding',data(c.binding));
 if(!Array.isArray(c.scopes)||c.scopes.length===0||c.scopes.length>100)deny();
 for(const scope of c.scopes){validateShape('Scope',data(scope));if(scope.tenantId!==c.binding.tenantId)deny();}
 const approver=data(own(c.requiredApprover,['tenantId','actorId']));
 validateShape('Identity',approver);
 if(approver.tenantId!==c.binding.tenantId)deny();
 return Object.freeze({binding:Object.freeze(data(c.binding)),scopes:Object.freeze(c.scopes.map(s=>Object.freeze(data(s)))),
  requiredApprover:Object.freeze(approver)});
}
/** Exact refusal of a substituted preparation: identical identity with different contents never resolves. */
export function sameBrowserPreparation(a,b){return canonicalSha256(data(a))===canonicalSha256(data(b));}
export {UUID as BROWSER_ACTION_UUID};
