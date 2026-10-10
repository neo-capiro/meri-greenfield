// Offline compiler/definition regressions only. No AWS, credentials, provider,
// SDK query, native process, registration or execution authority is created.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixturePins } from './test-native-enforcement.mjs';
import {
  buildNativeEnforcementAdmission as compile,
  buildNativeEnforcementStateMachine as definition,
  buildNativeEnforcementTemplate as template,
  ROLE_PINS,
} from '../infra/native-enforcement/app.mjs';
import { validateTaskDefinition } from '../infra/native-enforcement/lib/task-definition.mjs';

function rolelessPins() {
  const pins = fixturePins();
  pins.workerRoleArn = null;
  for (const kind of ['sdk', 'office']) delete pins.taskDefinitionPins[kind].taskRoleArn;
  return pins;
}

function expected(pins, kind) {
  return {
    arn: pins.taskDefinitionArns[kind],
    family: `meri-greenfield-qualification-${kind}`,
    revision: Number(pins.taskDefinitionArns[kind].split(':').at(-1)),
    image: pins.image,
    logGroup: pins.logGroup,
    region: pins.region,
    executionRoleArn: pins.executionRoleArn,
    workerRoleArn: pins.workerRoleArn,
    probeKind: kind,
    command: `/opt/meri-worker/probes/${kind === 'sdk' ? 'sdk-capture' : 'office-export'}.mjs`,
  };
}

test('explicit role-free native pins retain absent roles and remain synthetic/inert', () => {
  const pins = rolelessPins();
  const before = JSON.stringify(pins);
  for (const kind of ['sdk', 'office']) {
    assert.equal(validateTaskDefinition(pins.taskDefinitionPins[kind], expected(pins, kind)), true);
  }
  const binding = compile({ staticPins: pins, executeAdmitted: true });
  assert.equal(binding.runtimeEnabled, false);
  assert.equal(binding.pins.workerRoleArn, null);
  for (const kind of ['sdk', 'office']) {
    assert.equal(Object.hasOwn(binding.pins.taskDefinitionPins[kind], 'taskRoleArn'), false);
  }
  assert.equal(JSON.stringify(pins), before, 'caller input stays unchanged');
  assert.match(definition(binding).States.GuardInput.Choices[0].Condition, /^\{% false and/);
});

for (const kind of ['sdk', 'office']) {
  for (const [label, value] of [
    ['historical empty-policy role', ROLE_PINS.worker],
    ['foreign role', 'arn:aws:iam::111111111111:role/foreign'],
    ['other same-account role', 'arn:aws:iam::967807252336:role/unreviewed'],
    ['null role field', null],
    ['undefined role field', undefined],
    ['empty role field', ''],
  ]) {
    test(`role-free ${kind} rejects an actual ${label}`, () => {
      const pins = rolelessPins();
      pins.taskDefinitionPins[kind].taskRoleArn = value;
      assert.throws(() => compile({ staticPins: pins }), /definition roles\/networkMode/);
    });
  }
  test(`role-free ${kind} rejects an inherited role field`, () => {
    const pins = rolelessPins();
    const record = pins.taskDefinitionPins[kind];
    Object.setPrototypeOf(record, { taskRoleArn: ROLE_PINS.worker });
    assert.throws(() => validateTaskDefinition(record, expected(pins, kind)), /definition roles\/networkMode/);
  });
}

for (const [label, value] of [
  ['undefined', undefined], ['empty string', ''], ['false', false],
  ['foreign ARN', 'arn:aws:iam::111111111111:role/foreign'],
  ['other same-account ARN', 'arn:aws:iam::967807252336:role/unreviewed'],
]) {
  test(`native compiler rejects ${label} worker-role selector`, () => {
    const pins = rolelessPins();
    pins.workerRoleArn = value;
    assert.throws(() => compile({ staticPins: pins }), /exact retained worker\/execution roles/);
  });
}

test('missing selector is not an implicit role-free admission', () => {
  const pins = rolelessPins();
  delete pins.workerRoleArn;
  assert.throws(() => compile({ staticPins: pins }), /exact static schema/);
});

test('legacy role-bearing records still require their exact role', () => {
  const pins = fixturePins();
  assert.equal(compile({ staticPins: pins }).pins.workerRoleArn, ROLE_PINS.worker);
  for (const kind of ['sdk', 'office']) {
    const altered = fixturePins();
    delete altered.taskDefinitionPins[kind].taskRoleArn;
    assert.throws(() => compile({ staticPins: altered }), /definition roles\/networkMode/);
  }
});

test('role-free selector does not permit execution-role or other security drift', () => {
  for (const mutate of [
    pins => { pins.executionRoleArn = null; },
    pins => { pins.executionRoleArn = 'arn:aws:iam::967807252336:role/unreviewed'; },
    pins => { pins.taskDefinitionPins.sdk.executionRoleArn = null; },
    pins => { pins.taskDefinitionPins.office.containerDefinitions[0].readonlyRootFilesystem = false; },
    pins => { pins.taskDefinitionPins.sdk.containerDefinitions[0].environment.push({ name: 'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI', value: '/synthetic' }); },
    pins => { pins.network.securityGroupId = 'sg-00000000000000000'; },
  ]) {
    const pins = rolelessPins();
    mutate(pins);
    assert.throws(() => compile({ staticPins: pins }));
  }
});

test('role-free PassRole contains only execution role; every other policy statement is unchanged', () => {
  const roleless = template(compile({ staticPins: rolelessPins() }));
  const legacy = template(compile({ staticPins: fixturePins() }));
  const statements = value => value.Resources.NativeEnforcementRole.Properties.Policies[0].PolicyDocument.Statement;
  assert.deepEqual(statements(roleless).find(s => s.Action === 'iam:PassRole').Resource, [ROLE_PINS.execution]);
  assert.deepEqual(statements(legacy).find(s => s.Action === 'iam:PassRole').Resource, [ROLE_PINS.execution, ROLE_PINS.worker]);
  assert.deepEqual(statements(roleless).filter(s => s.Action !== 'iam:PassRole'), statements(legacy).filter(s => s.Action !== 'iam:PassRole'));
  assert.deepEqual(roleless.Resources.NativeEnforcementRole.Properties.AssumeRolePolicyDocument, legacy.Resources.NativeEnforcementRole.Properties.AssumeRolePolicyDocument);
  assert.equal(JSON.stringify(statements(roleless)).includes('null'), false);
  assert.deepEqual(roleless.Resources.NativeEnforcementMachine.Properties.Definition.States.RunTask.Arguments,
    legacy.Resources.NativeEnforcementMachine.Properties.Definition.States.RunTask.Arguments);
});

test('legacy role getters keep actual-before-expected order, once each, before network', () => {
  const pins = fixturePins();
  const record = pins.taskDefinitionPins.sdk;
  const expectation = expected(pins, 'sdk');
  const seen = [];
  Object.defineProperty(record, 'taskRoleArn', { get() { seen.push('actual'); return ROLE_PINS.worker; }, enumerable: true });
  Object.defineProperty(expectation, 'workerRoleArn', { get() { seen.push('expected'); return ROLE_PINS.worker; }, enumerable: true });
  Object.defineProperty(record, 'networkMode', { get() { seen.push('network'); return 'awsvpc'; }, enumerable: true });
  assert.equal(validateTaskDefinition(record, expectation), true);
  assert.deepEqual(seen, ['actual', 'expected', 'network']);
});
