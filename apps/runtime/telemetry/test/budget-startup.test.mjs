import test from 'node:test';
import assert from 'node:assert/strict';
import {runConversation} from '../../conversation-runner.mjs';
import {runRemoteConversation} from '../../remote-conversation-runner.mjs';
import {withRunnerDiagnostics} from '../../runner-runtime-diagnostics.mjs';
import {createTurnTelemetry} from '../turn-context.mjs';
import {hotPathBudgetDigest} from '../../../../packages/runtime/hot-path-budgets.mjs';
import {testBudgetTable} from '../../../../packages/runtime/test/budget-fixture.mjs';

test('both runner roots emit a single proof across recursive execution and none for an invalid table',async()=>{
 const roots=[runConversation,runRemoteConversation],configuration={sourceEnabled:true};
 const refuseAfterBudget=async root=>assert.rejects(root(configuration,{budgets:testBudgetTable,generalReads:{}}),/INVALID_COMMAND/u);
 async function capture(operation){
  const lines=[],telemetry=createTurnTelemetry({service:'runner',now:()=>123,write:line=>lines.push(JSON.parse(line))});
  try{await withRunnerDiagnostics(operation,{turnTelemetry:telemetry,write:()=>{}});return lines.filter(line=>line.event==='meri.budget.table');}
  finally{telemetry.close();}
 }
 const expected={schema:'meri.telemetry/1',event:'meri.budget.table',service:'runner',atMs:123,hops:279,
  tableSha256:hotPathBudgetDigest(testBudgetTable),Service:'runner',_aws:{Timestamp:123,CloudWatchMetrics:[]}};
 // A refusal after budget validation avoids secret reads, workspace access, SDK initialization and network calls.
 for(const root of roots)assert.deepEqual(await capture(()=>refuseAfterBudget(root)),[expected]);
 // Remote execution re-enters diagnostics; both roots must borrow the task's one proof.
 assert.deepEqual(await capture(()=>withRunnerDiagnostics(async()=>{
  for(const root of roots)await refuseAfterBudget(root);
 })),[expected]);
 for(const root of roots)assert.deepEqual(await capture(()=>assert.rejects(root(configuration,{budgets:{},generalReads:{}}))),[]);
});
