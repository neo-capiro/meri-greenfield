import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../validate.mjs';
import { assertCatalog, assertActionItemReadInput, resolveOperationContract, OPERATIONAL_READ_PENDING_MODES } from '../retrieval-0.2/validate.mjs';
import { CATALOG_OPERATION_BINDINGS } from '../retrieval-0.2/catalog-validation.mjs';

const reference={id:'query_action_items',version:'0.2.0'},actorId='synthetic-actor';
const contract=()=>resolveOperationContract(reference);
const catalog=()=>JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json',import.meta.url)));
const context={actorId,nowMs:0};

test('partial action binding does not declare full native parity or activate a handler',()=>{
 const c=catalog(),binding=CATALOG_OPERATION_BINDINGS.find(row=>row.id===reference.id),resolved=contract();
 assertCatalog(c);assert.equal(binding.nativeCoverage,'partial');assert.equal(resolved.binding,binding);
 assert.equal(c.operations.length,21);assert.equal(c.originals.filter(row=>row.state==='mapped').length,20);
 assert.equal(c.originals.filter(row=>row.disposition==='selected'&&row.state==='pending').length,76);
 const original=c.originals.find(row=>row.id===reference.id);assert.equal(original.state,'pending');assert.equal(original.replacement,null);
 assert.deepEqual(resolved.descriptor.aliases,[]);assert.equal(resolved.descriptor.handler,null);
 assert.equal(resolved.descriptor.availability,'unimplemented');assert.equal(resolved.descriptor.qualification,'pending');
 assert.equal(resolved.descriptor.retry.maxRetries,0);assert.deepEqual(resolved.descriptor.retry.retryableCodes,[]);
 const raw=readFileSync(new URL('../retrieval-0.2/operational-reads.schema.json',import.meta.url));
 const sha256=createHash('sha256').update(raw).digest('hex');
 assert.deepEqual(resolved.descriptor.inputSchema,{id:'urn:meri:retrieval:operational-reads:0.2.0#/$defs/ActionItemReadInput',sha256});
 assert.deepEqual(resolved.descriptor.outputSchema,{id:'urn:meri:retrieval:operational-reads:0.2.0#/$defs/ActionItemClientScopedPage',sha256});
});

test('partial binding refuses original mapping, aliases and executable/retry promotion',()=>{
 for(const mutate of [
  c=>Object.assign(c.originals.find(row=>row.id===reference.id),{state:'mapped',replacement:reference}),
  c=>c.originals.find(row=>row.id===reference.id).state='deferred',
  c=>c.operations.find(row=>row.operation.id===reference.id).aliases.push('read_action_items'),
  c=>c.operations.find(row=>row.operation.id===reference.id).aliases.push('query_action_items'),
  c=>c.operations.find(row=>row.operation.id===reference.id).retry.maxRetries=1,
  c=>c.operations.find(row=>row.operation.id===reference.id).retry.retryableCodes.push('timeout'),
  c=>Object.assign(c.operations.find(row=>row.operation.id===reference.id),{availability:'enabled',qualification:'qualified',handler:{module:'synthetic/read.mjs',export:'read',sourceSha256:'a'.repeat(64)}}),
 ]){const c=catalog();mutate(c);assert.throws(()=>assertCatalog(c));}
});

test('scoped canonical defaults and digest preserve a frozen original request plus opaque cursor',()=>{
 const c=contract(),request={clientId:' synthetic-client '};const normalized=c.normalizeInput(request,context);
 assert.deepEqual(normalized.input,{clientId:'synthetic-client',actionItemId:null,status:null,sort:'deadline',page:1,limit:20,cursorApplied:false});
 assert.deepEqual(normalized.metadata,{cursor:null});assert.equal(normalized.argumentsSha256,canonicalSha256(normalized.input));
 assert.notEqual(normalized.argumentsSha256,canonicalSha256(request));request.clientId='changed';assert.equal(normalized.request.clientId,' synthetic-client ');
 assert.ok(Object.isFrozen(normalized));assert.ok(Object.isFrozen(normalized.input));assert.ok(Object.isFrozen(normalized.metadata));
 const resumed=c.normalizeInput({clientId:'synthetic-client',actionItemId:'one',status:'new',sort:'priority',cursor:' opaque ',limit:1},context);
 assert.equal(resumed.input.page,null);assert.equal(resumed.input.cursorApplied,true);assert.equal(resumed.metadata.cursor,'opaque');
 assert.equal(resumed.input.actionItemId,'one');assert.equal(resumed.input.sort,'priority');
});

test('binding refuses unscoped mode while unchanged family keeps it explicitly pending',()=>{
 assert.equal(assertActionItemReadInput({}).mode,'unscoped_legacy_pending');
 assert.equal(OPERATIONAL_READ_PENDING_MODES.find(row=>row.operationId===reference.id).pending,true);
 for(const request of [{},{clientId:null},{clientId:' '},{actionItemId:'one'},{cursor:'opaque'},{clientId:null,status:'new'}])
  assert.throws(()=>contract().normalizeInput(request,context));
});

test('trusted actor is mandatory and model authority cannot replace it',()=>{
 for(const options of [{},{nowMs:0},{actorId:null},{actorId:0},{actorId:''},{actorId,subject:{kind:'client'}}])
  assert.throws(()=>contract().normalizeInput({clientId:'synthetic-client'},options));
 for(const key of ['actorId','tenantId','binding','subject','policyRevision','authorizedSources'])
  assert.throws(()=>contract().normalizeInput({clientId:'synthetic-client',[key]:actorId},context));
 assert.throws(()=>contract().assertOutput({}, {request:{clientId:'synthetic-client'}}),/actorId/);
});

test('family mode bounds and closed JSON admission retain strict behavior',()=>{
 for(const change of [{limit:0},{limit:51},{limit:'20'},{status:'UNKNOWN'},{sort:'other'},
  {cursor:'x'.repeat(4097)},{actionItemId:'x'.repeat(81)},{clientId:'x'.repeat(81)}])
  assert.throws(()=>contract().normalizeInput({clientId:'synthetic-client',...change},context));
 let effects=0;const accessor={};Object.defineProperty(accessor,'clientId',{enumerable:true,get(){effects++;return 'client';}});
 const proxy=new Proxy({clientId:'client'},{getPrototypeOf(){effects++;return Object.prototype;}});
 for(const value of [accessor,proxy,{clientId:'client',toJSON(){effects++;return {};}}])assert.throws(()=>contract().normalizeInput(value,context));
 assert.equal(effects,0);
});

test('all fourteen original descriptors and all139 native rows remain exact',()=>{
 const c=catalog();
 assert.equal(canonicalSha256(c.operations.slice(0,14)),'50d5baa13482e07e7e65bfcf88212aef7e1e41169719b9caf83a96246a000b92');
 const priorRows=structuredClone(c.originals);
 for(const id of ['lookup_client_registry','get_business_development_context','get_business_development_evidence',
  'get_business_development_recent_changes','get_research_portfolio','get_research_portfolio_changes']){
  const row=priorRows.find(row=>row.id===id);
  assert.equal(row.state,'mapped');assert.deepEqual(row.replacement,{id,version:'0.2.0'});
  row.state='pending';row.replacement=null;
 }
 assert.equal(canonicalSha256(priorRows),'74208a71fccd5403609980a19a51505dc566826c4e56449451306d39db2f18e9');
 assert.deepEqual(CATALOG_OPERATION_BINDINGS.filter(row=>row.dispatchProfile==='mail-candidates/1').map(row=>row.id),['mail.list_messages','mail.search_messages']);
});
