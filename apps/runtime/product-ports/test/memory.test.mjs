/** SYNTHETIC: the memory family composes nothing and touches nothing until its Core and migration owners exist. */
import test from 'node:test';import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createProductPortsFactory} from '../index.mjs';
import {createMemoryFamily,MEMORY_COMPOSITION_GAPS} from '../memory.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
test('memory composes no port, inspects no context and names every gap with its owner',()=>{
 let touched=0;const poison=new Proxy({},{get(){touched++;throw Error('unexpected');}});
 assert.deepEqual(createProductPortsFactory({families:[['memory',createMemoryFamily]]})(poison),{});assert.equal(touched,0);
 assert.deepEqual(MEMORY_COMPOSITION_GAPS.map(g=>g.gap),['core.m2Routes','core.reviewParser','migration.memoryCandidates','composer.allowlist']);
 // The candidate DDL exists in source; a memory port key does not exist, so no family could supply one silently.
 assert.ok(existsSync(new URL('../../../control/memory/migrations/0001_memory_candidates.sql',import.meta.url)));
 assert.throws(()=>captureRuntimePorts({memoryApplication:{handle(){}}}));
});
