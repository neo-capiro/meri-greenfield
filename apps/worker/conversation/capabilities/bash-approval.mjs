// @ts-check
/** Approval gate for networked Bash, through the same canonical approval owner the browser uses
 * (`browser/approval-binding.mjs`). The line is structural, not a command classifier: a sandboxed Bash command with no
 * network (empty `sandboxNetworkDomains`) can only touch the conversation workspace and is auto-allowed by the SDK
 * because it runs sandboxed; a sandboxed Bash command WITH network can reach an external system, so every such call
 * is decided before it runs. `bash-sandbox.mjs` then sets `autoAllowBashIfSandboxed:false`, so each call reaches this
 * `canUseTool`, and the fragment validator refuses networked Bash with auto-allow.
 *
 * The approval SUBJECT (`meri-bash-command/1`) is the full run binding, the tool, the tool-use id, the canonical
 * SHA-256 of the exact input that will run, the canonical digest of the run's SDK sandbox settings and the digest of
 * the run's domain allowlist. Its canonical digest replaces `commandSha256` in the canonical `ApprovalDecision`. The
 * owner (`approvals.decide`) authenticates the approver, presents the proposal, checks current authority and consumes
 * the decision once; this gate accepts only a consumed `approved` decision for exactly this subject, once per
 * proposal/consumption/tool-use in the run. The owner does not yet accept this subject (proposal in the lane file). */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createReplayLedger,receiptRefusal} from '../browser/approval-binding.mjs';
import {decideWithin,EXPIRED,ABORTED,APPROVAL_DEADLINE_MS} from '../browser/permissions.mjs';
export const BASH_APPROVAL_SUBJECT_SCHEMA='meri-bash-command/1';
export const BASH_APPROVAL_REQUEST_SCHEMA='meri-bash-approval-request/1';
export const BASH_APPROVAL_RECEIPT_SCHEMA='meri-bash-approval-receipt/1';
const MAX_INPUT=16384;
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
/** @param {{binding:object,toolUseId:string,input:object,sandboxSha256:string,domainsSha256:string}} facts */
export function bashApprovalSubject({binding,toolUseId,input,sandboxSha256,domainsSha256}){
 return Object.freeze({schema:BASH_APPROVAL_SUBJECT_SCHEMA,binding:structuredClone(binding),tool:'Bash',toolUseId,inputSha256:canonicalSha256(input),sandboxSha256,domainsSha256});
}
/** @param {{subject:ReturnType<typeof bashApprovalSubject>,input:object,requestedAtMs:number,expiresAtMs:number}} input */
export function bashApprovalRequest({subject,input,requestedAtMs,expiresAtMs}){
 return {schema:BASH_APPROVAL_REQUEST_SCHEMA,subject:structuredClone(subject),subjectSha256:canonicalSha256(subject),input:structuredClone(input),requestedAtMs,expiresAtMs};
}
/** @param {unknown} approvals */
export const isApprovalPort=approvals=>typeof /** @type {{decide?:unknown}} */(approvals)?.decide==='function';
/** @param {{binding:object,approvals:{decide:(request:object,options:{signal:AbortSignal})=>Promise<unknown>},now:()=>number,sandboxSha256:string,domainsSha256:string,approvalDeadlineMs?:number}} input
 * @returns {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
export function createBashApprovalGate({binding,approvals,now,sandboxSha256,domainsSha256,approvalDeadlineMs=APPROVAL_DEADLINE_MS.default}){
 if(!isApprovalPort(approvals)||typeof now!=='function'||![sandboxSha256,domainsSha256].every(d=>typeof d==='string'&&/^[0-9a-f]{64}$/u.test(d))||!Number.isSafeInteger(approvalDeadlineMs)||approvalDeadlineMs<APPROVAL_DEADLINE_MS.min||approvalDeadlineMs>APPROVAL_DEADLINE_MS.max)fail('BASH_APPROVAL_CONFIGURATION');
 const ledger=createReplayLedger();
 return async(name,input,options)=>{
  if(name!=='Bash')return /** @type {any} */(undefined);
  const toolUseID=options?.toolUseID;
  /** @param {string} message @returns {import('@anthropic-ai/claude-agent-sdk').PermissionResult} */
  const deny=message=>({behavior:'deny',message,...(typeof toolUseID==='string'?{toolUseID}:{})});
  try{
   if(typeof toolUseID!=='string'||options?.signal?.aborted)return deny('BASH_APPROVAL_UNAVAILABLE');
   // allowUnsandboxedCommands:false already makes the SDK ignore this flag; a request carrying it is refused outright.
   if(input?.dangerouslyDisableSandbox!==undefined&&input.dangerouslyDisableSandbox!==false)return deny('BASH_UNSANDBOXED_REFUSED');
   const approvedInput=structuredClone(input??{});
   if(JSON.stringify(approvedInput).length>MAX_INPUT)return deny('BASH_APPROVAL_INPUT_LIMIT');
   const requestedAtMs=now(),subject=bashApprovalSubject({binding,toolUseId:toolUseID,input:approvedInput,sandboxSha256,domainsSha256});
   const request=bashApprovalRequest({subject,input:approvedInput,requestedAtMs,expiresAtMs:requestedAtMs+approvalDeadlineMs});
   const signal=options.signal??new AbortController().signal;
   const answer=await decideWithin(approvals,structuredClone(request),signal,approvalDeadlineMs);
   if(answer===EXPIRED||now()>request.expiresAtMs)return deny('BASH_APPROVAL_EXPIRED');
   if(answer===ABORTED||signal.aborted)return deny('BASH_APPROVAL_UNAVAILABLE');
   const refused=receiptRefusal(answer,request,now(),{schema:BASH_APPROVAL_RECEIPT_SCHEMA,prefix:'BASH'});if(refused)return deny(refused);
   if(!ledger.claim(answer))return deny('BASH_APPROVAL_REPLAY');
   return {behavior:'allow',updatedInput:approvedInput,toolUseID};
  }catch{return deny('BASH_APPROVAL_UNAVAILABLE');}
 };
}
