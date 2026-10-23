// Control retires the canonical task allocation directly. There is no model child or runner-stop HTTP protocol.
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRemoteNativeController} from '../remote-composition.mjs';
import {compileNativeTaskPlan} from '../task-allocator.mjs';
import {continuationFixture} from '../../../worker/conversation/continuation/test/fixtures.mjs';
import {capabilityDigest} from '../task-verifier.mjs';

function controller({stop}={}) {
 const f=continuationFixture(),control='synthetic-control',calls=[];
 const runtime={binding:f.binding,versions:f.target.versions,deadlineMs:Date.now()+30000,maxOutputBytes:1024};
 const preparationIntent={workspace:join(tmpdir(),'synthetic-workspace'),configParentDirectory:join(tmpdir(),'synthetic-config'),secureStorageDirectory:join(tmpdir(),'synthetic-secure'),imageSha256:f.target.versions.imageDigest.slice(7),runnerSha256:'c'.repeat(64),authoritySha256:'e'.repeat(64)};
 const {original}=compileNativeTaskPlan({runtime,plan:{},preparationIntent});
 const owner=createRemoteNativeController({runtimeConfiguration:{runtime,plan:{},preparationIntent,taskCapability:'synthetic-task',controlCapabilitySha256:capabilityDigest(control),
  store:{allocations:{read:async()=>({})}},allocator:{allocate:async()=>{calls.push('allocate');return {};},stop:async()=>{calls.push('retire');return stop?.();}},
  supervisor:{taskVerifier:{verify:async()=>({})},admission:{currentRun:async()=> '{}',withCurrentRun:async()=>{}}},
  continuation:{prepare:async()=>null,readSnapshot:async()=>null,resumeOptions:async()=>null},verifyTask:async()=>({}),enabled:true,maxRequestMs:3000},
  transport:{original,credential:control,fetchImpl:async()=>{throw Error('obsolete runner transport must not be used');}}});
 return {owner,calls};
}

test('close invokes canonical task retirement without a runner-stop HTTP request',async()=>{
 const {owner,calls}=controller();await owner.close();assert.deepEqual(calls,['retire']);
 await assert.rejects(owner.allocate(),/PREPARATION_REFUSED/);assert.deepEqual(calls,['retire']);
});

test('uncertain containment remains visible and a later close retries the same canonical owner',async()=>{
 const uncertain=Error('canonical containment acknowledgement lost');let attempts=0;
 const {owner,calls}=controller({stop(){if(++attempts===1)throw uncertain;}});
 await assert.rejects(owner.close(),error=>error===uncertain);
 await assert.rejects(owner.allocate(),/PREPARATION_REFUSED/);assert.deepEqual(calls,['retire']);
 await owner.close();assert.deepEqual(calls,['retire','retire']);
});
