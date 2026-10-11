// Pure MANAGED predecessor DATA. No clients, clocks, files, dispatch or admission.
import { decodeFixtureBootstrapVolumeHistory } from './fixture-volume-history.mjs';
import { FIXTURE as F } from './fixture-volume-binding.mjs';

const ownData = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key) &&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
const refuse = reason => { throw new Error(`Managed probe preparation refused: ${reason}`); };
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const identityKeys = ['sourceCommit', 'definitionSha256', 'inputSha256', 'versionArn', 'executionArn', 'roleArn', 'ownerBindingId'];

/**
 * Externally pinned capture + original clock -> two unadmitted read-only intents.
 * Expected identities are owner DATA, never authenticated origin or permission.
 * A later separately reviewed managed executor must call the canonical Python
 * planner and recheck current authority/time. This is not its local owner input.
 */
export function prepareManagedFixtureVolumeProbes(options) {
  if (!ownData(options, ['capture', 'expected', 'originalClock', 'volumeId', 'probeAtMs'])) refuse('exact options');
  const { capture, expected, originalClock, volumeId, probeAtMs } = options;
  if (!ownData(expected, identityKeys) || !ownData(originalClock, ['t0Ms', 'createNotAfterMs', 'C'])) refuse('external identity/clock DATA');
  // One canonical parser/reconstructor owns profiles, raw byte pins, paging,
  // single create/delete, retained identity and complete fresh pre-delete proof.
  const history = decodeFixtureBootstrapVolumeHistory(capture);
  for (const key of identityKeys) {
    const observed = key === 'ownerBindingId' ? history.ownerBindingId : capture.pins[key];
    if (expected[key] !== observed) refuse('external identity mismatch');
  }
  for (const key of ['t0Ms', 'createNotAfterMs', 'C']) {
    if (originalClock[key] !== history.clock[key]) refuse('original clock mismatch');
  }
  if (typeof volumeId !== 'string' || volumeId !== history.volumeId) refuse('retained volume identity');
  if (history.firstDeleteAttempt === null) refuse('recorded first delete attempt required');
  if (!Number.isSafeInteger(probeAtMs) || probeAtMs < history.firstDeleteAttempt.completedAtMs || probeAtMs >= history.clock.C) {
    refuse('current probe time outside original window');
  }
  // These are only the two fixed operation/argument intents in SOURCE9 build()
  // with directInstance=None. No TestState graph/request or OWNER_REVIEWED local
  // CLI/STS/nonce/CREATED/DELETE_ACK receipt is synthesized here.
  return freeze({
    schema: 'meri-browser-MANAGED-probe-preparation/1', provenance: 'MANAGED',
    profile: history.profile, evidenceOnly: true, status: 'PREPARED_NOT_ADMITTED',
    runtimeAdmitted: false, absenceWireQualified: false, physicalAbsenceProven: false,
    cleanup: 'UNKNOWN', runUuid: F.runUuid, volumeId, preparedAtMs: probeAtMs,
    clock: { ...history.clock },
    externalIdentity: { ...expected },
    history: structuredClone(history),
    plannerBoundary: 'SEPARATE_MANAGED_EXECUTOR_AND_CANONICAL_PLANNER_REQUIRED',
    directInstance: null,
    requestIntents: [
      { case: 'DescribeInVpc', readOnly: true, service: 'ec2', operation: 'describeInstances',
        arguments: { Filters: [{ Name: 'vpc-id', Values: [F.vpc] }, { Name: 'owner-id', Values: [F.account] }], MaxResults: 5 } },
      { case: 'DescribeMissingVolume', readOnly: true, service: 'ec2', operation: 'describeVolumes',
        arguments: { VolumeIds: [volumeId] } },
    ],
    limitations: [
      'External pins and MANAGED labels do not authenticate captured origin or grant authority',
      'Partial observed Task/ownership reconstruction, not complete ASL replay',
      'Recorded delete outcome, including success, never produces a local CLI ACK or proves physical absence',
      'No SOURCE9 CLI/STS/nonce/create/delete receipt or planner owner approval is produced',
      'Probe time is caller DATA; later dispatch must recheck actual time, call budget and original C',
      'No service wire, managed survival, host, runtime, security or G1 acceptance',
    ],
  });
}
