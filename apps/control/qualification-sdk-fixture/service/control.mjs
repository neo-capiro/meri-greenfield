// Trusted assembly of the private G1 fixture control path. Importing or
// constructing this module performs no database, S3 or listener I/O.
import { createFixtureIngress } from '../ingress/index.mjs';
import { FixtureRegistry } from '../state/registry.mjs';
import { PostgresStore } from '../state/store.mjs';
import { createS3CheckpointStore } from './checkpoint-store.mjs';
import { createFixtureServiceHandlers } from './handlers.mjs';
import { createS3FixtureObjects } from './s3-objects.mjs';

const fail = () => { throw new Error('FIXTURE_CONTROL_CONFIGURATION'); };
const unsettled = () => { throw new Error('FIXTURE_CONTROL_UNSETTLED'); };
const keys = new Set(['database', 'evidenceInspector', 'bucket', 'kmsKeyArn',
  'region', 'objectClient', 'bind', 'tls', 'limits', 'now']);

async function settle(pending) {
  let timer;
  try {
    await Promise.race([Promise.allSettled(pending), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('FIXTURE_CONTROL_UNSETTLED')), 60000);
    })]);
  } finally { clearTimeout(timer); }
}

/**
 * The owner admits/replaces runs through the returned registry before/after
 * task dispatch. Only the four fixed ingress operations are exposed on mTLS.
 * The mandatory native inspector is a trusted owner capability, never a worker
 * claim or a boolean configuration flag.
 */
export function createFixtureControl(options) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype ||
      Reflect.ownKeys(options).some(key => !keys.has(key)) ||
      !(options.database instanceof PostgresStore) ||
      !options.evidenceInspector ||
      typeof options.evidenceInspector.verify !== 'function') fail();
  const { database, evidenceInspector, bucket, kmsKeyArn, region, objectClient,
    bind, tls, limits, now } = options;
  const objects = createS3FixtureObjects({ bucket, kmsKeyArn, region,
    ...(objectClient === undefined ? {} : { client: objectClient }) });
  let ingress;
  let registry;
  const inFlight = new Set();
  try {
    registry = new FixtureRegistry(database);
    const checkpointStore = createS3CheckpointStore({ objects, evidenceInspector,
      ...(now === undefined ? {} : { now }) });
    const handlers = createFixtureServiceHandlers({ registry, checkpointStore,
      ...(now === undefined ? {} : { now }) });
    const trackedHandlers = Object.fromEntries(Object.entries(handlers).map(([name, handler]) =>
      [name, input => {
        const operation = Promise.resolve().then(() => handler(input));
        inFlight.add(operation);
        return operation.finally(() => inFlight.delete(operation));
      }]));
    ingress = createFixtureIngress({ bind, tls, limits, handlers: trackedHandlers,
      ...(now === undefined ? {} : { now }),
      resolveCredential: ({ fingerprintSha256, operation, signal }) => {
        if (signal.aborted) fail();
        return registry.resolveCertificate({ fingerprintSha256, operation });
      } });
  } catch (error) {
    objects.close();
    throw error;
  }

  let closing = null;
  let released = false;
  function close() {
    if (released) return Promise.resolve();
    if (closing === null) closing = (async () => {
      await ingress.close();
      // Closing sockets aborts cooperative work but does not prove its outcome.
      // Keep the object client available if any handler remains unsettled.
      if (inFlight.size) await settle([...inFlight]);
      if (inFlight.size) unsettled();
      objects.close();
      released = true;
    })().finally(() => { if (!released) closing = null; });
    return closing;
  }
  async function start() {
    try { return await ingress.start(); }
    catch (error) {
      try { await close(); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'FIXTURE_CONTROL_START_CLEANUP');
      }
      throw error;
    }
  }
  return Object.freeze({ registry, start, close,
    address: () => ingress.address(),
    activeConnections: () => ingress.activeConnections(),
    activeOperations: () => inFlight.size });
}
