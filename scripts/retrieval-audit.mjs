// @ts-check
/** The connected-reader reconciliation table in `docs/RETRIEVAL-AUDIT.md`, derived from the one owner of each fact:
 * the current catalog (operations and descriptors), the gateway family modules (handlers), the contract bindings
 * (output validation), the worker mount and family guidance (model-facing coverage, states, SQL-first routing) and
 * the test tree (an operation id referenced by a test or fixture). Run `node scripts/retrieval-audit.mjs` to print the
 * table; `scripts/retrieval-audit.test.mjs` fails when the document no longer matches this derivation. */
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import catalog from '../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../packages/contracts/retrieval-0.2/validate.mjs';
import {GENERAL_READ_ADAPTER_FAMILIES} from '../apps/gateway/general-reads/integration.mjs';
import {READ_FAMILIES} from '../apps/worker/conversation/reads/families.mjs';
import {READ_FAMILY_GUIDANCE} from '../apps/worker/conversation/reads/family-guidance.mjs';
import {domainLimitations} from '../apps/worker/conversation/reads/tools.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
/** Every test or fixture file under apps and the contracts tests. @param {string} dir @param {string[]} out */
function walk(dir,out=[]){
 for(const entry of readdirSync(dir)){
  if(entry==='node_modules'||entry==='dist')continue;
  const path=join(dir,entry);
  if(statSync(path).isDirectory())walk(path,out);
  else if(/\.test\.mjs$/u.test(entry)||/[\\/]test[\\/][^\\/]+\.mjs$/u.test(path))out.push(path);
 }
 return out;
}
const tests=[...walk(join(root,'apps')),...walk(join(root,'packages/contracts/test')),...walk(join(root,'scripts'))].map(path=>readFileSync(path,'utf8'));
const mentions=(/** @type {string} */id)=>tests.filter(text=>text.includes(`'${id}'`)||text.includes(`"${id}"`)||text.includes('`'+id+'`')||text.includes(id+'@')).length;
/** @returns {{family:string,operations:string[],handler:string,validated:boolean,tests:number[],guidance:string,freshness:string,states:string,structured:boolean,inherited:string}[]} */
export function auditRows(){
 const byFamily=new Map();
 for(const descriptor of catalog.operations){
  if(descriptor.sideEffect!=='none'||descriptor.approvalBoundary!=='none')continue;
  const contract=resolveOperationContract(descriptor.operation),family=contract.binding.group;
  if(!byFamily.has(family))byFamily.set(family,[]);
  byFamily.get(family).push({descriptor,contract});
 }
 return [...byFamily.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([family,rows])=>{
  const guidance=READ_FAMILY_GUIDANCE[family],mounted=Object.hasOwn(READ_FAMILIES,family),module=existsSync(join(root,'apps/gateway/general-reads/families',`${family}.mjs`))||GENERAL_READ_ADAPTER_FAMILIES.includes(family);
  const operations=rows.map(row=>`${row.descriptor.operation.id}@${row.descriptor.operation.version}`);
  const handler=module?(mounted?`gateway module; worker mount ${READ_FAMILIES[family].clientScope} client scope`:'gateway module; not mounted for the model'):'none (served by another mount)';
  const quality=rows.every(row=>domainLimitations(row.descriptor).length===row.descriptor.limitations.length)?'descriptor':'descriptor with registration-era limits filtered';
  return {family,operations,handler,validated:rows.every(row=>typeof row.contract.binding.outputAssert==='function'),tests:rows.map(row=>mentions(row.descriptor.operation.id)),
   guidance:guidance?`${quality}; covers/returns/states from family guidance`:'none',freshness:guidance?guidance.returns:'-',states:guidance?guidance.states:'-',structured:guidance?.structured===true};
 });
}
/** @param {ReturnType<typeof auditRows>} rows */
export function auditTable(rows=auditRows()){
 const cell=(/** @type {string} */text)=>text.replaceAll('|','\\|').replaceAll('\n',' ');
 const lines=['| Family | Operations | Handler and mount | Output validated | Tests referencing each operation | Model-facing description | Freshness / version citation (result fields) | Absent vs unsupported vs denied vs stale/partial | SQL-first |','| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
 for(const row of rows)lines.push(`| ${cell(row.family)} | ${cell(row.operations.join(', '))} | ${cell(row.handler)} | ${row.validated?'yes':'no'} | ${row.tests.join(', ')} | ${cell(row.guidance)} | ${cell(row.freshness)} | ${cell(row.states)} | ${row.structured?'yes':'no'} |`);
 return lines.join('\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])console.log(auditTable());
