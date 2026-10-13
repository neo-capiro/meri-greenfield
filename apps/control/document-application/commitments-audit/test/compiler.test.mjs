import test from 'node:test';import assert from 'node:assert/strict';
import {createCommitmentsAuditCompiler} from '../compose.mjs';
import {admitPreparedCommitmentsAudit} from '../compose.mjs';
import {asset} from '../source.mjs';
import {sourcePage,makeInput,selection,unitContext,NOW,uid} from './fixtures.mjs';
function setup({source=sourcePage,limits={}}={}){const context=unitContext(),selected=selection(context),calls=[];
 const compiler=createCommitmentsAuditCompiler({now:()=>NOW,limits,async readSource(call){calls.push(call);return source(call);}});return {context,selected,calls,compiler};}
test('all8 original operations collect actual canonical pages across6 sources and exact late promise',async()=>{
 const f=setup(),p=await f.compiler.prepare(makeInput(),f.context,{selection:f.selected});
 assert.deepEqual(new Set(f.calls.map(c=>c.operation.id)),new Set(asset.manifest.allowedOperations.map(op=>op.id)));
 assert.equal(p.ledger.commitments.length,1);assert.equal(p.ledger.commitments[0].promise.verification,'bound-source-excerpt');
 assert.equal(p.ledger.commitments[0].owner.status,'conflicting');assert.equal(p.ledger.commitments[0].dueDate.status,'conflicting');
 assert.equal(p.ledger.commitments[0].completed,false);assert.equal(p.ledger.commitments[0].deliveryClaims.length,1);
 assert.equal(p.ledger.negativeClaimSupported,false);assert.deepEqual(p.ledger.mutations,[]);assert.equal(p.ledger.coverage.length,6);
 assert.ok(p.ledger.coverage.some(c=>c.sourceId==='tasks'&&c.complete===false));assert.ok(p.reads.every(r=>Object.keys(r).sort().join(',')==='normalizationContext,operation,request,result,resultSha256'));
 assert.ok(p.provenance.collection.calls<=24);assert.ok(p.request.content.blocks.some(b=>b.runs?.[0]?.text.includes('funding was withheld')||b.runs?.[0]?.text.includes('quoted source statement')));
});
test('all required source failures stay visible without inventing absence or a bound promise',async()=>{
 const f=setup({source:()=>{throw Object.assign(new Error('UNAVAILABLE'),{code:'UNAVAILABLE'});}}),p=await f.compiler.prepare(makeInput(),f.context,{selection:f.selected});
 assert.equal(p.ledger.commitments.length,0);assert.equal(p.unresolved.length,3);assert.equal(p.ledger.status,'partial');assert.equal(p.ledger.coverage.length,6);
 assert.equal(p.ledger.negativeClaimSupported,false);assert.ok(p.provenance.gaps.length>=6);
});
test('call/body caps disclose unbound observations and retain original budgets',async()=>{
 const f=setup({limits:{maxCalls:7,maxPages:1}}),p=await f.compiler.prepare(makeInput(),f.context,{selection:f.selected});
 assert.equal(p.provenance.collection.calls,7);assert.ok(p.provenance.collection.capHits.length>0);assert.equal(p.ledger.commitments.length,0);
 assert.equal(p.unresolved.length,3);assert.equal(p.ledger.negativeClaimSupported,false);assert.throws(()=>setup({limits:{maxCalls:25}}));
});
test('foreign binding/subject/window refuses rather than returning a partial authority failure',async()=>{
 for(const key of ['binding','subject','window']){const f=setup({source:call=>{const p=sourcePage(call);if(call.operation.id==='mail.search_messages')p[key]=key==='window'?{basis:'explicit',startInclusive:'2026-01-01T00:00:00Z',endExclusive:'2026-01-02T00:00:00Z',timezone:'UTC',weekStartsOn:null}:{...p[key],[key==='binding'?'actorId':'actorId']:'foreign'};return p;}});
  await assert.rejects(f.compiler.prepare(makeInput(),f.context,{selection:f.selected}));}
});
test('immutable skill, source body hash, quote and output request provenance cannot be substituted',async()=>{
 const f=setup(),i=makeInput();i.skill={...i.skill,skillVersion:'2.0.0'};await assert.rejects(f.compiler.prepare(i,f.context,{selection:f.selected}));
 const p=await f.compiler.prepare(makeInput(),f.context,{selection:f.selected}),guard=admitPreparedCommitmentsAudit(p,p.context),changed=structuredClone(p.request);
 changed.title='substituted';assert.throws(()=>guard({request:changed,baseVersionId:null}));assert.throws(()=>guard({request:p.request,baseVersionId:'foreign'}));
 const bad=setup({source:call=>{const p=sourcePage(call);if(call.operation.id==='mail.read_thread')p.messages[0].contentSha256='0'.repeat(64);return p;}});
 await assert.rejects(bad.compiler.prepare(makeInput(),bad.context,{selection:bad.selected}));
});
test('no mapped Monday board means not-mapped coverage and no unrelated board source call',async()=>{
 const f=setup();f.selected.mondayBoardIds=[];const p=await f.compiler.prepare(makeInput(),f.context,{selection:f.selected});
 assert.equal(f.calls.some(c=>c.operation.id==='read_monday_client_boards'),false);assert.ok(p.ledger.coverage.some(c=>c.sourceId==='client_knowledge_monday'&&c.status==='not-mapped'));
});
test('fresh authorization decision IDs retain exact stable subject and every actual source decision',async()=>{
 const f=setup({source:call=>{const page=sourcePage(call);if(page.subject)page.subject={...page.subject,authorizationDecisionId:uid(90)};return page;}});
 const p=await f.compiler.prepare(makeInput(),f.context,{selection:f.selected});assert.equal(p.ledger.commitments[0].promise.authorizationDecisionId,uid(90));
 assert.ok(p.context.evidence.every(e=>e.authorizationDecisionId===uid(90)));
});
test('cancelled collection never reaches later source work',async()=>{const f=setup(),controller=new AbortController();controller.abort();await assert.rejects(f.compiler.prepare(makeInput(),f.context,{selection:f.selected,signal:controller.signal}));assert.equal(f.calls.length,0);});

// This is synthetic original DTO grammar, not the actions.query producer.
import {sourcePage as originalFixture,unitContext as originalContext} from '../../relationship-brief/test/fixtures.mjs';
const originalGrammar=call=>originalFixture(call.operation.id.startsWith('mail.')?{...call,normalizationContext:{...call.normalizationContext,nowMs:NOW}}:call);
test('closed original read wrapper preserves a bounded selection and incomplete wider native evidence',async()=>{
 const context=originalContext(),selected=selection(context);selected.window={basis:'explicit',startInclusive:'2026-10-13T10:00:00.000Z',endExclusive:'2026-10-13T15:00:00.000Z',timezone:'UTC',weekStartsOn:null};
 const p=await createCommitmentsAuditCompiler({now:()=>NOW,readSource:originalGrammar}).prepare(makeInput(),context,{selection:selected});
 assert.deepEqual(p.provenance.selection.window,selected.window);assert(p.ledger.coverage.some(c=>c.windowMatch==='broad-native-read'));assert(p.ledger.coverage.every(c=>!c.complete));assert(p.ledger.commitments.every(c=>!c.completed));
});
test('original wrapper refuses altered lineage, input hash, extra fields and actual successor source/operation',async()=>{
 for(const mutate of [p=>{p.binding.actorId='foreign';},p=>{p.argumentsSha256='0'.repeat(64);},p=>{p.credential='not-authority';},p=>{p.operation={id:'actions.query',version:'0.2.0'};},p=>{p.result.sources[0].sourceId='action_items_complete';p.result.sources[0].authority='derived';}]){
  const context=originalContext(),compiler=createCommitmentsAuditCompiler({now:()=>NOW,readSource:call=>{const p=originalGrammar(call);if(call.operation.id==='query_action_items')mutate(p);return p;}});
  await assert.rejects(compiler.prepare(makeInput(),context,{selection:selection(context)}));
 }
});
