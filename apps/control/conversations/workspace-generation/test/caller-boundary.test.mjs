/** The Workspace generation leaf against the REAL session, context and
 * conversation owners — only the two external seams are faked:
 *   * Core HTTP  — `fetchImpl` answers the identity and context receipts a real
 *                  Core would (in-process, no network, no credential);
 *   * PostgreSQL — the existing `initial-input-fixture` pool implements the
 *                  binding journal, `initial_inputs` and run/event reads.
 *
 * That is the boundary a production cold start actually crosses: the leaf asks
 * the action-session owner for a session on the conversation its exact request
 * owns, the initial-run-binding journal CLAIMS that conversation, the canonical
 * initial-input owner reserves the original input, the conversation service
 * accepts it and dispatches one run. Nothing here stubs `issue`, `allocateInput`
 * or `submit`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {createNativeIdentityContext} from '../../../../runtime/native-authority/identity-context.mjs';
import {createActionSessionOwner} from '../../../action-host/session/owner.mjs';
import {createInitialRunBindingJournal} from '../../../conversations/initial-run-binding-journal.mjs';
import {createConversationService} from '../../../conversations/service.mjs';
import {initialInputFixture} from '../../../conversations/test/initial-input-fixture.mjs';
import {MODEL_CATALOG} from '../../../../../packages/contracts/test/model-selection-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createWorkspaceGenerationApplication} from '../application.mjs';
import {conversationRequestIdFor, workspaceConversationIdFor} from '../phases.mjs';

const SERVICE_SECRET = 'synthetic-workspace-generation-service-secret';
const IDENTITY_CREDENTIAL = 'synthetic-core-identity-credential';
const TENANT = 'tenant-a';
const ACTOR = 'actor-a';
const CLIENT = '00000005-0000-4000-8000-000000000000';
const DRAFT = 'draft-workspace-1';
const REQUEST_ID = `wsgen:${'7'.repeat(64)}`;

/** The Core the session owner talks to, at its own HTTP seam. */
const REVISION = {identity: 'a'.repeat(64), membership: 'b'.repeat(64), context: 'c'.repeat(64)};
const coreFetch = state => async (url, init) => {
  const path = new URL(url).pathname;
  const at = state.now();
  const body = JSON.parse(init.body ?? '{}');
  const principal = {tenantId: TENANT, actorId: ACTOR};
  if (path.endsWith('/identity')) {
    return Response.json({principal, identityRevision: REVISION.identity, checkedAtMs: at, expiresAtMs: at + 60_000});
  }
  if (path.endsWith('/context')) {
    return Response.json({principal, identityRevision: REVISION.identity, identitySha256: body.identitySha256,
      conversationId: body.conversationId, selectedClientId: state.selectedClientId, contextRevision: REVISION.context, checkedAtMs: at, expiresAtMs: at + 60_000});
  }
  if (path.endsWith('/current')) {
    return Response.json({principal, role: 'standard_user', permissions: [], clientIds: [CLIENT],
      identityRevision: REVISION.identity, membershipRevision: REVISION.membership, contextRevision: REVISION.context,
      conversationId: body.conversationId, selectedClientId: state.selectedClientId, checkedAtMs: at, expiresAtMs: at + 60_000});
  }
  throw Error(`unexpected Core route ${path}`);
};

/** The runtime's own conversation-identity composition, over the real journal. */
function conversationIdentity({journal, now, versions}) {
  return createNativeIdentityContext({
    origin: 'https://core.synthetic.invalid',
    currentOwner: {async currentRun(request) {
      const record = await journal.readConversation({principal: {tenantId: request.tenantId, actorId: request.actorId},
        conversationId: request.conversationId, selectedClientId: request.selectedClientId ?? CLIENT}, () => {});
      return JSON.stringify({binding: record.binding, policyRevision: record.policyRevision, checkedAtMs: now(), deadlineMs: now() + 60_000});
    }},
    admitInitialConversation: async ({principal, conversationId, selectedClientId, signal}) => {
      let record = await journal.readConversation({principal, conversationId, selectedClientId}, () => {});
      if (!record || record.expiresAtMs <= now()) {
        record = (await journal[record ? 'rebind' : 'claim']({principal, conversationId, selectedClientId,
          policyRevision: 'policy-revision', versions, configurationSha256: hash({configuration: 'synthetic'}), proposedExpiresAtMs: now() + 60_000}, () => {})).record;
      }
      return JSON.stringify({binding: record.binding, policyRevision: record.policyRevision, checkedAtMs: now(), deadlineMs: now() + 60_000});
    },
    fetchImpl: coreFetch({selectedClientId: CLIENT, now}),
    enabled: true,
    now,
    limits: {maxRequestMs: 3000, maxFactBytes: 65_536},
  });
}

function harness() {
  const f = initialInputFixture();
  const versions = {imageDigest: `sha256:${'a'.repeat(64)}`, sdk: '0.3.295', cli: '2.1.295', contracts: '0.1.0', skillsDigest: 'b'.repeat(64), checkpointFormat: '0.1.0'};
  const now = f.now;
  const journal = createInitialRunBindingJournal({pool: f.pool, now, newId: (n => () => `0000000${(n++).toString(16)}-0000-4000-8000-000000000000`)(1)});
  const identityContext = conversationIdentity({journal, now, versions});
  const sessions = createActionSessionOwner({mode: 'process-local', verifyIdentity: identityContext.verifyIdentity, resolveContext: identityContext.resolveContext,
    withAuthority: identityContext.withAuthority, now,
    limits: {maxSessions: 20, maxRequestMs: 3000, maxTtlMs: 60_000, maxFactBytes: 65_536}});
  const dispatched = [];
  const dispatcher = {async start({binding}) {dispatched.push(binding);}, async cancel() {}, async signal() {}};
  const store = f.store();
  const service = createConversationService({sessions, store, dispatcher, versions, modelCatalog: MODEL_CATALOG, now, maxRequestMs: 3000});
  const application = createWorkspaceGenerationApplication({sessions, service, getServiceSecret: async () => SERVICE_SECRET, now, observeMs: 300, pollMs: 20, idleRecheckMs: 100});
  const call = (route, request) => application.handle(new Request(`https://meri.invalid/v1/internal/workspace-generation/${route}`, {method: 'POST',
    headers: {'content-type': 'application/json', 'x-internal-service-secret': SERVICE_SECRET, authorization: `Bearer ${IDENTITY_CREDENTIAL}`},
    body: JSON.stringify({schemaVersion: 1, request})}));
  const turn = {requestId: REQUEST_ID, phase: 'brief', tenantId: TENANT, actorId: ACTOR, draftId: DRAFT, clientId: CLIENT, expectedRevision: 7, paidGeneration: true,
    sources: [{id: 'draft-workspace-1:document', kind: 'document'}]};
  return {f, sessions, service, store, journal, application, call, turn, dispatched,
    subject: extra => ({requestId: REQUEST_ID, tenantId: TENANT, actorId: ACTOR, draftId: DRAFT, clientId: CLIENT, ...extra})};
}

test('a paid phase cold-starts through the real owners and retains the exact conversation and run', async () => {
  const h = harness();
  try {
    const response = await h.call('turn', h.turn);
    assert.equal(response.status, 200);
    const body = await response.json();
    const expectConversation = workspaceConversationIdFor(REQUEST_ID);
    assert.equal(body.outcome.conversationId, expectConversation, `conversation retention: ${JSON.stringify(body)}`);
    // This harness has no worker, so the dispatched run stays queued: the leaf
    // reports the retained run as UNKNOWN rather than inventing an answer.
    assert.equal(body.outcome.status, 'unknown');
    // The journal claimed exactly that conversation, and the service dispatched one run of it.
    const claimed = await h.journal.readConversation({principal: {tenantId: TENANT, actorId: ACTOR}, conversationId: expectConversation, selectedClientId: CLIENT}, () => {});
    assert.ok(claimed, 'the initial-run-binding journal claimed the conversation');
    assert.equal(claimed.selectedClientId, CLIENT);
    assert.equal(h.dispatched.length, 1, 'exactly one run was dispatched');
    assert.equal(h.dispatched[0].conversationId, expectConversation);
    assert.equal(body.outcome.runId, h.dispatched[0].runId, 'the reported run is the dispatched run');
    // The canonical initial-input owner reserved the original input of that run.
    const reserved = [...h.f.allocations.values()].find(a => a.conversation_id === expectConversation);
    assert.ok(reserved, 'the initial-input owner reserved the original input');
    assert.equal(reserved.request_id, conversationRequestIdFor(REQUEST_ID));
    assert.equal(reserved.state, 'ACCEPTED');
  } finally {await h.sessions.close();}
});

test('repeating the exact request replays its own retained request and never dispatches a second run', async () => {
  const h = harness();
  try {
    const first = await (await h.call('turn', h.turn)).json();
    const second = await (await h.call('turn', h.turn)).json();
    assert.equal(second.outcome.conversationId, first.outcome.conversationId);
    assert.equal(second.outcome.runId, first.outcome.runId);
    // A queued run has no worker here: the owner re-issues the SAME workflow start
    // (idempotent by workflow id) and allocates nothing new.
    assert.equal(h.dispatched.length, 2, 'a replay re-issues the same run start, never a new run');
    assert.equal(h.dispatched[0].conversationId, h.dispatched[1].conversationId);
    assert.equal(h.dispatched[0].runId, h.dispatched[1].runId);
    assert.equal([...h.f.allocations.values()].length, 1, 'a replay allocates nothing');
  } finally {await h.sessions.close();}
});

test('a changed request owns a different conversation instead of colliding with the first', async () => {
  const h = harness();
  try {
    await h.call('turn', h.turn);
    const other = {...h.turn, expectedRevision: 8, requestId: `wsgen:${'8'.repeat(64)}`};
    const response = await h.call('turn', other);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.notEqual(body.outcome.conversationId, workspaceConversationIdFor(REQUEST_ID), `changed request conversation: ${JSON.stringify(body)}`);
    assert.equal(h.dispatched.length, 2, 'the new revision is its own paid run');
  } finally {await h.sessions.close();}
});

test('the current context, not the body, decides the client and the identity', async () => {
  const h = harness();
  try {
    const foreign = {...h.turn, clientId: '00000009-0000-4000-8000-000000000000'};
    const response = await h.call('turn', foreign);
    assert.equal(response.status, 403);
    const other = {...h.turn, actorId: 'actor-b'};
    assert.equal((await h.call('turn', other)).status, 403);
    assert.equal(h.dispatched.length, 0, 'a refused scope dispatches nothing');
  } finally {await h.sessions.close();}
});

test('cancel reuses the retained exact binding and allocates nothing', async () => {
  const h = harness();
  try {
    const body = await (await h.call('turn', h.turn)).json();
    const before = [...h.f.allocations.values()].length;
    const response = await h.call('cancel', h.subject({runId: body.outcome.runId}));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).state, 'cancelled');
    assert.equal([...h.f.allocations.values()].length, before, 'cancel allocates nothing');
    assert.equal(h.dispatched.length, 1, 'cancel dispatches nothing');
  } finally {await h.sessions.close();}
});

test('a cancel for another request identity or another run is refused and dispatches nothing', async () => {
  const h = harness();
  try {
    const body = await (await h.call('turn', h.turn)).json();
    // Another request identity derives another conversation; its resolved run is
    // not the retained one, so the exact-retained-run check refuses it.
    const foreign = await h.call('cancel', h.subject({requestId: `wsgen:${'9'.repeat(64)}`, runId: body.outcome.runId}));
    assert.notEqual(foreign.status, 200);
    // A run that is not the retained one cannot be cancelled either.
    const wrongRun = await h.call('cancel', h.subject({runId: '0000000f-0000-4000-8000-000000000000'}));
    assert.notEqual(wrongRun.status, 200);
    assert.equal(h.dispatched.length, 1, 'a refused cancel dispatches nothing');
  } finally {await h.sessions.close();}
});

test('the paid intent must be exactly true and the service secret must match', async () => {
  const h = harness();
  try {
    assert.equal((await h.call('turn', {...h.turn, paidGeneration: false})).status, 400);
    assert.equal((await h.call('turn', {...h.turn, paidGeneration: 'true'})).status, 400);
    const missing = new Request('https://meri.invalid/v1/internal/workspace-generation/turn', {method: 'POST',
      headers: {'content-type': 'application/json', authorization: `Bearer ${IDENTITY_CREDENTIAL}`}, body: JSON.stringify({schemaVersion: 1, request: h.turn})});
    assert.equal((await h.application.handle(missing)).status, 503);
    const wrong = new Request('https://meri.invalid/v1/internal/workspace-generation/turn', {method: 'POST',
      headers: {'content-type': 'application/json', 'x-internal-service-secret': 'synthetic-wrong-secret', authorization: `Bearer ${IDENTITY_CREDENTIAL}`},
      body: JSON.stringify({schemaVersion: 1, request: h.turn})});
    assert.equal((await h.application.handle(wrong)).status, 503);
    assert.equal(h.dispatched.length, 0);
  } finally {await h.sessions.close();}
});
