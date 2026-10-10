// W02-18 pure four-case seed validation and request/manifest data.
//
// Pure and IO-free: it does no filesystem/network/process work and imports nothing
// that performs IO at import time. It consumes only a branded binding (from
// ./binding.mjs) and the caller's seed bytes, validates the frozen local seed
// contract, and derives the exact read-only TestState REQUEST plus its plan manifest
// from the SAME immutable authority held by the binding (graph text, member hashes,
// raw input provenance).

import { createHash } from 'node:crypto';
import { parseStrictJson, isOwnedBinding, BOUNDS } from './binding.mjs';

export const SEED_SCHEMA = 'meri-native-teststate-initial-seed/1';
export const PLAN_SCHEMA = 'meri-native-teststate-initial-plan/1';
export const PLAN_STATUS = 'REQUEST_PLAN_ONLY';
export const SEED_KEYS = Object.freeze(['schemaVersion', 'case', 'wireCaptureId', 'runUuid', 't0Ms', 'planningTimeMs']);
export const REQUEST_KEYS = Object.freeze(['definition', 'stateName', 'roleArn', 'input', 'variables', 'inspectionLevel', 'revealSecrets']);
export const CASES = Object.freeze(['identity', 'list-started-by', 'list-running', 'list-stopped']);
export const ROLE_ARN = 'arn:aws:iam::967807252336:role/MeriGreenfield-TestStateReadOnly-20261010';

const D_OFFSET_MS = 720000;
const C_OFFSET_MS = 900000;
const MIN_REMAINING_MS = 1000;
const TIMEOUT_CAP_SECONDS = 30;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SELECTED_MEMBER_KEYS = ['Type', 'Resource', 'Arguments', 'TimeoutSeconds', 'Assign', 'Catch', 'Output', 'Next'];
const bound = (v) => createHash('sha256').update(v).digest('hex');

const CASE_SPEC = Object.freeze({
  identity: Object.freeze({ stateName: 'DispatchIdentity', resource: 'arn:aws:states:::aws-sdk:sts:getCallerIdentity', deadline: 'D' }),
  'list-started-by': Object.freeze({ stateName: 'ListFirst', resource: 'arn:aws:states:::aws-sdk:ecs:listTasks', deadline: 'C' }),
  'list-running': Object.freeze({ stateName: 'ListFirst', resource: 'arn:aws:states:::aws-sdk:ecs:listTasks', deadline: 'C' }),
  'list-stopped': Object.freeze({ stateName: 'ListFirst', resource: 'arn:aws:states:::aws-sdk:ecs:listTasks', deadline: 'C' }),
});

const refuse = (reason) => ({ ok: false, reason, plan: null });

const isPositiveSafeInt = (v) => Number.isSafeInteger(v) && v > 0;
const hasExactKeys = (obj, keys) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const own = Object.keys(obj);
  if (own.length !== keys.length) return false;
  const set = new Set(keys);
  return own.every((k) => set.has(k));
};

/**
 * Pure validation of the frozen local seed contract.
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateSeed(seed) {
  if (!hasExactKeys(seed, SEED_KEYS)) return { ok: false, reason: 'seed must have exactly the six contract keys' };
  if (seed.schemaVersion !== SEED_SCHEMA) return { ok: false, reason: 'seed schemaVersion mismatch' };
  if (!CASES.includes(seed.case)) return { ok: false, reason: 'unsupported seed case' };
  if (typeof seed.runUuid !== 'string' || !UUID_V4.test(seed.runUuid)) return { ok: false, reason: 'runUuid must be a canonical lowercase v4 UUID' };
  if (typeof seed.wireCaptureId !== 'string' || !UUID_V4.test(seed.wireCaptureId)) return { ok: false, reason: 'wireCaptureId must be a canonical lowercase v4 UUID' };
  if (seed.wireCaptureId === seed.runUuid) return { ok: false, reason: 'wireCaptureId must differ from runUuid' };
  if (!isPositiveSafeInt(seed.t0Ms)) return { ok: false, reason: 't0Ms must be a positive safe integer' };
  if (!isPositiveSafeInt(seed.planningTimeMs)) return { ok: false, reason: 'planningTimeMs must be a positive safe integer' };
  if (seed.t0Ms > seed.planningTimeMs) return { ok: false, reason: 't0Ms must not exceed planningTimeMs' };
  if (!Number.isSafeInteger(seed.t0Ms + C_OFFSET_MS)) return { ok: false, reason: 't0Ms + 900000 must stay a safe integer' };
  const selectedDeadlineMs = seed.case === 'identity' ? seed.t0Ms + D_OFFSET_MS : seed.t0Ms + C_OFFSET_MS;
  if (selectedDeadlineMs - seed.planningTimeMs < MIN_REMAINING_MS) return { ok: false, reason: 'remaining selected deadline must be >= 1000ms' };
  return { ok: true };
}

function buildVariables(caseName, values) {
  if (caseName === 'identity') return { ctx: { D: values.D } };
  if (caseName === 'list-started-by') return { ctx: { C: values.C, mode: 0, run: { uuid: values.runUuid } } };
  if (caseName === 'list-running') return { ctx: { C: values.C, mode: 1 } };
  return { ctx: { C: values.C, mode: 2 } };
}

function buildExpectedArguments(caseName, clusterArn, runUuid) {
  if (caseName === 'identity') return {};
  if (caseName === 'list-started-by') return { Cluster: clusterArn, MaxResults: 10, StartedBy: runUuid };
  if (caseName === 'list-running') return { Cluster: clusterArn, MaxResults: 10, DesiredStatus: 'RUNNING' };
  return { Cluster: clusterArn, MaxResults: 10, DesiredStatus: 'STOPPED' };
}

function validateSelectedMember(member, spec) {
  if (!member || typeof member !== 'object' || Array.isArray(member)) return 'selected member missing';
  const own = Object.keys(member).sort();
  const want = [...SELECTED_MEMBER_KEYS].sort();
  if (own.length !== want.length || own.some((k, i) => k !== want[i])) return 'selected member shape mismatch';
  if (member.Type !== 'Task') return 'selected member is not a Task';
  if (member.Resource !== spec.resource) return 'selected member resource mismatch';
  if (typeof member.TimeoutSeconds !== 'string' || !member.TimeoutSeconds.startsWith('{% ')) return 'selected member timeout shape mismatch';
  if (!member.Assign || typeof member.Assign !== 'object' || Array.isArray(member.Assign)) return 'selected member assign shape mismatch';
  if (!Array.isArray(member.Catch) || member.Catch.length === 0) return 'selected member catch shape mismatch';
  if (!member.Output || typeof member.Output !== 'object' || Array.isArray(member.Output)) return 'selected member output shape mismatch';
  if (typeof member.Next !== 'string' || member.Next.length === 0) return 'selected member next shape mismatch';
  return null;
}

function derivePlan(binding, seed, seedSha256) {
  const pins = binding.pins;
  if (seed.runUuid !== pins.runUuid) return refuse('seed runUuid must equal the fixed synthetic binding runUuid');

  const definition = binding.graphText;
  if (Buffer.byteLength(definition, 'utf8') !== binding.graphBytesLength) return refuse('binding graph text length mismatch');
  if (bound(Buffer.from(definition, 'utf8')) !== binding.graphSha256) return refuse('binding graph text hash mismatch');

  const spec = CASE_SPEC[seed.case];
  const member = binding.graph.States[spec.stateName];
  const memberError = validateSelectedMember(member, spec);
  if (memberError) return refuse(`graph member check failed: ${memberError}`);
  if (bound(JSON.stringify(member)) !== binding.memberHashes[spec.stateName]) return refuse('selected member hash mismatch');

  const D = seed.t0Ms + D_OFFSET_MS;
  const C = seed.t0Ms + C_OFFSET_MS;
  const selectedDeadlineMs = spec.deadline === 'D' ? D : C;
  const expectedTimeoutSeconds = Math.min(TIMEOUT_CAP_SECONDS, Math.floor((selectedDeadlineMs - seed.planningTimeMs) / 1000));

  const variables = JSON.stringify(buildVariables(seed.case, { D, C, runUuid: seed.runUuid }));
  const request = {
    definition,
    stateName: spec.stateName,
    roleArn: ROLE_ARN,
    input: '{}',
    variables,
    inspectionLevel: 'DEBUG',
    revealSecrets: false,
  };
  const requestBytes = JSON.stringify(request);

  const plan = {
    schemaVersion: PLAN_SCHEMA,
    status: PLAN_STATUS,
    case: seed.case,
    stateName: spec.stateName,
    resource: spec.resource,
    roleArn: ROLE_ARN,
    target: { account: pins.account, region: pins.region, clusterArn: pins.clusterArn },
    request,
    requestBytes,
    requestSha256: bound(Buffer.from(requestBytes, 'utf8')),
    expectedArguments: buildExpectedArguments(seed.case, pins.clusterArn, seed.runUuid),
    expectedTimeoutSeconds,
    selectedDeadline: spec.deadline,
    selectedDeadlineMs,
    selectedMemberHash: binding.memberHashes[spec.stateName],
    graph: { bytes: binding.graphBytesLength, sha256: binding.graphSha256 },
    input: {
      staticPins: { bytes: binding.inputProvenance.staticPins.bytes, sha256: binding.inputProvenance.staticPins.sha256 },
      graph: { bytes: binding.inputProvenance.graph.bytes, sha256: binding.inputProvenance.graph.sha256 },
    },
    source: { records: binding.sourceRecords.map((r) => ({ path: r.path, bytes: r.bytes, sha256: r.sha256 })) },
    staticBindingId: binding.staticBindingId,
    seed: {
      sha256: seedSha256,
      wireCaptureId: seed.wireCaptureId,
      runUuid: seed.runUuid,
      originalTimes: { t0Ms: seed.t0Ms, planningTimeMs: seed.planningTimeMs },
      derived: { D, C },
    },
    provenance: {
      synthetic: true,
      inert: true,
      notExecuted: true,
      runtimeEnabled: false,
      executeAdmitted: false,
      wireOrigin: 'SYNTHETIC_TEST_ONLY',
      roleStatus: 'FUTURE_NOT_CREATED_NOT_TRUSTED_NOT_AUTHORIZED',
      hashesAreIdentityNotAuthority: true,
    },
    limitations: [
      'planningTimeMs is supplied UNVERIFIED data, not freshness/authentication',
      'request DATA only: no reply, no decode, no service timestamp, no identity verdict',
      'a later owner adapter must recheck the actual current time immediately before any API call',
      'an input hash establishes identity within the allocation, not authentication or authority',
    ],
  };
  return { ok: true, plan };
}

/**
 * Build the exact read-only TestState request plan from a branded binding + seed bytes.
 * Refuses a forged/unbranded binding and any invalid seed.
 * @returns {{ok: true, plan: object} | {ok: false, reason: string, plan: null}}
 */
export function buildRequestPlan(input = {}) {
  const { binding, seedBytes } = input;
  if (!isOwnedBinding(binding)) return refuse('forged or unbranded binding refused');
  if (binding.runtimeEnabled !== false) return refuse('binding is not inert');
  const bytes = Buffer.isBuffer(seedBytes) ? seedBytes : null;
  if (!bytes) return refuse('seed bytes missing');
  const parsed = parseStrictJson(bytes, { maxBytes: BOUNDS.seed });
  if (!parsed.ok) return refuse(`seed: ${parsed.reason}`);
  const check = validateSeed(parsed.value);
  if (!check.ok) return refuse(`seed: ${check.reason}`);
  return derivePlan(binding, parsed.value, bound(bytes));
}
