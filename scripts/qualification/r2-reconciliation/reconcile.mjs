#!/usr/bin/env node
/** W00–W01 / REL-02 ledger reconciliation at one exact head: a read-only join of the recorded R2 ledgers,
 * the typed retrieval catalog, the skill manifests and the source adapter families. It changes nothing,
 * invents no alias or handler, and performs no network, database or provider access. */
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),defaultRoot=resolve(here,'../../..');
const usage='Usage: node scripts/qualification/r2-reconciliation/reconcile.mjs --out DIR [--repo DIR]\nExit: 0 ledgers and source agree; 1 drift recorded (outputs written); 2 usage/configuration.\n';
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const field=(record,...names)=>{for(const n of names){if(record.fields&&record.fields[n]!==undefined)return record.fields[n];}return undefined;};
const idOf=record=>field(record,'ID','Requirement ID','Gate ID','Ticket ID','Finding ID');
const stateOf=record=>record.integrationState??record.integrationDisposition??field(record,'State','Implementation state')??null;
const opRef=value=>value===null||value===undefined?null:typeof value==='string'?{id:value,version:null}:{id:value.id,version:value.version??null};
const opKey=ref=>ref.version?`${ref.id}@${ref.version}`:ref.id;
const listIds=value=>typeof value==='string'?value.split(/[,;\s]+/u).map(s=>s.trim()).filter(s=>/^(R|RG|REL|A)-\d{2}$/u.test(s)):Array.isArray(value)?value:[];

export async function loadInputs(root){
 const r2=Object.fromEntries(['capabilities','skills','requirements','gates','tickets','audit-findings'].map(n=>[n,json(join(root,'docs/coordination/r2',n+'.json'))]));
 const catalog=json(join(root,'packages/contracts/retrieval-0.2/catalog.json')),capabilitiesDoc=json(join(root,'docs/CAPABILITIES.json'));
 const skillsModule=await import(pathToFileURL(join(root,'packages/skills/index.mjs')).href),assets=json(join(root,'packages/skills/assets.json'));
 const manifests=assets.assets.map(a=>({...a,manifest:json(resolve(join(root,'packages/skills'),a.manifestPath))}));
 const sourcesRoot=join(root,'apps/gateway/sources'),adapters=[];
 for(const name of readdirSync(sourcesRoot).sort()){const dir=join(sourcesRoot,name);if(!existsSync(join(dir,'handler.mjs')))continue;
  const text=readdirSync(dir).filter(f=>f.endsWith('.mjs')&&!f.includes('test')).map(f=>readFileSync(join(dir,f),'utf8')).join('\n');adapters.push({family:name,text});}
 return {catalog,r2,capabilitiesDoc,skills:skillsModule.listSkills(),manifests,adapters};
}

export function reconcile({catalog,r2,capabilitiesDoc,skills,manifests,adapters}){
 const drift=[],note=(kind,detail)=>drift.push({kind,detail});
 const opIds=new Set(catalog.operations.map(o=>o.operation.id)),opKeys=new Set(catalog.operations.map(o=>o.operation.id+'@'+o.operation.version));
 // Adapter families: textual references to catalog operation ids inside the family's non-test modules.
 const adapterOps=new Map();for(const {family,text} of adapters){const ids=[...opIds].filter(id=>text.includes(`'${id}'`)||text.includes(`"${id}"`));adapterOps.set(family,ids);}
 const familiesFor=id=>[...adapterOps].filter(([,ids])=>ids.includes(id)).map(([f])=>f);
 const manifestFor=new Map(manifests.map(m=>[m.skillId,m]));
 const skillsFor=id=>manifests.filter(m=>m.manifest.allowedOperations.some(ref=>opRef(ref).id===id)).map(m=>m.skillId);
 const requirementIds=new Set(r2.requirements.records.map(idOf)),gateIds=new Set(r2.gates.records.map(idOf)),ticketIds=new Set(r2.tickets.records.map(idOf)),findingIds=new Set(r2['audit-findings'].records.map(idOf));
 const operations=catalog.operations.map(o=>{const id=o.operation.id;
  for(const [listName,set] of [['requirementIds',requirementIds],['ticketIds',ticketIds],['gateIds',gateIds]])for(const ref of o[listName]??[])if(!set.has(ref))note('operation-unknown-ledger-id',`${id} ${listName} ${ref}`);
  return {operation:o.operation,availability:o.availability,qualification:o.qualification,handlerBound:o.handler!==null,sideEffect:o.sideEffect,approvalBoundary:o.approvalBoundary,discoverable:o.availability==='enabled'&&o.qualification==='qualified'&&o.handler!==null&&o.sideEffect==='none'&&o.approvalBoundary==='none',requirementIds:o.requirementIds??[],ticketIds:o.ticketIds??[],gateIds:o.gateIds??[],fixtureIds:o.fixtureIds??[],sources:(o.sourceRequirements??[]).map(s=>s.sourceId),aliases:o.aliases??[],replacement:o.replacement??null,adapterFamilies:familiesFor(id),skills:skillsFor(id)};});
 const originals=catalog.originals??[],ledger=r2.capabilities.records,docNames=new Set((capabilitiesDoc.capabilities??[]).map(c=>c.name));
 const ledgerById=new Map(ledger.map(r=>[idOf(r),r])),originalIds=new Set(originals.map(o=>o.id));
 for(const id of ledgerById.keys())if(!originalIds.has(id))note('capability-missing-in-catalog-originals',id);
 for(const id of originalIds)if(!ledgerById.has(id))note('capability-missing-in-r2-ledger',id);
 for(const id of originalIds)if(!docNames.has(id))note('capability-missing-in-docs-capabilities',id);
 for(const name of docNames)if(!originalIds.has(name))note('docs-capability-missing-in-catalog-originals',name);
 const capabilities=originals.map(o=>{const l=ledgerById.get(o.id),ledgerDisposition=l?.acceptedScope?.disposition??null,replacement=opRef(o.replacement),ledgerReplacement=opRef(l?.replacementOperation);
  const bound=replacement!==null&&(replacement.version?opKeys.has(opKey(replacement)):opIds.has(replacement.id));
  if(l&&ledgerDisposition!==o.disposition)note('capability-disposition-mismatch',`${o.id} catalog=${o.disposition} ledger=${ledgerDisposition}`);
  if(replacement!==null&&!bound)note('capability-replacement-not-in-catalog',`${o.id} -> ${opKey(replacement)}`);
  if(ledgerReplacement&&(!replacement||ledgerReplacement.id!==replacement.id))note('capability-replacement-mismatch',`${o.id} catalog=${replacement?opKey(replacement):null} ledger=${opKey(ledgerReplacement)}`);
  return {id:o.id,disposition:o.disposition,state:o.state??null,replacement:replacement?opKey(replacement):null,replacementBound:bound,ledgerDisposition,ledgerReplacementState:l?.replacementState??null,ledgerRuntimeParity:l?.runtimeParity??null,category:l?field(l,'Category'):null,boundary:o.boundary??null};});
 const skillLedgerIds=new Set(r2.skills.records.map(idOf)),manifestIds=new Set(manifests.map(m=>m.skillId)),listedIds=new Set(skills.map(s=>s.skillId));
 for(const id of skillLedgerIds)if(!manifestIds.has(id))note('skill-ledger-without-manifest',id);
 for(const id of manifestIds){if(!skillLedgerIds.has(id))note('skill-manifest-without-ledger-row',id);if(!listedIds.has(id))note('skill-manifest-not-selectable',id);}
 const skillRows=manifests.map(m=>{const ops=m.manifest.allowedOperations.map(raw=>{const ref=opRef(raw),id=ref.id,present=ref.version?opKeys.has(opKey(ref)):opIds.has(id),op=catalog.operations.find(o=>o.operation.id===id&&(!ref.version||o.operation.version===ref.version));if(!present)note('skill-operation-not-in-catalog',`${m.skillId} -> ${opKey(ref)}`);return {id:opKey(ref),inCatalog:present,handlerBound:op?op.handler!==null:false,availability:op?.availability??null};});
  return {skillId:m.skillId,skillVersion:m.skillVersion,manifestSha256:m.manifestSha256,ledgerRow:skillLedgerIds.has(m.skillId),selectable:listedIds.has(m.skillId),ledgerDisposition:r2.skills.records.find(r=>idOf(r)===m.skillId)?.integrationDisposition??null,allowedOperations:ops,requiredSources:(m.manifest.requiredSources??[]).map(s=>s.sourceId)};});
 for(const f of r2['audit-findings'].records){for(const ref of listIds(field(f,'Requirement IDs')))if(!requirementIds.has(ref))note('finding-unknown-requirement',`${idOf(f)} ${ref}`);for(const ref of listIds(field(f,'Ticket IDs')))if(!ticketIds.has(ref))note('finding-unknown-ticket',`${idOf(f)} ${ref}`);}
 const ledgers=Object.fromEntries([['requirements',r2.requirements],['gates',r2.gates],['tickets',r2.tickets],['findings',r2['audit-findings']],['skills',r2.skills]].map(([name,l])=>[name,{sheet:l.sheet,planSha256:l.planSha256,workbookSha256:l.workbookSha256,sourceCommit:l.sourceCommit,records:l.records.map(r=>({id:idOf(r),title:field(r,'Contract','Measure','Phase','Finding','Category')??null,state:stateOf(r)}))}]));
 const count=(rows,fn)=>rows.filter(fn).length;
 const counts={capabilities:{total:capabilities.length,selected:count(capabilities,c=>c.disposition==='selected'),deferred:count(capabilities,c=>c.disposition==='deferred'),withReplacement:count(capabilities,c=>c.replacement!==null),replacementBound:count(capabilities,c=>c.replacementBound),selectedWithReplacement:count(capabilities,c=>c.disposition==='selected'&&c.replacement!==null),selectedWithoutReplacement:count(capabilities,c=>c.disposition==='selected'&&c.replacement===null),runtimeParityNotQualified:count(capabilities,c=>c.ledgerRuntimeParity==='NOT_QUALIFIED')},
  operations:{total:operations.length,handlerBound:count(operations,o=>o.handlerBound),discoverable:count(operations,o=>o.discoverable),byAvailability:Object.fromEntries([...new Set(operations.map(o=>o.availability))].map(a=>[a,count(operations,o=>o.availability===a)])),byQualification:Object.fromEntries([...new Set(operations.map(o=>o.qualification))].map(q=>[q,count(operations,o=>o.qualification===q)])),withAdapterFamily:count(operations,o=>o.adapterFamilies.length>0),referencedBySkills:count(operations,o=>o.skills.length>0),referencedByCapabilityReplacement:count(operations,o=>capabilities.some(c=>c.replacement===o.operation.id+'@'+o.operation.version))},
  skills:{manifests:skillRows.length,ledgerRows:skillLedgerIds.size,selectable:count(skillRows,s=>s.selectable),allowedOperationReferences:skillRows.reduce((n,s)=>n+s.allowedOperations.length,0),allowedOperationsInCatalog:skillRows.reduce((n,s)=>n+count(s.allowedOperations,o=>o.inCatalog),0),allowedOperationsHandlerBound:skillRows.reduce((n,s)=>n+count(s.allowedOperations,o=>o.handlerBound),0)},
  adapterFamilies:Object.fromEntries([...adapterOps].map(([f,ids])=>[f,ids])),
  ledgers:Object.fromEntries(Object.entries(ledgers).map(([n,l])=>[n,{records:l.records.length,byState:Object.fromEntries([...new Set(l.records.map(r=>String(r.state).slice(0,40)))].map(s=>[s,count(l.records,r=>String(r.state).slice(0,40)===s)]))}])),
  drift:drift.length};
 return {schema:'meri.r2-reconciliation.v1',catalog:{catalogId:catalog.catalogId,catalogVersion:catalog.catalogVersion,contractVersion:catalog.contractVersion,sourceRegistryCommit:catalog.sourceRegistryCommit},counts,drift,capabilities,operations,skills:skillRows,ledgers};
}

export function renderReport(result,meta){
 const c=result.counts,lines=[`# R2 ledger reconciliation at ${meta.head??'unknown head'}`,'',`Read-only join of the recorded R2 ledgers (\`docs/coordination/r2\`), the typed retrieval catalog ${result.catalog.catalogId} ${result.catalog.catalogVersion} (contract ${result.catalog.contractVersion}), the ${c.skills.manifests} skill manifests in \`packages/skills\` and the source adapter families under \`apps/gateway/sources\`. Nothing is promoted: a bound handler is a source fact, not qualification; a ledger state is the recorded state, not a measurement.`,'',
  '## Counts','',`- Capabilities: ${c.capabilities.total} originals (${c.capabilities.selected} selected / ${c.capabilities.deferred} deferred); ${c.capabilities.selectedWithReplacement} selected map to a catalog operation, ${c.capabilities.selectedWithoutReplacement} selected have no replacement operation recorded; ${c.capabilities.runtimeParityNotQualified} carry runtimeParity NOT_QUALIFIED in the ledger.`,
  `- Operations: ${c.operations.total} typed operations; handler bound ${c.operations.handlerBound}; discoverable (enabled, qualified, handler, no side effect, no approval) ${c.operations.discoverable}; availability ${JSON.stringify(c.operations.byAvailability)}; qualification ${JSON.stringify(c.operations.byQualification)}; with a source adapter family ${c.operations.withAdapterFamily}; referenced by skill manifests ${c.operations.referencedBySkills}; targeted by a capability replacement ${c.operations.referencedByCapabilityReplacement}.`,
  `- Skills: ${c.skills.manifests} manifests, ${c.skills.ledgerRows} ledger rows, ${c.skills.selectable} selectable; ${c.skills.allowedOperationReferences} allowed-operation references, ${c.skills.allowedOperationsInCatalog} present in the catalog, ${c.skills.allowedOperationsHandlerBound} with a bound handler.`,
  `- Ledgers: ${Object.entries(c.ledgers).map(([n,l])=>`${n} ${l.records} (${Object.entries(l.byState).map(([s,k])=>`${k} ${s}`).join('; ')})`).join('; ')}.`,
  `- Drift entries: ${c.drift}.`,'',
  '## Drift',''];
 if(!result.drift.length)lines.push('None: every ledger identifier resolves, dispositions agree, every skill operation exists in the catalog and every replacement target exists.');
 else for(const d of result.drift)lines.push(`- ${d.kind}: ${d.detail}`);
 lines.push('','## Adapter families and the operations they reference','');
 for(const [f,ids] of Object.entries(c.adapterFamilies))lines.push(`- \`${f}\`: ${ids.length?ids.map(i=>`\`${i}\``).join(', '):'(no catalog operation id referenced textually)'}`);
 lines.push('','## Operations with source presence but no bound handler','');
 const unbound=result.operations.filter(o=>!o.handlerBound&&(o.adapterFamilies.length||o.skills.length));
 lines.push('| Operation | Availability | Qualification | Adapter families | Skills |','| --- | --- | --- | --- | --- |');
 for(const o of unbound)lines.push(`| \`${o.operation.id}@${o.operation.version}\` | ${o.availability} | ${o.qualification} | ${o.adapterFamilies.join(', ')||'—'} | ${o.skills.join(', ')||'—'} |`);
 lines.push('','## Selected capabilities without a replacement operation','');
 const open=result.capabilities.filter(cp=>cp.disposition==='selected'&&cp.replacement===null);
 lines.push(`${open.length} of ${c.capabilities.selected} selected capabilities record no replacement operation (REL-02 required): ${open.map(cp=>`\`${cp.id}\``).join(', ')}`);
 lines.push('','## Skills','','| Skill | Ledger disposition | Allowed operations (in catalog / handler bound) | Required sources |','| --- | --- | --- | --- |');
 for(const s of result.skills)lines.push(`| \`${s.skillId}@${s.skillVersion}\` | ${String(s.ledgerDisposition).slice(0,60)} | ${s.allowedOperations.map(o=>`\`${o.id}\`${o.inCatalog?'':'(missing)'}${o.handlerBound?'*':''}`).join(', ')} | ${s.requiredSources.join(', ')} |`);
 lines.push('','`*` marks a bound handler. Source: `RECONCILIATION.json` beside this file.','');
 return lines.join('\n');
}

function git(root,args){try{return execFileSync('git',['-c','safe.directory='+root,'-C',root,...args],{encoding:'utf8',timeout:10000}).trim();}catch{return null;}}
export function parseArguments(argv){const o={repo:defaultRoot,out:null};for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--help'||a==='-h')return {help:true};if(a==='--repo')o.repo=resolve(argv[++i]??'');else if(a==='--out')o.out=resolve(argv[++i]??'');else throw Object.assign(Error('unknown argument: '+a),{code:'USAGE'});}if(!o.out)throw Object.assign(Error('--out is required'),{code:'USAGE'});return o;}
export async function run(options){
 const inputs=await loadInputs(options.repo),result=reconcile(inputs),meta={head:git(options.repo,['rev-parse','HEAD']),tree:git(options.repo,['rev-parse','HEAD^{tree}']),generatedAt:new Date().toISOString()};
 mkdirSync(options.out,{recursive:true});
 writeFileSync(join(options.out,'RECONCILIATION.json'),JSON.stringify({...result,repository:meta},null,1)+'\n');
 writeFileSync(join(options.out,'REPORT.md'),renderReport(result,meta));
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let options;try{options=parseArguments(process.argv.slice(2));}catch(error){process.stderr.write(error.message+'\n'+usage);process.exitCode=2;}
 if(options?.help)process.stdout.write(usage);
 else if(options)try{const result=await run(options);process.stdout.write(JSON.stringify({out:options.out,counts:{capabilities:result.counts.capabilities.total,operations:result.counts.operations.total,skills:result.counts.skills.manifests,drift:result.counts.drift}})+'\n');process.exitCode=result.drift.length?1:0;}catch(error){process.stderr.write((error.code==='USAGE'?error.message:'reconciliation failed: '+(error.stack??error.message))+'\n');process.exitCode=2;}
}
