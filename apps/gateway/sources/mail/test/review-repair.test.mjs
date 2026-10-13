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

const corruptions = {
  brokerAudience: a => a.claims.audience = 'meri-broker',
  commandOnly: a => a.claims.actions = ['command.execute'],
  deniedDecision: a => a.decision.decision = 'denied',
  decisionId: a => a.decision.decisionId = uuid('f'),
  decisionOperation: a => a.decision.operation = 'mail.search_messages@0.2.0',
  decisionVersion: a => a.decision.operation = 'mail.list_messages@0.3.0',
  decisionTenant: a => a.decision.actor.tenantId = 'foreign-tenant',
  decisionActor: a => a.decision.actor.actorId = 'foreign-actor',
  decisionPolicy: a => a.decision.policyRevision = 'foreign-policy',
  decisionScopesMissing: a => delete a.decision.scopes,
  decisionScopesSubstituted: a => a.decision.scopes = [{...a.subject.scopes[0], resourceId: uuid('f')}],
  decisionAbsent: a => delete a.decision,
  decisionExtraField: a => a.decision.sourceEnabled = true,
  authorityExtraField: a => a.enabled = true,
  claimsForeignScope: a => a.claims.scopes = [...a.claims.scopes, {...a.subject.scopes[0], tenantId: 'foreign-tenant', resourceId: uuid('f')}],
  claimsForeignScopePolicy: a => a.claims.scopes = [...a.claims.scopes, {...a.subject.scopes[0], policyRevision: 'foreign-policy', resourceId: uuid('f')}],
};
for (const [name, mutate] of Object.entries(corruptions)) for (const seam of ['adapter', 'handler']) {
  test(`mail ${seam}: inconsistent authority ${name} refuses before source effects`, async () => {
    const f = createMailFixture(), authority = structuredClone(f.authority); mutate(authority);
    const adapter = createMailHttpAdapter(f.config);
    const promise = seam === 'adapter'
      ? adapter.read({operation: f.operation, input: f.input(), request: f.args, authority})
      : createMailReadHandler({operation: f.operation, adapter, now: () => f.state.now})(f.call(f.args, authority));
    await assert.rejects(promise, /ACCESS_DENIED/);
    assert.deepEqual(f.calls, []); assert.deepEqual(f.wire, []); assert.deepEqual(f.credentialCalls, []);
  });
}

test('mail canonical authority can retain broader valid capabilities while releasing only exact read scope', async () => {
  const f = createMailFixture(), authority = structuredClone(f.authority);
  authority.claims.actions.push('command.propose');
  authority.claims.scopes = [...authority.claims.scopes, {...authority.subject.scopes[0], resourceId: uuid('f')}];
  const adapter = createMailHttpAdapter(f.config);
  const page = await adapter.read({operation: f.operation, input: f.input(), request: f.args, authority});
  assert.deepEqual(page.subject.scopes, f.subject.scopes); assert.equal(f.calls.includes('fetch'), true);
  assert.deepEqual(f.credentialCalls[0].subject.scopes, f.subject.scopes);
});
