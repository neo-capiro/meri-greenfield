import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import Provider from '../apps/worker/qualification/checkpoint/session-store-eval-provider.mjs';

const config = JSON.parse(readFileSync(new URL('../apps/worker/qualification/checkpoint/promptfooconfig.json', import.meta.url)));
for (const example of config.tests) {
  const result = await new Provider().callApi(example.vars.scenario);
  assert.equal(result.error, undefined);
  for (const check of example.assert) {
    assert.equal(check.type, 'javascript');
    assert.equal(vm.runInNewContext(check.value, { output: result.output }, { timeout: 1000 }), true,
                 example.vars.scenario);
  }
  console.log(JSON.stringify({ scenario: example.vars.scenario, assertions: example.assert.length,
                             pass: true, result: JSON.parse(result.output), cost: result.cost }));
}
console.log(JSON.stringify({ cases: config.tests.length, runner: 'direct Node provider/config assertions; not Promptfoo CLI',
                           sourceOnly: true, sessionStoreQualified: false }));
