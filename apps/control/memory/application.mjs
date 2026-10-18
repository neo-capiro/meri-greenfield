/** The memory product application: the memory routes over the membership-gated product mount, with each request's producer bound to
 * the bearer that request was admitted with (`bearer-custody.mjs`). `producerFor({principal,bearer})` is the family's: it builds the
 * Core client over the trusted service identity and this bearer, the shared journal and the review/decision adapters. Nothing here
 * opens a connection, reads a secret or calls Core; those happen inside the request's own lifetime. */
import {createProductApplication} from '../product-access/http.mjs';
import {refuse} from '../product-access/errors.mjs';
import {createBearerCustody} from './bearer-custody.mjs';
import {createMemoryRoutes} from './routes.mjs';
import {MEMORY_LIMITS as L,MEMORY_PATHS} from './protocol.mjs';
export function createMemoryApplication({gate,producerFor,now,limits}){
 if(typeof producerFor!=='function'||typeof now!=='function'||!limits||typeof limits!=='object')refuse('PRODUCT_CONFIGURATION');
 const custody=createBearerCustody({gate});
 const routes=createMemoryRoutes({producerFor:({principal})=>producerFor({principal,bearer:custody.bearerOf(principal)})});
 const application=createProductApplication({gate:custody.gate,routes,now,limits:{
  maxRequestMs:Math.min(limits.maxRequestMs,L.maxRequestMs),maxRequestBytes:Math.min(limits.maxRequestBytes,L.maxRequestBytes),maxResponseBytes:Math.min(limits.maxResponseBytes,L.maxResponseBytes)}});
 return Object.freeze({paths:Object.freeze(Object.values(MEMORY_PATHS)),handle:request=>application.handle(request)});
}
