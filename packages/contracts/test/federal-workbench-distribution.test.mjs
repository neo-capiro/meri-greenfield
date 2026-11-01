import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto, randomUUID} from 'node:crypto';
import {createContext, SourceTextModule} from 'node:vm';
import {receiveFederalSource, receiveFederalRequest, receiveFederalResponse} from '@capiro/meri-contracts/federal-workbench';
import {sourceFor, opFor} from '../../../apps/artifacts/federal-drafting/test/fixtures.mjs';
import official from './fixtures/federal-draft-source.wire.json' with {type:'json'};
import {projectNativeFederalSource} from '../../../apps/artifacts/federal-drafting/native-source.mjs';
import {scopedSource} from '../../../apps/artifacts/federal-drafting/test/scoped-fixture.mjs';

const bytes = value => new TextEncoder().encode(JSON.stringify(value));

test('distributed nested source validates explicit ancestors and rejects malformed locations', async () => {
  const source=scopedSource();
  assert.deepEqual(await receiveFederalSource(bytes(source)),source);
  for(const mutate of [s=>s.scopes[2].ancestorPath=[],s=>s.scopes.reverse(),s=>s.scopes[3].start--,s=>s.scopes[2].id=s.scopes[1].id]){
    const changed=structuredClone(source);mutate(changed);
    await assert.rejects(receiveFederalSource(bytes(changed)),/SOURCE_MISMATCH/);
  }
});

test('distributed official import binds the selection and retained source envelope', async () => {
  const selection = structuredClone(official.request);
  const source = projectNativeFederalSource(selection, official.response);
  const envelope = {schema: 'meri.federal-source.v1', selection, source};
  assert.deepEqual(await receiveFederalSource(bytes(envelope)), source);
  const request = receiveFederalRequest('federal-import', bytes({selection, deliveryId: randomUUID()}));
  assert.deepEqual(request.selection, selection);
  assert.throws(() => receiveFederalRequest('federal-import', bytes({...request, source})));
  for (const mutate of [
    value => {value.selection.textHash = '0'.repeat(64);},
    value => {value.source.sourceVersion += '-changed';},
    value => {value.source.coverage.complete = false;},
    value => {value.source.text += 'changed';},
  ]) {
    const changed = structuredClone(envelope); mutate(changed);
    await assert.rejects(receiveFederalSource(bytes(changed)));
  }
  await assert.rejects(receiveFederalResponse('federal-import', 200, bytes({}), structuredClone(request)), /UNADMITTED_REQUEST/);
});

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
  assert.equal(module.namespace.federalWorkbenchVersion, '1.3.0');
  await assert.rejects(module.namespace.receiveFederalSource(bytes({...source, sha256: '0'.repeat(64)})));
});

test('approval, history and refusal reasons are closed public shapes', async () => {
  const source = sourceFor(), versionId = randomUUID(), revisionSha256 = source.sha256;
  const approve = receiveFederalRequest('federal-approve', bytes({versionId, expectedArtifactSha256: source.sha256, revisionSha256, deliveryId: randomUUID()}));
  assert.equal(approve.versionId, versionId);
  assert.throws(() => receiveFederalRequest('federal-approve', bytes({versionId, expectedArtifactSha256: source.sha256, revisionSha256, deliveryId: randomUUID(), approved: true})));
  const history = receiveFederalRequest('federal-history', bytes({versionId, limit: 10, cursor: null}));
  assert.equal(history.limit, 10);
  assert.throws(() => receiveFederalRequest('federal-history', bytes({versionId, limit: 0, cursor: null})));
  assert.throws(() => receiveFederalRequest('federal-history', bytes({versionId, limit: 1, cursor: 'cursor'})));
  // A refusal carries its exact reason and, when known, the refused operation.
  const refused = await receiveFederalResponse('federal-history', 422, bytes({error: {code: 'DRAFT_SCOPE_INVALIDATED', outcome: 'READ_UNAVAILABLE', operationId: 'use-child'}}), history);
  assert.deepEqual(refused, {error: {code: 'DRAFT_SCOPE_INVALIDATED', outcome: 'READ_UNAVAILABLE', operationId: 'use-child'}});
  await assert.rejects(receiveFederalResponse('federal-history', 422, bytes({error: {code: 'DRAFT_SCOPE_INVALIDATED', outcome: 'READ_UNAVAILABLE', reason: 'x'}}), history), /INVALID_ERROR_RESPONSE/);
  await assert.rejects(receiveFederalResponse('federal-history', 200, bytes({}), history), /INVALID_RESPONSE/);
  // An export may cite the saved review it comes from; a draft save never does. The Word dossier is an export.
  const selection = {versionId, expectedArtifactSha256: source.sha256, operations: [opFor(source)]};
  const publish = (output, extra = {}) => ({selection, revisionSha256, output, deliveryId: randomUUID(), baseVersionId: null, baseRevisionSha256: null, reviewVersionId: null, ...extra});
  assert.equal(receiveFederalRequest('federal-publish', bytes(publish('docx', {reviewVersionId: randomUUID()}))).output, 'docx');
  assert.equal(receiveFederalRequest('federal-publish', bytes(publish('operative'))).reviewVersionId, null);
  const {reviewVersionId: omitted, ...withoutCitation} = publish('operative');
  assert.throws(() => receiveFederalRequest('federal-publish', bytes(withoutCitation)));
  assert.throws(() => receiveFederalRequest('federal-publish', bytes(publish('draft', {reviewVersionId: randomUUID()}))));
  assert.throws(() => receiveFederalRequest('federal-publish', bytes(publish('operative', {reviewVersionId: 'latest'}))));
});
