/** Clean-checkout procedure refusals and lock coverage; nothing is installed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {globSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./clean-checkout.sh',import.meta.url)),root=fileURLToPath(new URL('../../..',import.meta.url));
test('missing --out is a usage refusal before any install',()=>{
 const r=spawnSync('bash',[script],{encoding:'utf8'});assert.equal(r.status,2);assert.match(r.stderr,/usage: clean-checkout\.sh --out DIR/u);
});
test('receipts inside the checkout are a usage refusal before any install',()=>{
 const r=spawnSync('bash',[script,'--out',root+'/receipts'],{encoding:'utf8'});assert.equal(r.status,2);assert.match(r.stderr,/--out must be outside the checkout/u);assert.doesNotMatch(r.stderr,/npm ci/u);
});
test('the procedure installs exactly the repository package locks, contracts before ui-stream and the root before the packages',()=>{
 const locks=/^LOCKS=\(([^)]*)\)/mu.exec(readFileSync(script,'utf8'))[1].split(/\s+/u).filter(Boolean);
 const found=globSync('**/package-lock.json',{cwd:root,exclude:p=>/(^|\/)node_modules$/u.test(p)}).filter(p=>!/(^|\/)(node_modules|evidence)\//u.test(p)).map(dirname);
 assert.deepEqual([...locks].sort(),found.sort());assert.equal(new Set(locks).size,locks.length);
 assert.deepEqual(locks.slice(0,2),['packages/contracts','.']);assert.ok(locks.indexOf('packages/ui-stream')>1);
});
