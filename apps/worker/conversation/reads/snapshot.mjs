// @ts-check
/** Validation of the trusted availability facts the gateway general-read port returns (`readAvailability`).
 * Both shapes are LOCAL PROPOSALS pending dot; nothing here is a frozen contract:
 *
 * - PROPOSAL P2 projection, `installation`: `{installationId, baseCatalogSha256, executionCatalogSha256,
 *   operations:[OperationRef], checkedAtMs, expiresAtMs}` from the current measured native installation receipt.
 * - PROPOSAL P1, `discovery`: `{binding, policyRevision, operations:[OperationRef], checkedAtMs, expiresAtMs}`, the
 *   per-run eligibility list (claims carry `tool.read`, business policy grants the operation's required grants to this
 *   actor, the operation's sources are enabled for the tenant). Per-call authorization stays authoritative.
 *
 * Anything malformed, foreign, stale or expired refuses, and the caller then mounts no server. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {validateShape as privateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const same=(/** @type {unknown} */a,/** @type {unknown} */b)=>canonicalSha256(a)===canonicalSha256(b),UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,DIGEST=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Object.assign(Error('READ_AVAILABILITY_REFUSED'),{code:'READ_AVAILABILITY_REFUSED'});};
/** @typedef {{id:string,version:string}} OperationRef */
/** @param {unknown} value @returns {OperationRef[]} */
function operationList(value){
 if(!Array.isArray(value)||value.length>128)fail();const seen=new Set();
 for(const op of /** @type {unknown[]} */(value)){privateShape('OperationRef',op);const k=canonicalSha256(op);if(seen.has(k))fail();seen.add(k);}
 return /** @type {OperationRef[]} */(value);
}
/** @param {Record<string,unknown>} r @param {number} at */
const window=(r,at)=>{if(!Number.isSafeInteger(r.checkedAtMs)||!Number.isSafeInteger(r.expiresAtMs)||/** @type {number} */(r.checkedAtMs)>at||/** @type {number} */(r.expiresAtMs)<=at)fail();};
/** @typedef {{installationId:string,baseCatalogSha256:string,executionCatalogSha256:string,operations:OperationRef[],checkedAtMs:number,expiresAtMs:number}} InstallationFacts */
/** @typedef {{binding:unknown,policyRevision:string,operations:OperationRef[],checkedAtMs:number,expiresAtMs:number}} DiscoveryGrant */
/** @param {unknown} raw @param {{binding:unknown,policyRevision:string,catalogSha256:string,now:()=>number}} expected
 * @returns {{installation:InstallationFacts,discovery:DiscoveryGrant,expiresAtMs:number}} */
export function assertAvailabilitySnapshot(raw,{binding,policyRevision,catalogSha256,now}){
 try{
  const s=data(own(raw,['installation','discovery'])),at=now();
  const i=own(s.installation,['installationId','baseCatalogSha256','executionCatalogSha256','operations','checkedAtMs','expiresAtMs']);
  if(typeof i.installationId!=='string'||!UUID.test(i.installationId)||i.baseCatalogSha256!==catalogSha256||typeof i.executionCatalogSha256!=='string'||!DIGEST.test(i.executionCatalogSha256))fail();
  operationList(i.operations);window(i,at);
  const d=own(s.discovery,['binding','policyRevision','operations','checkedAtMs','expiresAtMs']);
  if(!same(d.binding,binding)||d.policyRevision!==policyRevision)fail();operationList(d.operations);window(d,at);
  return {installation:/** @type {InstallationFacts} */(i),discovery:/** @type {DiscoveryGrant} */(d),expiresAtMs:Math.min(/** @type {number} */(i.expiresAtMs),/** @type {number} */(d.expiresAtMs))};
 }catch{return fail();}
}
