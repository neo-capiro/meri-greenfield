// Local contract characterization only: no child CLI, service, provider or database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root, 'explicit source root required');
const require = createRequire(`${root}/packages/contracts/validate.mjs`);
const baselineSha = 'd17eb537372056910fdde3deca583f29d15173da';
let baselineSource = execFileSync('git', ['show', `${baselineSha}:packages/contracts/validate.mjs`], { cwd: root, encoding: 'utf8' });
for (const dependency of ['ajv/dist/2020.js', 'ajv-formats', 'canonicalize']) {
  baselineSource = baselineSource.replace(`from '${dependency}'`, `from '${pathToFileURL(require.resolve(dependency)).href}'`);
}
baselineSource = baselineSource.replace("new URL('./meri.schema.json', import.meta.url)", `new URL('${pathToFileURL(`${root}/packages/contracts/meri.schema.json`).href}')`);
const baseline = await import(`data:text/javascript;base64,${Buffer.from(baselineSource).toString('base64')}`);
const current = await import(pathToFileURL(`${root}/packages/contracts/validate.mjs`).href);
const schema = JSON.parse(readFileSync(`${root}/packages/contracts/meri.schema.json`, 'utf8'));
function outcome(module, name, value) {
  try { return { accepted: true, identityPreserved: module.validateShape(name, value) === value }; }
  catch (error) { return { accepted: false, name: error.name, message: error.message }; }
}

test('all 28 canonical public definitions retain exact rejection messages on first and cached use', () => {
  assert.equal(Object.keys(schema.$defs).length, 28);
  const values = [null, false, true, 0, -1, Number.MAX_SAFE_INTEGER + 1, '', '0.1.0', [], [{}], {}, { admin: true }, { contractVersion: '0.2.0' }, { sequence: 0 }];
  for (const name of Object.keys(schema.$defs)) {
    for (let iteration = 0; iteration < 2; iteration++) {
      for (const value of values) assert.deepEqual(outcome(current, name, value), outcome(baseline, name, value), `${name} iteration ${iteration}`);
    }
  }
});

test('unknown public names retain exact errors without prototype or private namespace fallback', () => {
  for (const name of ['Unknown', 'constructor', '__proto__', 'toString', 'Intent', '', null, 1]) {
    assert.deepEqual(outcome(current, name, {}), outcome(baseline, name, {}));
    assert.equal(outcome(current, name, {}).accepted, false);
  }
  assert.equal(current.contractVersion, baseline.contractVersion);
  assert.deepEqual(Object.keys(current).sort(), Object.keys(baseline).sort());
});
