/** P2: general-read installation measurement and the control-side receipt issuer. Composed DISABLED by default.
 *
 * Attestation. The measurement is computed IN the measured image (the same in-image measurement step that pins the SDK
 * options and the launch descriptor) from the exact source files the installation owner re-measures on every read. The render
 * pins `measurementSha256` in the reviewed control configuration next to the image digest. The issuer only restates that pinned
 * measurement for one run's binding, scopes and policy revision; it adds no authority of its own and holds no key:
 *  - at construction it refuses unless the measurement hashes to the pin, its base catalog is the runtime catalog, and every
 *    descriptor hash equals the runtime contract's descriptor (drift since measurement ⇒ no installation at all);
 *  - on every read the installation owner (installation.mjs) re-measures each handler's source bytes against
 *    `handlerSourceSha256` (drift ⇒ GENERAL_READ_INSTALLATION_REFUSED ⇒ UNAVAILABLE);
 *  - `revokedOperations` and `enabled:false` withdraw installation without a new image.
 * Receipt shape is installation.mjs `RECEIPT_KEYS`; `executionCatalogSha256` is installed-catalog.mjs's digest. */
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract,validateShape as privateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {executionCatalogSha256} from '../catalog/installed-catalog.mjs';
import {measureGeneralReadFamilySources} from './integration.mjs';

export const GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA='meri.general-read-installation-measurement.v1';
const DIGEST=/^[a-f0-9]{64}$/u,MAX_TTL_MS=60000;
const fault=code=>Object.assign(Error(code),{code});
const refuse=(code='GENERAL_READ_INSTALLATION_REFUSED')=>{throw fault(code);};
const key=op=>`${op.id}@${op.version}`;
/** Deterministic RFC 4122 shaped id (version 5 nibble, variant 10xx) from a digest; an identifier, never a credential. */
export function digestUuid(...parts){
 const h=createHash('sha256').update(parts.join('\u0000')).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-${(8|(parseInt(h[16],16)&3)).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;
}

/** In-image measurement. `operations` is the installable set `[{operation, family}]` (general-read-installation/runtime.mjs
 * `installationReadOperations()`); each family's source manifest digest becomes every operation's `handlerSourceSha256`. */
export async function measureGeneralReadInstallation({catalogJson,operations}){
 const catalog=JSON.parse(catalogJson),rows=data(operations);
 if(!Array.isArray(rows)||!rows.length||rows.length>128)refuse('GATEWAY_CONFIGURATION');
 const families=[...new Set(rows.map(row=>row.family))].sort(),manifests=await measureGeneralReadFamilySources({familyIds:families});
 const measured=rows.map(({operation,family})=>{privateShape('OperationRef',operation);const contract=resolveOperationContract(operation);
  if(contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none')refuse('GATEWAY_CONFIGURATION');
  return {operation:{id:operation.id,version:operation.version},family,descriptorSha256:canonicalSha256(contract.descriptor),handlerSourceSha256:manifests.get(family).sourceSha256};})
  .sort((a,b)=>key(a.operation).localeCompare(key(b.operation)));
 const measurement={schema:GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA,baseCatalogSha256:canonicalSha256(catalog),operations:measured};
 return Object.freeze({measurement,measurementSha256:canonicalSha256(measurement)});
}

function assertMeasurement(raw,pin,catalogSha256){
 const m=data(raw);own(m,['schema','baseCatalogSha256','operations']);
 if(m.schema!==GENERAL_READ_INSTALLATION_MEASUREMENT_SCHEMA||!DIGEST.test(pin)||canonicalSha256(m)!==pin||m.baseCatalogSha256!==catalogSha256||
  !Array.isArray(m.operations)||!m.operations.length||m.operations.length>128)refuse();
 const seen=new Set();
 for(const row of m.operations){own(row,['operation','family','descriptorSha256','handlerSourceSha256']);privateShape('OperationRef',row.operation);
  const contract=resolveOperationContract(row.operation);
  if(seen.has(key(row.operation))||typeof row.family!=='string'||!DIGEST.test(row.handlerSourceSha256)||row.descriptorSha256!==canonicalSha256(contract.descriptor)||
   contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none')refuse();seen.add(key(row.operation));}
 return m;
}

/** `readCurrentInstallation` for createControlGeneralReadRuntime / the reads composer. Disabled unless `enabled === true`. */
export function createGeneralReadInstallationIssuer(configuration){
 const c=own(configuration,['catalogJson','now'],['measurement','measurementSha256','enabled','ttlMs','revokedOperations']);
 const enabled=c.enabled??false,ttlMs=c.ttlMs??MAX_TTL_MS,now=c.now;
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>MAX_TTL_MS)refuse('GATEWAY_CONFIGURATION');
 const catalogSha256=canonicalSha256(JSON.parse(c.catalogJson));
 // A disabled issuer needs no measurement; an enabled one refuses construction on any pin or drift mismatch.
 const m=enabled?assertMeasurement(c.measurement,c.measurementSha256,catalogSha256):null;
 const revoked=new Set((c.revokedOperations===undefined?[]:data(c.revokedOperations)).map(op=>{privateShape('OperationRef',op);return key(op);}));
 const installationId=m?digestUuid('installation',c.measurementSha256):null;
 async function readCurrentInstallation(value){
  const {binding,scopes,policyRevision,signal}=own(value,['binding','scopes','policyRevision'],['signal']);nativeSignal(signal);
  if(!enabled)refuse('UNAVAILABLE');signal?.throwIfAborted();
  validateShape('RunBinding',binding);if(!Array.isArray(scopes)||!scopes.length)refuse();scopes.forEach(s=>validateShape('Scope',s));
  if(typeof policyRevision!=='string'||!policyRevision)refuse();
  const operations=m.operations.filter(row=>!revoked.has(key(row.operation))).map(row=>({operation:{...row.operation},descriptorSha256:row.descriptorSha256,
   handlerSourceSha256:row.handlerSourceSha256,qualificationReceiptId:digestUuid('qualification',c.measurementSha256,key(row.operation))}));
  if(!operations.length)refuse();
  const at=now(),receipt={binding:data(binding),scopes:data(scopes),policyRevision,baseCatalogSha256:m.baseCatalogSha256,installationId,executionCatalogSha256:'',
   operations,checkedAtMs:at,expiresAtMs:at+ttlMs};
  receipt.executionCatalogSha256=executionCatalogSha256(receipt);
  return receipt;
 }
 return Object.freeze({enabled,installationId,readCurrentInstallation});
}
