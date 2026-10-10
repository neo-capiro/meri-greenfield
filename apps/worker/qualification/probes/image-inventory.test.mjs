// Codex owner correction: fabricated temporary roots and mocked inode facts.
// No Docker, Linux native program, Office, SDK, service, provider or network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PROBE = join(dirname(fileURLToPath(import.meta.url)), 'image-inventory.py');
const PYTHON = process.env.PYTHON || 'python';
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const DRIVER = `
import importlib.util,json,sys
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('inventory_fixture',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
cfg=json.loads(sys.argv[2]);args=m.parse_args(cfg['args'])
def fake_walk(root,excludes,limits,hash_limit,entries,errors,aliases):
    for rec in cfg.get('records',[]):
        limits.add(rec,entry=True);entries.append(rec)
    for err in cfg.get('errors',[]):
        limits.add(err);errors.append(err)
if 'records' in cfg or 'errors' in cfg:
    with patch.object(m,'walk_root',side_effect=fake_walk):
        manifest,code=m._inventory(args,platform=cfg.get('platform','linux'),required_roots=cfg['roots'],pins=cfg.get('pins',{}),aliases=cfg.get('aliases',{}),clock=(lambda:0) if cfg.get('zeroClock') else m.time.monotonic,output_path=args.out)
else:
    manifest,code=m._inventory(args,platform=cfg.get('platform','linux'),required_roots=cfg['roots'],pins=cfg.get('pins',{}),aliases=cfg.get('aliases',{}),output_path=args.out)
m.emit(manifest,args.out);sys.exit(code)
`;
function runPython(code, args = []) {
  return spawnSync(PYTHON, ['-B', '-c', code, PROBE, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
}
function runProbe(args, config) {
  const r = config ? runPython(DRIVER, [JSON.stringify({ args, ...config })])
    : spawnSync(PYTHON, ['-B', PROBE, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
  let summary; try { summary = JSON.parse(r.stdout.trim().split('\n').at(-1)); } catch {}
  return { ...r, summary };
}
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'meri-inventory-owner-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function write(dir, rel, contents) {
  const path = join(dir, rel); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, contents); return path;
}
function scan(dir, more = [], config = {}) {
  const out = join(dir, 'inventory-result.json');
  const r = runProbe(['--root', dir, '--out', out, ...more], { roots: [dir], ...config });
  const manifest = JSON.parse(readFileSync(out, 'utf8'));
  return { ...r, manifest, bytes: readFileSync(out).length };
}
function rec(path, mode = '4755', extra = {}) {
  return { path, type: 'file', uid: 0, gid: 0, mode, size: 6, sha256: sha256('helper'), ...extra };
}

test('the probe is stdlib-only and has no process/network/dynamic execution call', () => {
  const r = runPython(`import ast,json,sys\nt=ast.parse(open(sys.argv[1]).read());print(json.dumps({'imports':[n.names[0].name for n in ast.walk(t) if isinstance(n,(ast.Import,ast.ImportFrom))],'calls':[ast.unparse(n.func) for n in ast.walk(t) if isinstance(n,ast.Call)]}))`);
  assert.equal(r.status, 0, r.stderr); const found = JSON.parse(r.stdout);
  assert.deepEqual(found.imports.sort(), ['argparse', 'hashlib', 'json', 'os', 'stat', 'sys', 'time']);
  assert.ok(!found.calls.some((n) => /^(exec|eval|__import__|os\.(system|popen|spawn|exec)|subprocess|socket)/.test(n)));
});

test('refuses a non-Linux platform without opening any root; CLI cannot override', () => fixture((dir) => {
  const r = scan(dir, [], { platform: 'win32' });
  assert.equal(r.status, 3); assert.equal(r.manifest.refused, true); assert.match(r.manifest.reason, /non-linux/);
  const escaped = runProbe(['--platform-override', 'linux', '--root', dir]);
  assert.equal(escaped.status, 2); assert.match(escaped.stderr, /unrecognized arguments/);
}));

test('rejects mismatched expectation counts before scanning', () => fixture((dir) => {
  const r = scan(dir, ['--expect-file', join(dir, 'a'), '--expect-sha256', 'b', '--expect-sha256', 'c']);
  assert.equal(r.status, 2); assert.equal(r.manifest.refused, true);
}));

test('enumerates fabricated roots deterministically and retains candidate byte hashes', () => fixture((dir) => {
  const tiff = write(dir, 'usr/bin/tiffcrop', 'synthetic tiff');
  const md5 = write(dir, 'opt/libdigestmd5.so.2', 'synthetic md5');
  write(dir, 'usr/lib/jvm/bin/java', 'java');
  const first = scan(dir), second = scan(dir);
  assert.equal(first.status, 0, first.stderr + JSON.stringify(first.manifest.errors));
  assert.equal(second.status, 0, second.stderr + JSON.stringify(second.manifest.errors));
  assert.deepEqual(first.manifest.entries, second.manifest.entries);
  const by = Object.fromEntries(first.manifest.candidates.map((c) => [c.kind, c]));
  assert.equal(by.tiffcrop.sha256, sha256(readFileSync(tiff)));
  assert.equal(by.libdigestmd5.sha256, sha256(readFileSync(md5)));
  assert.equal(by['java-jvm'].size, 4); assert.equal(first.manifest.coverage.complete, true);
}));

test('records a directory symlink/junction and never descends into it', () => fixture((dir) => {
  write(dir, 'real/only-here.txt', 'x'); mkdirSync(join(dir, 'holder'));
  symlinkSync(join(dir, 'real'), join(dir, 'holder/linkdir'), process.platform === 'win32' ? 'junction' : 'dir');
  const r = scan(dir); assert.equal(r.status, 0, r.stderr);
  assert.equal(r.manifest.entries.filter((e) => e.type === 'symlink').length, 1);
  assert.equal(r.manifest.entries.filter((e) => e.path.endsWith('only-here.txt')).length, 1);
}));

test('rejects exclusions that weaken declared static coverage', () => fixture((dir) => {
  write(dir, 'skip/secret.txt', 'synthetic');
  const r = scan(dir, ['--exclude', join(dir, 'skip')]);
  assert.equal(r.status, 2); assert.match(r.manifest.reason, /coverage/);
}));

test('a file root is a traversal error, never empty coverage', () => fixture((dir) => {
  const file = write(dir, 'notadir', 'plain'), out = join(dir, 'out.json');
  const r = runProbe(['--root', file, '--out', out], { roots: [file] });
  const m = JSON.parse(readFileSync(out)); assert.equal(r.status, 1);
  assert.equal(m.coverage.complete, false); assert.ok(m.errors.some((e) => /root-not-a-directory/.test(e.error)));
}));

test('a missing root is inaccessible, never an absence claim', () => fixture((dir) => {
  const missing = join(dir, 'missing'), out = join(dir, 'out.json');
  const r = runProbe(['--root', missing, '--out', out], { roots: [missing] });
  const m = JSON.parse(readFileSync(out)); assert.equal(r.status, 1); assert.ok(m.errors.length); assert.equal(m.coverage.complete, false);
}));

test('entry caps and deadline zero fail closed, including a zero fake clock', () => fixture((dir) => {
  write(dir, 'a', 'a'); write(dir, 'b', 'b');
  const cap = scan(dir, ['--max-entries', '1']); assert.equal(cap.status, 1); assert.equal(cap.manifest.summary.limitsExceeded, 'max-entries');
  const dl = scan(dir, ['--deadline-ms', '0'], { zeroClock: true, records: [] });
  assert.equal(dl.status, 1); assert.equal(dl.manifest.summary.limitsExceeded, 'deadline'); assert.equal(dl.manifest.truncated, true);
}));

test('oversized candidates/errors stay bounded and explicitly incomplete', () => fixture((dir) => {
  const records = Array.from({ length: 80 }, (_, i) => rec(join(dir, `jvm${i}/java`), '0755'));
  const r = scan(dir, ['--max-manifest-bytes', '4096'], { records });
  assert.equal(r.status, 1); assert.equal(r.manifest.coverage.complete, false); assert.equal(r.manifest.truncated, true);
  assert.ok(r.bytes <= 4096, `${r.bytes} bytes`);
  const errors = Array.from({ length: 80 }, (_, i) => ({ path: join(dir, `bad${i}`), error: 'synthetic denied '.repeat(10) }));
  const e = scan(dir, ['--max-manifest-bytes', '4096'], { errors }); assert.equal(e.status, 1); assert.ok(e.bytes <= 4096);
}));

test('expectation mismatch and missing exact paths fail closed', () => fixture((dir) => {
  const chrome = write(dir, 'chrome', 'chrome-bytes');
  const pins = { [chrome]: { sha256: sha256('wrong') } };
  const mismatch = scan(dir, [], { pins }); assert.equal(mismatch.status, 1); assert.equal(mismatch.manifest.expectations[0].status, 'unresolved/mismatch');
  const missing = scan(dir, [], { pins: { [join(dir, 'missing')]: { sha256: sha256('x') } } });
  assert.equal(missing.status, 1); assert.equal(missing.manifest.expectations[0].observed, null);
}));

test('a matching root-owned mode4755 helper needs its exact hash-bound allowlist', () => fixture((dir) => {
  const helper = join(dir, 'chrome_sandbox'), records = [rec(helper)];
  const pins = { [helper]: { sha256: sha256('helper'), uid: 0, gid: 0, mode: '4755' } };
  const allowed = scan(dir, ['--allow-suid', helper], { pins, records }); assert.equal(allowed.status, 0);
  const denied = scan(dir, [], { pins, records }); assert.equal(denied.status, 1); assert.equal(denied.manifest.unexpectedPrivilegeFiles.length, 1);
}));

test('rejects empty, duplicate, relative and incomplete declared roots', () => fixture((dir) => {
  for (const args of [[], ['--root', dir, '--root', dir], ['--root', 'relative']]) {
    const r = runProbe(args, { roots: [dir] }); assert.equal(r.status, 2, r.stderr); assert.equal(r.summary.refused, true);
  }
  const r = runProbe(['--root', dir], { roots: [dir, join(dir, 'another')] }); assert.equal(r.status, 2);
}));

test('SUID prefix collisions, owner/mode/hash drift and SGID helpers remain unreviewed', () => fixture((dir) => {
  const helper = join(dir, 'chrome_sandbox');
  const pins = { [helper]: { sha256: sha256('helper'), uid: 0, gid: 0, mode: '4755' } };
  for (const change of [{ path: join(dir, 'evilchrome_sandbox') }, { uid: 10001 }, { gid: 10001 }, { mode: '6755' }, { sha256: sha256('different') }]) {
    const r = scan(dir, ['--allow-suid', helper], { pins, records: [rec(helper, '4755', change)] });
    assert.equal(r.status, 1); assert.ok(r.manifest.unexpectedPrivilegeFiles.length);
  }
  const widened = scan(dir, ['--allow-suid', join(dir, 'su')], { pins, records: [rec(join(dir, 'su'))] }); assert.equal(widened.status, 2);
}));

test('records privilege directories and fails on traversal/read errors or event caps', () => fixture((dir) => {
  const suidDir = scan(dir, [], { records: [rec(join(dir, 'directory'), '2755', { type: 'dir' })] });
  assert.equal(suidDir.status, 1); assert.equal(suidDir.manifest.privilegeFiles.length, 1);
  const error = scan(dir, [], { errors: [{ path: join(dir, 'a'), error: 'synthetic inaccessible' }] });
  assert.equal(error.status, 1); assert.equal(error.manifest.coverage.complete, false);
  const cap = scan(dir, ['--max-events', '1'], { errors: [{ path: 'a', error: 'denied' }, { path: 'b', error: 'denied' }] });
  assert.equal(cap.status, 1); assert.equal(cap.manifest.summary.limitsExceeded, 'max-events');
  const full = scan(dir, [], { records: ['one', 'two', 'three'].map((p) => rec(join(dir, p))) });
  assert.equal(full.status, 1); assert.equal(full.manifest.unexpectedPrivilegeFiles.length, 3);
}));

test('rejects a declared root reached through a link/junction ancestor', () => fixture((dir) => {
  mkdirSync(join(dir, 'real/inside'), { recursive: true });
  symlinkSync(join(dir, 'real'), join(dir, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  const root = join(dir, 'link/inside'), out = join(dir, 'out.json');
  const r = runProbe(['--root', root, '--out', out], { roots: [root] });
  const m = JSON.parse(readFileSync(out)); assert.equal(r.status, 1); assert.equal(m.coverage.complete, false);
  assert.ok(m.errors.some((e) => /ancestor refused/.test(e.error)));
}));

test('known root aliases are recorded without walking; unexpected or missing targets fail', () => fixture((dir) => {
  mkdirSync(join(dir, 'real')); const link = join(dir, 'alias');
  symlinkSync(join(dir, 'real'), link, process.platform === 'win32' ? 'junction' : 'dir');
  const out = join(dir, 'out.json');
  // Junction readlink on Windows uses a native-prefix target; normalize only
  // this test's reported target via a pure fixture patch, never production CLI.
  const script = DRIVER.replace("manifest,code=m._inventory(args,platform=cfg.get('platform','linux'),required_roots=cfg['roots'],pins=cfg.get('pins',{}),aliases=cfg.get('aliases',{}),output_path=args.out)", "with patch.object(m.os,'readlink',return_value=cfg['aliasTarget']):\n        manifest,code=m._inventory(args,platform=cfg.get('platform','linux'),required_roots=cfg['roots'],pins=cfg.get('pins',{}),aliases=cfg.get('aliases',{}),output_path=args.out)");
  for (const correct of [true, false]) {
    const real = join(dir, 'real');
    const r = runPython(script, [JSON.stringify({ args: ['--root', link, '--root', real, '--out', out], roots: [link, real], aliases: correct ? { [link]: real } : {}, aliasTarget: real })]);
    assert.equal(r.status, correct ? 0 : 1, r.stderr);
  }
}));

test('file hashing refuses replaced paths, changed FDs, short reads and late EOF', () => {
  const r = runPython(`
import importlib.util,sys,stat,json
from types import SimpleNamespace
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('inv',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
st=SimpleNamespace(st_dev=1,st_ino=1,st_mode=stat.S_IFREG|0o644,st_uid=0,st_gid=0,st_size=1,st_mtime_ns=1,st_ctime_ns=1)
other=SimpleNamespace(**{**vars(st),'st_ino':2})
passed=[]
for mode in ['good','fd-replaced','path-replaced','short','late-eof','unreadable']:
    t={'v':0};args=m.parse_args([]);limits=m.Limits(args,lambda:t['v']);chunks=[b'x',b''] if mode!='short' else [b'']
    def read(fd,n):
        chunk=chunks.pop(0)
        if mode=='late-eof' and not chunk:t['v']=121
        return chunk
    with patch.object(m,'_safe_path'),patch.object(m,'_is_link',return_value=False),patch.object(m.os,'open',side_effect=OSError('synthetic denied') if mode=='unreadable' else None,return_value=123),patch.object(m.os,'close'),patch.object(m.os,'fstat',return_value=other if mode=='fd-replaced' else st),patch.object(m.os,'lstat',return_value=other if mode=='path-replaced' else st),patch.object(m.os,'read',side_effect=read):
        try:value=m.sha256_file('/fake/file',st,limits,512,'/fake');ok=True
        except (OSError,m._Bound):ok=False
    passed.append(ok if mode=='good' else not ok)
print(json.dumps(passed));sys.exit(0 if all(passed) else 1)
`);
  assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), [true, true, true, true, true, true]);
});

test('compiled production roots cover usr aliases and root/home; binary pins stay exact', () => {
  const r = runPython(`import importlib.util,sys,json\ns=importlib.util.spec_from_file_location('i',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps({'roots':m.REQUIRED_ROOTS,'aliases':m.ROOT_ALIASES,'pins':m.PINNED_FILES}))`);
  assert.equal(r.status, 0); const p = JSON.parse(r.stdout);
  for (const root of ['/bin', '/sbin', '/lib', '/lib64', '/root', '/home']) assert.ok(p.roots.includes(root));
  assert.equal(Object.keys(p.pins).length, 4);
  assert.equal(p.pins['/opt/meri-browsers/chromium-1247/chrome-linux64/chrome'].sha256, 'adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0');
});

test('production output is mandatory and cannot exclude an arbitrary scanned file', () => {
  const r = runPython(`
import importlib.util,sys,json
from unittest.mock import patch
s=importlib.util.spec_from_file_location('i',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
root=m.REQUIRED_ROOTS[0];facts=[]
for out in [None,'/usr/bin/java']:
    args=m.parse_args(['--root',root]+(['--out',out] if out else []))
    with patch.object(m,'walk_root') as walk:
        manifest,code=m._inventory(args,platform='linux',required_roots=[root],pins={})
    facts.append(code==2 and manifest['refused'] and not walk.called)
print(json.dumps(facts))
`);
  assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), [true, true]);
});

// Complete fabricated POSIX ancestor facts; never traverse a Linux filesystem.
const POSIX_FIXTURE = `
import importlib.util,json,posixpath,stat,sys
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('inventory_races',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def st(ino,mode=stat.S_IFDIR|0o755,uid=0,ctime=1,size=0):
    return SimpleNamespace(st_dev=1,st_ino=ino,st_mode=mode,st_uid=uid,st_gid=0,st_size=size,st_mtime_ns=1,st_ctime_ns=ctime)
def run(roots,lstat,walk,islink=lambda p:False,readlink=lambda p:''):
    args=m.parse_args([x for root in roots for x in ('--root',root)]+['--out','/inventory.json'])
    with ExitStack() as stack:
        for obj,name,value in [(m.os,'path',posixpath),(m.os,'sep','/')]: stack.enter_context(patch.object(obj,name,value))
        for obj,name,fn in [(m.os,'lstat',lstat),(m.os,'walk',walk),(m,'_is_link',islink),(m.os,'readlink',readlink)]: stack.enter_context(patch.object(obj,name,side_effect=fn))
        return m._inventory(args,platform='linux',required_roots=roots,pins={},aliases={'/bin':'/usr/bin'} if '/bin' in roots else {},output_path='/inventory.json')
`;

test('reviewed root alias identity and target remain bound through validation and final coverage', () => {
  const r = runPython(POSIX_FIXTURE + `
facts=[]
for scenario in ['stable','replace-during-target-validation','same-inode-target-swap','replace-after-alias-validation','target-identity-after-validation']:
    state={'target':'/usr/bin','aliasIno':10,'targetIno':3,'reads':0,'changed':False}
    def lstat(path):
        if path=='/':return st(1)
        if path=='/bin':return st(state['aliasIno'],stat.S_IFLNK|0o777)
        if path=='/usr':return st(2)
        if path=='/usr/bin':
            state['reads']+=1
            if scenario in ['replace-during-target-validation','same-inode-target-swap'] and not state['changed']:
                state.update(target='/outside',aliasIno=11 if scenario=='replace-during-target-validation' else 10,changed=True)
            return st(state['targetIno'])
        raise AssertionError(path)
    def walk(root,**kwargs):
        assert root=='/usr'
        if scenario=='replace-after-alias-validation':state.update(target='/outside',aliasIno=11)
        if scenario=='target-identity-after-validation':state['targetIno']=4
        yield '/usr',['bin'],[]
        yield '/usr/bin',[],[]
    manifest,code=run(['/bin','/usr'],lstat,walk,lambda p:p=='/bin',lambda p:state['target'])
    passed=code==0 and manifest['ok'] and manifest['coverage']['complete'] if scenario=='stable' else code==1 and not manifest['ok'] and not manifest['coverage']['complete'] and bool(manifest['errors'])
    facts.append({'scenario':scenario,'passed':bool(passed),'code':code})
print(json.dumps(facts));sys.exit(0 if all(f['passed'] for f in facts) else 1)
`);
  assert.equal(r.status, 0, r.stderr + r.stdout); assert.equal(JSON.parse(r.stdout).length, 5);
});

test('recorded child directory mode, inode and ownership are checked again before descent', () => {
  const r = runPython(POSIX_FIXTURE + `
facts=[]
for scenario in ['stable','sgid-before-descent','inode-before-descent','owner-before-descent']:
    state={'mode':0o755,'ino':21,'uid':0,'ctime':1}
    def lstat(path):
        if path=='/':return st(1)
        if path=='/static':return st(20)
        if path=='/static/child':return st(state['ino'],stat.S_IFDIR|state['mode'],state['uid'],state['ctime'])
        raise AssertionError(path)
    def walk(root,**kwargs):
        yield '/static',['child'],[]
        if scenario=='sgid-before-descent':state.update(mode=0o2755,ctime=2)
        if scenario=='inode-before-descent':state.update(ino=22,ctime=2)
        if scenario=='owner-before-descent':state.update(uid=10001,ctime=2)
        yield '/static/child',[],[]
    manifest,code=run(['/static'],lstat,walk)
    passed=code==0 and manifest['ok'] if scenario=='stable' else code==1 and not manifest['ok'] and not manifest['coverage']['complete'] and any('identity changed' in e['error'] for e in manifest['errors'])
    facts.append({'scenario':scenario,'passed':bool(passed),'code':code})
print(json.dumps(facts));sys.exit(0 if all(f['passed'] for f in facts) else 1)
`);
  assert.equal(r.status, 0, r.stderr + r.stdout); assert.equal(JSON.parse(r.stdout).length, 4);
});

test('full ancestors above the declared root stay bound before, during and after traversal', () => {
  const r = runPython(POSIX_FIXTURE + `
facts=[]
for scenario in ['stable','link-after-initial-root-stat','replace-before-walk','replace-after-walk']:
    state={'link':False,'ino':30,'changed':False}
    def lstat(path):
        if path=='/':return st(1)
        if path=='/safe':return st(state['ino'],stat.S_IFLNK|0o777 if state['link'] else stat.S_IFDIR|0o755)
        if path=='/safe/inside':
            if scenario=='link-after-initial-root-stat' and not state['changed']:state.update(link=True,changed=True)
            return st(31)
        raise AssertionError(path)
    def walk(root,**kwargs):
        if scenario=='replace-before-walk':state['ino']=32
        yield '/safe/inside',[],[]
        if scenario=='replace-after-walk':state['ino']=32
    manifest,code=run(['/safe/inside'],lstat,walk,lambda p:p=='/safe' and state['link'])
    passed=code==0 and manifest['ok'] if scenario=='stable' else code==1 and not manifest['ok'] and not manifest['coverage']['complete'] and bool(manifest['errors'])
    facts.append({'scenario':scenario,'passed':bool(passed),'code':code})
print(json.dumps(facts));sys.exit(0 if all(f['passed'] for f in facts) else 1)
`);
  assert.equal(r.status, 0, r.stderr + r.stdout); assert.equal(JSON.parse(r.stdout).length, 4);
});

test('file hashing rechecks the captured full ancestor chain after reading its FD', () => {
  const r = runPython(POSIX_FIXTURE + `
facts=[]
for scenario in ['stable','ancestor-link-after-read','ancestor-inode-after-read']:
    state={'link':False,'ino':30};file=st(40,stat.S_IFREG|0o644,size=1)
    chain={'/':m._identity(st(1)),'/safe':m._identity(st(30)),'/safe/inside':m._identity(st(31))}
    def lstat(path):
        return {'/':st(1),'/safe':st(state['ino']),'/safe/inside':st(31),'/safe/inside/file':file}[path]
    chunks=[b'x',b'']
    def read(fd,n):
        chunk=chunks.pop(0)
        if not chunk and scenario=='ancestor-link-after-read':state['link']=True
        if not chunk and scenario=='ancestor-inode-after-read':state['ino']=32
        return chunk
    with patch.object(m.os,'path',posixpath),patch.object(m.os,'sep','/'),patch.object(m.os,'lstat',side_effect=lstat),patch.object(m,'_is_link',side_effect=lambda p:p=='/safe' and state['link']),patch.object(m.os,'open',return_value=123),patch.object(m.os,'fstat',return_value=file),patch.object(m.os,'read',side_effect=read),patch.object(m.os,'close'):
        try:m.sha256_file('/safe/inside/file',file,m.Limits(m.parse_args([])),512,'/safe/inside',chain);ok=True
        except OSError:ok=False
    facts.append(ok if scenario=='stable' else not ok)
print(json.dumps(facts));sys.exit(0 if all(facts) else 1)
`);
  assert.equal(r.status, 0, r.stderr + r.stdout); assert.deepEqual(JSON.parse(r.stdout), [true, true, true]);
});

test('Linux main admits only the literal output and actually requests mandatory emission', () => {
  const r = runPython(POSIX_FIXTURE + `
facts=[]
for platform,out in [('linux',m.OUTPUT_PATH),('linux','/opt//meri-worker/image-inventory.json'),('linux','/opt/meri-worker/./image-inventory.json'),('win32',m.OUTPUT_PATH)]:
    emitted=[];walked=[]
    def fake_walk(root,excludes,limits,hash_limit,entries,errors,aliases):
        walked.append(root)
        for path,pin in m.PINNED_FILES.items():
            if path.startswith(root+'/'):
                record={'path':path,'type':'file','mode':'0755','uid':0,'gid':0,'size':0,**pin}
                limits.add(record,entry=True);entries.append(record)
    cli=[x for root in m.REQUIRED_ROOTS for x in ('--root',root)]+[x for path,pin in m.PINNED_FILES.items() if pin.get('mode')=='4755' for x in ('--allow-suid',path)]+['--out',out]
    with patch.object(m.os,'path',posixpath),patch.object(m.os,'sep','/'),patch.object(m.sys,'platform',platform),patch.object(m,'walk_root',side_effect=fake_walk),patch.object(m,'emit',side_effect=lambda manifest,target:emitted.append((manifest,target))):
        code=m.main(cli)
    if platform=='win32':passed=code==3 and not walked and emitted[0][1] is None
    elif out!=m.OUTPUT_PATH:passed=code==2 and not walked and emitted[0][0]['refused'] and emitted[0][1] is None
    else:passed=code==0 and emitted[0][0]['ok'] and emitted[0][1]==m.OUTPUT_PATH and set(walked)==set(m.REQUIRED_ROOTS)
    facts.append({'platform':platform,'out':out,'passed':bool(passed),'code':code,'emitOut':emitted[0][1]})
print(json.dumps(facts));sys.exit(0 if all(f['passed'] for f in facts) else 1)
`);
  assert.equal(r.status, 0, r.stderr + r.stdout); assert.equal(JSON.parse(r.stdout).length, 4);
});
