/** Conversation lifecycle owners family (resume / fork / approval wait) for the production product-port composer.
 *
 * All three lifecycle ports compose together, only when the shared intents composition (`intents.mjs`) is `composed`
 * (`configuration.intents.enabled === true`, the membership gate exists, the `meri_intents` migration is applied); otherwise the
 * family supplies nothing, product readiness reports `lifecycle.currentAuthority`, `lifecycle.admissionRetirement` and
 * `lifecycle.approvals` unavailable, and resume/fork refuse `LIFECYCLE_OWNER_UNAVAILABLE`, approval.wait `APPROVAL_OWNER_UNAVAILABLE`,
 * before any effect.
 * - `approvals {read, readDecision}`: `read` is Meri's own custody of the PREPARED command proposal (dot PR #121 6246551969 item 4:
 *   `createPostgresCommandProposalReader` over the control pool, returned only to the run's own tenant, actor and conversation;
 *   `createLifecycleFamilyWith({readProposal})` substitutes another trusted reader); `readDecision` is the shared decision adapter,
 *   which with `intents.core` declared is the Core P-INT-10 forwarder (`native-authority/approval-forwarder.mjs`: the approver's
 *   live-session bearer plus the verified service identity, bound to the proposal) and otherwise the provider seam.
 * - `transitionAuthority {readCurrent}` and `continuationAdmission {admit, retire}` (dot 6247464370 item 6): the continuation
 *   authority (`native-authority/continuation-authority.mjs`) over the existing durable owners of THIS control: the conversation
 *   store (run records, allocation journal, current-run join, lifecycle controls) on the control pool, the native stop of the
 *   prepared candidate / run registry (`execution/kickoff/stop` through the trusted native client), the candidate's one selected
 *   client and qualification policy revision, and the control's runtime versions. Composed only when a native candidate is
 *   configured. Fork additionally needs the initial-run-binding owners (dynamic initial runs): the journal over the same pool, the
 *   prepared-run configuration digest and the reviewed run window; `createLifecycleFamilyWith({continuation:{fork}})` substitutes
 *   trusted owners for tests. `assembleControl` then wires `sessions.verifyTransition` over the candidate identity context's
 *   `resolveTransitionContext` and the journal's `readTransition` by itself.
 * - Execution guard: no port takes a credential. A <=120 s approved-execution capability can never bootstrap a pre-approval wait,
 *   a resume or any other continuation; a decision is always the CURRENT one read through the decision adapter.
 * Construction is inert: no native call, SQL or secret read. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createPostgresCommandProposalReader} from '../../control/intents/postgres-journal.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {allocation} from '../../gateway/budget/tool-budget-binding.mjs';
import {compilePreparedCandidateConfiguration} from '../prepared-candidate-config.mjs';
import {compilePreparedRunConfigurationSha256} from '../prepared-run-configuration.mjs';
import {createContinuationAuthority} from '../native-authority/continuation-authority.mjs';
import {intentsComposition} from './intents.mjs';
const fault=code=>Object.assign(new Error(code),{code});
const refused=()=>fault('APPROVAL_REFUSED');
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
/** The native stop operation of the prepared candidate / run registry (control capability): the retirement's physical stop. */
export const NATIVE_STOP_OPERATION='execution/kickoff/stop';
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
function captureContinuation(continuation){
 if(continuation===undefined)return null;
 let c;try{c=own(continuation,[],['fork','stop','store']);}catch{throw fault('LIFECYCLE_CONFIGURATION');}
 if(c.fork!==undefined){try{own(c.fork,['initialBindings','configurationSha256','proposeInitialExpiry']);}catch{throw fault('LIFECYCLE_CONFIGURATION');}}
 if(c.stop!==undefined&&!ordinary(c.stop)||c.store!==undefined&&(c.store===null||typeof c.store!=='object'||types.isProxy(c.store)))throw fault('LIFECYCLE_CONFIGURATION');
 return Object.freeze(c);
}
/** The continuation authority of this control over its own durable owners; null without a native candidate. */
function continuationAuthority(context,owners){
 const configuration=context.configuration;
 if(configuration?.nativeCandidate===undefined)return null;
 const candidate=compilePreparedCandidateConfiguration(configuration.nativeCandidate,configuration.versions),now=context.now;
 const store=owners?.store??createPostgresConversationStore({pool:context.pool,now});
 const native=context.native;
 const stop=owners?.stop??(({binding,signal})=>native.call(NATIVE_STOP_OPERATION,{binding,executionId:hash(binding)},{signal}));
 let fork=owners?.fork;
 if(fork===undefined&&candidate.multiRun?.dynamicInitialRuns===true){
  const scheduleExpiresAtMs=Date.parse(allocation(candidate.allocationJson).schedule.expiresAt),runWindowMs=candidate.multiRun.runWindowMs;
  fork={initialBindings:createInitialRunBindingJournal({pool:context.pool,now}),configurationSha256:compilePreparedRunConfigurationSha256(configuration),
   proposeInitialExpiry(){const expiresAtMs=Math.min(now()+runWindowMs,scheduleExpiresAtMs);if(expiresAtMs<=now())throw fault('CONTINUATION_WINDOW_EXPIRED');return expiresAtMs;}};
 }
 return createContinuationAuthority({store,stop,selectedClientId:candidate.identity.commandContext.clientResolution.clientId,policyRevision:candidate.qualification.policyRevision,
  versions:configuration.versions,now,limits:{maxRequestMs:Math.min(configuration.limits.requestMs,30000)},...(fork===undefined?{}:{fork})});
}
export function createLifecycleFamilyWith({readProposal,continuation}={}){
 if(readProposal!==undefined&&!ordinary(readProposal))throw fault('LIFECYCLE_CONFIGURATION');
 const owners=captureContinuation(continuation);
 return function createLifecycleFamily(context){
  const shared=intentsComposition(context);
  if(shared.state!=='composed'||typeof shared.readDecision!=='function')return {ports:{}};
  const read=readProposal??createJournalProposalReader({pool:context.pool});
  const authority=continuationAuthority(context,owners);
  return {ports:{approvals:Object.freeze({read:value=>read(value),readDecision:value=>shared.readDecision(value)}),
   ...(authority===null?{}:{transitionAuthority:authority.transitionAuthority,continuationAdmission:authority.continuationAdmission})}};
 };
}
/** Production family for `PRODUCT_FAMILIES`: `['lifecycle', createLifecycleFamily]`; every port only when intents are composed. */
export const createLifecycleFamily=createLifecycleFamilyWith();
