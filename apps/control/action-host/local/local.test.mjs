import test from 'node:test';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createLocalActionHostFixture} from './fixture.mjs';
import {runLocalHostRecovery} from './recovery.mjs';
import {main} from '../../../../scripts/local-followthrough/host-run.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
async function local(body){const previous=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;let f;try{f=await createLocalActionHostFixture({mode:'synthetic-local'});return await body(f);}finally{f?.close();if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}}
test('actual three host recovery keeps same proposal and accounting across reconstruction',()=>local(async f=>{const result=await runLocalHostRecovery({mode:f.mode,openHost:f.openHost,approve:f.approve,revoke:f.revoke,stats:f.stats});assert.equal(result.status,'PASS');assert.equal(result.reconstructedHosts,3);assert.equal(result.stats.taskEffects,1);assert.equal(result.stats.commandInvocations,1);assert.equal(result.stats.commandReservations,1);assert.equal(result.stats.commandChargeMicroUsd,'10');assert.equal(result.stats.lookupChargeMicroUsd,'10');assert.equal(result.stats.sourceReads,1);assert.equal(result.outcomes.replayIdentical,true);assert.deepEqual(result.cleanup.listeners,Array.from({length:3},()=>({closed:true,listening:false,activeSockets:0})));}));
test('help and invalid arguments are inert and closed',async()=>{let output='';assert.equal(await main(['--help'],v=>output+=v),0);assert.match(output,/retained synthetic SQL/);output='';assert.equal(await main([],v=>output+=v),2);assert.equal(output,'LOCAL_ARGUMENTS_REFUSED\n');});
