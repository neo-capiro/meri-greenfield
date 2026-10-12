// Deterministic Promptfoo provider for the adapter's recovery safety boundary.
// No model, SDK query, native process, database or network is invoked.
import { InMemorySessionStore } from '@anthropic-ai/claude-agent-sdk';
import { createRunBoundSessionStore } from './bound-session-store.mjs';
import { verifySessionStoreSnapshot } from './verify-session-store.mjs';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = { tenantId: 'synthetic-eval', actorId: 'synthetic-actor', conversationId: id(1),
  runId: id(2), attemptId: id(3), workerId: id(4), writerFence: 1 };
const key = { projectKey: '-workspace-conversation', sessionId: id(5) };
const entries = [{ type: 'system', compact: { unknown: ['verbatim', 7, null] } },
  { type: 'system', mode: 'retained-marker' }, { type: 'system', mode: 'retained-marker' }];
const child = { ...key, subpath: 'subagents/agent-eval' };

export default class SessionStoreQualificationProvider {
  id() { return 'session-store-deterministic-qualification'; }
  async callApi(scenario) {
    const backend = new InMemorySessionStore(); let writes = 0;
    const transport = {
      async append(request) {
        if (scenario === 'stale-generation' && request.binding.writerFence !== 2)
          throw Object.assign(new Error('stale'), { code: 'SESSION_WRITE_REJECTED' });
        writes++;
        if (scenario === 'uncertain-commit') throw new Error('connection lost after remote commit');
        await backend.append(request.key, request.entries);
      },
      load: request => backend.load(request.key),
      listSubkeys: request => backend.listSubkeys(request.key),
    };
    const client = createRunBoundSessionStore({ binding, sessionKey: key, transport });
    const output = { scenario, errors: [] };
    const attempt = async operation => { try { return await operation(); } catch (error) { output.errors.push(error.code); return null; } };
    if (scenario === 'foreign-session') {
      await attempt(() => client.store.append({ ...key, sessionId: id(99) }, entries));
    } else if (scenario === 'stale-generation' || scenario === 'uncertain-commit') {
      await attempt(() => client.store.append(key, entries));
      await attempt(() => client.store.append(key, entries));
    } else {
      await client.store.append(key, entries);
      await client.store.append(child, [{ type: 'assistant', future: { opaque: true } }]);
      if (scenario === 'opaque-resume') {
        output.main = await client.store.load(key); output.child = await client.store.load(child);
        output.verification = await verifySessionStoreSnapshot(client.store, key, [
          { entries }, { subpath: child.subpath, entries: output.child },
        ]);
      } else if (scenario === 'dropped-marker') {
        await attempt(() => verifySessionStoreSnapshot(client.store, key, [
          { entries: entries.slice(0, 2) }, { subpath: child.subpath, entries: [{ type: 'assistant', future: { opaque: true } }] },
        ]));
      } else if (scenario === 'omitted-subagent') {
        await attempt(() => verifySessionStoreSnapshot(client.store, key, [{ entries }]));
      } else if (scenario === 'late-write') {
        client.closeMirror(); client.recordMirrorError({ type: 'system', subtype: 'mirror_error' });
        await attempt(() => client.store.append(key, entries));
      } else return { error: 'Unknown qualification scenario' };
    }
    output.writes = writes; output.state = await client.settleObservedCalls();
    return { output: JSON.stringify(output), cost: 0, tokenUsage: { total: 0, prompt: 0, completion: 0 } };
  }
}
