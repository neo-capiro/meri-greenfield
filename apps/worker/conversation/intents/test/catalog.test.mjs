/** The intent registry reconciles exactly with the scope ledger's INTENT-ROUTE rows and the canonical catalog. */
import test from 'node:test';import assert from 'node:assert/strict';
import ledger from '../../../../../docs/coordination/ledgers/scope-ledger.json' with {type:'json'};
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {INTENT_ROWS,NOT_INTENTS,assertIntentCatalog,intentDescriptor,intentToolName} from '../catalog.mjs';
const routed=ledger.capabilities.filter(c=>c.decision==='included'&&c.gates.includes('INTENT-ROUTE'));

test('exactly the 11 selected non-read capabilities the ledger routes through INTENT-ROUTE, with the ledger\'s tool names',()=>{
 const nonReads=routed.filter(c=>c.sideEffect!=='none');
 assert.equal(nonReads.length,11);assert.equal(INTENT_ROWS.length,11);
 assert.deepEqual(INTENT_ROWS.map(r=>r.operation.id).sort(),nonReads.map(c=>c.id).sort());
 for(const c of nonReads){const r=INTENT_ROWS.find(x=>x.operation.id===c.id);assert.equal(`governed-intent:${intentToolName(r.tool)}`,c.route,c.id);}
 assert.deepEqual(Object.keys(NOT_INTENTS),routed.filter(c=>c.sideEffect==='none').map(c=>c.id),'the routed read is listed with its reason, never registered');
});

test('every row is a catalog non-read behind an approval or draft boundary; reads and deferred originals are refused',()=>{
 assert.doesNotThrow(assertIntentCatalog);
 for(const r of INTENT_ROWS){const d=intentDescriptor(r.operation);assert.notEqual(d.sideEffect,'none');assert.notEqual(d.approvalBoundary,'none');}
 const deferred=catalog.originals.filter(o=>o.disposition==='deferred').map(o=>o.id);
 assert.equal(deferred.length,43);
 for(const r of INTENT_ROWS)assert.equal(deferred.includes(r.operation.id)||deferred.includes(r.tool),false,r.operation.id);
});

test('owner-backed rows and explicit unavailability reasons',()=>{
 assert.deepEqual(INTENT_ROWS.filter(r=>r.unavailable===null).map(r=>r.operation.id),['create_word','create_excel','schedule_task','update_scheduled_task','cancel_scheduled_task','create_task']);
 const reasons=Object.fromEntries(INTENT_ROWS.filter(r=>r.unavailable!==null).map(r=>[r.operation.id,r.unavailable]));
 assert.deepEqual(Object.keys(reasons).sort(),['create_powerpoint','run_analysis','save_chat_attachments','save_memory','update_task']);
 for(const [id,reason] of Object.entries(reasons))assert.match(reason,/^(ROUTE_GAP|OWNER_MISSING): /u,id);
});
