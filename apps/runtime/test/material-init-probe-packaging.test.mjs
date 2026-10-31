import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {imageProbeControlFixture} from '../build/material-init-probe-fixture.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';

test('packaged probe input equals the canonical synthetic configuration without sharing mutable state', () => {
  const first = imageProbeControlFixture();
  assert.deepEqual(first, agentcoreControlFixture());
  first.configuration.models.models[0].available = false;
  assert.deepEqual(imageProbeControlFixture(), agentcoreControlFixture());
});

test('actual probe module and all three role fixtures load with test directories excluded', t => {
  const helper = new URL('../build/material-init-image-probe.mjs', import.meta.url).href;
  const excluded = new URL('./agentcore-fixture.mjs', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    const seen = new Set();
    registerHooks({resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context);
      if (result.url.startsWith('file:')) {
        const path = new URL(result.url).pathname;
        if (/(?:^|\\/)(?:test|tests)(?:\\/|$)/.test(path)) throw Error('PROBE_TEST_DIRECTORY_EXCLUDED');
        seen.add(result.url);
      }
      return result;
    }});
    await assert.rejects(import(${JSON.stringify(excluded)}), /PROBE_TEST_DIRECTORY_EXCLUDED/);
    const probe = await import(${JSON.stringify(helper)});
    const counts = [];
    for (const [role, count] of [['control', 7], ['temporal-worker', 5], ['schedule-worker', 7]]) {
      const fixture = probe.roleFixture(role);
      assert.equal(fixture.plan.role, role);
      assert.equal(fixture.plan.requiredFiles.length, count);
      assert.equal(fixture.bundle.files.length, count);
      counts.push({role, count});
    }
    assert.ok(seen.size > 1);
    console.log(JSON.stringify({counts, resolvedModules: seen.size, testDirectoriesExcluded: true}));
  `;
  const child = spawnSync(process.execPath, [...process.execArgv, '--input-type=module', '-e', script],
    {encoding: 'utf8', timeout: 30000, env: process.env});
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const result = JSON.parse(child.stdout);
  assert.equal(result.testDirectoriesExcluded, true);
  assert.deepEqual(result.counts.map(row => row.count), [7, 5, 7]);
  t.diagnostic(child.stdout.trim());
});
