import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
process.env.MERI_REVIEW_SOURCE_ROOT=root;
const load=p=>import(new URL('../../../../../'+p,import.meta.url));
const {productFixture,NOW}=await load('apps/gateway/budget/product-scripted-fixture.mjs');
const {createPostgresToolBudget}=await load('apps/gateway/budget/postgres-tool-budget.mjs');
const {createPostgresAdmittedRunOwner}=await load('apps/gateway/budget/admitted-run-owner.mjs');
const {createDurableToolDispatch}=await load('apps/gateway/budget/durable-tool-dispatch.mjs');
const {BudgetCommitUncertain,PostgresBudgetStore}=await load('apps/gateway/budget/postgres-budget-store.mjs');
const {requestJson,limits}=await load('docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
const turn=()=>new Promise(r=>setImmediate(r));
async function setup(intercept){
 const t=productFixture(),receivers=new WeakMap();let paused=false;
 const pool={async connect(){const raw=await t.pool.connect();const c={async query(...args){assert.equal(receivers.get(this),raw,'native SQL receiver must be preserved');if(paused&&intercept)await intercept(args,t);return raw.query(...args);},release(...args){return raw.release(...args);}};receivers.set(c,raw);return c;}};
 const c={pool,allocationJson:JSON.stringify(t.allocation),namespace:'product',now:t.now};
 const budget=createPostgresToolBudget(c);await budget.bindTrustedGrant(t.json());
 const admitted=createPostgresAdmittedRunOwner({...c,grantFactsJsons:[JSON.stringify(t.context())],limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const gateway=createDurableToolDispatch({...c,authority:t.f.authority,catalog:{entry:()=>t.f.entry,discoverable:()=>[t.f.entry]},limits,sourceEnabled:true,newId:randomUUID});
 return {...t,budget,admitted,gateway,interceptOn(){paused=true;}};
}
test('independent current lease preserves native receiver and immutable allocation across same transaction',async()=>{
 const t=await setup();let captured;const before=t.commands.length;
 const result=await t.admitted.withCurrentAllocation({binding:t.f.binding},async({client,current})=>{captured=client;assert.equal(Object.isFrozen(current.binding),true);assert.equal(Object.isFrozen(current.allocation.manifest),true);assert.throws(()=>current.allocation.budgets.maxToolCalls=999);return(await client.query('SELECT synthetic_effect')).rows[0].value;});
 assert.equal(result,'owned SQL result');await assert.rejects(captured.query('SELECT synthetic_effect'),/ADMITTED_EFFECT_CLOSED/);
 const sql=t.commands.slice(before).map(x=>x.sql);assert.equal(sql.filter(x=>x==='BEGIN').length,1);assert.equal(sql.filter(x=>x==='COMMIT').length,1);assert.equal(sql.filter(x=>x.startsWith('SELECT * FROM meri_product_budget.runs')&&x.endsWith('FOR UPDATE')).length,2);
});
test('independent callback deadline publisher only narrows and refuses before next SQL at exact cutoff',async()=>{
 const t=await setup();await assert.rejects(t.admitted.withCurrentAllocation({binding:t.f.binding},async({client},limit)=>{limit(NOW+3);limit(NOW+50000);t.setClock(NOW+3);return client.query('SELECT synthetic_effect');}));
 assert.equal(t.commands.some(x=>x.sql==='SELECT synthetic_effect'),false);assert.equal(t.commands.at(-1).sql,'ROLLBACK');
});
test('independent explicit caller deadline refuses before connect without changing canonical authority receipt',async()=>{
 const t=await setup();t.commands.length=0;await assert.rejects(t.admitted.withCurrentAllocation({binding:t.f.binding,deadlineMs:NOW},async()=>assert.fail('effect')));assert.equal(t.commands.length,0);
 const observed=JSON.parse(await t.admitted.currentRun(t.f.binding,{}));assert.equal(observed.deadlineMs,NOW+10000);
});
test('independent pending native SQL prevents callback result/COMMIT; late query is cleanup-only',async()=>{
 const gate=Promise.withResolvers(),entered=Promise.withResolvers();const t=await setup(async([sql])=>{if(sql==='SELECT synthetic_effect'){entered.resolve();await gate.promise;}});t.interceptOn();
 let work;await assert.rejects(t.admitted.withCurrentAllocation({binding:t.f.binding},async({client})=>{work=client.query('SELECT synthetic_effect');work.catch(()=>{});await entered.promise;return'private';}),/ADMITTED_EFFECT_PENDING/);assert.equal(t.commands.some(x=>x.sql==='COMMIT'),true); // earlier bind only
 const commits=t.commands.filter(x=>x.sql==='COMMIT').length;gate.resolve();await assert.rejects(work);await turn();assert.equal(t.commands.filter(x=>x.sql==='COMMIT').length,commits);
});
for(const field of ['actorId','tenantId','conversationId','runId','attemptId','sessionId','workerId','writerFence'])test('independent foreign full '+field+' refuses before lease SQL',async()=>{
 const t=await setup();t.commands.length=0;const binding={...t.f.binding,[field]:field==='writerFence'?2:'00000000-0000-4000-8000-000000000099'};
 await assert.rejects(t.admitted.withCurrentAllocation({binding},async()=>assert.fail('effect')));assert.equal(t.commands.length,0);
});
for(const mutate of [r=>r.completion.resultSha256='x'.repeat(64),r=>r.completion.outputBytes++,r=>r.completion.factsSha256='b'.repeat(64),r=>r.arguments_sha256='b'.repeat(64),r=>r.raw_request_sha256='b'.repeat(64)])test('independent stored completion corruption refuses without accounting repair or redispatch',async()=>{
 const t=await setup();await t.gateway.executeOwned(requestJson,t.credential,t.delivery());const row=[...t.state().produced.values()][0];mutate(row);const before=structuredClone(t.state());await assert.rejects(t.budget.readCompletion(t.delivery(),requestJson,{}));assert.deepEqual(t.state(),before);
});
test('independent completion current expiry publishes no marker and never refunds held/settled liabilities',async()=>{
 const t=await setup();await t.gateway.executeOwned(requestJson,t.credential,t.delivery());t.setClock(NOW+10000);const before=structuredClone(t.state());await assert.rejects(t.budget.readCompletion(t.delivery(),requestJson,{}));assert.deepEqual(t.state(),before);
});
test('independent readCompletion refuses substituted actor and producer namespace and literal request hashes',async()=>{
 const t=await setup();const body=await t.gateway.executeOwned(requestJson,t.credential,t.delivery());const marker=await t.budget.readCompletion(t.delivery(),requestJson,{});assert.equal(marker.resultSha256,hash(JSON.parse(body)));assert.equal(marker.rawRequestSha256,hash(JSON.parse(requestJson)));
 for(const mutate of [d=>d.context.binding.actorId='foreign',d=>d.producer.namespace='foreign',d=>d.deliveryId='foreign']){const d=JSON.parse(t.delivery());mutate(d);await assert.rejects(t.budget.readCompletion(JSON.stringify(d),requestJson,{}));}
});
test('independent lost read COMMIT is typed uncertainty and returns no completion or accounting writes',async()=>{
 const t=await setup();await t.gateway.executeOwned(requestJson,t.credential,t.delivery());const before=structuredClone(t.state());t.loseCommit();await assert.rejects(t.budget.readCompletion(t.delivery(),requestJson,{}),BudgetCommitUncertain);assert.deepEqual(t.state(),before);
});
test('independent cancellation during COMMIT must retain typed commit uncertainty',async()=>{
 const entered=Promise.withResolvers(),gate=Promise.withResolvers();const t=await setup(async([sql])=>{if(sql==='COMMIT'){entered.resolve();await gate.promise;}});t.interceptOn();const ac=new AbortController();
 const work=t.admitted.withCurrentAllocation({binding:t.f.binding,signal:ac.signal},async()=> 'private');await entered.promise;ac.abort();let error;try{await work;}catch(e){error=e;}gate.resolve();await turn();await turn();assert.ok(error instanceof BudgetCommitUncertain,'COMMIT dispatched before cancel must be typed BudgetCommitUncertain, received '+error?.constructor.name+':'+error?.message);
});
test('independent transaction observer malformed input is inert and default transaction behavior is preserved',async()=>{
 let touched=0;const store=new PostgresBudgetStore({connect(){touched++;assert.fail('connection');}});
 for(const observer of [null,{},'COMMIT',true])await assert.rejects(store.transact(async()=>assert.fail('effect'),()=>{},observer),/TRANSACTION_OBSERVER_REFUSED/);assert.equal(touched,0);
 const t=await setup();const result=await new PostgresBudgetStore(t.pool,{namespace:'product'}).transact(async c=>{await c.query('SELECT * FROM meri_product_budget.budget WHERE id=1 FOR UPDATE');return'legacy';});assert.equal(result,'legacy');
});
test('independent late release failure returns typed uncertainty without repeating SQL effect',async()=>{
 const t=await setup();let effects=0;const owner=createPostgresAdmittedRunOwner({pool:{async connect(){const raw=await t.pool.connect();return{query:(...a)=>raw.query(...a),release(...a){raw.release(...a);throw Error('synthetic release ACK unknown');}};}},allocationJson:JSON.stringify(t.allocation),namespace:'product',grantFactsJsons:[JSON.stringify(t.context())],now:t.now,limits:{maxRequestMs:1000,maxFactBytes:65536}});
 await assert.rejects(owner.withCurrentAllocation({binding:t.f.binding},async()=>{effects++;return'private';}),BudgetCommitUncertain);assert.equal(effects,1);
});
