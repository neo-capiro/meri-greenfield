import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkLiteralBudgets, checkRegisteredBudgets} from './budget-scan.mjs';

const testDirectory=path.dirname(fileURLToPath(import.meta.url));
const root=process.env.MERI_BUDGET_SOURCE_ROOT??path.resolve(testDirectory,'../../..');
const registry=JSON.parse(await readFile(path.join(testDirectory,'budget-call-sites.json'),'utf8'));
const allowlist=JSON.parse(await readFile(path.join(testDirectory,'budget-literal-allowlist.json'),'utf8'));

test('production budget literals have one source and exact reviewed exceptions',async()=>{
 const failures=await checkLiteralBudgets(root,allowlist);
 assert.deepEqual(failures,[],`Budget literals outside the table:\n${failures.join('\n')}`);
});

test('registered constructor fields are required and composition roots pass their table hops',async()=>{
 const failures=await checkRegisteredBudgets(root,{constructors:registry.constructors});
 assert.deepEqual(failures,[],`Missing explicit constructor budgets:\n${failures.join('\n')}`);
});

test('registered library clients receive explicit transport time options',async()=>{
 const failures=await checkRegisteredBudgets(root,{constructors:[],libraries:registry.libraries,libraryExceptions:registry.libraryExceptions,assignments:registry.assignments});
 assert.deepEqual(failures,[],`Missing explicit library options:\n${failures.join('\n')}`);
});
