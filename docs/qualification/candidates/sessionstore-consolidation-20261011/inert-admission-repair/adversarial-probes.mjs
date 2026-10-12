import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRunBoundSessionStore, scopedSessionKey } from '../../../../../apps/worker/qualification/checkpoint/bound-session-store.mjs';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = { tenantId: 'synthetic-tenant', actorId: 'synthetic-actor', conversationId: uuid(1), runId: uuid(2), attemptId: uuid(3), workerId: uuid(4), writerFence: 1 };
const scope = {projectKey: '-workspace-conversation', sessionId: uuid(5)};
const calls = [];
const owner = createRunBoundSessionStore({binding, sessionKey: scope, transport: {
 append: async request => calls.push(request), load: async () => null, listSubkeys: async () => [],
}});
let getterCalls = 0;
const entry = {type: 'system'};
Object.defineProperty(entry, 'text', {enumerable: true, get() {getterCalls++; return 'synthetic';}});
await owner.store.append(scope, [entry]);
assert.equal(calls.length, 1);
assert.equal(getterCalls, 2);
let keyReads = 0;
const key = {sessionId: scope.sessionId};
Object.defineProperty(key, 'projectKey', {enumerable: true, get() {return ++keyReads === 1 ? scope.projectKey : 'foreign-project';}});
await owner.store.append(key, [{type: 'system'}]);
assert.equal(calls.length, 2);
assert.equal(calls[1].key.projectKey, 'foreign-project');
assert.equal(keyReads, 2);
const status = await owner.settleObservedCalls();
assert.equal(status.pending, 0);
const ownedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'native-owner-review-'));
let ownerMutation;
try { fs.chownSync(ownedRoot, 10001, 10001); ownerMutation = 'SUPPORTED'; }
catch (error) { ownerMutation = error.code; }
finally { fs.rmSync(ownedRoot, {recursive: true, force: true}); }
console.log(JSON.stringify({stableGetterAccepted: true, getterCalls, foreignProjectReachedTransport: calls[1].key.projectKey, keyReads, pending: status.pending, ownerMutation, ownedRootRemoved: !fs.existsSync(ownedRoot)}));
