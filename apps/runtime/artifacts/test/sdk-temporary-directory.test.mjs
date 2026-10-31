import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import promises from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';
import {join,resolve,sep,dirname} from 'node:path';import {tmpdir} from 'node:os';
import {ensureSdkConfigurationDirectories} from '../../conversation-runner.mjs';
import {sdkProviderEnvironment,sdkTemporaryDirectory,BEDROCK_MODEL,BEDROCK_REGION} from '../../../worker/conversation/provider.mjs';
import {createNativeFiles,prepareNativeTaskDirectory} from '../native-files.mjs';
import {workspaceCaptureDiagnosticCause} from '../../../../packages/runtime/workspace-capture-diagnostics.mjs';

async function fixture(t){
 const temp=await promises.realpath(tmpdir()),root=await promises.realpath(await promises.mkdtemp(join(temp,'meri-sdk-temp-')));
 t.after(()=>{assert.ok(resolve(root).startsWith(resolve(temp)+sep));fs.rmSync(root,{recursive:true,force:true});});
 const workspace=join(root,'cwd'),parent=join(root,'conversation'),configDirectory=join(parent,'sdk-run'),secure=join(parent,'secure');
 await promises.mkdir(workspace,{mode:0o700});await promises.mkdir(parent,{mode:0o700});
 // Windows cannot enforce POSIX mode/uid. Model only these metadata fields there; use real filesystem identity/paths.
 if(process.platform==='win32'){const original=promises.lstat,syncOriginal=fs.lstatSync,model=(s,p)=>{if(String(p).startsWith(root)&&s.isDirectory()){s.mode=(s.mode&~0o777)|0o700;s.uid=0;}return s;};promises.lstat=async(...args)=>model(await original(...args),args[0]);fs.lstatSync=(...args)=>model(syncOriginal(...args),args[0]);syncBuiltinESMExports();t.after(()=>{promises.lstat=original;fs.lstatSync=syncOriginal;syncBuiltinESMExports();});}
 return {root,workspace,parent,configDirectory,secure,directories:{sdkConfigDirectory:configDirectory,sdkSecureStorageDirectory:secure},uid:process.getuid?.()??0};
}
const environment=f=>sdkProviderEnvironment({cwd:f.workspace,configDirectory:f.configDirectory,secureStorageDirectory:f.secure,model:BEDROCK_MODEL,region:BEDROCK_REGION,maxOutputTokens:4096,environment:{}});
function socketMetadata(t,paths){const original=fs.lstatSync;fs.lstatSync=(p,...args)=>{const s=original(p,...args);return paths.includes(String(p))?{...s,isDirectory:()=>false,isFile:()=>false,isSymbolicLink:()=>false,isSocket:()=>true}:s;};syncBuiltinESMExports();t.after(()=>{fs.lstatSync=original;syncBuiltinESMExports();});}

test('SDK temp uses a fresh private run directory outside durable cwd and SDK task capture',async t=>{
 const f=await fixture(t);await ensureSdkConfigurationDirectories(f.directories,{uid:f.uid});
 const temporary=sdkTemporaryDirectory(f.configDirectory),env=environment(f);
 assert.equal(env.TMPDIR,temporary);assert.equal(env.HOME,f.workspace);assert.equal(env.CLAUDE_CONFIG_DIR,f.configDirectory);
 assert.equal(dirname(temporary),f.root);assert.notEqual(temporary,f.workspace);assert.ok(fs.statSync(temporary).isDirectory());
 if(process.platform!=='win32'){assert.equal(fs.statSync(temporary).mode&0o777,0o700);assert.equal(fs.statSync(temporary).uid,process.getuid());}
 await assert.rejects(ensureSdkConfigurationDirectories(f.directories,{uid:f.uid}),/RUNNER_SDK_DIRECTORY_REFUSED/);
 const next={...f.directories,sdkConfigDirectory:join(f.parent,'sdk-next')};await ensureSdkConfigurationDirectories(next,{uid:f.uid});
 assert.notEqual(sdkTemporaryDirectory(next.sdkConfigDirectory),temporary);assert.ok(fs.existsSync(temporary));
});

test('SDK IPC in the temporary root is not captured; unknown nonregular cwd content still refuses',async t=>{
 const f=await fixture(t);await ensureSdkConfigurationDirectories(f.directories,{uid:f.uid});const tasks=await prepareNativeTaskDirectory(f.configDirectory);
 const owner=createNativeFiles({workspace:f.workspace,sdkConfigDirectory:f.configDirectory,expiresAtMs:2000,now:()=>1000});
 fs.writeFileSync(join(f.workspace,'answer.txt'),'durable answer');fs.writeFileSync(join(tasks,'.lock'),'');
 const socket=join(environment(f).TMPDIR,'claude-http-0123456789abcdef.sock');fs.writeFileSync(socket,'');socketMetadata(t,[socket]);
 const upload=owner.capture();assert.deepEqual(upload.files.map(x=>x.path),['answer.txt']);assert.equal(Buffer.from(upload.files[0].base64,'base64').toString(),'durable answer');assert.deepEqual(upload.taskFiles.map(x=>x.path),['.lock']);
 assert.ok(fs.existsSync(socket),'capture does not delete or adopt SDK-owned IPC');
 const unknown=join(f.workspace,'unowned-ipc');fs.writeFileSync(unknown,'');socketMetadata(t,[socket,unknown]);
 assert.throws(()=>owner.capture(),error=>workspaceCaptureDiagnosticCause(error)==='WORKSPACE_CAPTURE_CWD_TYPE');
});

for(const kind of ['directory','file','symlink'])test(`preexisting ${kind} at the run temp path refuses before SDK use`,async t=>{
 const f=await fixture(t),temporary=sdkTemporaryDirectory(f.configDirectory);
 if(kind==='directory')fs.mkdirSync(temporary,{mode:0o700});else if(kind==='file')fs.writeFileSync(temporary,'retained');else fs.symlinkSync(f.workspace,temporary,'junction');
 await assert.rejects(ensureSdkConfigurationDirectories(f.directories,{uid:f.uid}),/RUNNER_SDK_DIRECTORY_REFUSED/);
 assert.ok(fs.lstatSync(temporary),'existing custody remains untouched');
});

test('temporary root cannot overlap protected secure storage',async t=>{
 const f=await fixture(t);await assert.rejects(ensureSdkConfigurationDirectories({...f.directories,sdkSecureStorageDirectory:sdkTemporaryDirectory(f.configDirectory)},{uid:f.uid}),/RUNNER_SDK_DIRECTORY_REFUSED/);
 assert.equal(fs.existsSync(f.configDirectory),false);
});

test('cancellation during asynchronous directory preparation cannot create a late temporary root',async t=>{
 const f=await fixture(t),controller=new AbortController(),original=promises.realpath;
 promises.realpath=async(...args)=>{const result=await original(...args);if(args[0]===f.secure)controller.abort();return result;};syncBuiltinESMExports();t.after(()=>{promises.realpath=original;syncBuiltinESMExports();});
 await assert.rejects(ensureSdkConfigurationDirectories(f.directories,{uid:f.uid,signal:controller.signal}),error=>error.name==='AbortError');
 assert.equal(fs.existsSync(sdkTemporaryDirectory(f.configDirectory)),false);
});

test('actual runtime path leaves room for the pinned SDK Unix socket name',()=>{
 const id='11111111-1111-4111-8111-111111111111',temporary=sdkTemporaryDirectory(`/run/meri/${id}/sdk-${id}`);
 assert.ok(Buffer.byteLength(join(temporary,'claude-socks-0123456789abcdef.sock'))<104);
 for(const invalid of ['relative','/run/meri/../foreign/sdk-run'])assert.throws(()=>sdkTemporaryDirectory(invalid),/SDK_PROVIDER_CONFIGURATION_REFUSED/);
});
