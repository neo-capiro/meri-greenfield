/** Per-run SDK configuration directories on the remote task path: derived from the admitted intent and verified before SDK initialization. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,statSync,mkdirSync,chmodSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sdkConfigurationDirectories,ensureSdkConfigurationDirectories} from '../conversation-runner.mjs';
import {binding} from '../../control/conversations/test/application-fixture.mjs';
function remoteConfiguration(root){const workspace=join(root,binding.conversationId);return {binding,workspace,remoteTask:{preparationIntent:{workspace,configParentDirectory:join(root,'config'),secureStorageDirectory:join(root,'secure'),launchTemplate:{command:'/opt/claude',args:[],env:{CLAUDE_SECURESTORAGE_CONFIG_DIR:join(root,'secure')}},executableSha256:'a'.repeat(64),imageSha256:'b'.repeat(64),runnerSha256:'c'.repeat(64),sdkOptionsSha256:'d'.repeat(64),authoritySha256:'f'.repeat(64)}}};}
function roots(t,{parentMode=0o700}={}){const root=mkdtempSync(join(tmpdir(),'meri-sdk-directories-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'config'),{mode:parentMode});if(parentMode!==0o700)chmodSync(join(root,'config'),parentMode);return root;}
const derive=root=>sdkConfigurationDirectories(remoteConfiguration(root));
test('no remote task: no directories are derived and the runtime shape is unchanged',async()=>{
 assert.deepEqual(sdkConfigurationDirectories({binding,workspace:'/w/'+binding.conversationId}),{});
 assert.deepEqual(await ensureSdkConfigurationDirectories({}),{});
});
test('remote task: directories derive from the compiled intent and the run identity',()=>{
 const root='/task',d=derive(root);
 assert.deepEqual(d,{sdkConfigDirectory:join(root,'config','sdk-'+binding.runId),sdkSecureStorageDirectory:join(root,'secure')});
 assert.throws(()=>sdkConfigurationDirectories({binding,remoteTask:{preparationIntent:{workspace:'relative'}}}),/PREPARATION_REFUSED|INVALID_COMMAND/u);
});
test('directories are created private and owned by this uid; a reused config directory refuses before SDK initialization',async t=>{
 const root=roots(t),d=await ensureSdkConfigurationDirectories(derive(root));
 for(const dir of [d.sdkConfigDirectory,d.sdkSecureStorageDirectory]){assert.ok(existsSync(dir));const s=statSync(dir);assert.equal(s.mode&0o777,0o700);assert.equal(s.uid,process.getuid());}
 await assert.rejects(ensureSdkConfigurationDirectories(d),/RUNNER_SDK_DIRECTORY_REFUSED/);
 // secure storage may pre-exist for a later run of the same task; a fresh config directory is still required
 const next=await ensureSdkConfigurationDirectories({...d,sdkConfigDirectory:join(root,'config','sdk-next')});assert.equal(statSync(next.sdkConfigDirectory).mode&0o777,0o700);
});
test('a permissive config parent refuses and creates nothing',async t=>{
 const root=roots(t,{parentMode:0o755}),d=derive(root);
 await assert.rejects(ensureSdkConfigurationDirectories(d),/RUNNER_SDK_DIRECTORY_REFUSED/);assert.equal(existsSync(d.sdkConfigDirectory),false);assert.equal(existsSync(d.sdkSecureStorageDirectory),false);
});
test('a permissive existing secure storage directory refuses',async t=>{
 const root=roots(t);mkdirSync(join(root,'secure'),{mode:0o755});chmodSync(join(root,'secure'),0o755);
 await assert.rejects(ensureSdkConfigurationDirectories(derive(root)),/RUNNER_SDK_DIRECTORY_REFUSED/);
});
test('a symlinked secure storage directory or a symlinked config parent refuses',async t=>{
 const root=roots(t);mkdirSync(join(root,'real-secure'),{mode:0o700});symlinkSync(join(root,'real-secure'),join(root,'secure'));
 await assert.rejects(ensureSdkConfigurationDirectories(derive(root)),/RUNNER_SDK_DIRECTORY_REFUSED/);
 const other=mkdtempSync(join(tmpdir(),'meri-sdk-directories-link-'));t.after(()=>rmSync(other,{recursive:true,force:true}));mkdirSync(join(other,'real-config'),{mode:0o700});symlinkSync(join(other,'real-config'),join(other,'config'));
 await assert.rejects(ensureSdkConfigurationDirectories(derive(other)),/RUNNER_SDK_DIRECTORY_REFUSED/);
});
test('foreign ownership refuses even when the directory is private',async t=>{
 const root=roots(t);
 await assert.rejects(ensureSdkConfigurationDirectories(derive(root),{uid:process.getuid()+1}),/RUNNER_SDK_DIRECTORY_REFUSED/);
});
test('initialization failures refuse: missing config parent, a file where the secure directory must be',async t=>{
 const missing=mkdtempSync(join(tmpdir(),'meri-sdk-directories-missing-'));t.after(()=>rmSync(missing,{recursive:true,force:true}));
 await assert.rejects(ensureSdkConfigurationDirectories(derive(missing)),/RUNNER_SDK_DIRECTORY_REFUSED/);
 const root=roots(t);writeFileSync(join(root,'secure'),'not a directory');
 await assert.rejects(ensureSdkConfigurationDirectories(derive(root)),/RUNNER_SDK_DIRECTORY_REFUSED/);
});
