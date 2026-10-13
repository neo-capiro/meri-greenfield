/** Trusted passive composition; does not modify catalog or enable a source. */
import {originalTrackingContract,assertOriginalSourceIdentity,ownFields} from './request-context.mjs';
import {createOriginalTrackingHttpAdapter} from './http-adapter.mjs';
import {createOriginalTrackingReadHandler} from './handler.mjs';
export const originalTrackingLiveGate='Qualify exact native original producer identity/owner and current tenant/actor/client or private-task policy; prove bound credential issuance, revocation/fence/budget correlation, cursor authenticity, physical transport retirement and release under the approved isolated runtime. Original source activation and qualified runtime catalog provenance remain separately gated.';
export function createOriginalTrackingSourceMount(options) {
  const {operation:reference,sourceIdentity:configured,origin,getCredentials,now,newId,fetchImpl,maxRequestMs,maxResponseBytes}=
    ownFields(options,['operation','sourceIdentity','origin','getCredentials','now','newId'],['fetchImpl','maxRequestMs','maxResponseBytes']);
  const {operation,contract}=originalTrackingContract(reference),sourceIdentity=assertOriginalSourceIdentity(configured,contract);
  const adapter=createOriginalTrackingHttpAdapter({operation,sourceIdentity,origin,getCredentials,now,
    ...(fetchImpl===undefined?{}:{fetchImpl}),...(maxRequestMs===undefined?{}:{maxRequestMs}),...(maxResponseBytes===undefined?{}:{maxResponseBytes})});
  const execute=createOriginalTrackingReadHandler({operation,adapter,now,newId});
  return Object.freeze({operation,sourceIdentity,execute,availability:'source-implemented',qualification:'pending',liveGate:originalTrackingLiveGate});
}
