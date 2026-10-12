// Actual Git main/CLI statements with all environmental checks replaced by inert ports.
// No DNS, OS signal, native child, filesystem qualification or process exit occurs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('/workspace/meri-g1-durable-budget-20261012/packages/contracts/node_modules/typescript/lib/typescript.js');
const root=process.env.MERI_SANDBOX_REPO;
const candidate=process.env.MERI_SANDBOX_CANDIDATE;
const source=execFileSync('git',['show',`${candidate}:apps/worker/qualification/probes/runtime.mjs`],{cwd:root}).toString();
const ast=ts.createSourceFile('runtime.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const main=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='main').getText(ast);
const direct=ast.statements.find(n=>ts.isIfStatement(n)&&n.expression.getText(ast)==='invokedDirectly').getText(ast);
const {installProbeCancellation}=await import(pathToFileURL(`${root}/apps/worker/qualification/probes/owned-probe-child.mjs`));

test('runtime direct entry leaves default signal disposition during parked network precheck',async()=>{
 const fake=new EventEmitter();let releaseNetwork;let atNetwork=false,children=0;let resolveExit;
 const exited=new Promise(resolve=>{resolveExit=resolve;});
 fake.stdout={write(){}};fake.exit=resolveExit;
 const context={process:fake,Date,JSON,console,invokedDirectly:true,
  installProbeCancellation:()=>installProbeCancellation(fake),
  checkIdentityAndMounts:()=>({}),checkReadOnlyRoot:()=>({}),checkSdkStatic:async()=>({}),
  checkNetworkDenial:()=>{atNetwork=true;return new Promise(resolve=>{releaseNetwork=resolve;});},
  runQualificationChildren:async()=>{children++;return[];},
  runQualificationChildrenForCli:async()=>{children++;return[];},
  summarize:()=>({ok:true}),computeExitCode:()=>0,
 };
 vm.runInNewContext(`${main}\n${direct}`,context,{timeout:100});
 for(let i=0;i<3;i++)await Promise.resolve();
 assert.equal(atNetwork,true);assert.equal(children,0);
 try {assert.equal(fake.listenerCount('SIGINT'),0);assert.equal(fake.listenerCount('SIGTERM'),0);}
 finally {releaseNetwork({});await exited;}
});
