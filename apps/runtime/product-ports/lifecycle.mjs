/** Conversation lifecycle owners family (resume / fork / approval wait) for the production product-port composer.
 *
 * - `transitionAuthority` and `continuationAdmission` stay ABSENT: Core implements no native continuation operations
 *   (`continuation/admit`, `continuation/retire`, current-transition authority), and no Meri owner may stand in for them. Product
 *   readiness reports `lifecycle.currentAuthority` and `lifecycle.admissionRetirement` unavailable; resume and fork refuse
 *   `LIFECYCLE_OWNER_UNAVAILABLE` before any effect.
 * - `approvals {read, readDecision}` is composed only when it is honest:
 *     the shared intents composition (`intents.mjs`) is `composed`, i.e. `configuration.intents.enabled === true` asserts Core's
 *     approval owner is live, the membership gate exists and the `meri_intents` migration is applied; its `readDecision` (the same
 *     native decision adapter the decide route and every per-run executor use) answers `approvals.readDecision`; AND
 *     the proposal reader is Meri's own (dot PR #121 6246551969 item 4): by default the intent journal's read-only custody of the
 *     PREPARED command proposal (`createPostgresCommandProposalReader` over the same control pool), returned only to the run's own
 *     tenant, actor and conversation. `createLifecycleFamilyWith({readProposal})` substitutes another trusted reader.
 *   With intents disabled or ungated, a decision reader over an unimplemented Core operation would only make readiness claim
 *   `composed`, so nothing is supplied: approval.wait refuses `APPROVAL_OWNER_UNAVAILABLE`.
 * - Execution guard: neither port takes a credential. A <=120 s approved-execution capability therefore can never bootstrap a
 *   pre-approval wait, a resume or any other continuation; a decision is always the CURRENT one read through the native
 *   `approval/decision` operation with the control's own authority.
 * Construction is inert: no native call, SQL or secret read. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {createPostgresCommandProposalReader} from '../../control/intents/postgres-journal.mjs';
import {intentsComposition} from './intents.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const refused=()=>fault('APPROVAL_REFUSED');
/** The lifecycle `approvals.read` port over the intent journal's proposal custody. Closed input: no credential is accepted. */
export function createJournalProposalReader({pool}){
 const reader=createPostgresCommandProposalReader({pool});
 return async function readProposal(value){
  let v;try{v=own(value,['proposalId','binding','scopes'],['signal']);validateShape('RunBinding',data(v.binding));}catch{throw refused();}
  const b=v.binding;
  const proposal=await reader.readProposal({tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,proposalId:v.proposalId,...(v.signal===undefined?{}:{signal:v.signal})});
  if(proposal===null||proposal.command.binding.runId!==b.runId)throw refused();
  return proposal;
 };
}
export function createLifecycleFamilyWith({readProposal}={}){
 if(readProposal!==undefined&&(typeof readProposal!=='function'||types.isProxy(readProposal)))throw fault('LIFECYCLE_CONFIGURATION');
 return function createLifecycleFamily(context){
  const shared=intentsComposition(context);
  if(shared.state!=='composed'||typeof shared.readDecision!=='function')return {ports:{}};
  const read=readProposal??createJournalProposalReader({pool:context.pool});
  return {ports:{approvals:Object.freeze({read:value=>read(value),readDecision:value=>shared.readDecision(value)})}};
 };
}
/** Production family for `PRODUCT_FAMILIES`: `['lifecycle', createLifecycleFamily]`; approvals only when intents are composed. */
export const createLifecycleFamily=createLifecycleFamilyWith();
