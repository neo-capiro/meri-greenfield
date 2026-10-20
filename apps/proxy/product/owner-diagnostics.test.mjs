import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerDiagnostics,createDiagnosticPool,statementRelation,refusalCode} from './owner-diagnostics.mjs';

const denied=()=>Object.assign(Error('permission denied for table initial_run_bindings'),{code:'42501',detail:'secret-detail',table:'x'});

test('a refused statement leaves one line: SQLSTATE and the relation its own SQL names, never message or parameters',()=>{
 const lines=[],d=createOwnerDiagnostics({write:line=>lines.push(line)});
 d.database(denied(),'SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE');
 assert.deepEqual(lines,['PRODUCT_OWNER_DB_REFUSED sqlstate=42501 relation=meri_conversations.initial_run_bindings\n']);
 for(const text of ['INSERT INTO meri_product_budget.requests(x) VALUES($1)','UPDATE meri_product_budget.budget SET x=1'])
  assert.match(statementRelation(text),/^meri_product_budget\.(requests|budget)$/u);
 assert.equal(statementRelation("SELECT pg_advisory_xact_lock(hashtextextended($1,0))"),'unknown');
 assert.equal(statementRelation({text:'SELECT * FROM meri_x.y'}),'unknown','only SQL text, never an object');
 // Errors without a SQLSTATE (lifetimes, aborts) are not database refusals.
 d.database(Error('DEADLINE'),'SELECT 1');d.database(Object.assign(Error('x'),{code:'not a state'}),'SELECT 1');
 assert.equal(lines.length,1);
 assert.ok(!lines.join('').includes('permission denied')&&!lines.join('').includes('secret-detail'));
});

test('a refused owner decision names the owner, its fixed step and a constant code only',()=>{
 const lines=[],d=createOwnerDiagnostics({write:line=>lines.push(line)});
 d.refused('placement','initial-binding',Object.assign(Error('INITIAL_RUN_BINDING_STORE_UNAVAILABLE'),{code:'INITIAL_RUN_BINDING_STORE_UNAVAILABLE'}));
 d.refused('currentness','next-run',Error('free text with a 6bd78118-c496-4d4c-8f16-838aeafde5cc id'));
 d.refused('placement','Bad Step',Error('x'));d.refused('placement step','facts',Error('x'));
 assert.deepEqual(lines,['PRODUCT_OWNER_REFUSED owner=placement step=initial-binding code=INITIAL_RUN_BINDING_STORE_UNAVAILABLE\n',
  'PRODUCT_OWNER_REFUSED owner=currentness step=next-run code=REFUSED\n']);
 assert.equal(refusalCode({code:'42501'}),'REFUSED','a SQLSTATE is reported only on the database line');
 assert.equal(refusalCode({code:'lower_case'}),'REFUSED');assert.equal(refusalCode(null),'REFUSED');
});

test('lines are bounded per window, a suppressed burst says so once, and a failing writer never throws',()=>{
 let at=0;const lines=[],d=createOwnerDiagnostics({write:line=>lines.push(line),now:()=>at,burst:2,windowMs:1000});
 for(let i=0;i<5;i++)d.refused('placement','facts',Error('x'));
 assert.deepEqual(lines.map(l=>l.trim().split(' ')[0]),['PRODUCT_OWNER_REFUSED','PRODUCT_OWNER_REFUSED','PRODUCT_OWNER_DIAGNOSTICS_SUPPRESSED']);
 at=1000;d.refused('placement','facts',Error('x'));assert.equal(lines.length,4);
 const broken=createOwnerDiagnostics({write:()=>{throw Error('closed');}});
 assert.doesNotThrow(()=>broken.database(denied(),'SELECT * FROM meri_x.y'));
 assert.throws(()=>createOwnerDiagnostics({burst:0}),/PRODUCT_OWNER_DIAGNOSTICS_CONFIGURATION/u);
});

test('the diagnostic pool passes results and errors through unchanged and wraps each pooled client once',async()=>{
 const lines=[],d=createOwnerDiagnostics({write:line=>lines.push(line)});
 const client={calls:0,async query(text){this.calls++;if(String(text?.text??text).includes('initial_run_bindings'))throw denied();return {rows:[{ok:1}]};},release(){}};
 const pool={async connect(){return client;},async query(){return {rows:[]};},async end(){pool.ended=true;}};
 const wrapped=createDiagnosticPool(pool,d);
 assert.ok(Object.isFrozen(wrapped));
 const c1=await wrapped.connect(),c2=await wrapped.connect();assert.equal(c1,client);assert.equal(c2,client);
 assert.deepEqual((await c1.query('SELECT 1 FROM meri_conversations.runs')).rows,[{ok:1}]);
 const error=await c1.query({text:'SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 FOR UPDATE'}).catch(e=>e);
 assert.equal(error.code,'42501','the original error reaches the caller');
 assert.deepEqual(lines,['PRODUCT_OWNER_DB_REFUSED sqlstate=42501 relation=meri_conversations.initial_run_bindings\n'],'wrapped once: one line');
 await wrapped.end();assert.equal(pool.ended,true);
 const noQuery=createDiagnosticPool({connect:pool.connect,end:pool.end},d);assert.equal(noQuery.query,undefined);
 assert.throws(()=>createDiagnosticPool({},d),/PRODUCT_OWNER_DIAGNOSTICS_CONFIGURATION/u);
});
