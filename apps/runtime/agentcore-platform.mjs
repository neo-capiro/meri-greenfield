/** The platform's own evidence that this process runs inside an AgentCore runtime container.
 *
 * An AgentCore microVM is a platform isolation boundary with fixed memory and CPU for the whole runtime session, and it
 * exposes exactly one unlimited root cgroup (`levels:1`, `mountRootIsRoot:true`, every bound `max`) that uid 1000 can
 * neither tighten nor leaf. The shared sandbox gate therefore cannot observe a finite cgroup there, and a gate a lower
 * layer already enforces is not kept: when BOTH the AgentCore runtime identity the entrypoint verifies before serving
 * (`agentcoreEnvironment`: the control origin, its pinned CA and the region) AND that microVM cgroup shape are observed,
 * the evaluators attest `boundedResources` as `boundedBy:'agentcore-microvm'` (see `platformBoundedCgroup`).
 *
 * This is not a flag a deployment sets: the identity is the runtime's verified environment, and the shape is the
 * observed hierarchy. An EC2 native host or a local checkout has neither, so the finite-cgroup requirement stands there. */
import {agentcoreEnvironment} from './agentcore-control-client.mjs';
export const AGENTCORE_PLATFORM='agentcore';
/** `{runtime:'agentcore'}` when the verified AgentCore runtime environment is present; null otherwise. Never throws. */
export function agentcoreRuntimePlatform(environment=globalThis.process?.env??{}){
 try{agentcoreEnvironment(environment);}catch{return null;}
 return Object.freeze({runtime:AGENTCORE_PLATFORM});
}
