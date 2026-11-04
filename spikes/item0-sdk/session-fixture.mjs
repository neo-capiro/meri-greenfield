/** Snapshot the SDK's development store for a fresh-process experiment. Not a production storage backend. */
import {InMemorySessionStore} from '@anthropic-ai/claude-agent-sdk';
import {projectKey} from './fixture.mjs';

export async function snapshotStore(store) {
  const rows = [];
  for (const {sessionId} of await store.listSessions(projectKey)) {
    const key = {projectKey, sessionId};
    rows.push({key, entries: await store.load(key)});
    for (const subpath of await store.listSubkeys(key)) {
      rows.push({key: {...key, subpath}, entries: await store.load({...key, subpath})});
    }
  }
  return {kind: 'synthetic-sdk-store-snapshot', sdk: '0.3.295', rows};
}

export async function restoreStore(snapshot) {
  if (snapshot?.kind !== 'synthetic-sdk-store-snapshot' || snapshot.sdk !== '0.3.295' || !Array.isArray(snapshot.rows)) {
    throw Error('INVALID_SYNTHETIC_SNAPSHOT');
  }
  const store = new InMemorySessionStore();
  for (const {key, entries} of snapshot.rows) {
    if (key?.projectKey !== projectKey || typeof key.sessionId !== 'string' || !Array.isArray(entries)) {
      throw Error('INVALID_SYNTHETIC_SNAPSHOT');
    }
    await store.append(key, entries);
  }
  return store;
}
