/** The ONE Parent-owned join this host cannot implement: canonical allocation/currentness/custody and the placement
 * opener. Nothing here is synthesized from an upload, a request or a local run binding. When Parent's module is absent the
 * host reports `available:false` and refuses to start serving; it never falls back to an unauthenticated or unallocated
 * path, and no local RunBinding is fabricated for uploads.
 *
 * Required Parent API (exact):
 *   authorize({requestId,imageDigest,declarationId,deadlineMs,signal})
 *     -> {authorized:true, allocation, binding, currentness:{phase:'active',checkedAtMs,currentUntilMs}}
 *   openPlacement({allocation,binding,hostIdentity,signal})
 *     -> {placement, network, close}   // finite leaf + no-egress compartment, root bootstrap owned
 */
export const PARENT_JOIN_MODULE='apps/control/native-processing/authority.mjs';
export function loadParentJoin(){return null;}
