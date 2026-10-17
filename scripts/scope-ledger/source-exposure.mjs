/** Current source coverage of the existing selected scope. Offline evidence, never tool availability. */
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {CATALOG_OPERATION_BINDINGS} from '../../packages/contracts/retrieval-0.2/catalog-validation.mjs';
import {READ_FAMILIES} from '../../apps/worker/conversation/reads/families.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {parseAdmittedSkills} from '../general-reads/sources.mjs';

const fail=message=>{throw Object.assign(Error(message),{code:'SOURCE_EXPOSURE_INVALID'});};
const unique=values=>[...new Set(values)].sort();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

function operationList(values,label){
 if(!Array.isArray(values)||values.length===0||values.some(id=>typeof id!=='string'||!id)||new Set(values).size!==values.length)fail(`Invalid ${label}`);
 return values;
}

/** A mixed family advertises only its explicit canonical subset; omitted siblings never inherit exposure. */
function registeredOperations(catalog,byOperation,families){
 const selected=new Set();
 for(const [family,policy] of Object.entries(families)){
  const descriptors=catalog.operations.filter(descriptor=>byOperation.get(descriptor.operation.id)?.group===family);
  if(!policy||typeof policy!=='object'||descriptors.length===0)fail(`Unknown general-read family ${family}`);
  const ids=Object.hasOwn(policy,'operationIds')?operationList(policy.operationIds,`${family} operationIds`):descriptors.map(descriptor=>descriptor.operation.id);
  for(const id of ids){
   if(!descriptors.some(descriptor=>descriptor.operation.id===id))fail(`Foreign general-read operation ${family}/${id}`);
   selected.add(id);
  }
 }
 return catalog.operations.filter(descriptor=>selected.has(descriptor.operation.id));
}

/** Derive every selected row; fixture inputs can narrow or corrupt source facts without loading SDK/provider code. */
export function reconcileSourceExposure({catalog,bindings,families,adapters,skills,admittedSkills,provenance,backendMapping}){
 const byOperation=new Map(bindings.map(binding=>[binding.id,binding]));
 if(byOperation.size!==bindings.length)fail('Duplicate canonical operation binding');
 const selected=catalog.originals.filter(row=>row.disposition==='selected'),excluded=catalog.originals.filter(row=>row.disposition==='deferred');
 if(selected.length!==96||excluded.length!==43)fail('Selected/excluded scope changed');
 const adapterByOperation=new Map();
 for(const adapter of adapters){
  const operations=operationList(adapter.operations,'adapter operations');
  const partial=Object.hasOwn(adapter,'partialOperations')?operationList(adapter.partialOperations,'partialOperations'):[];
  if(partial.some(id=>!operations.includes(id)))fail('Partial adapter operation is not declared');
  for(const operation of operations){
   if(!byOperation.has(operation)||adapterByOperation.has(operation))fail(`Unmapped or duplicate adapter operation ${operation}`);
   adapterByOperation.set(operation,{paths:adapter.paths,partial:partial.includes(operation)});
  }
 }
 const operations=registeredOperations(catalog,byOperation,families);
 for(const descriptor of operations){
  if(descriptor.sideEffect!=='none'||descriptor.approvalBoundary!=='none'||excluded.some(row=>row.id===descriptor.operation.id))fail(`Unsafe general-read registration ${descriptor.operation.id}`);
  if(!adapterByOperation.has(descriptor.operation.id))fail(`Registered read lacks a canonical adapter: ${descriptor.operation.id}`);
  if(adapterByOperation.get(descriptor.operation.id).partial)fail(`Incomplete source adapter cannot be SDK-exposed: ${descriptor.operation.id}`);
 }
 const registered=new Set(operations.map(descriptor=>descriptor.operation.id));
 const productGroups=new Set(['artifacts','schedule-tools','client-knowledge-attachments','memory-proposals','command-tools']);
 const rows=selected.map(original=>{
  const operation=original.replacement?.id,binding=byOperation.get(operation);
  if(!binding)fail(`Selected capability lacks canonical binding ${original.id}`);
  const related=unique([operation,...bindings.filter(item=>item.supersededBy===operation).map(item=>item.id)]);
  const declared=skills.filter(skill=>skill.operations.some(id=>related.includes(id))).map(skill=>skill.id).sort();
  const admitted=skills.filter(skill=>admittedSkills.includes(skill.id)&&skill.operations.some(id=>related.includes(id)&&adapterByOperation.has(id))).map(skill=>skill.id).sort();
  const skillOperations=related.filter(id=>adapterByOperation.has(id)&&skills.some(skill=>admittedSkills.includes(skill.id)&&skill.operations.includes(id)));
  return {id:original.id,operation,family:binding.group,kind:productGroups.has(binding.group)?'product-or-governed':'source-read',
   currentContractDeclared:skills.some(skill=>skill.operations.includes(operation)),declaredBySkills:declared,sourceAdmittedSkills:admitted,sourceAdmittedOperations:skillOperations,generalOperations:related.filter(id=>registered.has(id)),
   adapterPaths:adapterByOperation.get(operation)?.paths??[],requiredContextKeys:[...(binding.contextKeys??[])],
   state:adapterByOperation.get(operation)?.partial?'adapter-partial':adapterByOperation.has(operation)?'adapter-present':productGroups.has(binding.group)?'separate-product-path':'adapter-missing'};
 });
 const sourceReads=rows.filter(row=>row.kind==='source-read'),missing=sourceReads.filter(row=>row.state!=='adapter-present'),partial=sourceReads.filter(row=>row.state==='adapter-partial');
 if(backendMapping){
  if(backendMapping.schema!=='meri-core-producer-source-map/1'||backendMapping.operations.length!==63)fail('Incomplete backend producer mapping');
  const seen=new Set();
  for(const producer of backendMapping.operations){
   const row=sourceReads.find(row=>row.operation===producer.operation);
   if(!row||seen.has(producer.operation)||row.family!==producer.family||JSON.stringify(unique(row.requiredContextKeys))!==JSON.stringify(unique(producer.requiredContextKeys)))fail(`Backend producer correlation changed: ${producer.operation}`);
   if(!/^#[/]/u.test(producer.evidence?.jsonPointer)||!backendMapping.sourceFiles.some(file=>file.file===producer.evidence.file&&file.sha256===producer.evidence.sha256))fail(`Unpinned backend producer: ${producer.operation}`);
   seen.add(producer.operation);row.backendProducer=producer;
  }
 }
 const unexposed=sourceReads.filter(row=>row.state==='adapter-present'&&!row.generalOperations.includes(row.operation));
 const groupRows=rows=>unique(rows.map(row=>row.family)).map(family=>({family,operations:rows.filter(row=>row.family===family).map(row=>row.operation).sort()}));
 return {schema:'meri-selected-source-exposure/1',note:'Source paths and manifest declarations are evidence only. Partial source adapters remain missing complete coverage and cannot be SDK-exposed. No qualification, authority, credential, native producer or live availability is inferred.',
  provenance,...(backendMapping?{backendProducerEvidence:Object.fromEntries(Object.entries(backendMapping).filter(([key])=>key!=='operations'))}:{}),counts:{selectedCapabilities:rows.length,excludedCapabilities:excluded.length,selectedSourceReads:sourceReads.length,
   selectedProductOrGoverned:rows.length-sourceReads.length,registeredGeneralOperations:registered.size,registeredFamilies:Object.keys(families).length,
   generalSelectedSourceReads:sourceReads.filter(row=>row.generalOperations.includes(row.operation)).length,
   generalSelectedProductStateReads:rows.filter(row=>row.kind==='product-or-governed'&&row.generalOperations.includes(row.operation)).length,
   generalHistoricalOperations:operations.filter(descriptor=>!rows.some(row=>row.operation===descriptor.operation.id)).length,
   sourceReadsWithSkillDeclarations:sourceReads.filter(row=>row.declaredBySkills.length).length,
   sourceReadsWithCurrentContractDeclarations:sourceReads.filter(row=>row.currentContractDeclared).length,
   sourceReadsWithHistoricalOnlySkillDeclaration:sourceReads.filter(row=>!row.currentContractDeclared&&row.declaredBySkills.length).length,
   sourceReadsWithAdmittedSkillSourceRoute:sourceReads.filter(row=>row.sourceAdmittedSkills.length).length,
   completeSourceAdapters:sourceReads.filter(row=>row.state==='adapter-present').length,partialSourceAdapters:partial.length,
   absentSourceAdapters:sourceReads.filter(row=>row.state==='adapter-missing').length,
   existingSourceAdaptersWithoutGeneralExposure:unexposed.length,partialSourceAdaptersWithoutGeneralExposure:partial.filter(row=>!row.generalOperations.includes(row.operation)).length,missingSourceAdapters:missing.length,
   missingAdaptersDeclaredBySkills:missing.filter(row=>row.declaredBySkills.length).length,
   missingAdaptersWithoutSkillDeclaration:missing.filter(row=>!row.declaredBySkills.length).length,mappedBackendProducers:sourceReads.filter(row=>row.backendProducer).length,live:0},
  admittedSkills:[...admittedSkills],generalRegistration:groupRows(operations.map(descriptor=>({family:byOperation.get(descriptor.operation.id).group,operation:descriptor.operation.id}))),
  existingAdaptersWithoutGeneralExposure:unexposed.map(row=>row.id),partialAdapterFamilies:groupRows(partial),missingAdapterFamilies:groupRows(missing),
  missingAdapterAction:'Missing complete coverage includes partial source adapters and absent adapters. Complete the canonical gateway adapter and operation-specific trusted dispatch/current-resource context using an admitted exact producer/endpoint protocol. A schema/normalizer binding, skill declaration, restricted branch or pending native bridge is not complete operation coverage. No guessed endpoint, default credential or permissive generic query is allocated.',
  rows};
}

/** Read only declared registry/composition/manifest metadata and the immediate canonical source directories. */
export function loadSourceExposure(root){
 const provenance={};
 const read=path=>{const absolute=resolve(root,path);if(relative(root,absolute).startsWith('..')||!existsSync(absolute))fail(`Missing/outside source ${path}`);
  const bytes=readFileSync(absolute);provenance[path]=sha(bytes);return bytes.toString('utf8');};
 const catalog=JSON.parse(read('packages/contracts/retrieval-0.2/catalog.json'));
 const backendMapping=JSON.parse(read('scripts/scope-ledger/backend-producers.json'));
 read('packages/contracts/retrieval-0.2/catalog-validation.mjs');read('apps/worker/conversation/reads/families.mjs');
 read('apps/worker/conversation/reads/server.mjs');read('apps/gateway/general-reads/registration.mjs');
 const integration=read('apps/gateway/general-reads/integration.mjs'),declared=JSON.parse(read('scripts/general-reads/adapters.json'));
 const adapters=declared.adapters.map(adapter=>({directory:adapter.path,operations:[...adapter.operations],...(Object.hasOwn(adapter,'partialOperations')?{partialOperations:adapter.partialOperations}:{}),paths:[`${adapter.path}/handler.mjs`,...adapter.declaredIn].filter((path,index,all)=>all.indexOf(path)===index)}));
 const selectedOperations=registeredOperations(catalog,new Map(CATALOG_OPERATION_BINDINGS.map(binding=>[binding.id,binding])),READ_FAMILIES);
 for(const family of Object.keys(READ_FAMILIES)){
  if(family==='mail')continue;
  const path=`apps/gateway/general-reads/families/${family}.mjs`,text=read(path);
  if(!integration.includes(`'./families/${family}.mjs'`)||!text.includes(`id='${family}'`))fail(`Family composition missing ${family}`);
  const directory=/sourceDirectory='([^']+)'/.exec(text)?.[1];
  if(!directory||!/^[a-z-]+$/u.test(directory))fail(`Unknown source directory for ${family}`);
  const source=`apps/gateway/sources/${directory}`,operations=selectedOperations.filter(descriptor=>CATALOG_OPERATION_BINDINGS.find(binding=>binding.id===descriptor.operation.id)?.group===family).map(descriptor=>descriptor.operation.id);
  let adapter=adapters.find(item=>item.directory===source);
  // Curated declarations are authoritative: registry metadata cannot manufacture a missing sibling adapter.
  if(!adapter){adapter={directory:source,operations,paths:[`${source}/handler.mjs`]};adapters.push(adapter);}
  adapter.paths.push(path);
 }
 const directories=readdirSync(resolve(root,'apps/gateway/sources'),{withFileTypes:true}).filter(entry=>entry.isDirectory()&&existsSync(resolve(root,`apps/gateway/sources/${entry.name}/handler.mjs`))).map(entry=>`apps/gateway/sources/${entry.name}`);
 if(directories.some(directory=>!adapters.some(adapter=>adapter.directory===directory)))fail('Canonical source directory missing from reconciliation');
 for(const adapter of adapters){adapter.paths=unique(adapter.paths);for(const path of adapter.paths)read(path);}
 const assets=JSON.parse(read('packages/skills/assets.json'));
 const skills=assets.assets.map(asset=>{
  const path=relative(root,resolve(root,'packages/skills',asset.manifestPath)).replaceAll('\\','/'),text=read(path);
  const manifest=JSON.parse(text);
  if(canonicalSha256(manifest)!==asset.manifestSha256)fail(`Skill manifest pin changed ${asset.skillId}`);
  return {id:manifest.skillId,operations:manifest.allowedOperations.map(operation=>operation.id)};
 });
 const admittedSkills=parseAdmittedSkills(read('apps/worker/conversation/skills/mcp.mjs'));
 return reconcileSourceExposure({catalog,bindings:CATALOG_OPERATION_BINDINGS,families:READ_FAMILIES,adapters,skills,admittedSkills,provenance,backendMapping});
}
