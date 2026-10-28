/** Mount test for the Workspace generation leaf on the private control boundary.
 * The boundary and the leaf are the real modules; only the surrounding
 * applications are inert fakes. No network, database or model is touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlRouteApplications} from '../../../../runtime/control-route-boundary.mjs';
import {createWorkspaceGenerationApplication} from '../application.mjs';
import {workspaceGenerationPaths} from '../protocol.mjs';

const SECRET = 'synthetic-internal-service-secret';
const RUN = '44444444-4444-4444-4444-444444444444';
const assembly = {handle: async () => Response.json({routed: 'assembly'})};
const candidate = {handle: async () => null};

function request(path, body) {
  return new Request(`https://control.example.test${path}`, {method: 'POST',
    headers: {'content-type': 'application/json', 'x-internal-service-secret': SECRET, authorization: 'Bearer synthetic-identity'},
    body: JSON.stringify(body)});
}

test('mounts the leaf on the protected listener when it is composed', async () => {
  const calls = [];
  let conversationId;
  const leaf = createWorkspaceGenerationApplication({
    sessions: {issue: async input => {
      conversationId = input.hints.conversationId;
      return {context: {tenantId: 't', actorId: 'a', conversationId, runId: RUN, selectedClientId: null}, credential: 'x', expiresAtMs: Date.now() + 1000};
    }},
    service: {
      allocateInput: async () => { calls.push('allocate'); return {allocation: {binding: {conversationId, runId: RUN}}}; },
      submit: async input => { calls.push('submit'); return {requestId: input.input.requestId, run: {binding: {runId: RUN, conversationId}, state: 'queued'}}; },
      observe: async input => input.opened({binding: {runId: RUN, conversationId}, state: 'running'}),
      history: async () => ({request: {requestId: 'nope'}, run: {state: 'running', binding: {runId: RUN, conversationId}}, events: []}),
      cancel: async () => ({state: 'cancelled'}),
    },
    getServiceSecret: async () => SECRET,
  });
  const {private: privateApplication} = createControlRouteApplications({assembly, candidate, workspaceGeneration: leaf});
  const body = {schemaVersion: 1, request: {requestId: `wsgen:${'ab'.repeat(32)}`, phase: 'brief', tenantId: 't', actorId: 'a', draftId: 'd', clientId: null, expectedRevision: 0, paidGeneration: true, sources: [{id: 'd', kind: 'workspace-draft'}]}};
  const response = await privateApplication.handle(request(workspaceGenerationPaths.turn, body));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).outcome.status, 'unknown');
  assert.deepEqual(calls, ['allocate', 'submit']);
});

test('leaves the route absent when the leaf is not composed and never answers it publicly', async () => {
  const {private: privateApplication, public: publicApplication} = createControlRouteApplications({assembly, candidate});
  const absent = await privateApplication.handle(request(workspaceGenerationPaths.turn, {}));
  assert.equal(absent.status, 404);
  const publicly = await publicApplication.handle(request(workspaceGenerationPaths.turn, {}));
  assert.equal(publicly.status, 404);
});
