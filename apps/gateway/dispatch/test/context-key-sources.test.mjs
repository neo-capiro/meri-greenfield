/** P5 pin: every registered read gets each declared context key from a named trusted producer; unsupplied keys exist only on
 * reads that are not registered. A new contract key, path or registration that breaks this fails here, not at run time. */
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {CATALOG_OPERATION_BINDINGS} from '../../../../packages/contracts/retrieval-0.2/catalog-validation.mjs';
import {familyReads} from '../../../worker/conversation/reads/availability.mjs';
import {CONTEXT_KEY_SOURCES,readContextPath,readContextSupply} from '../context-key-sources.mjs';

const registered=new Set(familyReads().map(row=>row.operation.id));
const reads=CATALOG_OPERATION_BINDINGS.filter(binding=>catalog.operations.find(op=>op.operation.id===binding.id)?.sideEffect==='none');
const keyed=reads.filter(binding=>(binding.contextKeys??[]).length);

test('every registered read with context keys has a trusted producer for each key and never uses the generic path',()=>{
 const covered=keyed.filter(binding=>registered.has(binding.id));
 assert.equal(covered.length,34);
 for(const binding of covered){
  const supply=readContextSupply(binding);
  assert.notEqual(supply.path,'generic',binding.id);
  for(const {key,source} of supply.keys)assert.ok(typeof source==='string'&&source.length>20,`${binding.id}.${key}`);
 }
});

test('keys without a trusted producer exist only on unregistered reads, exactly these',()=>{
 const unsupplied=keyed.filter(binding=>readContextSupply(binding).keys.some(k=>k.source===null)).map(binding=>binding.id).sort();
 assert.deepEqual(unsupplied,['get_certification_status','get_state_rule_status','read_chat_attachments','search_research_sources','search_sam_opportunities']);
 for(const id of unsupplied)assert.equal(registered.has(id),false,id);
});

test('the classifier follows operation-context.mjs path selection',()=>{
 const path=id=>readContextPath(CATALOG_OPERATION_BINDINGS.find(b=>b.id===id));
 assert.equal(path('search_funding_opportunities'),'native');assert.equal(path('read_bill_text'),'native');
 assert.equal(readContextPath(CATALOG_OPERATION_BINDINGS.find(b=>b.id==='read_bill_text'),{nativePortsComposed:false}),'bill-text');
 for(const binding of keyed.filter(b=>registered.has(b.id)))for(const {key,source} of readContextSupply(binding,{nativePortsComposed:false}).keys)assert.ok(source,`${binding.id}.${key} without native ports`);
 assert.equal(path('get_research_portfolio'),'retained');assert.equal(path('get_florida_budget_project'),'retained');
 assert.equal(path('get_client_context'),'profile:bound-projection/1');assert.equal(path('actions.query'),'profile:actions-complete/1');
 assert.equal(path('search_sam_opportunities'),'generic');
 // bill-text has two trusted producers (native when native ports are composed, otherwise the bill-text context); both supply the key.
 assert.ok(CONTEXT_KEY_SOURCES.native.defaultCongress&&CONTEXT_KEY_SOURCES['bill-text'].defaultCongress);
});

test('every declared source table is reachable and no source text is empty',()=>{
 const paths=new Set([...keyed.map(binding=>readContextPath(binding)),...keyed.map(binding=>readContextPath(binding,{nativePortsComposed:false}))]);
 for(const path of Object.keys(CONTEXT_KEY_SOURCES))assert.ok(paths.has(path),`unused path ${path}`);
 for(const [path,sources] of Object.entries(CONTEXT_KEY_SOURCES))for(const [key,source] of Object.entries(sources))assert.ok(source.includes('—')||source.includes('apps/'),`${path}.${key}`);
});
