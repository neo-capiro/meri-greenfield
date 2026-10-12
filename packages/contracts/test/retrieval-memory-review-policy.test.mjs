import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { memoryReviewPolicy as policy, memoryReviewPolicyText as wording } from '../retrieval-0.2/memory-review-policy.mjs';

test('policy is a private description without live admission or authorization output', () => {
  assert.equal(policy.kind, 'policy_description');
  assert.equal(policy.runtimeQualification, 'unqualified');
  assert.equal(policy.source.ref, 'fd8765ec01d292013758606204f2c9d886cd31c1');
  assert.equal(Object.hasOwn(policy, 'authorize'), false);
  assert.equal(Object.hasOwn(policy, 'allowed'), false);
});

test('only the two established administrator roles appear in the shared approval exception', () => {
  for (const scope of ['firm', 'client']) {
    const roles = policy.scopes[scope].actions.approve.selfApprovalExceptionRoles;
    assert.deepEqual(roles, ['user_admin', 'capiro_admin']);
    for (const role of ['standard_user', 'client_portal_user', 'admin', 'USER_ADMIN', 'user_admin ', 'capiro-admin', '', null]) {
      assert.equal(roles.includes(role), false, `${scope}: ${role}`);
    }
  }
  assert.deepEqual(policy.scopes.personal.actions.approve.selfApprovalExceptionRoles, []);
});

test('shared proposal wording preserves pending state and the subsequent approval exception', () => {
  for (const scope of ['firm', 'client']) {
    assert.equal(policy.scopes[scope].proposalState, 'pending');
    const text = wording({ scope, action: 'propose' });
    assert.match(text, /pending until approved/);
    assert.match(text, /administrator may subsequently approve their own proposal/);
    assert.match(text, /pending proposal is not approved memory/);
  }
});

test('firm and client approval descriptions preserve different standard-reviewer requirements', () => {
  assert.equal(policy.scopes.firm.actions.approve.otherReviewerRequirement, 'administrator');
  assert.match(wording({ scope: 'firm', action: 'approve' }), /grant alone does not authorize firm approval/);
  const text = wording({ scope: 'client', action: 'approve' });
  assert.match(text, /Standard reviewers/);
  assert.match(text, /different person from the proposer/);
  assert.match(text, /grant and review assignment/);
  assert.match(text, /Missing, expired or revoked grants/);
});

test('administrator self-approval never promises self-rejection or withdrawal of another proposal', () => {
  for (const scope of ['firm', 'client']) {
    assert.equal(policy.scopes[scope].actions.reject.proposerRoute, 'withdraw');
    assert.match(wording({ scope, action: 'reject' }), /cannot use reviewer rejection on their own shared/);
    assert.match(wording({ scope, action: 'reject' }), /including an administrator/);
    assert.equal(policy.scopes[scope].actions.withdraw.requiredRelationship, 'proposer');
    assert.match(wording({ scope, action: 'withdraw' }), /does not authorize withdrawing another person/);
  }
});

test('administrators retain current actor, tenant, wall, client and database obligations', () => {
  for (const scope of ['firm', 'client']) {
    const text = wording({ scope, action: 'approve' });
    assert.match(text, /current actor, effective role and tenant, including impersonation context/);
    assert.match(text, /Caller-supplied role or identity is not authority/);
    assert.match(text, /client status and ethical-wall checks still apply to administrators/);
    assert.match(text, /transaction-local capability/);
    assert.match(text, /authorized administrator need not be assigned as reviewer/);
    assert.match(text, /grants no permission and proves no live check/);
  }
});

test('personal ownership and automated proposal descriptions do not inherit shared privileges', () => {
  assert.equal(policy.scopes.personal.producerScope, 'user_private');
  assert.equal(policy.scopes.personal.proposalState, 'source_flow_dependent');
  assert.deepEqual(policy.scopes.personal.automatedSourceKinds, ['model_extraction', 'learning_signal']);
  assert.equal(policy.scopes.personal.automatedSourceKinds.includes('automation'), false);
  for (const action of ['propose', 'approve', 'reject', 'withdraw']) {
    assert.match(wording({ scope: 'personal', action }), /does not confer access to another user’s private memory/);
  }
  assert.match(wording({ scope: 'personal', action: 'reject' }), /not apply the shared proposer rejection rule as a universal prohibition/);
});

test('wording is derived only from the canonical descriptor and every requirement resolves', () => {
  for (const [scope, entry] of Object.entries(policy.scopes)) {
    for (const [action, description] of Object.entries(entry.actions)) {
      const text = wording({ scope, action });
      assert.ok(text.startsWith(description.text));
      for (const id of description.requirements) {
        assert.equal(typeof policy.requirements[id], 'string', id);
        assert.ok(text.includes(policy.requirements[id]), id);
      }
      assert.equal(typeof text, 'string');
    }
  }
});

test('unknown scopes/actions and supplied authorization facts cannot select a policy result', () => {
  for (const selection of [null, [], {}, { scope: 'client' }, { scope: 'private', action: 'approve' },
    { scope: 'toString', action: 'approve' }, { scope: 'client', action: 'constructor' },
    { scope: 'client', action: 'approve', role: 'capiro_admin' },
    { scope: 'client', action: 'approve', actorId: 'other' },
    { scope: 'client', action: 'approve', grant: 'active' }]) {
    assert.throws(() => wording(selection), /Invalid memory policy text selection/);
  }
});

test('policy arrays and descriptions cannot be modified by callers', () => {
  assert.throws(() => policy.scopes.client.actions.approve.selfApprovalExceptionRoles.push('admin'), TypeError);
  assert.throws(() => { policy.scopes.firm.actions.approve.text = 'Anyone can approve'; }, TypeError);
  assert.throws(() => { policy.requirements.client_boundary = 'Walls bypassed'; }, TypeError);
});

test('selector getters, proxies, inherited selectors and hidden authority are refused without effects', () => {
  let effects = 0;
  const getter = { get scope() { effects++; return 'client'; }, action: 'approve' };
  const proxy = new Proxy({ scope: 'client', action: 'approve' }, {
    get() { effects++; throw Error('private'); }, ownKeys() { effects++; throw Error('private'); },
    getPrototypeOf() { effects++; throw Error('private'); },
  });
  const hidden = { scope: 'client', action: 'approve' };
  Object.defineProperty(hidden, 'actorRole', { value: 'capiro_admin' });
  const nonenumerable = { scope: 'client' };
  Object.defineProperty(nonenumerable, 'action', { value: 'approve' });
  for (const value of [getter, proxy, hidden, Object.create({ scope: 'client', action: 'approve' }),
    nonenumerable,
    { scope: 'client', action: 'approve', [Symbol('role')]: 'capiro_admin' }]) {
    assert.throws(() => wording(value), /Invalid memory policy text selection/);
  }
  assert.equal(effects, 0);
  const own = Object.assign(Object.create(null), { scope: 'client', action: 'approve' });
  assert.equal(wording(own), wording({ scope: 'client', action: 'approve' }));
});

test('private description imports without configuration, services or persistent process handles', () => {
  const url = new URL('../retrieval-0.2/memory-review-policy.mjs', import.meta.url).href;
  // Child must exit naturally inside the deadline; Node may initialize its stdio resources while importing.
  const code = `const mod = await import(${JSON.stringify(url)}); console.log(JSON.stringify(Object.keys(mod).sort()));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: tmpdir(), env: {}, encoding: 'utf8', timeout: 3000 });
  assert.equal(child.error, undefined); assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), ['memoryReviewPolicy', 'memoryReviewPolicyText']);
});
