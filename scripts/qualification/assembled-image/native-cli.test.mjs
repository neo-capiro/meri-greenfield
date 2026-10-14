import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {nativePackageName, assertExecutableStat, resolveNativeCli, probeNativeCli} from './native-cli.mjs';

test('platform/architecture/libc selection never substitutes another optional package', () => {
  assert.deepEqual(nativePackageName('linux','x64',{glibcVersionRuntime:'2.36'}), {name:'@anthropic-ai/claude-agent-sdk-linux-x64',libc:'glibc'});
  assert.deepEqual(nativePackageName('linux','arm64',{glibcVersionRuntime:'2.36'}), {name:'@anthropic-ai/claude-agent-sdk-linux-arm64',libc:'glibc'});
  assert.throws(()=>nativePackageName('linux','x64',{}), /glibc observation missing/);
  assert.throws(()=>nativePackageName('darwin','x64',{}), /Unsupported/);
  assert.throws(()=>nativePackageName('linux','ia32',{}), /Unsupported/);
  assert.throws(()=>nativePackageName('linux','x64',null), /missing/);
});

test('binary must be a bounded regular executable without write/privilege bits', () => {
  const stat = {isFile:()=>true,size:100,mode:0o100755};
  assertExecutableStat(stat);
  for (const mode of [0o100644,0o100775,0o100757,0o104755,0o102755]) assert.throws(()=>assertExecutableStat({...stat,mode}), /Unsafe/);
  for (const size of [0,512*1024*1024+1]) assert.throws(()=>assertExecutableStat({...stat,size}), /Unsafe/);
  assert.throws(()=>assertExecutableStat({...stat,isFile:()=>false}), /Unsafe/);
});

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'meri-native-resolve-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const owner=path.join(root,'apps/worker/conversation/node_modules/@anthropic-ai');
  const sdk=path.join(owner,'claude-agent-sdk'),native=path.join(owner,'claude-agent-sdk-linux-x64');
  fs.mkdirSync(sdk,{recursive:true});fs.mkdirSync(native);
  const metadata={name:'@anthropic-ai/claude-agent-sdk',version:'0.3.295',main:'sdk.mjs',optionalDependencies:{'@anthropic-ai/claude-agent-sdk-linux-x64':'0.3.295'}};
  fs.writeFileSync(path.join(sdk,'package.json'),JSON.stringify(metadata));fs.writeFileSync(path.join(sdk,'sdk.mjs'),'export {};');
  const nativeMetadata={name:'@anthropic-ai/claude-agent-sdk-linux-x64',version:'0.3.295',os:['linux'],cpu:['x64'],libc:['glibc']};
  fs.writeFileSync(path.join(native,'package.json'),JSON.stringify(nativeMetadata));
  const binary=path.join(native,'claude');fs.writeFileSync(binary,'#!/bin/sh\nprintf "2.1.295 (Claude Code)\\n"\n',{mode:0o755});
  const args={root,sdkEntry:path.join(sdk,'sdk.mjs'),platform:'linux',architecture:'x64',header:{glibcVersionRuntime:'2.36'}};
  return {args,native,sdk,binary,metadata,nativeMetadata};
}

test('missing or mismatched optional package fails closed even with another libc package', t => {
  const f=fixture(t);
  assert.throws(()=>resolveNativeCli({...f.args,architecture:'arm64'}), /optional dependency pin/);
  fs.writeFileSync(path.join(f.native,'package.json'),JSON.stringify({...f.nativeMetadata,libc:['musl']}));
  assert.throws(()=>resolveNativeCli(f.args), /target differs/);
  fs.writeFileSync(path.join(f.sdk,'package.json'),JSON.stringify({...f.metadata,version:'0.3.294'}));
  assert.throws(()=>resolveNativeCli(f.args), /owner pin differs/);
});

test('resolved SDK must be inside owned image root', t => {
  const f=fixture(t);const other=fs.mkdtempSync(path.join(os.tmpdir(),'meri-native-outside-'));
  t.after(()=>fs.rmSync(other,{recursive:true,force:true}));
  assert.throws(()=>resolveNativeCli({...f.args,root:other}), /escapes/);
});

test('POSIX exact executable is resolved, directly executed and hashed; symlink/changes rejected', {skip:process.platform==='win32'?'POSIX executable modes and shell fixture require Linux; image gate remains mandatory':false}, t => {
  const f=fixture(t);const binding=resolveNativeCli(f.args);
  const result=probeNativeCli(binding,{PATH:'/usr/bin:/bin',HOME:path.dirname(f.binary)});
  assert.equal(result.path,fs.realpathSync(f.binary));
  assert.equal(result.sha256,crypto.createHash('sha256').update(fs.readFileSync(f.binary)).digest('hex'));
  assert.match(result.version,/^2\.1\.295/);
  fs.appendFileSync(f.binary,'# changed\n');assert.throws(()=>probeNativeCli(binding,{}),/changed before/);
  fs.renameSync(f.binary,f.binary+'.original');fs.symlinkSync(f.binary+'.original',f.binary);
  assert.throws(()=>resolveNativeCli(f.args),/link refused/);
});
