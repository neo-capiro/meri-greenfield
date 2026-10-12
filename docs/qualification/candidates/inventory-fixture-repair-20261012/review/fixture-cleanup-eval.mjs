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

const PROBE = "/workspace/meri-inventory-fixture-review-20261012/apps/worker/qualification/probes/image-inventory.py";
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


import { existsSync } from 'node:fs';
let owned;
assert.throws(() => fixture((dir) => { owned=dir; write(dir, 'nested/file', 'synthetic'); throw new Error('intentional reviewer assertion'); }), /intentional reviewer assertion/);
assert.equal(existsSync(owned), false);
console.log(JSON.stringify({cleanupAfterThrownAssertion:true}));
