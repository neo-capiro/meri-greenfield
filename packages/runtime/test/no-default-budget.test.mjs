import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
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


test('native connection exceptions reject the unsupported timeout in direct and forwarded options',async()=>{
 const entries=registry.libraryExceptions.filter(entry=>entry.scope==='sdk-unconfigurable');assert.equal(entries.length,2);
 for(const entry of entries){
  const fixture=await mkdtemp(path.join(tmpdir(),'native-connect-budget-'));
  try{
   const source=await readFile(path.join(path.resolve(testDirectory,'../../..'),entry.file),'utf8'),file=path.join(fixture,entry.file);
   await mkdir(path.dirname(file),{recursive:true});await writeFile(file,source);
   const config={constructors:[],libraries:[],libraryExceptions:[entry]};
   assert.deepEqual(await checkRegisteredBudgets(fixture,config),[]);
   for(const field of ['connectTimeout','connectTimeoutMs']){
    assert.ok(source.includes('address:configuration.temporal.address'));
    await writeFile(file,source.replace('address:configuration.temporal.address',`${field}:10000,address:configuration.temporal.address`));
    assert.ok((await checkRegisteredBudgets(fixture,config)).some(value=>value.includes(field)&&value.includes('unsupported')),entry.file+' '+field);
   }
   await writeFile(file,source);
   const undocumented={...entry,reason:''};assert.ok((await checkRegisteredBudgets(fixture,{...config,libraryExceptions:[undocumented]})).some(value=>value.includes('invalid library exception')));
   const unguarded={...entry,forbiddenOptions:[]};assert.ok((await checkRegisteredBudgets(fixture,{...config,libraryExceptions:[unguarded]})).some(value=>value.includes('invalid library exception')));
  }finally{await rm(fixture,{recursive:true,force:true});}
 }
});
