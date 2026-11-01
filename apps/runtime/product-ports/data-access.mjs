/** Data-access center family: the read-family coverage view (`apps/control/data-access/reader.mjs`) mounted as `dataAccessApplication`
 * over the canonical Core membership gate. It composes only when typed reads are configured (`reads.enabled` with the agentcore
 * approved-read installation) AND the prepared candidate supplies its membership owner; otherwise it contributes no port, so
 * `/api/data-access/read` answers DATA_ACCESS_UNAVAILABLE and product readiness reports `data-access.application: unavailable`.
 * Construction is ordinary and synchronous: no SQL, connection or secret read. The policy comes from the same settings store and
 * resolver that decide every run's reads (`capability-policy.mjs`). */
import {createProductApplication} from '../../control/product-access/http.mjs';
import {createDataAccessReader} from '../../control/data-access/reader.mjs';
import {createDataAccessRoutes} from '../../control/data-access/http.mjs';
import {DATA_ACCESS_LIMITS as L} from '../../control/data-access/protocol.mjs';
import {createConfiguredRunCapabilityPolicy} from './capability-policy.mjs';
export function createDataAccessFamily(context){
 const {configuration,pool,now=Date.now,canonicalProductPorts}=context??{};
 const installation=configuration?.agentcore?.approvedReads;
 if(configuration?.reads?.enabled!==true||installation?.enabled!==true)return {ports:{}};
 const gate=canonicalProductPorts?.conversationMembership;
 if(gate===undefined)return {ports:{}};
 const policy=createConfiguredRunCapabilityPolicy(configuration,{pool});
 const reader=createDataAccessReader({installed:installation.operations,policyForActor:value=>policy.forActor(value),now});
 const application=createProductApplication({gate,routes:createDataAccessRoutes({reader}),now,limits:{
  maxRequestMs:Math.min(configuration.limits.requestMs,L.maxRequestMs),
  maxRequestBytes:Math.min(configuration.limits.requestBytes,L.maxRequestBytes),
  maxResponseBytes:Math.min(configuration.native.maxResponseBytes,L.maxResponseBytes)}});
 return {ports:{dataAccessApplication:Object.freeze({handle:request=>application.handle(request)})}};
}
