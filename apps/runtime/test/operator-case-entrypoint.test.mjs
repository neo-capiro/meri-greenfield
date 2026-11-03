import test,{mock,after} from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../config.mjs';
import * as material from '../operator-material.mjs';
let reads=[],calls=[],initialized=0;
mock.module('../config.mjs',{namedExports:{...config,readSecret:async path=>{reads.push(path);return Buffer.from('{"protected":"fixture"}');}}});
mock.module('../operator-material.mjs',{namedExports:{...material,runOperatorMaterialInit:async()=>{initialized++;},runOperatorAgentCoreMaterial:async()=>{initialized++;}}});
mock.module('../operator-callback-entrypoint.mjs',{namedExports:{main:async argv=>{calls.push(argv);return 0;}}});
mock.module('../cli.mjs',{namedExports:{mainOperatorBrowserControl:async(raw,argv)=>{assert.deepEqual(raw,{protected:'fixture'});calls.push(argv);return 0;}}});
const {main}=await import('../operator-case-entrypoint.mjs');
const saved={...process.env};after(()=>{for(const key of ['MERI_SOURCE_COMMIT','MERI_RENDERER_IMAGE_DIGEST','MERI_OPERATOR_MATERIAL_EXPECTED'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];});
test('fixed executable delegates Control and Temporal startup without accepting an alternate mount or command',async()=>{
 assert.equal(await main(['control','--config','/run/meri/control.json']),0);assert.equal(await main(['temporal-worker','--config','/run/meri/worker.json']),0);
 assert.deepEqual(reads,['/run/meri-operator/control.json']);assert.equal(calls.length,2);
 for(const args of [[],['control'],['control','--config','/tmp/control.json'],['temporal-worker','--config','/run/meri/ordinary.json'],['agentcore','--config','/tmp/config']])assert.equal(await main(args),2);
 assert.equal(calls.length,2);assert.equal(reads.length,1);
});
test('fixed AgentCore image initializes its pinned public descriptor before callback startup; source/image mismatch refuses',async()=>{
 const e={role:'agentcore',sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),sha256ByPath:{'/run/meri-operator/callback.json':'c'.repeat(64)}};
 process.env.MERI_OPERATOR_MATERIAL_EXPECTED=JSON.stringify(e);process.env.MERI_SOURCE_COMMIT=e.sourceCommit;process.env.MERI_RENDERER_IMAGE_DIGEST=e.imageDigest;
 assert.equal(await main(['agentcore']),0);assert.equal(initialized,1);assert.deepEqual(calls.at(-1),['agentcore']);
 process.env.MERI_SOURCE_COMMIT='0'.repeat(40);assert.equal(await main(['agentcore']),2);assert.equal(initialized,1);
 process.env.MERI_SOURCE_COMMIT=e.sourceCommit;process.env.MERI_RENDERER_IMAGE_DIGEST='sha256:'+'0'.repeat(64);assert.equal(await main(['agentcore']),2);assert.equal(initialized,1);
});
