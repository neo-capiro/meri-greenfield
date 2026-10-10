// Pure composition entry: no deployment, process, or network side effects.
export { TARGET,PLATFORM,NETWORK,ROLE_PINS,LIMITS,WIRE_PROFILE,EVIDENCE_KINDS,sha256,canonical,buildNativeEnforcementAdmission,buildCanaryEnforcementAdmission,isCanaryBinding } from './lib/binding.mjs';
export { J } from './lib/expressions.mjs';
export { buildNativeEnforcementStateMachine,buildCanaryEnforcementStateMachine } from './lib/workflow.mjs';
export { buildNativeEnforcementTemplate,buildCanaryEnforcementTemplate } from './lib/infrastructure.mjs';
export { buildCanaryTaskDefinitionTemplate } from './canary-task-definition.mjs';
