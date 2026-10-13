/** Canonical execution installation view; immutable preservation descriptors remain exact. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertCatalog} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {deny,parseRawJson} from '../dispatch/operation-result.mjs';
const key=op=>`${op.id}@${op.version}`;
export function createInstalledRuntimeCatalog(configuration){
 const {catalogJson,contracts,handlers,installation,now}=own(configuration,['catalogJson','contracts','handlers','installation','now']);
 const catalog=parseRawJson(catalogJson,16777216,'GATEWAY_CONFIGURATION');assertCatalog(catalog);
 if(!(handlers instanceof Map)||typeof contracts?.resolveOperationContract!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
 const receipt=data(installation),descriptors=new Map(catalog.operations.map(row=>[key(row.operation),row])),table=new Map();
 if(receipt.baseCatalogSha256!==canonicalSha256(catalog)||!Array.isArray(receipt.operations)||!Number.isSafeInteger(receipt.checkedAtMs)||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.checkedAtMs>now()||receipt.expiresAtMs<=now())deny('GATEWAY_CONFIGURATION');
 // Receipt verification and actual source qualification belong to the configured
 // trusted installation owner. Metadata and UUIDs alone prove neither.
 for(const row of receipt.operations){const descriptor=descriptors.get(key(row.operation)),handler=handlers.get(key(row.operation));let owned;try{owned=own(handler,['sourceSha256','execute']);}catch{deny('GATEWAY_CONFIGURATION');}
  if(!descriptor||descriptor.sideEffect!=='none'||descriptor.approvalBoundary!=='none'||row.descriptorSha256!==canonicalSha256(descriptor)||
   typeof owned.execute!=='function'||owned.sourceSha256!==row.handlerSourceSha256||!(/^[a-f0-9]{64}$/u.test(row.handlerSourceSha256))||!(/^[a-f0-9-]{36}$/u.test(row.qualificationReceiptId))||table.has(key(row.operation)))deny('GATEWAY_CONFIGURATION');
  const contract=contracts.resolveOperationContract(row.operation);if(canonicalSha256(contract.descriptor)!==canonicalSha256(descriptor))deny('GATEWAY_CONFIGURATION');
  table.set(key(row.operation),Object.freeze({descriptor:data(descriptor),contract,execute:args=>owned.execute.call(handler,args)}));
 }
 function entry(operation){if(!Number.isSafeInteger(now())||now()<receipt.checkedAtMs||now()>=receipt.expiresAtMs)return null;return table.get(key(operation))??null;}
 return Object.freeze({entry,discoverable:()=>[...table.values()].filter(row=>entry(row.descriptor.operation)),catalogVersion:catalog.catalogVersion,
  installationId:receipt.installationId,executionCatalogSha256:receipt.executionCatalogSha256});
}
