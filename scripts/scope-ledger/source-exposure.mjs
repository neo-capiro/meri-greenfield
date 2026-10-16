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

/** Derive every selected row; fixture inputs can narrow or corrupt source facts without loading SDK/provider code. */
export function reconcileSourceExposure({catalog,bindings,families,adapters,skills,admittedSkills,provenance}){
 const byOperation=new Map(bindings.map(binding=>[binding.id,binding]));
 if(byOperation.size!==bindings.length)fail('Duplicate canonical operation binding');
 const selected=catalog.originals.filter(row=>row.disposition==='selected'),excluded=catalog.originals.filter(row=>row.disposition==='deferred');
 if(selected.length!==96||excluded.length!==43)fail('Selected/excluded scope changed');
 const adapterByOperation=new Map();
 for(const adapter of adapters)for(const operation of adapter.operations){
  if(!byOperation.has(operation)||adapterByOperation.has(operation))fail(`Unmapped or duplicate adapter operation ${operation}`);
  adapterByOperation.set(operation,adapter.paths);
 }
 const operations=catalog.operations.filter(descriptor=>Object.hasOwn(families,byOperation.get(descriptor.operation.id)?.group));
 for(const descriptor of operations){
  if(descriptor.sideEffect!=='none'||descriptor.approvalBoundary!=='none'||excluded.some(row=>row.id===descriptor.operation.id))fail(`Unsafe general-read registration ${descriptor.operation.id}`);
  if(!adapterByOperation.has(descriptor.operation.id))fail(`Registered read lacks a canonical adapter: ${descriptor.operation.id}`);
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
   adapterPaths:adapterByOperation.get(operation)??[],requiredContextKeys:[...(binding.contextKeys??[])],
   state:adapterByOperation.has(operation)?'adapter-present':productGroups.has(binding.group)?'separate-product-path':'adapter-missing'};
 });
 const sourceReads=rows.filter(row=>row.kind==='source-read'),missing=sourceReads.filter(row=>row.state==='adapter-missing');
 const unexposed=sourceReads.filter(row=>row.state==='adapter-present'&&!row.generalOperations.includes(row.operation));
 const groupRows=rows=>unique(rows.map(row=>row.family)).map(family=>({family,operations:rows.filter(row=>row.family===family).map(row=>row.operation).sort()}));
 return {schema:'meri-selected-source-exposure/1',note:'Source paths and manifest declarations are evidence only. No qualification, authority, credential, native producer or live availability is inferred.',
  provenance,counts:{selectedCapabilities:rows.length,excludedCapabilities:excluded.length,selectedSourceReads:sourceReads.length,
   selectedProductOrGoverned:rows.length-sourceReads.length,registeredGeneralOperations:registered.size,registeredFamilies:Object.keys(families).length,
   generalSelectedSourceReads:sourceReads.filter(row=>row.generalOperations.includes(row.operation)).length,
   generalSelectedProductStateReads:rows.filter(row=>row.kind==='product-or-governed'&&row.generalOperations.includes(row.operation)).length,
   generalHistoricalOperations:operations.filter(descriptor=>!rows.some(row=>row.operation===descriptor.operation.id)).length,
   sourceReadsWithSkillDeclarations:sourceReads.filter(row=>row.declaredBySkills.length).length,
   sourceReadsWithCurrentContractDeclarations:sourceReads.filter(row=>row.currentContractDeclared).length,
   sourceReadsWithHistoricalOnlySkillDeclaration:sourceReads.filter(row=>!row.currentContractDeclared&&row.declaredBySkills.length).length,
   sourceReadsWithAdmittedSkillSourceRoute:sourceReads.filter(row=>row.sourceAdmittedSkills.length).length,
   existingSourceAdaptersWithoutGeneralExposure:unexposed.length,missingSourceAdapters:missing.length,
   missingAdaptersDeclaredBySkills:missing.filter(row=>row.declaredBySkills.length).length,
   missingAdaptersWithoutSkillDeclaration:missing.filter(row=>!row.declaredBySkills.length).length,live:0},
  admittedSkills:[...admittedSkills],generalRegistration:groupRows(operations.map(descriptor=>({family:byOperation.get(descriptor.operation.id).group,operation:descriptor.operation.id}))),
  existingAdaptersWithoutGeneralExposure:unexposed.map(row=>row.id),missingAdapterFamilies:groupRows(missing),
  missingAdapterAction:'Canonical gateway family adapter and operation-specific trusted dispatch/current-resource context, plus an admitted exact producer/endpoint protocol. A schema/normalizer binding or skill declaration is not a producer. No guessed endpoint, default credential or permissive generic query is allocated.',
  rows};
}

/** Read only declared registry/composition/manifest metadata and the immediate canonical source directories. */
export function loadSourceExposure(root){
 const provenance={};
 const read=path=>{const absolute=resolve(root,path);if(relative(root,absolute).startsWith('..')||!existsSync(absolute))fail(`Missing/outside source ${path}`);
  const bytes=readFileSync(absolute);provenance[path]=sha(bytes);return bytes.toString('utf8');};
 const catalog=JSON.parse(read('packages/contracts/retrieval-0.2/catalog.json'));
 read('packages/contracts/retrieval-0.2/catalog-validation.mjs');read('apps/worker/conversation/reads/families.mjs');
 read('apps/worker/conversation/reads/server.mjs');read('apps/gateway/general-reads/registration.mjs');
 const integration=read('apps/gateway/general-reads/integration.mjs'),declared=JSON.parse(read('scripts/general-reads/adapters.json'));
 const adapters=declared.adapters.map(adapter=>({directory:adapter.path,operations:adapter.operations,paths:[`${adapter.path}/handler.mjs`,...adapter.declaredIn].filter((path,index,all)=>all.indexOf(path)===index)}));
 for(const family of Object.keys(READ_FAMILIES)){
  if(family==='mail')continue;
  const path=`apps/gateway/general-reads/families/${family}.mjs`,text=read(path);
  if(!integration.includes(`'./families/${family}.mjs'`)||!text.includes(`id='${family}'`))fail(`Family composition missing ${family}`);
  const directory=/sourceDirectory='([^']+)'/.exec(text)?.[1];
  if(!directory||!/^[a-z-]+$/u.test(directory))fail(`Unknown source directory for ${family}`);
  const source=`apps/gateway/sources/${directory}`,operations=CATALOG_OPERATION_BINDINGS.filter(binding=>binding.group===family).map(binding=>binding.id);
  let adapter=adapters.find(item=>item.directory===source);
  if(!adapter){adapter={directory:source,operations:[],paths:[`${source}/handler.mjs`]};adapters.push(adapter);}
  for(const operation of operations)if(!adapter.operations.includes(operation))adapter.operations.push(operation);
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
 return reconcileSourceExposure({catalog,bindings:CATALOG_OPERATION_BINDINGS,families:READ_FAMILIES,adapters,skills,admittedSkills,provenance});
}
