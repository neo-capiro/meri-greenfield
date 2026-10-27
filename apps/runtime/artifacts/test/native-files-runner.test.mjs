/** Real runner/activity and local file bytes; SDK/control are explicit synthetic ports. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {binding as ordinaryBinding,scopes as ordinaryScopes,versions,id} from '../../../control/conversations/test/store-fixture.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../../control/conversations/usage.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {buildConversationOptions} from '../../../worker/conversation/options.mjs';
import {runStartFixture,NOW} from '../../objective-source/test/run-start-fixture.mjs';
import {createObjectiveSelectionOwner} from '../../objective-generation/selection-owner.mjs';
import {result as objectiveResult} from '../../../../packages/contracts/strategy-operations-candidate/fixture-source.mjs';
import {assertTypedResultBytes} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {createTaskSelectedSkills} from '../../selected/task.mjs';
let ownedRoot,failSkillsClose=false;
mock.module('../../selected/task.mjs',{namedExports:{createTaskSelectedSkills(configuration){const owner=createTaskSelectedSkills(configuration);return {...owner,async close(){await owner.close();if(failSkillsClose)throw Error('synthetic skill close refusal');}};}}});
// Windows has no POSIX private-directory mode. Only that OS observation is
// synthetic here; native Linux qualification must run the unchanged mode gate.
if(process.platform==='win32')mock.module('node:fs/promises',{namedExports:{...fs,async lstat(path){const s=await fs.lstat(path);if(ownedRoot&&String(path).startsWith(ownedRoot))s.mode&=~0o077;return s;}}});
// Production cwd uses POSIX separators. Exercise the actual option validator
// with that path spelling while the real local filesystem keeps its OS path.
if(process.platform==='win32')mock.module('../../../worker/conversation/options.mjs',{namedExports:{buildConversationOptions(value,...args){return buildConversationOptions({...value,cwd:value.cwd.replaceAll('\\','/')},...args);}}});
// The production writer pins a Linux directory fd through /proc. This portable
// composition check preserves real bytes/exclusive creation; root qualifies the
// unchanged native writer separately on Linux.
if(process.platform==='win32')mock.module('../../../worker/conversation/objective-generation/fixed-file.mjs',{namedExports:{async writeObjectiveResultFile({cwd,bytes,descriptor,signal}){signal?.throwIfAborted();await fs.writeFile(join(cwd,descriptor.path),assertTypedResultBytes(bytes,descriptor),{flag:'wx',mode:0o600,signal});}}});
const {assembleConversationRunner}=await import('../../conversation-runner.mjs');
async function fixture(t,{flushFails=false,closeFails=false,sessionCloseFails=false,skillCloseFails=false,captureFails=false,restoreFails=false,objective=false,emptyDirectoriesOnly=false}={}){
 failSkillsClose=skillCloseFails;t.after(()=>{failSkillsClose=false;});
 const o=objective?runStartFixture():null,binding=o?.binding??ordinaryBinding,scopes=o?[{tenantId:o.tenantId,kind:'client',resourceId:o.clientId,policyRevision:'policy1'}]:ordinaryScopes;if(o)t.mock.timers.enable({apis:['Date'],now:NOW});
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'meri-native-runner-')));ownedRoot=root;
 t.after(()=>fs.rm(root,{recursive:true,force:true}));if(process.platform==='win32'){const d=Object.getOwnPropertyDescriptor(process,'getuid');Object.defineProperty(process,'getuid',{value:()=>0,configurable:true});t.after(()=>{if(d)Object.defineProperty(process,'getuid',d);else delete process.getuid;});}
 const workspace=join(root,binding.conversationId),configParentDirectory=join(root,'config'),secureStorageDirectory=join(root,'secure','storage');
 for(const p of [workspace,configParentDirectory,join(root,'secure')])await fs.mkdir(p,{mode:0o700});
 const request=o?.acceptedRequest??{requestId:id(100),prompt:'Synthetic local capture',skill:null,window:null,windowRequest:null},sessionId=id(101),order=[],events=[];let queries=0,upload;
 const configuration={binding,versions,workspace,sdk:{configParentDirectory,secureStorageDirectory},limits:{requestMs:25000,shutdownMs:1000}},saved={run:{binding,versions,scopes,state:'queued',policyRevision:'policy1',createdAt:new Date().toISOString()},request};
 const selected=o?await createObjectiveSelectionOwner({runStarts:{read:async()=>({state:'STARTED',record:o.record})},store:{read:async()=>saved,readModelPolicy:async()=>({})},now:()=>Date.now()}).read({binding}):null;
 const native={async call(operation,input){order.push(operation);
  if(operation==='runner/load')return saved;
  if(operation==='runner/runtime')return {binding,versions,deadlineMs:Date.now()+10000,maxOutputBytes:4096,sdkSessionKey:null,objective:selected};
  if(operation==='runner/files/restore'){if(restoreFails)throw Error('synthetic restore refusal');return {binding,files:null,upload:null};}
  if(operation==='runner/publish'){events.push(input.event);return input.event;}
  if(operation==='runner/next-controls')return {controls:[],nextControlSequence:0};
  if(operation==='runner/record-usage')return {};
  if(operation==='runner/checkpoint/complete'){assert.ok(order.indexOf('drained')<order.indexOf('flush'));assert.ok(order.indexOf('flush')<order.lastIndexOf(operation));upload=input;if(captureFails)throw Error('synthetic unknown capture');
   let n=200;const entries=rows=>rows.map(f=>({path:f.path,kind:'file',executable:f.executable,object:{objectId:id(n++),versionId:'synthetic-version',sha256:f.sha256,bytes:f.bytes,scopes}}));
   const files={workspace:{contractVersion:'0.1.0',manifestId:id(199),binding,logicalCwd:'/workspace/conversation',entries:entries(input.files),scopes,createdAt:new Date().toISOString()},tasks:entries(input.taskFiles)},sdkSession={binding,key:{projectKey:'synthetic-project',sessionId},ownerSha256:'a'.repeat(64),entriesCount:2};
   return {binding,state:'completed',proof:{kind:'native-session',sdkSession,files,checkpointId:binding.runId,checkpointSha256:hash({sdkSession,files}),versions,scopes,sourceRequestSha256:hash(request),contextSha256:hash({window:null,skill:null,scopes}),lastEventSequence:3}};
  }throw Error('unexpected '+operation);
 }};
 const execute=assembleConversationRunner({configuration,native,credentialForBinding:async()=> 'synthetic',sessionFactory:async()=>({store:{async load(){return null;},async append(){}},async settle(){order.push('flush');if(flushFails)throw Error('synthetic flush refusal');},async close(){order.push('mirror-close');if(sessionCloseFails)throw Error('synthetic session close refusal');}}),
  query({options}){queries++;assert.ok(order.includes('runner/files/restore'));if(o)assert.equal(options.outputFormat.type,'json_schema');else assert.equal(options.outputFormat,undefined);assert.equal(options.env.CLAUDE_CODE_TASK_LIST_ID,'meri');const tasks=join(options.env.CLAUDE_CONFIG_DIR,'tasks','meri');
   return {async *[Symbol.asyncIterator](){yield {type:'system',subtype:'init',session_id:sessionId};await fs.mkdir(join(workspace,'scratch','empty'),{recursive:true});await fs.mkdir(join(tasks,'empty'));if(!emptyDirectoriesOnly){await fs.writeFile(join(workspace,'answer.txt'),'exact native output');await fs.writeFile(join(tasks,'1.json'),'{"id":"1","status":"completed"}\n');}yield {type:'result',subtype:'success',is_error:false,session_id:sessionId,...(o?{structured_output:{operation:'strategy.draft',state:'succeeded',payload:objectiveResult(o.selection.request).payload,issues:[]}}:{})};},close(){order.push('close');if(closeFails)throw Error('synthetic close refusal');},async return(){order.push('drained');return {done:true};}};
  }});
 // Model policy comes from the canonical loaded run owner, never the local files.
 saved.model={...SDK_MODEL_CONFIGURATION,maxTurns:20,maxCostMicroUSD:2000000};
 return {run:()=>execute({binding}),workspace,order,events,counts:()=>({queries,upload}),cleanup:()=>execute.cleanupStatus()};
}
test('assembled runner restores before one SDK query and uploads real Task/workspace bytes after close and flush',async t=>{const f=await fixture(t);assert.deepEqual(await f.run(),{state:'completed'});assert.equal(f.counts().queries,1);assert.equal(Buffer.from(f.counts().upload.files[0].base64,'base64').toString(),'exact native output');assert.equal(f.counts().upload.taskFiles[0].path,'1.json');assert.equal(f.events.some(e=>e.data?.state==='completed'),false);assert.equal(f.cleanup().closed,true);});
test('assembled no-file SDK result completes after draining and capturing only empty local directories',async t=>{const f=await fixture(t,{emptyDirectoriesOnly:true});assert.deepEqual(await f.run(),{state:'completed'});assert.equal(f.counts().queries,1);assert.deepEqual(f.counts().upload.files,[]);assert.deepEqual(f.counts().upload.taskFiles,[]);assert.equal(f.order.filter(v=>v==='runner/checkpoint/complete').length,1);assert.equal(f.cleanup().closed,true);});
for(const failure of ['restoreFails','closeFails','flushFails','captureFails'])test(`assembled ${failure} refuses completion without a second SDK query`,async t=>{const f=await fixture(t,{[failure]:true});await assert.rejects(f.run());assert.equal(f.counts().queries,failure==='restoreFails'?0:1);assert.equal(f.events.some(e=>e.data?.state==='completed'),false);if(['restoreFails','closeFails','flushFails'].includes(failure))assert.equal(f.counts().upload,undefined);assert.equal(f.cleanup().closed,true);});
test('a run that never durably recorded its cwd retains those bytes beside the workspace and leaves the owned directory empty',async t=>{const f=await fixture(t,{captureFails:true});await assert.rejects(f.run());
 assert.deepEqual(await fs.readdir(f.workspace),[],'the next invocation restores the durable state instead of refusing a stale warm tree');
 assert.equal(await fs.readFile(join(f.workspace+'.uncommitted','answer.txt'),'utf8'),'exact native output','the uncommitted bytes are retained, never erased');
 assert.deepEqual(await fs.readdir(join(f.workspace+'.uncommitted','scratch','empty')),[],'the empty directory the run created moves with its tree');
 assert.equal(f.cleanup().closed,true);});
test('a completed run keeps its recorded warm workspace and retains nothing',async t=>{const f=await fixture(t);assert.deepEqual(await f.run(),{state:'completed'});
 assert.equal(await fs.readFile(join(f.workspace,'answer.txt'),'utf8'),'exact native output');
 await assert.rejects(fs.readdir(f.workspace+'.uncommitted'),error=>error.code==='ENOENT','a recorded tree stays in place as the run\'s durable materialization');});

for(const failure of ['sessionCloseFails','skillCloseFails'])test(`failed ${failure} still retains the failed run workspace for the next warm turn`,async t=>{
 const f=await fixture(t,{captureFails:true,[failure]:true});await assert.rejects(f.run());
 assert.deepEqual(await fs.readdir(f.workspace),[]);
 assert.equal(await fs.readFile(join(f.workspace+'.uncommitted','answer.txt'),'utf8'),'exact native output');
 assert.ok(f.cleanup().failures.includes('RUNNER_CLEANUP_UNKNOWN'));
});

test('assembled Objective uses one SDK query and captures the actual fixed typed file after SessionStore flush',async t=>{const f=await fixture(t,{objective:true});assert.deepEqual(await f.run(),{state:'completed'});const {queries,upload}=f.counts();assert.equal(queries,1);const file=upload.files.find(e=>e.path===upload.typedResult.path);assert.ok(file);assert.equal(file.sha256,upload.typedResult.fileSha256);assert.equal(file.bytes,upload.typedResult.bytes);const result=JSON.parse(Buffer.from(file.base64,'base64'));assert.equal(result.execution.model,SDK_MODEL_CONFIGURATION.model);assert.equal(result.resultRef,upload.binding.runId);assert.equal(result.payload.type,'authorization');assert.equal(f.order.filter(v=>v==='runner/runtime').length,2);assert.equal(f.cleanup().closed,true);});
