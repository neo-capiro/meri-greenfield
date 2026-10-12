import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const candidate = await import(process.env.MEMORY_POLICY_MODULE
  ? pathToFileURL(process.env.MEMORY_POLICY_MODULE)
  : new URL('../../../../../packages/contracts/retrieval-0.2/memory-review-policy.mjs', import.meta.url));
const { memoryReviewPolicy: policy, memoryReviewPolicyText: wording } = candidate;

test('policy is descriptive, private, deeply frozen and exposes no authorization evaluator', () => {
  assert.deepEqual(Object.keys(candidate).sort(), ['memoryReviewPolicy', 'memoryReviewPolicyText']);
  assert.equal(policy.kind, 'policy_description'); assert.equal(policy.runtimeQualification, 'unqualified');
  assert.equal(policy.source.ref, 'fd8765ec01d292013758606204f2c9d886cd31c1');
  const pending = [policy]; while (pending.length) {
    const value = pending.pop(); assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) if (child && typeof child === 'object') pending.push(child);
  }
  assert.throws(() => { policy.runtimeQualification = 'qualified'; }, TypeError);
});

test('only exact administrator roles receive the shared approval exception', () => {
  for (const scope of ['firm', 'client']) {
    assert.equal(policy.scopes[scope].proposalState, 'pending');
    assert.deepEqual(policy.scopes[scope].actions.approve.selfApprovalExceptionRoles, ['user_admin', 'capiro_admin']);
    assert.match(wording({ scope, action: 'approve' }), /own pending proposal|own pending client proposal/);
    assert.match(wording({ scope, action: 'propose' }), /pending until approved/);
  }
  assert.equal(policy.scopes.firm.actions.approve.otherReviewerRequirement, 'administrator');
  assert.match(wording({ scope: 'firm', action: 'approve' }), /grant alone does not authorize firm approval/);
  assert.match(wording({ scope: 'client', action: 'approve' }), /different person from the proposer/);
});

test('shared proposer rejection is distinct from approval and proposer withdrawal', () => {
  for (const scope of ['firm', 'client']) {
    assert.equal(policy.scopes[scope].actions.reject.proposerRoute, 'withdraw');
    assert.match(wording({ scope, action: 'reject' }), /cannot use reviewer rejection.*including an administrator/);
    assert.equal(policy.scopes[scope].actions.withdraw.requiredRelationship, 'proposer');
    assert.match(wording({ scope, action: 'withdraw' }), /does not authorize withdrawing another person/);
  }
});

test('private ownership and recognized automated proposal flows stay separate', () => {
  assert.equal(policy.scopes.personal.producerScope, 'user_private');
  assert.equal(policy.scopes.personal.proposalState, 'source_flow_dependent');
  assert.deepEqual(policy.scopes.personal.automatedSourceKinds, ['model_extraction', 'learning_signal']);
  assert.deepEqual(policy.scopes.personal.actions.approve.selfApprovalExceptionRoles, []);
  assert.match(wording({ scope: 'personal', action: 'propose' }), /require review/);
  assert.match(wording({ scope: 'personal', action: 'reject' }), /private-owner review path/);
  assert.match(wording({ scope: 'personal', action: 'approve' }), /does not confer access to another user/);
});

test('descriptions require current trusted authority, wall checks and existing guards', () => {
  for (const scope of ['firm', 'client', 'personal']) for (const action of ['propose', 'approve', 'reject', 'withdraw']) {
    const text = wording({ scope, action });
    assert.equal(typeof text, 'string'); assert.match(text, /Caller-supplied role or identity is not authority/);
    assert.match(text, /grants no permission and proves no live check/);
  }
  const text = wording({ scope: 'client', action: 'approve' });
  assert.match(text, /ethical-wall checks still apply to administrators/);
  assert.match(text, /Missing, expired or revoked grants/);
  assert.match(text, /transaction-local capability.*active membership/);
});

test('wording explicitly preserves the administrator assignment exception', () => {
  for (const scope of ['firm', 'client']) {
    const text = wording({ scope, action: 'approve' });
    assert.match(text, /administrator[^.]*not[^.]*(?:assign|assignment)|administrator[^.]*(?:without|regardless of)[^.]*assign/i);
  }
});

test('text selection rejects accessors and proxies without invoking them', () => {
  let touched = 0;
  const accessor = { action: 'approve', get scope() { touched++; return 'firm'; } };
  const proxy = new Proxy({}, { get() { touched++; throw Error('private'); }, ownKeys() { touched++; throw Error('private'); },
    getPrototypeOf() { touched++; throw Error('private'); }, getOwnPropertyDescriptor() { touched++; throw Error('private'); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const value of [accessor, proxy, revoked.proxy]) assert.throws(() => wording(value), TypeError);
  assert.equal(touched, 0);
});

test('text selection rejects hidden fields, symbol authority and custom prototypes', () => {
  const hiddenScope = Object.defineProperty({ action: 'approve' }, 'scope', { value: 'firm', enumerable: false });
  const hiddenAction = Object.defineProperty({ scope: 'firm' }, 'action', { value: 'approve', enumerable: false });
  const hiddenAuthority = Object.defineProperty({ scope: 'firm', action: 'approve' }, 'role', { value: 'user_admin' });
  for (const value of [hiddenScope, hiddenAction, hiddenAuthority,
    { scope: 'firm', action: 'approve', [Symbol('authority')]: true }, Object.assign(Object.create({}), { scope: 'firm', action: 'approve' })])
    assert.throws(() => wording(value), TypeError);
});

test('text accepts only closed scope/action fields and never caller authority facts', () => {
  for (const extra of ['role', 'actorId', 'tenantId', 'grant', 'authorized', 'approved'])
    assert.throws(() => wording({ scope: 'firm', action: 'approve', [extra]: true }), TypeError);
  for (const value of [null, [], true, 'firm', {}, { scope: 'firm' }, { scope: 'firm', action: '__proto__' },
    { scope: 'constructor', action: 'approve' }, { scope: 'user_private', action: 'approve' }, { scope: 'firm', action: 'execute' }])
    assert.throws(() => wording(value), TypeError);
  assert.equal(typeof wording(Object.assign(Object.create(null), { scope: 'personal', action: 'propose' })), 'string');
});
