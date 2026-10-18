/** Closed, validated bounds for the current-authority adapters and the reads gateway limits record (`gateway.limits` of
 * `createControlReadsComposer`). No I/O; importable by `config.mjs` without pulling the control tree.
 *
 * `gateway.limits` is the `createToolDispatch` bound set (`maxRequestBytes`, `maxResponseBytes`, `maxRequestMs`, `maxCleanupMs`).
 * D016 / D016-A defaults: one read request body of at most 64 KiB, one result of at most 2 MiB (the P3 per-result bound; the
 * run's own tool-call and cost caps come from its allocation), 30 s per read call (the control request ceiling of `config.mjs`),
 * 3 s cleanup (the execution composition's default). Every value is a validated configurable profile bound, never a hidden
 * universal ceiling. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {deny} from '../../gateway/dispatch/operation-result.mjs';
export const GATEWAY_LIMITS_DEFAULTS=Object.freeze({maxRequestBytes:65536,maxResponseBytes:2097152,maxRequestMs:30000,maxCleanupMs:3000});
export const GATEWAY_LIMIT_BOUNDS=Object.freeze({maxRequestBytes:Object.freeze([1024,131072]),maxResponseBytes:Object.freeze([1024,16777216]),maxRequestMs:Object.freeze([1000,60000]),maxCleanupMs:Object.freeze([100,60000])});
/** Adapter bounds: one Core round trip set per port call, the fact size the gateway parses, the lease an observation may
 * carry (never past any Core expiry, the session or the caller deadline), and the proposal lifetime `preparePolicy` answers. */
export const CURRENT_AUTHORITY_LIMITS=Object.freeze({maxRequestMs:10000,maxFactBytes:131072,maxLeaseMs:30000,proposalTtlMs:900000});
const ADAPTER_BOUNDS=Object.freeze({maxRequestMs:Object.freeze([100,30000]),maxFactBytes:Object.freeze([1024,131072]),maxLeaseMs:Object.freeze([1000,300000]),proposalTtlMs:Object.freeze([1000,86400000])});
function bounded(raw,defaults,bounds){
 let v;try{v=raw===undefined?{}:data(own(raw,[],Object.keys(bounds)));}catch{deny('GATEWAY_CONFIGURATION');}
 const out={...defaults,...v};
 for(const [key,[min,max]] of Object.entries(bounds))if(!Number.isSafeInteger(out[key])||out[key]<min||out[key]>max)deny('GATEWAY_CONFIGURATION');
 return Object.freeze(out);
}
/** The reads gateway limits record from an optional closed `reads.gateway` configuration block. */
export function compileGatewayLimits(raw){return bounded(raw,GATEWAY_LIMITS_DEFAULTS,GATEWAY_LIMIT_BOUNDS);}
/** The adapter bounds from an optional closed override. */
export function compileCurrentAuthorityLimits(raw){return bounded(raw,CURRENT_AUTHORITY_LIMITS,ADAPTER_BOUNDS);}
