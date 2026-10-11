// Trusted control-layer composition for the fixed private SDK fixture operations.
// Ingress authenticates sockets; the registry decides currentness and publication;
// the injected checkpoint store must perform immutable versioned object I/O.
import { randomUUID } from 'node:crypto';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureResponse, fixtureReceiptIdentity } from
  '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { CommitUncertain } from '../state/errors.mjs';
import { assertVerifiedReadback, sameIdentity } from '../state/receipt.mjs';
import { assertCurrentContext, presentedBinding } from './binding.mjs';

const fail = () => { throw new Error('FIXTURE_SERVICE_REFUSED'); };
const methods = Object.freeze(['authorize', 'publishCommit', 'readPublication',
  'loadCheckpoint', 'verifyCheckpoint']);
const same = (left, right) => canonicalSha256(left) === canonicalSha256(right);

function fixedDependencies(registry, checkpointStore, decisionId) {
  if (!registry || typeof registry !== 'object' ||
      !methods.every(name => typeof registry[name] === 'function') ||
      !checkpointStore || typeof checkpointStore !== 'object' ||
      typeof checkpointStore.prepareCommit !== 'function' ||
      typeof checkpointStore.load !== 'function' || typeof decisionId !== 'function') fail();
}

function envelope(request, status, rest) {
  return { channelVersion: request.channelVersion, profile: request.profile,
    operation: request.operation, requestId: request.requestId,
    context: request.context, status, ...rest };
}

function checkResponse(request, response, producer, nowMs) {
  assertFixtureResponse(request, response, { producer, nowMs });
  return response;
}

function checkPublication(stored, publication, reference) {
  if (!stored || typeof stored !== 'object' ||
      !stored.receipt || !stored.bundle || !stored.fixtureFile || !stored.readback) fail();
  assertVerifiedReadback(stored.readback, stored.receipt);
  if (!sameIdentity(fixtureReceiptIdentity(stored.receipt), reference) ||
      stored.receipt.bundle.objectId !== publication.bundleObjectId ||
      stored.receipt.bundle.versionId !== publication.bundleVersionId ||
      stored.receipt.bundle.sha256 !== publication.bundleSha256 ||
      stored.receipt.bundle.bytes !== publication.bundleBytes ||
      stored.receipt.workspaceSha256 !== publication.workspaceSha256) fail();
  return stored;
}

/**
 * Compose the exact four ingress handlers. `checkpointStore` is an owner-supplied
 * trusted capability, not a worker-selected key/URL or a memory fallback.
 * prepareCommit must return a canonical receipt and independently reread bundle
 * and workspace versions. load must reread the registry-selected publication.
 * `now` is the trusted service clock; PostgreSQL remains the grant clock.
 */
export function createFixtureServiceHandlers({ registry, checkpointStore,
  decisionId = randomUUID, now = Date.now }) {
  fixedDependencies(registry, checkpointStore, decisionId);
  if (typeof now !== 'function') fail();
  const clock = () => {
    const reading = now();
    if (!Number.isSafeInteger(reading)) fail();
    return reading;
  };

  async function authorizeFixturePhase({ peer, context, producer, request }) {
    const decision = await registry.authorize({ presented: presentedBinding(request.context), peer });
    if (!Number.isSafeInteger(decision.checkedAtMs)) fail();
    const common = { decisionId: decisionId(), checkedAtMs: decision.checkedAtMs };
    if (decision.decision === 'AUTHORIZED') {
      return checkResponse(request, envelope(request, 'AUTHORIZED', common), producer, clock());
    }
    if (decision.decision !== 'DENIED_STALE_BINDING') fail();
    assertCurrentContext(context, decision.current, decision.checkedAtMs);
    return checkResponse(request, envelope(request, 'DENIED_STALE_BINDING',
      { ...common, currentContext: context }), producer, clock());
  }

  async function commitFixtureCheckpoint({ peer, producer, request, signal }) {
    const authorization = await registry.authorize({ presented: presentedBinding(producer), peer });
    if (authorization.decision !== 'AUTHORIZED') fail();
    const stored = await checkpointStore.prepareCommit({ producer,
      bundle: request.bundle, fixtureFile: request.fixtureFile, evidence: request.evidence, signal });
    if (!stored || !stored.receipt || !stored.readback) fail();
    const response = envelope(request, 'COMMITTED', { completeRecoveryCheckpoint: false,
      sessionStoreQualified: false, receipt: stored.receipt });
    checkResponse(request, response, producer, clock());
    const identity = fixtureReceiptIdentity(stored.receipt);
    try {
      const result = await registry.publishCommit({ context: producer, peer,
        receipt: stored.receipt, readback: stored.readback });
      if (!['COMMITTED', 'ALREADY_COMMITTED'].includes(result.outcome) ||
          !sameIdentity(result.identity, identity)) fail();
    } catch (error) {
      if (!(error instanceof CommitUncertain)) throw error;
      const observed = await registry.readPublication({ runUuid: producer.runUuid });
      if (observed.outcome !== 'COMMITTED' || !sameIdentity(observed.identity, identity)) fail();
    }
    return response;
  }

  async function readStored({ peer, context, producer, request, signal }) {
    const publication = await registry.loadCheckpoint({ context, peer,
      reference: request.reference });
    if (publication.outcome !== 'LOADED') fail();
    const stored = checkPublication(await checkpointStore.load({ publication,
      producer, current: context, signal }), publication, request.reference);
    return { stored, publication };
  }

  async function loadFixtureCheckpoint(input) {
    const { request, producer, context, peer } = input;
    const { stored, publication } = await readStored(input);
    const response = checkResponse(request, envelope(request, 'LOADED', { completeRecoveryCheckpoint: false,
      sessionStoreQualified: false, receipt: stored.receipt, bundle: stored.bundle,
      fixtureFile: stored.fixtureFile }), producer, clock());
    // A replacement/revocation while the object bytes were being reread must
    // refuse before those bytes are sent on the worker connection.
    const current = await registry.loadCheckpoint({ context, peer, reference: request.reference });
    if (!same(publication, current)) fail();
    return response;
  }

  async function verifyFixtureCheckpoint(input) {
    const { request, producer, context, peer } = input;
    const { stored } = await readStored(input);
    const response = envelope(request, 'VERIFIED', { completeRecoveryCheckpoint: false,
      sessionStoreQualified: false, receipt: stored.receipt });
    checkResponse(request, response, producer, clock());
    const result = await registry.verifyCheckpoint({ context, peer, reference: request.reference,
      bundleSha256: canonicalSha256(request.bundle),
      workspaceSha256: stored.receipt.workspaceSha256 });
    if (result.outcome !== 'VERIFIED' || !sameIdentity(result, request.reference)) fail();
    return response;
  }

  return Object.freeze({ authorizeFixturePhase, commitFixtureCheckpoint,
    loadFixtureCheckpoint, verifyFixtureCheckpoint });
}
