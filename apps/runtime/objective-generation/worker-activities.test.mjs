/** No Core, credential, database or Temporal server: the production registration has no ports, so no transport exists to call. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {workerOptions} from '../temporal-worker.mjs';
import {createObjectiveWorkerActivities,OBJECTIVE_GENERATION_ACTIVITY_NAMES} from './worker-activities.mjs';

const binding={tenantId:'tenant-a',actorId:'actor-a',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002',
 attemptId:'00000000-0000-4000-8000-000000000003',workerId:'00000000-0000-4000-8000-000000000004',writerFence:1};
const input={generationJobId:'00000000-0000-4000-8000-000000000005',binding,notAfterMs:Date.now()+3600000};
const context=()=>({cancellationSignal:new AbortController().signal});

test('the production registration answers a definite no-op for every step with all ports absent',async()=>{
 const a=createObjectiveWorkerActivities({context});
 assert.deepEqual(Object.keys(a),OBJECTIVE_GENERATION_ACTIVITY_NAMES);assert.ok(Object.isFrozen(a));
 assert.deepEqual(await a.objectiveGenerationSource(input),{kind:'unconfirmed'});
 assert.deepEqual(await a.objectiveGenerationStartRun({...input,mode:'effect',requestSha256:'a'.repeat(64)}),{kind:'not-started'});
 assert.deepEqual(await a.objectiveGenerationStartRun({...input,mode:'read',requestSha256:'a'.repeat(64)}),{kind:'not-started'});
 assert.deepEqual(await a.objectiveGenerationReadRun(input),{kind:'unconfirmed'});
 assert.deepEqual(await a.objectiveGenerationComplete({...input,sourceAdmissionSha256:'b'.repeat(64)}),{kind:'unconfirmed'});
 await assert.rejects(a.objectiveGenerationSource({...input,prompt:'caller text'}),'inputs stay closed');
});

test('the default constructor (Temporal Context) and every activity name match the bundled workflow and never collide with the broker',async()=>{
 const a=createObjectiveWorkerActivities();assert.deepEqual(Object.keys(a),OBJECTIVE_GENERATION_ACTIVITY_NAMES);
 const workflow=await readFile(new URL('../../control/conversations/objective-generation-workflow.ts',import.meta.url),'utf8');
 for(const name of OBJECTIVE_GENERATION_ACTIVITY_NAMES)assert.match(workflow,new RegExp(`\\b${name}\\(input`,'u'),name);
 const broker=Object.keys(workerOptions({configuration:{temporal:{namespace:'synthetic',taskQueue:'synthetic'},limits:{shutdownMs:1000}},connection:{},native:{}}).activities);
 assert.deepEqual(broker.filter(name=>OBJECTIVE_GENERATION_ACTIVITY_NAMES.includes(name)),[]);
});

test('ports are closed: unknown keys and half-composed run owners are refused',()=>{
 assert.throws(()=>createObjectiveWorkerActivities({prompt:'x'}),/OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION/u);
 assert.throws(()=>createObjectiveWorkerActivities({runs:{start(){}}}),/OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION/u);
 assert.throws(()=>createObjectiveWorkerActivities(null),/OBJECTIVE_GENERATION_ACTIVITY_CONFIGURATION/u);
});
