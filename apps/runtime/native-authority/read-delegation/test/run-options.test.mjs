/** SYNTHETIC: the registry-facing stop hook (`run-options.mjs`): never throws, never rejects, reports a failed stop once. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadDelegationRunOptions,READ_DELEGATION_STOP_FAILED,READ_DELEGATION_STOP_REASONS} from '../run-options.mjs';
import {nativeReadFault} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
const binding={tenantId:'t',actorId:'a',conversationId:'c',runId:'r1',attemptId:'a1',writerFence:1};
test('passes the call through and returns the delegation receipt; a failure is reported and answered as not stopped',async()=>{
 const calls=[],events=[];
 const ok=createReadDelegationRunOptions({stopRun:async input=>{calls.push(input);return {stopped:true,revoked:false};},log:e=>events.push(e)});
 assert.deepEqual(await ok.stopRun({binding,reason:'cancelled'}),{stopped:true,revoked:false});assert.deepEqual(calls,[{binding,reason:'cancelled'}]);assert.deepEqual(events,[]);
 const failing=createReadDelegationRunOptions({stopRun:async()=>{throw nativeReadFault('UNAVAILABLE');},log:e=>events.push(e)});
 assert.deepEqual(await failing.stopRun({binding,reason:'run_terminal'}),{stopped:false,revoked:false});
 assert.deepEqual(events,[{event:READ_DELEGATION_STOP_FAILED,reason:'run_terminal',code:'UNAVAILABLE',runId:'r1',attemptId:'a1'}]);
 const throwing=createReadDelegationRunOptions({stopRun:()=>{throw Object.assign(Error('boom'),{code:'SYNTHETIC'});},log:e=>events.push(e)});
 assert.deepEqual(await throwing.stopRun({binding,reason:'fenced'}),{stopped:false,revoked:false});assert.equal(events.at(-1).code,'SYNTHETIC');
 const malformed=createReadDelegationRunOptions({stopRun:async()=>({stopped:'yes'}),log:e=>events.push(e)});
 assert.deepEqual(await malformed.stopRun({binding,reason:'fenced'}),{stopped:false,revoked:false});assert.equal(events.length,3);
 // A log that throws is swallowed too; the secret-free event never carries the binding's tenant or actor.
 const quiet=createReadDelegationRunOptions({stopRun:async()=>{throw Error('x');},log(){throw Error('log down');}});
 assert.deepEqual(await quiet.stopRun({binding,reason:'cancelled'}),{stopped:false,revoked:false});
 assert.deepEqual(Object.keys(events[0]).sort(),['attemptId','code','event','reason','runId']);
 assert.deepEqual([...READ_DELEGATION_STOP_REASONS],['run_terminal','cancelled','fenced','superseded']);
 for(const bad of [{},{stopRun:'x'},{stopRun:()=>{},log:'x'}])assert.throws(()=>createReadDelegationRunOptions(bad),{code:'READ_DELEGATION_RUN_OPTIONS_CONFIGURATION'});
});
