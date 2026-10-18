// @ts-check
/** Reviewable production-host DATA proposal. This module has no AWS/CDK/client import or execution path. */
import {HOST_PROPOSAL_SCHEMA,validateHostProposalBinding} from './binding.mjs';
import {proposeBrowserHostNetwork} from './network.mjs';
import {proposeBrowserHostInstance} from './instance.mjs';
import {proposeBrowserHostWatchdog} from './watchdog.mjs';
export const HOST_ACTIVATION_BLOCKERS=Object.freeze([
 'reviewed-private-host-and-public-egress-change-set',
 'tool-namespace-and-host-firewall-direct-bypass-proof',
 'browser-and-renderer-native-sandbox-proof',
 'sdk-bash-native-sandbox-and-network-approval-proof',
 'task-bound-control-currentness-and-grant-revocation-proof',
 'tls-connect-origin-coalescing-enforcement-proof',
 'managed-deadline-and-exact-root-volume-absence-proof',
 'approval-artifact-image-scan-and-browser-activation-review',
]);
/** @param {unknown} input */
export function compileBrowserHostSourceProposal(input){
 const binding=validateHostProposalBinding(input);
 return Object.freeze({schema:HOST_PROPOSAL_SCHEMA,kind:'source-data-only',runtimeEnabled:false,
  deployable:false,launchAdmitted:false,activation:'held',
  binding,network:proposeBrowserHostNetwork(binding),instance:proposeBrowserHostInstance(binding),
  watchdog:proposeBrowserHostWatchdog(),blockers:HOST_ACTIVATION_BLOCKERS,
  note:'No CloudFormation Resources, IAM policy, route, grant, AWS client or execute switch is emitted.'});
}
