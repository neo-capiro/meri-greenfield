/** SYNTHETIC canonical runtime composition over existing schedule/conversation SQL and Temporal fixtures. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assembleScheduleDispatch} from '../schedule-worker.mjs';
import {harness,createIntent,occurrence,NOW} from '../../control/schedules/test/scheduled-dispatch-harness.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
test('runtime factory reuses canonical durable occurrence barrier, current authority and exact workflow start',async()=>{
 const h=harness();await h.acknowledge(createIntent());let connects=0;
 const pool={async connect(){connects++;const a=await h.schedules.pool.connect(),b=await h.conversations.pool.connect();return {async query(sql,p){if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)){await a.query(sql,p);return b.query(sql,p);}return (sql.includes('meri_schedules.')?a:b).query(sql,p);},release(error){a.release(error);b.release(error);}};}};
 const configuration={versions,limits:{requestMs:1000},temporal:{taskQueue:'meri-schedules'},scheduledDispatch:{enabled:true,conversationTaskQueue:'meri-conversations',maxConcurrentActivities:1}};
 const dispatch=assembleScheduleDispatch({configuration,pool,client:h.temporal.client,authority:h.authority.port,taskInstructions:{async read(){return {instruction:h.instructions.text};}},now:()=>NOW});
 assert.equal(connects,0);const result=await dispatch.dispatch({occurrence:occurrence()});assert.equal(result.outcome,'DISPATCHED');assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
 assert.equal((await dispatch.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
 const workflow=[...h.temporal.workflows.values()][0];assert.equal(workflow.workflowType,'meriConversationLifecycleWorkflow');assert.deepEqual(h.authority.state.calls.map(v=>v.phase),['before_admission','before_start']);
 assert.equal([...h.schedules.state.occurrences.values()][0].state,'DISPATCHED');
});
