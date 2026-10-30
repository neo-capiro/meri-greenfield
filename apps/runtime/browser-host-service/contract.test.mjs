/** Contract tests against the REAL merged modules.
 *
 * The merged capabilities owner imports workspace packages that need the root `npm ci` (ajv). This worktree has no
 * installed dependencies under the allocation's no-install rule, so the runtime import is attempted and skipped with
 * the exact reason. The byte-level signature check needs no dependency and still binds this caller to the real callee.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const RUN = new URL('../../worker/conversation/host/composition/run.mjs', import.meta.url);
const TRANSPORT = new URL('../../worker/conversation/host/browser-viewer-transport.mjs', import.meta.url);
const signature = async (url, marker) => {
  const text = await readFile(url, 'utf8');
  const index = text.indexOf(marker);
  assert.ok(index >= 0, `${marker} present in ${url.pathname}`);
  return text.slice(index, text.indexOf('){', index));
};


test('prepareGuestHostRun signature is the documented input contract', async () => {
  const head = await signature(RUN, 'export async function prepareGuestHostRun(');
  for (const name of ['allocation', 'binding', 'hostIdentity', 'cwd', 'deadlineMs', 'capabilityPolicy', 'readBrowserPolicy', 'control', 'model', 'browser', 'bash', 'native', 'network', 'host', 'now', 'signal', 'components']) {
    assert.match(head, new RegExp(`\\b${name}\\b`, 'u'));
  }
  const text = await readFile(RUN, 'utf8');
  for (const member of ['browserPort', 'browserHost', 'bashRuntimeFacts', 'processClientFactory', 'browserInstallation', 'settle']) {
    assert.ok(text.includes(member), `result member ${member}`);
  }
});

test('createBrowserViewerHostServer accepts relay plus custodyOwner over the existing route', async () => {
  const head = await signature(TRANSPORT, 'export function createBrowserViewerHostServer(');
  for (const name of ['bind', 'tls', 'peer', 'relay', 'custodyOwner', 'now', 'requestMs']) assert.match(head, new RegExp(`\\b${name}\\b`, 'u'));
});

test('real runtime import is unavailable in this worktree without installed dependencies', async t => {
  try {
    await import(RUN.href);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return t.skip(`unrun: ${String(error.message).split('\n')[0]}`);
    throw error;
  }
  t.diagnostic('real capabilities owner imported; its behaviour is covered by its own accepted suites');
});

