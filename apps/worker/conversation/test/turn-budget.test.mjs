/** The model is told once, with the result of the call that leaves two turns, to stop calling tools and answer with what it
 * has; subagent calls are not counted, and a failed call counts like a finished one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {turnBudgetHooks,TURN_LIMIT_NOTICE,RESERVED_TURNS} from '../turn-budget.mjs';

const post=(hooks,event='PostToolUse',extra={})=>hooks[event][0].hooks[0]({hook_event_name:event,session_id:'s',tool_name:'mcp__meri_reads__mail_read_thread',tool_input:{},...extra},'toolu_1',{signal:new AbortController().signal});

test('the call that leaves the reserved turns carries the notice once; earlier and later calls carry nothing',async()=>{
 const hooks=turnBudgetHooks(6);
 for(let n=1;n<6-RESERVED_TURNS;n++)assert.deepEqual(await post(hooks),{},`call ${n}`);
 assert.deepEqual(await post(hooks,'PostToolUseFailure'),{hookSpecificOutput:{hookEventName:'PostToolUseFailure',additionalContext:TURN_LIMIT_NOTICE}});
 assert.deepEqual(await post(hooks),{},'told once');
 assert.match(TURN_LIMIT_NOTICE,/call no more tools.*without mentioning steps, limits or tools/);
});

test('subagent calls are not counted, and a small limit warns on the first call',async()=>{
 const hooks=turnBudgetHooks(20);
 for(let n=0;n<30;n++)assert.deepEqual(await post(hooks,'PostToolUse',{agent_id:'agent-1'}),{});
 assert.deepEqual(await post(turnBudgetHooks(2)),{hookSpecificOutput:{hookEventName:'PostToolUse',additionalContext:TURN_LIMIT_NOTICE}});
 assert.throws(()=>turnBudgetHooks(0),/RUNTIME_CONFIGURATION/);
});
