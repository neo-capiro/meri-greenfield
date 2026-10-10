// Pure composition entry: no deployment, process, or network side effects.
export { TARGET,PLATFORM,NETWORK,ROLE_PINS,LIMITS,WIRE_PROFILE,EVIDENCE_KINDS,sha256,canonical,buildNativeEnforcementAdmission } from './lib/binding.mjs';
export { J } from './lib/expressions.mjs';
export { buildNativeEnforcementStateMachine } from './lib/workflow.mjs';
export { buildNativeEnforcementTemplate } from './lib/infrastructure.mjs';
