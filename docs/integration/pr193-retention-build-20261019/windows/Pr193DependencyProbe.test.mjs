import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {OWNERS, classifyImportError} from './Pr193DependencyProbe.mjs';

const temporary = mkdtempSync(join(tmpdir(), 'pr193-public-dependency-'));
const source = join(temporary, 'source with spaces');
const write = (path, text) => { mkdirSync(resolve(path, '..'), {recursive: true}); writeFileSync(path, text); };
const declarations = {
  ROOT: {ajv: '8.20.0', 'ajv-formats': '3.0.1', canonicalize: '5.1.0', 'aws-cdk-lib': '2.273.0'},
  RUNTIME: {'@aws-sdk/client-ecs': '3.1151.0'}, CONVERSATION: {'@anthropic-ai/claude-agent-sdk': '0.3.295', zod: '4.6.7'},
  CONTROL_CONVERSATIONS: {'@temporalio/client': '1.24.0'}, QUALIFICATION: {'@capiro/meri-contracts': 'file:vendor/public.tgz'},
  ARTIFACT_STORAGE: {'@aws-sdk/client-s3': '3.1141.0'},
};
for (const [owner, prefix] of Object.entries(OWNERS)) {
  const manifest = {name: 'public-fixture', dependencies: declarations[owner]};
  write(join(source, prefix, 'package.json'), JSON.stringify(manifest));
  write(join(source, prefix, 'package-lock.json'), JSON.stringify({lockfileVersion: 3, packages: {'': manifest}}));
}
after(() => {
  assert.ok(relative(tmpdir(), temporary).startsWith('pr193-public-dependency-'));
  rmSync(temporary, {recursive: true, force: true});
});
const esm = (name, importer) => Object.assign(new Error(`Cannot find package '${name}' imported from ${importer}`), {code: 'ERR_MODULE_NOT_FOUND'});
const cases = [
  ['contracts shared root', 'ajv', 'packages/contracts/validate.mjs', 'ROOT'],
  ['runtime root declaration', 'canonicalize', 'apps/runtime/native-authority/config.mjs', 'ROOT'],
  ['worker root declaration', 'ajv-formats', 'apps/worker/conversation/continuation/options.mjs', 'ROOT'],
  ['infra root declaration', 'aws-cdk-lib', 'infra/product-preview/manifest.mjs', 'ROOT'],
  ['qualification vendor declaration', '@capiro/meri-contracts', 'apps/worker/qualification/checkpoint/bound-session-store.mjs', 'QUALIFICATION'],
  ['runtime owner', '@aws-sdk/client-ecs', 'apps/runtime/native-authority/proof.mjs', 'RUNTIME'],
  ['worker owner', '@anthropic-ai/claude-agent-sdk', 'apps/worker/conversation/agent-sdk.mjs', 'CONVERSATION'],
  ['control owner', '@temporalio/client', 'apps/control/conversations/dispatch.mjs', 'CONTROL_CONVERSATIONS'],
  ['storage owner', '@aws-sdk/client-s3', 'apps/artifacts/storage/s3-sdk.mjs', 'ARTIFACT_STORAGE'],
];
for (const [name, dependency, importerRelative, owner] of cases) {
  test(name + ': native and file URL', () => {
    const importer = join(source, importerRelative); write(importer, '// public fixture');
    for (const parent of [importer, pathToFileURL(importer).href]) {
      assert.deepEqual(classifyImportError(esm(dependency, parent), source),
        {schemaVersion: 1, status: 'MISSING', category: 'ESM_MODULE_MISSING', owner, package: dependency});
    }
  });
}
test('outside source and misleading prefix refuse without path disclosure', () => {
  const outside = join(temporary, 'outside/apps/runtime/file.mjs'); write(outside, '');
  assert.equal(classifyImportError(esm('@aws-sdk/client-ecs', outside), source).reason, 'IMPORTER_OUTSIDE_SOURCE');
  const misleading = join(source, 'other/apps/runtime/file.mjs'); write(misleading, '');
  assert.equal(classifyImportError(esm('@aws-sdk/client-ecs', misleading), source).reason, 'MISSING_OWNER_UNMAPPED');
});
test('transitive CJS package uses an exact enclosing lock entry', () => {
  const lockPath = join(source, 'package-lock.json'), original = readFileSync(lockPath, 'utf8');
  const lock = JSON.parse(original); lock.packages['node_modules/public-host'] = {dependencies: {'public-child': '1.0.0'}};
  write(lockPath, JSON.stringify(lock));
  const importer = join(source, 'node_modules/public-host/lib/index.cjs'); write(importer, '');
  try {
    const error = Object.assign(new Error("Cannot find module 'public-child'\nRequire stack:\nPUBLIC_CANARY"), {code: 'MODULE_NOT_FOUND', requireStack: [importer]});
    const result = classifyImportError(error, source);
    assert.equal(result.owner, 'ROOT'); assert.equal(result.category, 'CJS_MODULE_MISSING');
    assert.ok(!JSON.stringify(result).includes('PUBLIC_CANARY'));
    error.message = "Cannot find module 'undeclared'";
    assert.equal(classifyImportError(error, source).reason, 'TRANSITIVE_PACKAGE_UNDECLARED');
  } finally { write(lockPath, original); }
});
test('lock disagreement and non-module errors fail with fixed reasons', () => {
  const lockPath = join(source, 'apps/runtime/package-lock.json'), original = readFileSync(lockPath, 'utf8');
  const lock = JSON.parse(original); lock.packages[''].dependencies['@aws-sdk/client-ecs'] = 'wrong'; write(lockPath, JSON.stringify(lock));
  try { assert.equal(classifyImportError(esm('@aws-sdk/client-ecs', join(source, 'apps/runtime/native-authority/proof.mjs')), source).reason, 'OWNER_LOCK_UNVERIFIED'); }
  finally { write(lockPath, original); }
  for (const [code, reason] of [['ERR_DLOPEN_FAILED', 'NATIVE_IMPORT_FAILURE'], ['ERR_PACKAGE_PATH_NOT_EXPORTED', 'PACKAGE_EXPORTS_REFUSED'], ['OTHER_CANARY', 'IMPORT_OTHER_REFUSED']]) {
    const result = classifyImportError(Object.assign(new Error('PRIVATE_CANARY'), {code}), source);
    assert.equal(result.reason, reason); assert.ok(!JSON.stringify(result).includes('CANARY'));
  }
});
test('actual helper entry imports both canonical guard fixtures without invoking their CLI', () => {
  const guard = 'import{resolve}from"node:path";import{pathToFileURL}from"node:url";if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){process.stdout.write("CLI_EXECUTED");process.exitCode=73;}';
  for (const file of ['render-material.mjs', 'stage3-deploy.mjs']) write(join(source, 'infra/product-preview/first-chat', file), guard);
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./Pr193DependencyProbe.mjs', import.meta.url)), '--source', source], {encoding: 'utf8', timeout: 30000});
  assert.equal(child.status, 0); assert.deepEqual(JSON.parse(child.stdout), {schemaVersion: 1, status: 'READY'});
});
