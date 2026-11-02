/** The model is told once, before the request that leaves RESERVED_TURNS turns, to stop calling tools and answer with what it
 * has. Batches are counted, not calls: a turn of parallel calls is one batch, and subagent batches are not counted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {turnBudgetHooks,TURN_LIMIT_NOTICE,RESERVED_TURNS} from '../turn-budget.mjs';

const call=name=>({tool_name:name,tool_input:{},tool_use_id:`toolu_${name}`});
const batch=(hooks,calls=[call('mcp__meri_reads__mail_read_thread')],extra={})=>hooks.PostToolBatch[0].hooks[0]({hook_event_name:'PostToolBatch',session_id:'s',tool_calls:calls,...extra},undefined,{signal:new AbortController().signal});
const NOTICE={hookSpecificOutput:{hookEventName:'PostToolBatch',additionalContext:TURN_LIMIT_NOTICE}};

test('the batch that leaves the reserved turns carries the notice once; earlier and later batches carry nothing',async()=>{
 const hooks=turnBudgetHooks(6);assert.deepEqual(Object.keys(hooks),['PostToolBatch']);
 for(let n=1;n<6-RESERVED_TURNS;n++)assert.deepEqual(await batch(hooks),{},`batch ${n}`);
 assert.deepEqual(await batch(hooks),NOTICE);
 assert.deepEqual(await batch(hooks),{},'told once');
 assert.match(TURN_LIMIT_NOTICE,/call no more tools.*without mentioning steps, limits or tools/);
});

test('parallel calls count as one turn: a long run with four calls per turn is told only near its own limit',async()=>{
 const hooks=turnBudgetHooks(500),four=['a','b','c','d'].map(call);
 for(let n=1;n<500-RESERVED_TURNS;n++)assert.deepEqual(await batch(hooks,four),{},`batch ${n}`);
 assert.deepEqual(await batch(hooks,four),NOTICE);
});

test('subagent batches are not counted, and a small limit warns after the first batch',async()=>{
 const hooks=turnBudgetHooks(20);
 for(let n=0;n<30;n++)assert.deepEqual(await batch(hooks,undefined,{agent_id:'agent-1'}),{});
 assert.deepEqual(await batch(turnBudgetHooks(2)),NOTICE);assert.deepEqual(await batch(turnBudgetHooks(3)),NOTICE);
 assert.throws(()=>turnBudgetHooks(0),/RUNTIME_CONFIGURATION/);
});
