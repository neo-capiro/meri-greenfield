/** Conversation lifecycle owners family (resume / fork / approval wait) for the production product-port composer.
 *
 * - `transitionAuthority` and `continuationAdmission` stay ABSENT: Core implements no native continuation operations
 *   (`continuation/admit`, `continuation/retire`, current-transition authority), and no Meri owner may stand in for them. Product
 *   readiness reports `lifecycle.currentAuthority` and `lifecycle.admissionRetirement` unavailable; resume and fork refuse
 *   `LIFECYCLE_OWNER_UNAVAILABLE` before any effect.
 * - `approvals {read, readDecision}` is composed only when it is honest:
 *     the shared intents composition (`intents.mjs`) is `composed`, i.e. `configuration.intents.enabled === true` asserts Core's
 *     approval owner is live and the membership gate exists; its `readDecision` (the same native decision adapter the decide route
 *     and every per-run executor use) answers `approvals.readDecision`; AND
 *     a trusted proposal reader is supplied: `readProposal({proposalId, binding, scopes, signal}) -> ApprovalProposal`.
 *   No Meri owner reads a proposal by id for the lifecycle (Core's `approval/read` is a required provider contract with no
 *   implementation), so the production family (`createLifecycleFamily`) supplies NO approvals: approval.wait refuses
 *   `APPROVAL_OWNER_UNAVAILABLE` and readiness reports `lifecycle.approvals` unavailable. With intents disabled, a decision reader
 *   over an unimplemented Core operation would only make readiness claim `composed`, so it is never supplied.
 *   `createLifecycleFamilyWith({readProposal})` is the seam for when Core's proposal read exists.
 * Construction is inert: no native call, SQL or secret read. */
import {types} from 'node:util';
import {intentsComposition} from './intents.mjs';
const fault=code=>Object.assign(new Error(code),{code});
export function createLifecycleFamilyWith({readProposal}={}){
 if(readProposal!==undefined&&(typeof readProposal!=='function'||types.isProxy(readProposal)))throw fault('LIFECYCLE_CONFIGURATION');
 return function createLifecycleFamily(context){
  const shared=intentsComposition(context);
  if(readProposal===undefined||shared.state!=='composed'||typeof shared.readDecision!=='function')return {ports:{}};
  return {ports:{approvals:Object.freeze({read:value=>readProposal(value),readDecision:value=>shared.readDecision(value)})}};
 };
}
/** Production family for `PRODUCT_FAMILIES`: `['lifecycle', createLifecycleFamily]` (contributes nothing today). */
export const createLifecycleFamily=createLifecycleFamilyWith();
