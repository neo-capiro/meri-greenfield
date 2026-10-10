// Owner invocation only: derive fresh read-only requests from the accepted planner.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { composeFixedBinding } from '../native-teststate/binding.mjs';
import { buildRequestPlan, CASES, SEED_SCHEMA } from '../native-teststate/requests.mjs';

const [outputArgument] = process.argv.slice(2);
if (!outputArgument || process.argv.length !== 3) throw Error('usage: prepare-readonly-wire.mjs <new-output-directory>');
const output = resolve(outputArgument);
const ownerInputs = resolve('.task-inputs/W02-18-owner-inputs');
const composed = await composeFixedBinding({
  staticPinsBytes: readFileSync(join(ownerInputs, 'static-pins.json')),
  graphBytes: readFileSync(join(ownerInputs, 'definition.json')),
});
if (!composed.ok) throw Error(composed.reason);
mkdirSync(output, { recursive: false });
const t0Ms = Date.now();
// Read-only cases retain the accepted graph's fixed synthetic run binding.
const runUuid = composed.binding.pins.runUuid;
for (const caseName of CASES) {
  const seed = { schemaVersion: SEED_SCHEMA, case: caseName, wireCaptureId: randomUUID(),
    runUuid, t0Ms, planningTimeMs: Date.now() };
  const seedBytes = Buffer.from(JSON.stringify(seed));
  const result = buildRequestPlan({ binding: composed.binding, seedBytes });
  if (!result.ok) throw Error(result.reason);
  for (const [suffix, bytes] of [['seed', seedBytes], ['request', result.plan.requestBytes],
    ['plan', JSON.stringify(result.plan, null, 2)]]) {
    writeFileSync(join(output, `${caseName}-${suffix}.json`), bytes, { flag: 'wx' });
  }
}
console.log(JSON.stringify({ status: 'READ_ONLY_REQUESTS_PREPARED_NOT_EXECUTED', runUuid, t0Ms, output }));
