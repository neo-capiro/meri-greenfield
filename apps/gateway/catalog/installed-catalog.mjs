/** Trusted execution installation view over exact immutable preservation descriptors. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertCatalog} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertSkillInstallation} from '../../../packages/contracts/selected-skills/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {deny,parseRawJson} from '../dispatch/operation-result.mjs';
const key=op=>`${op.id}@${op.version}`;
export function executionCatalogSha256(receipt){return canonicalSha256({baseCatalogSha256:receipt.baseCatalogSha256,installationId:receipt.installationId,operations:receipt.operations});}
/** Execution view over an installation receipt the caller has already validated against its own owner
 * (selected skill or general read). Only read-only descriptors with the measured handler hash enter the table. */
export function createInstalledCatalogView(configuration){
 const c=own(configuration,['catalogJson','contracts','handlers','receipt','now']);
 const catalog=parseRawJson(c.catalogJson,16777216,'GATEWAY_CONFIGURATION');assertCatalog(catalog);
 const contracts=own(c.contracts,['resolveOperationContract'],['assertCatalog','validateShape']),receipt=c.receipt;
 if(types.isProxy(c.handlers)||!(c.handlers instanceof Map)||Object.getPrototypeOf(c.handlers)!==Map.prototype||typeof contracts.resolveOperationContract!=='function'||typeof c.now!=='function')deny('GATEWAY_CONFIGURATION');
 if(receipt.baseCatalogSha256!==canonicalSha256(catalog)||receipt.executionCatalogSha256!==executionCatalogSha256(receipt))deny('GATEWAY_CONFIGURATION');
 const descriptors=new Map(catalog.operations.map(row=>[key(row.operation),row])),table=new Map();
 for(const row of receipt.operations){const descriptor=descriptors.get(key(row.operation)),handler=Map.prototype.get.call(c.handlers,key(row.operation));let owned;
  try{owned=own(handler,['sourceSha256','execute']);}catch{deny('GATEWAY_CONFIGURATION');}
  if(!descriptor||descriptor.sideEffect!=='none'||descriptor.approvalBoundary!=='none'||typeof owned.execute!=='function'||owned.sourceSha256!==row.handlerSourceSha256)deny('GATEWAY_CONFIGURATION');
  const contract=contracts.resolveOperationContract.call(c.contracts,row.operation);
  if(typeof contract?.normalizeInput!=='function'||typeof contract?.assertOutput!=='function'||canonicalSha256(contract.descriptor)!==canonicalSha256(descriptor))deny('GATEWAY_CONFIGURATION');
  table.set(key(row.operation),Object.freeze({descriptor:data(descriptor),contract,execute:args=>owned.execute.call(handler,args)}));
 }
 function entry(operation){if(!Number.isSafeInteger(c.now())||c.now()<receipt.checkedAtMs||c.now()>=receipt.expiresAtMs)return null;return table.get(key(operation))??null;}
 return Object.freeze({entry,discoverable:()=>[...table.values()].filter(row=>entry(row.descriptor.operation)),catalogVersion:catalog.catalogVersion,installationId:receipt.installationId,executionCatalogSha256:receipt.executionCatalogSha256});
}
export function createInstalledRuntimeCatalog(configuration){
 const c=own(configuration,['catalogJson','contracts','handlers','installation','input','selected','now','life','started']);
 const receipt=assertSkillInstallation(c.installation,{input:c.input,selected:c.selected,started:c.started,now:c.now,life:c.life});
 return createInstalledCatalogView({catalogJson:c.catalogJson,contracts:c.contracts,handlers:c.handlers,receipt,now:c.now});
}
