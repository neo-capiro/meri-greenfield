import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import { canonicalSha256 } from '../validate.mjs';
import { assertCatalog, assertActionItemClientScopedPage, assertActionItemReadInput } from '../retrieval-0.2/validate.mjs';
import { contract, clientId, actorId, id, page, row, operation, sha } from '../../../docs/qualification/candidates/capability-successor-20261012/action-review/fixture.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('../../../docs/qualification/candidates/capability-successor-20261012/action-review/baseline-catalog.json',import.meta.url)));

test('independent literal recommendation and outcome source proofs satisfy unchanged family',()=>{
  for(const actions of [[row()],[row({outcome:'Synthetic outreach reported'})]])
    assertActionItemClientScopedPage(page({clientId},{actions}),{clientId},{actorId});
  assert.equal(assertActionItemReadInput({}).mode,'unscoped_legacy_pending');
});
test('partial binding preserves every original row and fourteen descriptors',()=>{
  assertCatalog(catalog);assert.equal(catalog.operations.length,21);
  const priorRows = structuredClone(catalog.originals);
  for (const id of ['lookup_client_registry','get_business_development_context','get_business_development_evidence',
    'get_business_development_recent_changes','get_research_portfolio','get_research_portfolio_changes']) {
    const row = priorRows.find(row => row.id === id);
    assert.equal(row.state,'mapped'); assert.deepEqual(row.replacement,{id,version:'0.2.0'});
    // Undo only the six explicit new mappings for the unchanged historical hash.
    row.state='pending'; row.replacement=null;
  }
  assert.equal(sha(priorRows),baseline.originalsSha256);
  assert.equal(sha(catalog.operations.filter(x=>baseline.originalIds.includes(x.operation.id))),baseline.originalOperationsSha256);
  assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,20);
  assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.replacement===null).length,76);
  const c=contract();assert.equal(c.binding.nativeCoverage,'partial');assert.deepEqual(c.descriptor.aliases,[]);
  assert.equal(catalog.originals.find(x=>x.id===operation.id).replacement,null);
});
test('canonical binding defaults, raw ownership and digest use existing selection',()=>{
  const request={clientId:` ${clientId} `};const c=contract();const n=c.normalizeInput(request,{actorId,nowMs:1});
  assert.deepEqual(n.input,{clientId,actionItemId:null,status:null,sort:'deadline',page:1,limit:20,cursorApplied:false});
  assert.equal(n.argumentsSha256,canonicalSha256(n.input));assert.notEqual(n.argumentsSha256,canonicalSha256(request));
  assert.deepEqual(n.metadata,{cursor:null});request.clientId='changed';assert.equal(n.request.clientId,` ${clientId} `);
  for(const v of [n,n.request,n.input,n.metadata]) assert.equal(Object.isFrozen(v),true);
});
test('client-less, missing actor and shape/coercion attempts refuse',()=>{
  const c=contract();for(const value of [{},{clientId:null},{clientId:' '},{actionItemId:id},{cursor:'opaque'},{clientId,limit:'20'},{clientId,limit:51},{clientId,sort:'Deadline'},{clientId,page:2},{clientId,actorId:'forged'}])
    assert.throws(()=>c.normalizeInput(value,{actorId}),undefined,JSON.stringify(value));
  for(const ctx of [{},{actorId:''},{actorId:null},{actorId,subject:{}}])assert.throws(()=>c.normalizeInput({clientId},ctx));
});
test('hostile objects never invoke accessor/proxy/toJSON and unknown context refuses',()=>{
  const c=contract();let effects=0;const accessor={};Object.defineProperty(accessor,'clientId',{enumerable:true,get(){effects++;return clientId;}});
  const proxy=new Proxy({clientId},{get(){effects++;return clientId;},getPrototypeOf(){effects++;return Object.prototype;},ownKeys(){effects++;return [];}});
  const hidden={clientId};Object.defineProperty(hidden,'x',{value:1});const symbolic={clientId,[Symbol('x')]:1};const cyclic={clientId};cyclic.x=cyclic;
  for(const value of [accessor,proxy,hidden,symbolic,cyclic,{clientId,toJSON(){effects++;return {clientId};}}])assert.throws(()=>c.normalizeInput(value,{actorId}));
  assert.throws(()=>c.normalizeInput({clientId},proxy));assert.equal(effects,0);
});
test('opaque cursor boundary and page disclosure remain bounded but unqualified',()=>{
  const c=contract(),request={clientId,cursor:'x'.repeat(4096),limit:1};const n=c.normalizeInput(request,{actorId});
  assert.equal(n.input.page,null);assert.equal(n.input.cursorApplied,true);assert.equal(n.metadata.cursor,request.cursor);
  assert.throws(()=>c.normalizeInput({...request,cursor:'x'.repeat(4097)},{actorId}));
  c.assertOutput(page(request),{request,actorId});
  assert.throws(()=>c.assertOutput(page(request,{page:1}),{request,actorId}));
  assert.throws(()=>c.assertOutput(page({clientId}),{request,actorId}));
});
test('catalog mutants cannot promote partial parity, aliases, availability or source pins',()=>{
  for(const change of [
    c=>{const x=c.originals.find(x=>x.id===operation.id);x.state='mapped';x.replacement=operation;},
    c=>c.operations.find(row=>row.operation.id===operation.id).aliases.push('client-action-compat'),c=>c.operations.find(row=>row.operation.id===operation.id).handler={module:'synthetic/module.mjs',sourceSha256:'a'.repeat(64)},
    c=>c.operations.find(row=>row.operation.id===operation.id).availability='enabled',c=>c.operations.find(row=>row.operation.id===operation.id).qualification='qualified',
    c=>c.operations.find(row=>row.operation.id===operation.id).retry.maxRetries=1,c=>c.operations.find(row=>row.operation.id===operation.id).inputSchema.sha256='b'.repeat(64),
  ]){const copy=structuredClone(catalog);change(copy);assert.throws(()=>assertCatalog(copy));}
});
test('bound pages preserve recommendation semantics for a reported outcome',()=>{
  const c=contract(),request={clientId,actionItemId:id};const output=page(request,{actions:[row({outcome:'Reported synthetic outreach'})]});
  c.assertOutput(output,{request,actorId});assert.equal(output.actions[0].nativeCompletion.completed,false);
  for(const change of [p=>p.actions[0].acceptedAsTask=true,p=>p.actions[0].nativeCompletion.completed=true,p=>p.actions[0].nativeCompletion.establishesDeliveryOrAcceptance=true,p=>p.actions[0].nativeCompletion.evidence='native_task_status']){
    const mutant=structuredClone(output);change(mutant);assert.throws(()=>c.assertOutput(mutant,{request,actorId}));}
});
test('exact proof and content substitutions fail through canonical resolver',()=>{
  const c=contract(),request={clientId,actionItemId:id};const output=page(request);
  for(const change of [p=>p.actions[0].sourceProof.sourceRecordId='other',p=>p.actions[0].sourceProof.currentClientId='other',p=>p.actions[0].sourceProof.sourceVersion='2025-01-01T00:00:00Z',p=>p.actions[0].sourceProof.contentSha256='0'.repeat(64),p=>p.actions[0].recommendedAction='changed',p=>p.actions[0].id='other',p=>p.actions[0].clientId='other',p=>p.scope.limit=1,p=>p.argumentsSha256='1'.repeat(64),p=>p.actions.push(structuredClone(p.actions[0]))]){
    const mutant=structuredClone(output);change(mutant);assert.throws(()=>c.assertOutput(mutant,{request,actorId}));}
});
test('unlinked evidence and forged linked source owner fail despite valid row digest',()=>{
  const c=contract(),request={clientId};const evidence=[{kind:'source',sourceDocumentId:'source-one'}];
  const linked={owner:'source_document',sourceRecordId:'source-one',sourceVersion:'2026-01-01T00:00:00Z',contentSha256:'a'.repeat(64)};
  c.assertOutput(page(request,{actions:[row({evidence,linkedSources:[linked]})]}),{request,actorId});
  assert.throws(()=>c.assertOutput(page(request,{actions:[row({evidence})]}),{request,actorId}));
  assert.throws(()=>c.assertOutput(page(request,{actions:[row({evidence,linkedSources:[{...linked,owner:'other'}]})]}),{request,actorId}));
});
test('bounded page completeness never becomes source evidence, history or absence proof',()=>{
  const c=contract(),request={clientId};const empty=page(request,{actions:[]});c.assertOutput(empty,{request,actorId});
  assert.equal(empty.pageCoverage.absenceSupported,true);assert.equal(empty.negativeAssertion.kind,'none');assert.equal(empty.evidenceReady,false);
  for(const change of [p=>p.evidenceReady=true,p=>p.coverage.enumeration='complete',p=>p.coverage.enumerableTotal=0,p=>p.coverage.historySupport='supported',p=>p.sources[0].snapshotVersionId='claimed',p=>p.sources[0].status='checked',p=>p.sources[0].freshness='fresh',p=>p.coverage.limitations=[],p=>p.negativeAssertion={kind:'no-results'}]){
    const mutant=structuredClone(empty);change(mutant);assert.throws(()=>c.assertOutput(mutant,{request,actorId}));}
});
