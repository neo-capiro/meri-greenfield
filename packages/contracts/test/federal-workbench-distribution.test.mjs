import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto, randomUUID} from 'node:crypto';
import {createContext, SourceTextModule} from 'node:vm';
import {receiveFederalSource, receiveFederalRequest, receiveFederalResponse} from '@capiro/meri-contracts/federal-workbench';
import {sourceFor, opFor} from '../../../apps/artifacts/federal-drafting/test/fixtures.mjs';

const bytes = value => new TextEncoder().encode(JSON.stringify(value));

test('public subpath admits retained source bytes and rejects changed text and scope hashes', async () => {
  const source = sourceFor();
  assert.deepEqual(await receiveFederalSource(bytes(source)), source);
  await assert.rejects(receiveFederalSource(bytes({...source, text: source.text + 'changed'})));
  const changed = structuredClone(source);
  changed.scopes[0].sha256 = '0'.repeat(64);
  await assert.rejects(receiveFederalSource(bytes(changed)));
});

test('public request brands prevent unadmitted responses and reject widened authority', async () => {
  const source = sourceFor();
  const selection = {versionId: randomUUID(), expectedArtifactSha256: source.sha256, operations: [opFor(source)]};
  const request = receiveFederalRequest('federal-prepare', bytes({selection}));
  assert.deepEqual(request.selection, selection);
  assert.throws(() => receiveFederalRequest('federal-prepare', bytes({selection, approved: true})));
  await assert.rejects(receiveFederalResponse('federal-prepare', 200, bytes({}), structuredClone(request)), /UNADMITTED_REQUEST/);
  assert.throws(() => receiveFederalRequest('federal-publish', bytes({selection, revisionSha256: source.sha256,
    output: 'operative', deliveryId: randomUUID(), baseVersionId: randomUUID(), baseRevisionSha256: source.sha256})));
});

test('distributed receiver runs with browser globals and no external imports', async () => {
  const context = createContext({TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, crypto: webcrypto});
  const module = new SourceTextModule(await readFile(new URL('../dist/federal-workbench.mjs', import.meta.url), 'utf8'), {context});
  await module.link(() => {throw Error('External imports are not browser-safe');});
  await module.evaluate({timeout: 2000});
  const source = sourceFor();
  const received = await module.namespace.receiveFederalSource(bytes(source));
  assert.equal(received.sha256, source.sha256);
  assert.equal(module.namespace.federalWorkbenchVersion, '1.0.0');
  await assert.rejects(module.namespace.receiveFederalSource(bytes({...source, sha256: '0'.repeat(64)})));
});
