import test from 'node:test';
import assert from 'node:assert/strict';
import {createMailHttpAdapter} from '../http-adapter.mjs';
import {createMailReadHandler} from '../handler.mjs';
import {createMailFixture, uuid} from './fixtures.mjs';

for (const id of ['mail.list_messages', 'mail.search_messages', 'mail.read_thread']) {
  test(`${id}: handler preserves the captured ordinary method's WeakMap receiver`, async () => {
    const f = createMailFixture(id), state = new WeakMap();
    const adapter = {async read(call) {
      const pageFactory = state.get(this);
      assert.equal(typeof pageFactory, 'function');
      assert.deepEqual(call.input, f.input()); assert.deepEqual(call.request, f.args);
      return pageFactory(call.input, call.authority);
    }};
    state.set(adapter, f.page);
    const handler = createMailReadHandler({operation: f.operation, adapter, now: () => f.state.now});
    // Replacing the property cannot replace the admitted method or its receiver.
    adapter.read = () => {throw Error('replacement must not be used');};
    assert.deepEqual(JSON.parse(await handler(f.call())), f.page());
  });
}

// Retired claims/decisions are now closed-field failures. Current correlation
// still binds actor, tenant, policy and scopes without recreating those grants.
const corruptions = [
  ['retiredClaims', a => a.claims = {audience: 'meri-broker', actions: ['command.execute']}, 'INVALID_ARGUMENTS'],
  ['retiredDecision', a => a.decision = {decision: 'allowed'}, 'INVALID_ARGUMENTS'],
  ['retiredSubjectDecision', a => a.subject.authorizationDecisionId = uuid('f'), 'ACCESS_DENIED'],
  ['bindingTenant', a => a.binding.tenantId = 'foreign-tenant', 'ACCESS_DENIED'],
  ['bindingActor', a => a.binding.actorId = 'foreign-actor', 'ACCESS_DENIED'],
  ['subjectActor', a => a.subject.entityIds[0] = 'foreign-actor', 'ACCESS_DENIED'],
  ['policy', a => a.policyRevision = 'foreign-policy', 'ACCESS_DENIED'],
  ['subjectScopesMissing', a => delete a.subject.scopes, 'ACCESS_DENIED'],
  ['subjectScopesSubstituted', a => a.subject.scopes[0] = {...a.subject.scopes[0], resourceId: uuid('f')}, 'ACCESS_DENIED'],
  ['executionMissing', a => delete a.executionSha256, 'INVALID_ARGUMENTS'],
  ['executionDigest', a => a.executionSha256 = 'not-a-digest', 'ACCESS_DENIED'],
  ['scopesMissing', a => delete a.scopes, 'INVALID_ARGUMENTS'],
  ['scopesEmpty', a => a.scopes = [], 'ACCESS_DENIED'],
  ['scopesDuplicate', a => a.scopes.push(structuredClone(a.scopes[0])), 'ACCESS_DENIED'],
  ['scopeTenant', a => a.scopes = [{...a.scopes[0], tenantId: 'foreign-tenant'}], 'ACCESS_DENIED'],
  ['scopePolicy', a => a.scopes = [{...a.scopes[0], policyRevision: 'foreign-policy'}], 'ACCESS_DENIED'],
  ['source', a => a.sourceIds = ['foreign'], 'ACCESS_DENIED'],
  ['expired', a => a.deadlineMs = 0, 'DEADLINE'],
  ['outputBudgetEmpty', a => a.maxOutputBytes = 0, 'ACCESS_DENIED'],
  ['outputBudgetOversized', a => a.maxOutputBytes = 16777217, 'ACCESS_DENIED'],
  ['authorityExtraField', a => a.enabled = true, 'INVALID_ARGUMENTS'],
];
for (const [name, mutate, code] of corruptions) for (const seam of ['adapter', 'handler']) {
  test(`mail ${seam}: inconsistent authority ${name} refuses before source effects`, async () => {
    const f = createMailFixture(), authority = structuredClone(f.authority); mutate(authority);
    const adapter = createMailHttpAdapter(f.config);
    const promise = seam === 'adapter'
      ? adapter.read({operation: f.operation, input: f.input(), request: f.args, authority})
      : createMailReadHandler({operation: f.operation, adapter, now: () => f.state.now})(f.call(f.args, authority));
    await assert.rejects(promise, error => error.message === code);
    assert.deepEqual(f.calls, []); assert.deepEqual(f.wire, []); assert.deepEqual(f.credentialCalls, []);
  });
}

test('mail current context can retain broader execution scopes without widening the released subject', async () => {
  const f = createMailFixture(), authority = structuredClone(f.authority);
  authority.scopes.push({tenantId: f.binding.tenantId, kind: 'client', resourceId: uuid('f'),
    policyRevision: authority.policyRevision});
  const adapter = createMailHttpAdapter(f.config);
  const page = await adapter.read({operation: f.operation, input: f.input(), request: f.args, authority});
  assert.deepEqual(page.subject.scopes, f.subject.scopes); assert.equal(f.calls.includes('fetch'), true);
  assert.deepEqual(f.credentialCalls[0].subject.scopes, f.subject.scopes);
});
