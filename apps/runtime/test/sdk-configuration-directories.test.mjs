/** Per-run SDK configuration directories on the remote task path: derived from the admitted intent and verified before SDK initialization. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,statSync,mkdirSync,chmodSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {sdkConfigurationDirectories,ensureSdkConfigurationDirectories,assertPinnedSdkCaFile} from '../conversation-runner.mjs';
import {RUNNER_SDK_CA_FILE} from '../native-authority/preparation-intent.mjs';
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
const withCa=(root,ca)=>{const c=remoteConfiguration(root);c.remoteTask.preparationIntent.launchTemplate.env.NODE_EXTRA_CA_CERTS=ca;return c;};
test('the SDK CA is derived only as the pinned runner CA from the admitted template, and the product path requires it',()=>{
 assert.deepEqual(sdkConfigurationDirectories(withCa('/task',RUNNER_SDK_CA_FILE),{}),{sdkConfigDirectory:join('/task','config','sdk-'+binding.runId),sdkSecureStorageDirectory:join('/task','secure'),sdkCaFile:'/run/meri/poststart/bootstrap/control-ca.pem'});
 assert.deepEqual(sdkConfigurationDirectories(withCa('/task',RUNNER_SDK_CA_FILE),{MERI_PRODUCT_PREVIEW_REQUIRED:'1'}).sdkCaFile,RUNNER_SDK_CA_FILE);
 assert.throws(()=>sdkConfigurationDirectories(withCa('/task','/tmp/other.pem'),{}),/PREPARATION_REFUSED/);
 assert.throws(()=>sdkConfigurationDirectories(remoteConfiguration('/task'),{MERI_PRODUCT_PREVIEW_REQUIRED:'1'}),/RUNNER_SDK_CA_REFUSED/);
 assert.equal(Object.hasOwn(sdkConfigurationDirectories(remoteConfiguration('/task'),{}),'sdkCaFile'),false);
 assert.deepEqual(sdkConfigurationDirectories({binding,workspace:'/w/'+binding.conversationId},{MERI_PRODUCT_PREVIEW_REQUIRED:'1'}),{});
});
function caFile(t,{mode=0o600,bytes=Buffer.from('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n')}={}){const root=mkdtempSync(join(tmpdir(),'meri-sdk-ca-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const path=join(root,'control-ca.pem');writeFileSync(path,bytes,{mode});chmodSync(path,mode);return {root,path,sha256:createHash('sha256').update(bytes).digest('hex')};}
test('the SDK CA file must be the exact pinned bytes in a private regular file owned by this uid, checked before directories are created',async t=>{
 const uid=process.getuid(),f=caFile(t);
 await assertPinnedSdkCaFile(f.path,{uid,expectedSha256:f.sha256});
 for(const expectedSha256 of ['0'.repeat(64),undefined,'not-hex'])await assert.rejects(assertPinnedSdkCaFile(f.path,{uid,expectedSha256}),/RUNNER_SDK_CA_REFUSED/);
 await assert.rejects(assertPinnedSdkCaFile(f.path,{uid:uid+1,expectedSha256:f.sha256}),/RUNNER_SDK_CA_REFUSED/);
 const open=caFile(t,{mode:0o644});await assert.rejects(assertPinnedSdkCaFile(open.path,{uid,expectedSha256:open.sha256}),/RUNNER_SDK_CA_REFUSED/);
 const linked=join(f.root,'linked.pem');symlinkSync(f.path,linked);await assert.rejects(assertPinnedSdkCaFile(linked,{uid,expectedSha256:f.sha256}),/RUNNER_SDK_CA_REFUSED/);
 await assert.rejects(assertPinnedSdkCaFile(join(f.root,'missing.pem'),{uid,expectedSha256:f.sha256}),/RUNNER_SDK_CA_REFUSED/);
 await assert.rejects(assertPinnedSdkCaFile(f.root,{uid,expectedSha256:f.sha256}),/RUNNER_SDK_CA_REFUSED/);
 // Through the directory owner: a wrong CA digest refuses before either SDK directory exists.
 const root=roots(t),d={...derive(root),sdkCaFile:f.path};
 await assert.rejects(ensureSdkConfigurationDirectories(d,{environment:{MERI_POSTSTART_CA_SHA256:'0'.repeat(64)}}),/RUNNER_SDK_CA_REFUSED/);
 assert.equal(existsSync(d.sdkConfigDirectory),false);assert.equal(existsSync(d.sdkSecureStorageDirectory),false);
 const ready=await ensureSdkConfigurationDirectories(d,{environment:{MERI_POSTSTART_CA_SHA256:f.sha256}});assert.equal(ready.sdkCaFile,f.path);assert.ok(existsSync(ready.sdkConfigDirectory));
});
