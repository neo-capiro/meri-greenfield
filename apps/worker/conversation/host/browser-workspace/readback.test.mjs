/** Synthetic proc and mount fixtures only; no namespace, browser, SDK, model or live host is started. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {browserPaths} from '../../browser/workspace.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {BROWSER_WORKSPACE_READBACK_SCHEMA,readBrowserWorkspaceIsolation} from './readback.mjs';

const browserUid=2002,browserGid=2002,sdkUid=2001,sdkGid=2001,leaderPid=43210;
const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,
 leaseDeadlineMs:Date.now()+60000};
const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',
 bootId:'00000021-b0a1-4000-8000-000000000000',conversationId:binding.conversationId,hostId:allocation.hostId};
const cwd=`/workspace/conversations/${binding.conversationId}`,paths=browserPaths(cwd),proc=`/proc/${leaderPid}`;
const directory=(uid,gid,mode,dev,ino)=>({uid,gid,mode,dev,ino,isDirectory:()=>true,isSymbolicLink:()=>false});
const statLine=ticks=>{const fields=Array(40).fill('0');fields[0]='S';fields[19]=String(ticks);return `${leaderPid} (meri-host-launcher) ${fields.join(' ')}\n`;};
function fixture(){
 const files=new Map([
  [`${proc}/stat`,statLine(99)],
  [`${proc}/status`,`Name:\tmeri-host-launcher\nUid:\t${browserUid}\t${browserUid}\t${browserUid}\t${browserUid}\nGid:\t${browserGid}\t${browserGid}\t${browserGid}\t${browserGid}\nGroups:\t\nCapInh:\t0000000000000000\nCapPrm:\t0000000000000000\nCapEff:\t0000000000000000\nCapBnd:\t0000000000000000\nCapAmb:\t0000000000000000\nNoNewPrivs:\t1\n`],
  [`${proc}/cgroup`,`0::/meri/hosts/${allocation.hostId}-${allocation.generation}/${canonicalSha256(binding)}/browser\n`],
  [`${proc}/mountinfo`,`11 1 0:12 / ${cwd} rw,nosuid,nodev,noexec - tmpfs tmpfs rw\n12 11 8:1 /private/state ${paths.root} rw,nosuid,nodev,noexec - ext4 /dev/root rw\n`],
 ]);
 const links=new Map([[`${proc}/ns/mnt`,'mnt:[4026533001]'],['/proc/self/ns/mnt','mnt:[4026531840]']]);
 const stats=new Map([
  [cwd,directory(0,sdkGid,0o41770,8,10)],
  [paths.root,directory(browserUid,browserGid,0o40700,8,11)],
  ['/workspace',directory(0,0,0o40755,8,12)],
  ['/workspace/conversations',directory(0,0,0o40711,8,13)],
  [`${proc}/root${cwd}`,directory(browserUid,browserGid,0o40700,12,20)],
  [`${proc}/root${paths.root}`,directory(browserUid,browserGid,0o40700,8,11)],
  ...[paths.profile,paths.output,paths.home].map((path,index)=>[`${proc}/root${path}`,directory(browserUid,browserGid,0o40700,8,30+index)]),
 ]);
 const listings=new Map([[`${proc}/root${cwd}`,['.browser']]]);
 const fs={readFile:async path=>{if(!files.has(path))throw Error('missing file');return files.get(path);},
  readlink:async path=>{if(!links.has(path))throw Error('missing link');return links.get(path);},
  lstat:async path=>{if(!stats.has(path))throw Error('missing stat');return stats.get(path);},
  readdir:async path=>{if(!listings.has(path))throw Error('missing listing');return listings.get(path);}};
 return {files,links,stats,listings,fs,input:{allocation,binding,hostIdentity,cwd,paths,browserUid,browserGid,sdkUid,sdkGid,
  leaderPid,now:()=>1000,fs}};
}
const refused=error=>error?.code==='HOST_BROWSER_WORKSPACE_UNPROVEN';

test('live readback contract binds the paused browser child to a private overlay and original state inode',async()=>{
 const f=fixture(),receipt=await readBrowserWorkspaceIsolation(f.input);
 assert.equal(receipt.schema,BROWSER_WORKSPACE_READBACK_SCHEMA);
 assert.equal(receipt.bindingSha256,canonicalSha256(binding));
 assert.equal(receipt.browserMountNamespace,'mnt:[4026533001]');
 assert.equal(receipt.originalCwdInode,'10');
 assert.equal(receipt.stateInode,'11');
 assert.equal(receipt.observedAtMs,1000);
});

test('a search-only or writable SDK cwd, absent browser overlay, and extra source entry are refused',async()=>{
 for(const mutate of [
  f=>f.stats.set(cwd,directory(0,sdkGid,0o40710,8,10)),
  f=>f.files.set(`${proc}/mountinfo`,f.files.get(`${proc}/mountinfo`).replace('tmpfs tmpfs','ext4 /dev/root')),
  f=>f.listings.set(`${proc}/root${cwd}`,['.browser','source.txt']),
  f=>f.stats.set(`${proc}/root${cwd}`,directory(browserUid,browserGid,0o40700,8,10)),
 ]){
  const f=fixture();mutate(f);await assert.rejects(readBrowserWorkspaceIsolation(f.input),refused);
 }
});

test('wrong state inode, mounted child path, UID, cgroup, namespace and parent refuse before GO',async()=>{
 for(const mutate of [
  f=>f.stats.set(`${proc}/root${paths.root}`,directory(browserUid,browserGid,0o40700,8,99)),
  f=>f.files.set(`${proc}/mountinfo`,f.files.get(`${proc}/mountinfo`)+`13 12 8:1 /etc ${paths.profile} rw,nosuid,nodev,noexec - ext4 /dev/root rw\n`),
  f=>f.files.set(`${proc}/status`,f.files.get(`${proc}/status`).replace('NoNewPrivs:\t1','NoNewPrivs:\t0')),
  f=>f.files.set(`${proc}/status`,f.files.get(`${proc}/status`).replace('CapBnd:\t0000000000000000','CapBnd:\t0000000000000001')),
  f=>f.files.set(`${proc}/cgroup`,'0::/wrong\n'),
  f=>f.links.set(`${proc}/ns/mnt`,'mnt:[4026531840]'),
  f=>f.stats.set('/workspace/conversations',directory(0,0,0o40700,8,13)),
 ]){
  const f=fixture();mutate(f);await assert.rejects(readBrowserWorkspaceIsolation(f.input),refused);
 }
});

test('PID reuse and untrusted shape or missing proc data refuse',async()=>{
 const f=fixture();let reads=0;const original=f.fs.readFile;
 f.fs.readFile=async(...args)=>{const result=await original(...args);if(args[0]===`${proc}/stat`&&reads++>0)return statLine(100);return result;};
 await assert.rejects(readBrowserWorkspaceIsolation(f.input),refused);
 await assert.rejects(readBrowserWorkspaceIsolation({...fixture().input,paths:{...paths,root:'/other'}}),refused);
 const missing=fixture();missing.files.delete(`${proc}/mountinfo`);
 await assert.rejects(readBrowserWorkspaceIsolation(missing.input),refused);
});
