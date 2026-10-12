// Read-back verification of a trusted, immutable/quiesced transcript snapshot.
// It does not establish process quiescence, storage durability or authority.
import { canonicalSha256 } from '@capiro/meri-contracts/node';
import { verifyRestore } from '../sdk-options.mjs';
import { copySessionTranscript, scopedSessionKey } from './bound-session-store.mjs';
import { copySessionJson, captureSessionMethods } from './session-store-data.mjs';

const fail = code => { throw Object.assign(new Error(code), { code }); };

export async function verifySessionStoreSnapshot(store, sessionKey, transcripts) {
  const key = scopedSessionKey(sessionKey, sessionKey, true);
  const methods = captureSessionMethods(store, ['load', 'listSubkeys'], 'SESSION_SNAPSHOT_SHAPE');
  // Allow finite wrapper/subpath overhead; the original aggregate entry-byte
  // budget is checked below independently and remains 32 MiB.
  const snapshot = copySessionJson(transcripts, 34 * 1024 * 1024);
  if (!Array.isArray(snapshot) || !snapshot.length || snapshot.length > 256)
    fail('SESSION_SNAPSHOT_SHAPE');
  const names = new Set(), expected = [];
  let bytes = 0, entryCount = 0;
  for (const transcript of snapshot) {
    if (!transcript || Object.keys(transcript).some(k => !['subpath', 'entries'].includes(k))) fail('SESSION_SNAPSHOT_SHAPE');
    const partKey = scopedSessionKey({ ...key, ...(transcript.subpath === undefined ? {} : { subpath: transcript.subpath }) }, key);
    const name = partKey.subpath ?? null;
    if (names.has(name)) fail('SESSION_SNAPSHOT_DUPLICATE');
    names.add(name);
    const entries = copySessionTranscript(transcript.entries);
    if (name === null && !entries.length) fail('SESSION_SNAPSHOT_EMPTY_MAIN');
    bytes += Buffer.byteLength(JSON.stringify(entries)); entryCount += entries.length;
    if (bytes > 32 * 1024 * 1024) fail('SESSION_SNAPSHOT_BOUND');
    expected.push({ key: partKey, entries });
  }
  if (!names.has(null)) fail('SESSION_SNAPSHOT_MISSING_MAIN');
  expected.sort((a, b) => {
    const left = a.key.subpath ?? '', right = b.key.subpath ?? '';
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const wanted = [...names].filter(name => name !== null).sort();
  const actual = copySessionJson(await methods.listSubkeys(key), 8 * 1024 * 1024);
  if (!Array.isArray(actual) || JSON.stringify([...actual].sort()) !== JSON.stringify(wanted)) fail('SESSION_SNAPSHOT_SUBKEYS');
  for (const transcript of expected) {
    try { await verifyRestore({ load: async item => {
      const loaded = await methods.load(item);
      return loaded === null ? null : copySessionTranscript(loaded);
    } }, transcript.key, transcript.entries); }
    catch { fail('SESSION_SNAPSHOT_CONTENT'); }
  }
  return Object.freeze({ kind: 'session-mirror-readback-only', transcripts: expected.length,
    entries: entryCount, sha256: canonicalSha256(expected) });
}
