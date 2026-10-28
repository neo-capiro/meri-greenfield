/** Stored request -> runtime preparation, with real plugin materialization and no SDK/model call. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import {describeSkillPlugin} from '../../../packages/skills/plugin.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

// Windows has no POSIX private-directory bits. Model only the SDK directory
// ownership check; plugin files and their immutable-tree verification stay real.
const sdkDirectories=new Set();
mock.module('node:fs/promises',{namedExports:{...fs,async lstat(path){
 const stat=await fs.lstat(path);if(process.platform==='win32'&&sdkDirectories.has(path))stat.mode=0o40700;return stat;
}}});
mock.module('../../worker/conversation/activity.mjs',{namedExports:{createConversationActivity:({prepareRuntime})=>prepareRuntime}});
mock.module('../artifacts/native-files.mjs',{namedExports:{prepareNativeTaskDirectory:async()=>{},createNativeFiles:()=>({retain:async()=>true})}});
const {assembleConversationRunner}=await import('../conversation-runner.mjs');

async function prepare(t,request){
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'meri-runner-skill-'))),parent=join(root,'config'),secure=join(root,'secure');
 await fs.mkdir(parent,{mode:0o700});await fs.mkdir(secure,{mode:0o700});
 for(const p of [root,parent,secure,join(parent,'sdk-'+binding.runId)])sdkDirectories.add(p);
 if(process.platform==='win32'){const descriptor=Object.getOwnPropertyDescriptor(process,'getuid');Object.defineProperty(process,'getuid',{configurable:true,value:()=>0});t.after(()=>{if(descriptor)Object.defineProperty(process,'getuid',descriptor);else delete process.getuid;});}
 t.after(async()=>{const unseal=async dir=>{await fs.chmod(dir,0o700);for(const e of await fs.readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await unseal(path);else await fs.chmod(path,0o600);}};await unseal(root);await fs.rm(root,{recursive:true,force:true});sdkDirectories.clear();});
 let closed=false;const calls=[];
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:join(root,'workspace'),sdk:{configParentDirectory:parent,secureStorageDirectory:secure}},
  sessionFactory:async()=>({store:{},settle:async()=>{},close:async()=>{closed=true;}}),query:()=>assert.fail('No model call in runtime-preparation regression'),
  native:{async call(operation){calls.push(operation);if(operation==='runner/runtime')return {binding,versions,deadlineMs:Date.now()+60000,maxOutputBytes:1024,sdkSessionKey:null};if(operation==='runner/files/restore')return {binding,files:null,upload:null};assert.fail(operation);}}});
 const result=await execute({binding,versions,model:{model:'synthetic',region:'synthetic',maxOutputTokens:10,usageBasis:{},maxTurns:1,maxCostMicroUSD:1},request,skillPlugin:true});
 assert.deepEqual(calls,['runner/runtime','runner/files/restore']);assert.equal(closed,true);
 return {result,parent};
}

for(const [name,request]of [['stored null',{skill:null}],['omitted',{}]])test(`${name} selection prepares the default plugin without changing the request`,async t=>{
 const before=structuredClone(request),{result,parent}=await prepare(t,request);
 assert.equal(result.skillPluginDirectory,join(parent,'meri-skill-plugin'));
 const expected=describeSkillPlugin().skills.map(s=>s.name).sort();
 assert.deepEqual((await fs.readdir(join(result.skillPluginDirectory,'skills'))).sort(),expected);assert.equal(expected.length,14);
 assert.deepEqual(request,before);
});

test('an explicit valid skill pin keeps its selection-specific plugin and exact prose',async t=>{
 const item=describeSkillPlugin().skills[0],selection=selectSkill(item.skillId,item.skillVersion).pin,request={skill:selection};
 const {result,parent}=await prepare(t,request);
 assert.equal(result.skillPluginDirectory,join(parent,'meri-skill-plugin-'+canonicalSha256(selection)));
 assert.equal(await fs.readFile(join(result.skillPluginDirectory,'skills',item.name,'SKILL.md'),'utf8'),selectSkill(item.skillId,item.skillVersion).prose);
 assert.strictEqual(request.skill,selection);
});
