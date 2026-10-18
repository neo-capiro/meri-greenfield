/** Request-scoped custody of the admitted native bearer for the memory family.
 *
 * Core's memory routes act AS the member: the receiving routes take the member's live native bearer plus the verified service
 * identity, the decision routes the bearer alone. The product mount (`product-access/http.mjs`) keeps that bearer inside its request
 * closure and hands domain owners only the admitted principal, so the memory routes need a way to reach, for one request, exactly
 * the bearer that request was admitted with and nothing else. This wrapper gate does that without widening the mount: `admit`
 * runs the canonical membership gate, returns a request-private copy of its principal, and remembers the bearer under that object.
 * The principal object is reachable only from that request's handler, so the bearer is released with it; nothing is persisted,
 * logged or shared across requests, and `recheck` is the canonical gate's own (membership facts stay Core's). */
import {refuse} from '../product-access/errors.mjs';
import {closed} from '../product-access/shape.mjs';
export function createBearerCustody({gate}){
 if(typeof gate?.admit!=='function'||typeof gate?.recheck!=='function')refuse('PRODUCT_CONFIGURATION');
 const held=new WeakMap();
 return Object.freeze({
  gate:Object.freeze({
   async admit(call){
    const admitted=closed(await gate.admit(call),['principal','expiresAtMs'],[],'ACCESS_DENIED');
    const principal=Object.freeze({...admitted.principal});
    held.set(principal,Object.freeze({credential:call.credential,expiresAtMs:admitted.expiresAtMs}));
    return Object.freeze({principal,expiresAtMs:admitted.expiresAtMs});
   },
   recheck:call=>gate.recheck(call),
  }),
  /** `{credential, expiresAtMs}` the given principal was admitted with; any other object was never admitted here. */
  bearerOf(principal){const bearer=held.get(principal);if(bearer===undefined)refuse('ACCESS_DENIED');return bearer;},
 });
}
