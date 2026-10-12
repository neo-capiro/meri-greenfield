import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {assertCatalog,resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS as bindings} from '../../../../../packages/contracts/retrieval-0.2/catalog-validation.mjs';
const baseline=JSON.parse(readFileSync(new URL('./baseline.json',import.meta.url)));
const oldBindings=JSON.parse(readFileSync(new URL('./baseline-bindings.json',import.meta.url)));
const ids=['get_committee_roster','list_members','get_pe_contractors','get_pe_bills','get_pe_report_language','get_state_rule_status','get_certification_status','search_intel_articles','list_global_datasets','get_representation'];
const checks=[];
function check(name,fn){fn();checks.push({name,result:'PASS'});}
check('exact PR28 catalog',()=>assert.deepEqual(catalog,baseline.catalog));
check('exact prior46 callback and descriptor metadata',()=>assert.deepEqual(JSON.parse(JSON.stringify(bindings,(k,v)=>typeof v==='function'?{source:v.toString()}:v)),oldBindings));
check('catalog validation',()=>assertCatalog(catalog));
check('original139 selected96 deferred43',()=>{assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);});
check('prior46 typed45 mapped51 pending',()=>{assert.equal(catalog.operations.length,46);assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,45);assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.replacement===null).length,51);});
for(const id of ids)check(`${id} remains unmapped and unresolvable at baseline`,()=>{const row=catalog.originals.find(x=>x.id===id);assert.equal(row.disposition,'selected');assert.equal(row.replacement,null);assert.throws(()=>resolveOperationContract({id,version:'0.2.0'}));});
console.log(JSON.stringify({base:baseline.base,checks,passed:checks.length,scope:'BASELINE_CHARACTERIZATION_ONLY; COMBINED_INTEGRATION_UNBUILT'},null,2));
