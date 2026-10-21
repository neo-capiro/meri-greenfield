import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {HOP,HOT_PATH_BUDGET_EXCEPTIONS,HOT_PATH_BUDGET_MARGIN_MS,assertHotPathBudgets,budget,fixedHotPathBudget,hotPathBudgets,hotPathBudgetDigest,runnerStartupBudget,WORKFLOW_BUDGETS} from '../hot-path-budgets.mjs';
import {productionBudgetInputs,testBudgetTable as table} from './budget-fixture.mjs';

const clone=()=>structuredClone(table);
const refusal=(action,hop,parent)=>assert.throws(action,error=>error.code==='HOT_PATH_BUDGET_CONFIGURATION'&&error.hop===hop&&(parent===undefined||error.parent===parent));

test('production roots derive the frozen table and preserve all absolute runner cutoffs',()=>{
 assert.equal(assertHotPathBudgets(table),table);
 assert.deepEqual(table.startup,runnerStartupBudget({requestMs:productionBudgetInputs.limits.requestMs,shutdownMs:productionBudgetInputs.limits.shutdownMs,originalExpiresAtMs:productionBudgetInputs.originalExpiresAtMs}));
 const frozen=value=>{if(value&&typeof value==='object'){assert.equal(Object.isFrozen(value),true);for(const child of Object.values(value))frozen(child);}};frozen(table);frozen(HOP);frozen(HOT_PATH_BUDGET_EXCEPTIONS);
 assert.throws(()=>{table.hops['runner.replay.delays'].ms[0]=0;},TypeError);
 const moved=hotPathBudgets({...productionBudgetInputs,originalExpiresAtMs:productionBudgetInputs.originalExpiresAtMs+60000});
 for(const stage of Object.keys(table.startup.stages))assert.equal(moved.startup.stages[stage].expiresAtMs-table.startup.stages[stage].expiresAtMs,60000);
});

test('every nested edge rejects both a grown child and a shrunken parent, naming the edge',()=>{
 const edges=Object.entries(table.hops).filter(([,hop])=>hop.kind==='nested');assert.ok(edges.length>10);
 for(const[id,hop]of edges){
  const exception=HOT_PATH_BUDGET_EXCEPTIONS.find(row=>row.hop===id&&row.rule==='nested-margin');
  const grown=clone();grown.hops={[id]:grown.hops[id],...grown.hops};grown.hops[id].ms=exception?exception.maxChildMs+1:budget(table,hop.parent)-HOT_PATH_BUDGET_MARGIN_MS+1;refusal(()=>assertHotPathBudgets(grown),id,hop.parent);
  const shrunk=clone();shrunk.hops={[id]:shrunk.hops[id],...shrunk.hops};(shrunk.hops[hop.parent]??shrunk.roots[hop.parent]).ms=exception?exception.minParentMs-1:hop.ms+HOT_PATH_BUDGET_MARGIN_MS-1;refusal(()=>assertHotPathBudgets(shrunk),id,hop.parent);
 }
});

test('serial owners validate each child and report the unchanged sum without rejecting the known overrun',()=>{
 for(const[id,hop]of Object.entries(table.hops).filter(([,hop])=>hop.kind==='serial')){
  assert.equal(hop.sumMs,hop.children.reduce((sum,child)=>sum+budget(table,child),0));
  for(const child of new Set(hop.children)){const broken=clone();broken.hops={[id]:broken.hops[id],...broken.hops};broken.hops[child].ms=hop.ms-HOT_PATH_BUDGET_MARGIN_MS+1;refusal(()=>assertHotPathBudgets(broken),child,id);}
 }
 assert.equal(table.hops['runtime.preparation'].sumMs,33000);assert.equal(budget(table,'runtime.preparation'),30000);
 const violations=Object.entries(table.hops).filter(([,h])=>h.kind==='serial'&&h.sumMs>h.ms).map(([id])=>id).sort();
 assert.deepEqual(violations,HOT_PATH_BUDGET_EXCEPTIONS.filter(e=>e.rule==='serial-sum').map(e=>e.hop).sort());
});

test('background expiry must cover two whole renewal periods',()=>{
 const valid=clone();valid.hops['test.renewal']={kind:'background',ms:100,periodMs:100,expiryMs:200};assertHotPathBudgets(valid);
 valid.hops['test.renewal'].expiryMs=199;refusal(()=>assertHotPathBudgets(valid),'test.renewal');
 valid.hops['test.renewal']={kind:'background',ms:100,period:'continuation.poll',expiry:'conversation.events.subscription'};assertHotPathBudgets(valid);
 valid.hops['test.renewal'].period='conversation.events.subscription';refusal(()=>assertHotPathBudgets(valid),'test.renewal');
});

test('ADR ten-percent exceptions are exact, dated, phase-owned and never stale',()=>{
 const violations=Object.entries(table.hops).filter(([,hop])=>hop.kind==='nested'&&hop.ms>budget(table,hop.parent)-Math.max(HOT_PATH_BUDGET_MARGIN_MS,.1*budget(table,hop.parent))).map(([id])=>id).sort();
 const rows=HOT_PATH_BUDGET_EXCEPTIONS.filter(e=>e.rule==='adr-margin');assert.deepEqual(rows.map(e=>e.hop).sort(),violations);
 for(const row of HOT_PATH_BUDGET_EXCEPTIONS){assert.match(row.removedBy,/^P[1-6]$/);assert.match(row.recordedAt,/^\d{4}-\d{2}-\d{2}$/);assert.ok(row.reason.trim());assert.ok(table.hops[row.hop]);}
 assert.equal(new Set(HOT_PATH_BUDGET_EXCEPTIONS.map(row=>row.hop+' '+row.rule)).size,HOT_PATH_BUDGET_EXCEPTIONS.length);
});

test('unbounded libraries require an existing bound and a reason',()=>{
 const bad=clone();delete bad.hops['aws.connection'].boundedBy;refusal(()=>assertHotPathBudgets(bad),'aws.connection');
 const missing=clone();missing.hops['sdk.api'].boundedBy='missing';refusal(()=>assertHotPathBudgets(missing),'sdk.api');
 const reason=clone();reason.hops['pg.owner.statement'].reason='';refusal(()=>assertHotPathBudgets(reason),'pg.owner.statement');
});

test('missing roots, invalid values and unknown or non-fixed hops refuse without supplying defaults',()=>{
 refusal(()=>hotPathBudgets(),'limits');refusal(()=>hotPathBudgets({limits:productionBudgetInputs.limits}),'turn');
 refusal(()=>hotPathBudgets({...productionBudgetInputs,limits:{...productionBudgetInputs.limits,requestMs:22999}}),'runner.native.router');
 refusal(()=>budget(table,'missing'),'missing');refusal(()=>fixedHotPathBudget('missing'),'missing');refusal(()=>fixedHotPathBudget('runtime.request'),'runtime.request');
 assert.equal(fixedHotPathBudget('runner.poststart.bootstrap'),20000);
 const negative=clone();negative.hops['runner.replay.pause'].ms=-1;refusal(()=>assertHotPathBudgets(negative),'runner.replay.pause');
 const missingParent=clone();missingParent.hops['runner.capture'].parent='missing';refusal(()=>assertHotPathBudgets(missingParent),'runner.capture','missing');
});

test('digest covers canonical effective values and excludes absolute wall-clock timestamps',()=>{
 const expected=createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(table.hops).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,hop])=>[id,hop.ms])))).digest('hex');
 assert.equal(hotPathBudgetDigest(table),expected);assert.match(expected,/^[a-f0-9]{64}$/);
 assert.equal(hotPathBudgetDigest(hotPathBudgets({...productionBudgetInputs,nowMs:productionBudgetInputs.nowMs+1000,originalExpiresAtMs:productionBudgetInputs.originalExpiresAtMs+1000})),expected);
 const changed=clone();changed.hops['runner.replay.pause'].ms+=1;assert.notEqual(hotPathBudgetDigest(changed),expected);
 const reordered=clone();reordered.hops=Object.fromEntries(Object.entries(reordered.hops).reverse());assert.equal(hotPathBudgetDigest(reordered),expected);
});

test('every effective production hop equals the independently extracted base golden',async()=>{
 const golden=JSON.parse(await readFile(new URL('./hot-path-budgets.golden.json',import.meta.url),'utf8'));
 const actual=hotPathBudgets(golden.inputs);
 assert.deepEqual(Object.fromEntries(Object.entries(actual.hops).map(([id,hop])=>[id,hop.ms])),golden.values);
 assert.deepEqual(WORKFLOW_BUDGETS,golden.workflow);
 assert.deepEqual(Object.keys(golden.sources).sort(),Object.keys(golden.values).sort());
 assert.match(golden.baseCommit,/^[a-f0-9]{40}$/);
});

test('independent lifetimes identify their owner and reject absent reasons or nonpositive durations',()=>{
 const independent=Object.entries(table.hops).filter(([,hop])=>hop.kind==='independent');assert.ok(independent.length>20);
 for(const[id]of independent)for(const field of ['owner','reason','ms']){
  const broken=clone();broken.hops={[id]:broken.hops[id],...broken.hops};broken.hops[id][field]=field==='ms'?0:'';refusal(()=>assertHotPathBudgets(broken),id);
 }
 const metadata=clone();metadata.hops['core.request'].reason='';refusal(()=>assertHotPathBudgets(metadata),'core.request');
});

test('Core retains its shared request deadline with an explicit P6 exception',()=>{
 assert.equal(budget(table,'core.request'),budget(table,'request'));
 for(const change of [-1,1]){const broken=clone();broken.hops['core.request'].ms+=change;refusal(()=>assertHotPathBudgets(broken),'core.request','request');}
 assert.equal(table.hops['core.request'].kind,'derived');assert.equal(table.hops['core.request'].parent,'request');
 const rows=HOT_PATH_BUDGET_EXCEPTIONS.filter(row=>row.rule==='shared-deadline');assert.deepEqual(rows.map(row=>[row.hop,row.removedBy]),[['core.request','P6']]);
});

test('separately configured owner request limits retain the same pool and shutdown values',()=>{
 for(const ownerRequestMs of [1000,8000,15000]){
  const custom=hotPathBudgets({...productionBudgetInputs,ownerRequestMs});
  for(const hop of ['owner.request','pg.owner.connect','pg.owner.query'])assert.equal(budget(custom,hop),ownerRequestMs);
  assert.equal(budget(custom,'owner.shutdown.watchdog'),ownerRequestMs+1000);
 }
 for(const ownerRequestMs of [0,15001,NaN])refusal(()=>hotPathBudgets({...productionBudgetInputs,ownerRequestMs}),'owner.request');
});


test('rendered tables cannot relax or replace the fixed containment margin',()=>{
 for(const ms of [0,1999,2001]){const altered=clone();altered.hops['budget.margin'].ms=ms;refusal(()=>assertHotPathBudgets(altered),'budget.margin');}
 const altered=clone();altered.hops['budget.margin'].ms=0;altered.hops['native.client.request'].ms=budget(table,'request');
 refusal(()=>assertHotPathBudgets(altered),'budget.margin');
});


test('durable activity windows keep workflow attempts and heartbeat/retry policy distinct',()=>{
 assert.ok(budget(table,'workflow.conversation.startToClose')>budget(table,'turn'));
 assert.equal(table.hops['workflow.conversation.heartbeat'].parent,'workflow.conversation.startToClose');
 assert.equal(table.hops['workflow.recovery.startToClose'].parent,'workflow.recovery.scheduleToClose');
 for(const id of ['workflow.conversation.startToClose','workflow.recovery.scheduleToClose','workflow.objective.startToClose','workflow.schedule.startToClose'])assert.equal(table.hops[id].kind,'independent');
 for(const id of ['workflow.recovery.retry.initial','workflow.recovery.retry.maximum'])assert.equal(table.hops[id].parent,'workflow.recovery.scheduleToClose');
 assert.equal(table.hops['workflow.schedule.settle'].kind,'derived');
});

test('preserved two-second margin exceptions are exact and cannot exempt a changed bound',()=>{
 const rows=HOT_PATH_BUDGET_EXCEPTIONS.filter(row=>row.rule==='nested-margin');
 const violations=Object.entries(table.hops).filter(([,hop])=>hop.kind==='nested'&&hop.ms>budget(table,hop.parent)-HOT_PATH_BUDGET_MARGIN_MS).map(([id])=>id).sort();
 assert.deepEqual(rows.map(row=>row.hop).sort(),violations);
 assert.equal(rows.length,5);
 for(const row of rows){assert.equal(row.parent,table.hops[row.hop].parent);assert.equal(row.maxChildMs,budget(table,row.hop));assert.equal(row.minParentMs,budget(table,row.parent));}
 // A rendered exception or relabelled child has no authority to relax the code-owned policy.
 const enlarged=clone();enlarged.hops['authority.gateway.request'].ms++;enlarged.exceptions=[{hop:'authority.gateway.request',maxChildMs:999999}];
 refusal(()=>assertHotPathBudgets(enlarged),'authority.gateway.request','request');
});

test('audited request children cannot be relabelled or moved under a larger owner',()=>{
 for(const id of ['conversation.http.request','authority.gateway.request','native.pinned.transport','native.gateway.read.request','reads.snapshot','intents.snapshot']){
  assert.equal(table.hops[id].kind,'nested');assert.equal(table.hops[id].parent,'request');
  for(const change of [{kind:'independent',owner:'invented',reason:'invented separate lifetime'},{parent:'turn'}]){
   const altered=clone();Object.assign(altered.hops[id],change);refusal(()=>assertHotPathBudgets(altered),id);
  }
 }
 const store=table.hops['runner.session.store'];assert.equal(store.kind,'serial');assert.equal(store.parent,'turn');assert.deepEqual(store.children,['runner.session.load','runner.session.append']);assert.equal(store.sumMs,13000);assert.equal(store.ms,15000);
 assert.equal(table.hops['proxy.bootstrap'].parent,'proxy.connection');
 assert.equal(table.hops['proxy.request.cleanup'].kind,'independent');assert.match(table.hops['proxy.request.cleanup'].reason,/asyncio.wait.*fresh 26 s/u);
});

test('worker native connect records an opaque sdk-core default and cannot supply a fictitious number',()=>{
 const hop=table.hops['temporal.connect'];assert.equal(hop.kind,'library');assert.equal(hop.ms,null);assert.equal(hop.sdkOwned,true);assert.equal(hop.configurable,false);assert.equal(hop.owner,'sdk-core');assert.equal(hop.boundedBy,undefined);
 refusal(()=>budget(table,'temporal.connect'),'temporal.connect');refusal(()=>fixedHotPathBudget('temporal.connect'),'temporal.connect');
 for(const change of [{ms:10000},{ms:0,unbounded:true,boundedBy:'startup'},{boundedBy:'startup'},{reason:''},{configurable:true},{owner:'client-js'}]){const altered=clone();Object.assign(altered.hops['temporal.connect'],change);refusal(()=>assertHotPathBudgets(altered),'temporal.connect');}
 const invented=clone();invented.hops['aws.connection']={...hop};refusal(()=>assertHotPathBudgets(invented),'aws.connection');
});
