import test from 'node:test';
import assert from 'node:assert/strict';
import {executionFault} from '../native-authority/execution-broker.mjs';
import {withRunnerDiagnostics,atRunnerStage} from '../runner-runtime-diagnostics.mjs';

test('kickoff diagnostics retain the exact prefixed execution fault without private error text',async()=>{
 const lines=[],error=executionFault('KICKOFF_UNKNOWN');
 Object.defineProperty(error,'message',{get(){assert.fail('private error message must not be read');}});
 await assert.rejects(withRunnerDiagnostics(()=>atRunnerStage('kickoff-wait',async()=>{throw error;}),{write:line=>lines.push(line)}),value=>value===error);
 assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime stage=kickoff-wait code=NATIVE_EXECUTION_KICKOFF_UNKNOWN class=ERROR exit=none signal=none\n','RUNNER_RUNTIME_FAILED stage=kickoff-wait code=NATIVE_EXECUTION_KICKOFF_UNKNOWN\n']);
});
