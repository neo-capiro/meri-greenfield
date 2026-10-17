/** Adapters from the intent approval owner (`approval.mjs`) to its canonical owners. Import is inert; nothing here is live.
 *
 * `createNativeIntentApprovals({call,now,maxFactBytes})` maps the decision ports onto the fixed native provider RPC
 * (`native.call(operation,input,{signal})`, the same transport `apps/runtime/control.mjs` uses for `checkpoint/read`):
 *  - `record`       → `approval/record`   {proposal,decision,approver,binding} → {decision:ApprovalDecision,checkedAtMs,revoked}
 *  - `readDecision` → `approval/decision` {proposalId,commandSha256,binding}   → {decision:ApprovalDecision|null,checkedAtMs,revoked}
 *  - `getCurrent`   → the same read, serialized for the command executor's approval guard (`commands/approval-context.mjs`).
 * `approval/decision` is listed as a required provider contract in `apps/runtime/README.md`; `approval/record` is a NEW
 * required Core contract (lane 3 proposal P-INT-10). Core implements neither today, so no composition may claim this live.
 *
 * `createCommandJournalOutcomes({journal,contextFor})` reads the executor's durable result (`meri_command_journal`) for a
 * proposal: `journal` is the executor's own `createPostgresCommandJournal` and `contextFor(proposal)` the exact executor
 * context the composition gave `createCommandExecutor` for that run. Read-only. */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const refused=code=>{throw Object.assign(Error(code),{code});};
export function createNativeIntentApprovals(configuration){
 const c=own(configuration,['call','now','maxFactBytes']);
 if(typeof c.call!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(c.maxFactBytes)||c.maxFactBytes<1||c.maxFactBytes>1048576)refused('INTENT_APPROVAL_CONFIGURATION');
 const receipt=(raw,{nullable})=>{
  const v=data(raw);if(Buffer.byteLength(JSON.stringify(v))>c.maxFactBytes)refused('APPROVAL_RECEIPT_REFUSED');
  own(v,['decision','checkedAtMs','revoked']);if(typeof v.revoked!=='boolean'||!Number.isSafeInteger(v.checkedAtMs))refused('APPROVAL_RECEIPT_REFUSED');
  if(v.decision===null){if(!nullable)refused('APPROVAL_RECEIPT_REFUSED');}else validateShape('ApprovalDecision',v.decision);
  return v;
 };
 const read=async({proposalId,commandSha256,binding,signal})=>{nativeSignal(signal);
  const v=receipt(await c.call('approval/decision',data({proposalId,commandSha256,binding}),{signal}),{nullable:true});
  if(v.decision!==null&&(v.decision.proposalId!==proposalId||v.decision.commandSha256!==commandSha256))refused('APPROVAL_RECEIPT_REFUSED');return v;};
 return Object.freeze({
  async record({proposal,decision,approver,binding,signal}){nativeSignal(signal);
   return receipt(await c.call('approval/record',data({proposal,decision,approver,binding}),{signal}),{nullable:false});},
  async readDecision(value){const v=await read(value);return v.revoked?null:v.decision;},
  /** Approval guard input: a JSON string; an absent decision is a refusal there (no current approval). */
  async getCurrent(value){const v=await read(value);if(v.decision===null)refused('COMMAND_APPROVAL_REFUSED');return JSON.stringify(v);},
 });
}
export function createCommandJournalOutcomes(configuration){
 const c=own(configuration,['journal','contextFor']);
 if(typeof c.journal?.read!=='function'||typeof c.contextFor!=='function')refused('INTENT_APPROVAL_CONFIGURATION');
 return Object.freeze({async read({proposal,signal}){
  nativeSignal(signal);const p=data(proposal),context=data(await c.contextFor(p));
  if(hash(context?.binding)!==hash(p.command.binding))refused('INTENT_OUTCOME_CONTEXT');
  const row=await c.journal.read({proposal:p,context},()=>{if(signal?.aborted)refused('CANCELLED');});
  return row===null?null:data({state:row.state,outcome:row.outcome});
 }});
}
