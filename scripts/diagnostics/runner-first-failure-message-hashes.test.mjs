// The on-demand msg= table, built from this checkout (the pinned SDK bundle under apps/worker/conversation/node_modules).
// node --test scripts/diagnostics/runner-first-failure-message-hashes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildMessageHashTable, resolveMessageHashes} from './runner-first-failure-message-hashes.mjs';
import {firstFailureMessageHash} from '../../apps/runtime/runner-runtime-diagnostics.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)), script = fileURLToPath(new URL('./runner-first-failure-message-hashes.mjs', import.meta.url));
const table = buildMessageHashTable({root});

test('the table hashes every constant message with the runtime hash function', () => {
  assert.equal(table.sdkVersion, '0.3.295');
  for (const row of table.messages) assert.equal(row.msg, firstFailureMessageHash(row.message), row.message);
  const lookup = new Map(table.messages.map(row => [row.msg, row.message]));
  // Runner, worker and contract constants, and a plain Error message from the SDK bundle itself.
  for (const message of ['LIFECYCLE_EXECUTION_UNKNOWN', 'DEADLINE', 'NATIVE_UNAVAILABLE', 'REMOTE_TASK_REFUSED', 'SDK_SESSION_REFUSED', 'INVALID_COMMAND',
    'Transport is not ready for writing']) assert.equal(lookup.get(firstFailureMessageHash(message)), message);
  // Interpolated SDK templates cannot be hashed; they are listed, not guessed.
  assert.ok(table.unhashablePatterns.some(row => row.pattern.startsWith('Claude Code process exited with code ${…}')));
});

test('a live msg= value resolves to its message and anything else is refused or reported unresolved', () => {
  assert.deepEqual(resolveMessageHashes(['a6073a611574'], table),
    {code: 0, lines: ['a6073a611574\t"LIFECYCLE_EXECUTION_UNKNOWN"\tapps/worker/conversation/continuation/activity-lifecycle.mjs']});
  assert.equal(resolveMessageHashes(['000000000000'], table).code, 1);
  for (const value of ['templated', 'A6073A611574', 'a6073a61157', '']) assert.equal(resolveMessageHashes([value], table).code, 2);
  const cli = spawnSync(process.execPath, [script, 'a6073a611574'], {cwd: root, encoding: 'utf8'});
  assert.equal(cli.status, 0);assert.match(cli.stdout, /^a6073a611574\t"LIFECYCLE_EXECUTION_UNKNOWN"\t/u);
});
