/** Current native-qualified installation for general reads over measured Meri code; no self-qualification.
 *
 * PROPOSAL P2 (local shape, pending dot): `assertSkillInstallation` is bound to a skill pin, so general reads use this
 * receipt instead. The trusted native qualification owner (`readCurrentInstallation`) returns exactly
 * `{binding, scopes, policyRevision, baseCatalogSha256, installationId, executionCatalogSha256,
 *   operations:[{operation, descriptorSha256, handlerSourceSha256, qualificationReceiptId}], checkedAtMs, expiresAtMs}`.
 * No production owner exists, so no general read is installed today. Repository flags, the catalog `state`, inventory
 * rows or a caller/model receipt never stand in for it. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract,validateShape as privateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {parseRawJson} from '../dispatch/operation-result.mjs';
import {executionCatalogSha256} from '../catalog/installed-catalog.mjs';
import {registerMeasuredHandlers} from '../catalog/measured-handlers.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,DIGEST=/^[a-f0-9]{64}$/u;
const fault=()=>Object.assign(Error('GENERAL_READ_INSTALLATION_REFUSED'),{code:'GENERAL_READ_INSTALLATION_REFUSED'}),fail=()=>{throw fault();};
const RECEIPT_KEYS=Object.freeze(['binding','scopes','policyRevision','baseCatalogSha256','installationId','executionCatalogSha256','operations','checkedAtMs','expiresAtMs']);
export function createGeneralReadInstallationOwner(configuration){
 const c=own(configuration,['binding','scopes','handlers','readCurrentInstallation','catalogJson','now'],['sourceRoot','maxRequestMs']);
 const binding=data(c.binding),scopes=data(c.scopes),maxRequestMs=c.maxRequestMs??3000;
 validateShape('RunBinding',binding);if(!Array.isArray(scopes)||!scopes.length)fail();scopes.forEach(s=>validateShape('Scope',s));
 const policyRevision=scopes[0].policyRevision;
 if(scopes.some(s=>s.tenantId!==binding.tenantId||s.policyRevision!==policyRevision)||typeof c.readCurrentInstallation!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail();
 const catalogSha256=canonicalSha256(parseRawJson(c.catalogJson,16777216,'GATEWAY_CONFIGURATION')),registry=registerMeasuredHandlers({handlers:c.handlers,sourceRoot:c.sourceRoot,fail});
 function assertReceipt(r,started){
  if(!same(r.binding,binding)||!same(r.scopes,scopes)||r.policyRevision!==policyRevision||r.baseCatalogSha256!==catalogSha256||!UUID.test(r.installationId)||!DIGEST.test(r.executionCatalogSha256)||r.executionCatalogSha256!==executionCatalogSha256(r)||
   !Array.isArray(r.operations)||r.operations.length<1||r.operations.length>128||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>c.now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=c.now())fail();
  const seen=new Set();
  for(const value of r.operations){const row=own(value,['operation','descriptorSha256','handlerSourceSha256','qualificationReceiptId']);privateShape('OperationRef',row.operation);const k=canonicalSha256(row.operation);
   if(seen.has(k)||row.descriptorSha256!==canonicalSha256(resolveOperationContract(row.operation).descriptor)||!DIGEST.test(row.handlerSourceSha256)||row.handlerSourceSha256!==registry.sourceSha256(row.operation)||!UUID.test(row.qualificationReceiptId))fail();seen.add(k);}
 }
 /** Reads the native owner's current receipt, then measures every installed handler's source bytes. */
 async function readCurrent(value={}){const {signal}=own(value,[],['signal']);nativeSignal(signal);const life=createOperationLifetime({deadlineMs:c.now()+maxRequestMs,now:c.now,signal,errorFactory:fault});
  try{const started=c.now();
   const receipt=data(own(await life.run(s=>c.readCurrentInstallation({binding,scopes,policyRevision,signal:s})),RECEIPT_KEYS));
   assertReceipt(receipt,started);life.limitDeadline(receipt.expiresAtMs);
   for(const row of receipt.operations)await registry.measure(row.operation,life);
   life.check();return data({...receipt,checkedAtMs:c.now()});
  }catch{throw fault();}finally{life.close();}}
 return Object.freeze({readCurrent,handlers:registry.handlers});
}
