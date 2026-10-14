import test from 'node:test';
import assert from 'node:assert/strict';
import {loaderCauses,mountSummary,swcDiagnostic} from '../../../apps/runtime/build/swc-diagnostic.mjs';
import {fileURLToPath} from 'node:url';

test('nested native errors retain codes/symptoms without raw secrets or paths',()=>{
  const secret='SENSITIVE_PAYLOAD_SENTINEL';
  const missing=Object.assign(Error('Cannot find module ./swc.linux-x64-gnu.node '+secret),{code:'MODULE_NOT_FOUND'});
  const cache=Object.assign(Error('user cache failed: noexec; fallback cache failed: read-only '+secret),{code:'ERR_SWC_NATIVE_CACHE'});
  const error=Error('Failed to load native binding '+secret,{cause:[missing,cache]});
  const rows=loaderCauses(error),serialized=JSON.stringify(rows);
  assert.equal(rows[1].code,'MODULE_NOT_FOUND');assert.deepEqual(rows[1].classes,['missing-module']);
  assert.deepEqual(rows[2].classes,['cache-materialization','noexec-mount','read-only']);
  assert.ok(!serialized.includes(secret)&&!serialized.includes('/swc'));
  error.cause.push(error);assert.ok(loaderCauses(error).length<=8);
});
test('mount reporting includes only relevant targets, type and safe flags',()=>{
  const rows=mountSummary('40 30 0:1 / / rw,relatime - overlay PRIVATE_HOST_SOURCE rw,lowerdir=SECRET\n41 40 0:2 / /tmp rw,nosuid,nodev,noexec - tmpfs PRIVATE_SOURCE rw,size=SECRET\n42 40 0:3 / /private rw - ext4 SECRET rw\n');
  assert.deepEqual(rows,[{target:'/',flags:['rw'],type:'overlay'},{target:'/tmp',flags:['rw','nosuid','nodev','noexec'],type:'tmpfs'}]);
  assert.ok(!JSON.stringify(rows).includes('SECRET'));
});
test('real pinned dependency inventory is owner-anchored and makes no root-cause claim',()=>{
  const root=fileURLToPath(new URL('../../../',import.meta.url));
  const report=swcDiagnostic(root,Error('Failed to load native binding'));
  assert.equal(report.rootCause,'unestablished');
  const core=report.inventory.find(row=>row.package==='@swc/core');
  assert.equal(core.resolved,true);assert.equal(core.version,'1.16.18');assert.equal(core.imageContained,true);
  assert.deepEqual(Object.keys(report.cacheConfiguration).sort(),['custom','homeUnderTmp','securitySkip','xdg']);
});
