/**
 * MB-05 closed source-event contract (finite slice, producer-linked).
 *
 * One finite event per request. The envelope is CLOSED: an unknown key is a refusal, not
 * an extension point, so no prompt, scope grant, destination selector, budget, limit or run
 * identifier can ever be smuggled into an event — the server derives work, destination,
 * limits and retry from the durable approved routine instead.
 *
 * Nothing in this module is authority: producer, tenant, owner, client, source revision and
 * event identity are claims that the receiver must re-read from Core custody over the
 * existing service-identity transport before any durable effect (see source-event-core-client.mjs).
 *
 * The producer fact vocabulary mirrors the canonical Core owners
 * (apps/api/src/business-development/bizdev-watch.types.ts: BizDevWatchSourceFamily,
 * BizDevSourceObservation.recordId/sourceRevision, BizDevAlertDraft.fingerprint/dedupeKey).
 * The receipt shape is the proposed Core contract named in CLAIM.txt section 2; this module is
 * its Meri-side closed reader.
 */
import {types} from 'node:util';
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

/** Private service-identity listener route Meri exposes to the Core producer. */
export const SOURCE_EVENT_PATH = '/v1/internal/routines/source-events';
/** The producer's READ of one approved binding for a producer/resource pair. There is no write
 *  route: a read of an approved binding is never authority to create one. */
export const SOURCE_EVENT_BINDING_PATH = '/v1/internal/routines/source-events/binding';
/** The one service-identity Core read this lane calls. ABSENT in Core today (CLAIM.txt section 2). */
export const SOURCE_EVENT_CORE_ROUTE = '/api/internal/routines/source-events/current';
export const SOURCE_EVENT_PROTOCOL = 'meri.routines.source-event/1';
export const SOURCE_EVENT_SCHEMA_VERSION = 1;
/** Closed producer allowlist. v1 is exactly the existing Core bizdev watch-alert producer. */
export const SOURCE_EVENT_PRODUCERS = Object.freeze(['bizdev.watch.alert.v1']);
export const SOURCE_EVENT_FAMILIES = Object.freeze([
  'federal_award', 'federal_assistance_award', 'sam_opportunity', 'tango_resource', 'lda_filing', 'acquisition_revision',
]);
export const SOURCE_EVENT_WATCH_STATES = Object.freeze(['active', 'paused', 'ended']);
export const SOURCE_EVENT_SOURCE_STATES = Object.freeze(['current', 'revoked', 'deleted', 'superseded']);
export const SOURCE_EVENT_CONSENT_STATES = Object.freeze(['active', 'revoked', 'expired']);
export const SOURCE_EVENT_DISPOSITIONS = Object.freeze({
  ACCEPTED: 'ACCEPTED', QUEUED: 'QUEUED', DISPATCHED: 'DISPATCHED', DEDUPED: 'DEDUPED',
  CONFLICT: 'CONFLICT', SKIPPED: 'SKIPPED', REFUSED: 'REFUSED', UNKNOWN: 'UNKNOWN',
});
/** Names that must never appear in a source event; every one of them is refused by the closed key set. */
export const SOURCE_EVENT_FORBIDDEN_KEYS = Object.freeze([
  'prompt', 'instruction', 'instructions', 'scope', 'scopes', 'grant', 'grants', 'destination', 'destinations',
  'budget', 'budgets', 'limit', 'limits', 'runId', 'runIds', 'attemptId', 'conversationId', 'workflowId',
  'taskQueue', 'routineId', 'subscriptionId', 'mailbox', 'provider', 'model', 'tools', 'metadata',
]);

export class SourceEventError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SourceEventError';
    this.code = code;
  }
}
export const refuse = code => {
  throw new SourceEventError(code);
};
export const sourceEventFault = error => (error instanceof SourceEventError ? error : new SourceEventError('SOURCE_EVENT_UNKNOWN'));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\u0000');
const uuid = value => text(value, 64) && UUID.test(value);
const hex64 = value => typeof value === 'string' && HEX64.test(value);
const integer = (value, min) => Number.isSafeInteger(value) && value >= min;
const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]));

/**
 * Closed plain-data extractor with the same descriptor discipline as the canonical
 * contracts#own boundary (proxies, exotic prototypes, accessors, symbols and unknown keys
 * are all refusals). Envelope/receipt refusal codes stay namespaced to this receiver.
 */
function closed(value, required, optional = [], code = 'SOURCE_EVENT_INVALID') {
  if (!value || typeof value !== 'object' || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    return refuse(code);
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (required.some(key => !Object.hasOwn(descriptors, key)) ||
      keys.some(key => typeof key !== 'string' || ![...required, ...optional].includes(key) ||
        !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value')))
    return refuse(code);
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
const instant = (value, code = 'SOURCE_EVENT_INVALID') => {
  const parsed = Date.parse(value);
  if (!Number.isSafeInteger(parsed) || new Date(parsed).toISOString() !== value) return refuse(code);
  return parsed;
};

const ALERT_KEYS = ['alertId', 'watchId', 'prospectId', 'dedupeKey', 'fingerprint'];
const SOURCE_KEYS = ['sourceFamily', 'recordId', 'sourceRevision'];

function alertFacts(value, code = 'SOURCE_EVENT_INVALID') {
  const a = closed(value, ALERT_KEYS);
  if (!uuid(a.alertId) || !uuid(a.watchId) || !uuid(a.prospectId) || !text(a.dedupeKey, 512) || !hex64(a.fingerprint))
    return refuse(code);
  return {alertId: a.alertId, watchId: a.watchId, prospectId: a.prospectId, dedupeKey: a.dedupeKey, fingerprint: a.fingerprint};
}

function sourceFacts(value, code = 'SOURCE_EVENT_INVALID') {
  const s = closed(value, SOURCE_KEYS);
  if (!SOURCE_EVENT_FAMILIES.includes(s.sourceFamily) || !text(s.recordId, 512) ||
      !(s.sourceRevision === null || text(s.sourceRevision, 512)))
    return refuse(code);
  return {sourceFamily: s.sourceFamily, recordId: s.recordId, sourceRevision: s.sourceRevision};
}

/** The canonical immutable producer fact set. Producer and receiver must derive this identically. */
export function sourceEventFacts(value) {
  const f = closed(value, ['tenantId', 'source', 'alert']);
  if (!text(f.tenantId, 256)) return refuse('SOURCE_EVENT_INVALID');
  return data({tenantId: f.tenantId, alert: alertFacts(f.alert), source: sourceFacts(f.source)});
}

/** The producer fact digest carried as the event hash. Content, never authority. */
export const sourceEventFactHash = facts => canonicalSha256({
  protocol: `${SOURCE_EVENT_PROTOCOL}.bizdev.watch.alert/1`,
  tenantId: facts.tenantId,
  alert: facts.alert,
  source: facts.source,
});

/** Validate and freeze the closed inbound envelope. */
export function snapshotSourceEvent(value) {
  const e = closed(value, ['schemaVersion', 'producer', 'tenantId', 'eventId', 'eventHash', 'occurredAt', 'routine', 'source', 'alert']);
  if (e.schemaVersion !== SOURCE_EVENT_SCHEMA_VERSION) return refuse('SOURCE_EVENT_INVALID');
  if (!SOURCE_EVENT_PRODUCERS.includes(e.producer)) return refuse('SOURCE_EVENT_PRODUCER');
  if (!text(e.tenantId, 256)) return refuse('SOURCE_EVENT_INVALID');
  if (!uuid(e.eventId)) return refuse('SOURCE_EVENT_INVALID');
  if (!hex64(e.eventHash)) return refuse('SOURCE_EVENT_INVALID');
  instant(e.occurredAt);
  const routine = closed(e.routine, ['scheduleId', 'generation']);
  if (!uuid(routine.scheduleId) || !integer(routine.generation, 1)) return refuse('SOURCE_EVENT_INVALID');
  const event = data({
    schemaVersion: SOURCE_EVENT_SCHEMA_VERSION, producer: e.producer, tenantId: e.tenantId, eventId: e.eventId,
    eventHash: e.eventHash, occurredAt: e.occurredAt,
    routine: {scheduleId: routine.scheduleId, generation: routine.generation},
    source: sourceFacts(e.source), alert: alertFacts(e.alert),
  });
  // The envelope must be self-consistent before it is worth any Core round-trip.
  if (sourceEventFactHash({tenantId: event.tenantId, alert: event.alert, source: event.source}) !== event.eventHash) return refuse('SOURCE_EVENT_HASH');
  return event;
}

/**
 * Validate and freeze the closed binding-read request (a producer asking Meri's durable owner
 * which approved routine generation, if any, is bound to this producer/resource pair).
 */
export function snapshotSourceEventBindingRequest(value) {
  const b = closed(value, ['schemaVersion', 'producer', 'tenantId', 'sourceFamily', 'resourceKey']);
  if (b.schemaVersion !== SOURCE_EVENT_SCHEMA_VERSION) return refuse('SOURCE_EVENT_INVALID');
  if (!SOURCE_EVENT_PRODUCERS.includes(b.producer)) return refuse('SOURCE_EVENT_PRODUCER');
  if (!text(b.tenantId, 256) || !SOURCE_EVENT_FAMILIES.includes(b.sourceFamily) || !text(b.resourceKey, 256))
    return refuse('SOURCE_EVENT_INVALID');
  return data({schemaVersion: SOURCE_EVENT_SCHEMA_VERSION, producer: b.producer, tenantId: b.tenantId,
    sourceFamily: b.sourceFamily, resourceKey: b.resourceKey});
}

/**
 * Identity is (producer, tenant, eventId) ONLY — deliberately excluding the bytes, so a
 * redelivery with different bytes is recognisable as the same identity with a hash conflict
 * instead of a second accepted event.
 */ export const sourceEventIdentity = event => data({
  protocol: SOURCE_EVENT_PROTOCOL, producer: event.producer, tenantId: event.tenantId, eventId: event.eventId,
});

export const sourceEventKey = event => canonicalSha256(sourceEventIdentity(event));

/** Validate and freeze the canonical Core receipt (proposed contract, CLAIM.txt section 2). */
export function snapshotSourceEventReceipt(value) {
  const r = closed(value, ['schemaVersion', 'producer', 'tenantId', 'eventId', 'eventHash', 'alert', 'watch', 'consent', 'checkedAtMs', 'expiresAtMs'], [], 'SOURCE_EVENT_RECEIPT');
  if (r.schemaVersion !== SOURCE_EVENT_SCHEMA_VERSION || !SOURCE_EVENT_PRODUCERS.includes(r.producer)) return refuse('SOURCE_EVENT_RECEIPT');
  if (!text(r.tenantId, 256) || !uuid(r.eventId) || !hex64(r.eventHash)) return refuse('SOURCE_EVENT_RECEIPT');
  const receiptAlert = closed(r.alert, [...ALERT_KEYS, ...SOURCE_KEYS], [], 'SOURCE_EVENT_RECEIPT');
  const alert = alertFacts(pick(receiptAlert, ALERT_KEYS), 'SOURCE_EVENT_RECEIPT');
  const source = sourceFacts(pick(receiptAlert, SOURCE_KEYS), 'SOURCE_EVENT_RECEIPT');
  const watch = closed(r.watch, ['ownerActorId', 'status', 'membership', 'clientId', 'sourceState'], [], 'SOURCE_EVENT_RECEIPT');
  // The client id is Core's own opaque resource identifier: Meri compares it with the approved
  // scope's resource id and never re-formats it, so here it only has to be text or absent.
  if (!text(watch.ownerActorId, 256) || !SOURCE_EVENT_WATCH_STATES.includes(watch.status) ||
      !['active', 'inactive'].includes(watch.membership) || !(watch.clientId === null || text(watch.clientId, 256)) ||
      !SOURCE_EVENT_SOURCE_STATES.includes(watch.sourceState))
    return refuse('SOURCE_EVENT_RECEIPT');
  const consent = closed(r.consent, ['consentId', 'state', 'expiresAtMs'], [], 'SOURCE_EVENT_RECEIPT');
  if (!(consent.consentId === null || uuid(consent.consentId)) || !SOURCE_EVENT_CONSENT_STATES.includes(consent.state) ||
      !Number.isSafeInteger(consent.expiresAtMs))
    return refuse('SOURCE_EVENT_RECEIPT');
  if (!Number.isSafeInteger(r.checkedAtMs) || !Number.isSafeInteger(r.expiresAtMs)) return refuse('SOURCE_EVENT_RECEIPT');
  // The receipt carries the producer facts and the source identity together; they are re-emitted
  // as two closed fact sets so a consumer can never see an extendable object.
  return data({
    schemaVersion: SOURCE_EVENT_SCHEMA_VERSION, producer: r.producer, tenantId: r.tenantId, eventId: r.eventId,
    eventHash: r.eventHash,
    alert, source,
    watch: {ownerActorId: watch.ownerActorId, status: watch.status, membership: watch.membership, clientId: watch.clientId, sourceState: watch.sourceState},
    consent: {consentId: consent.consentId, state: consent.state, expiresAtMs: consent.expiresAtMs},
    checkedAtMs: r.checkedAtMs, expiresAtMs: r.expiresAtMs,
  });
}

/** The provider-supplied disposition code is the only free-form text this lane ever stores. */
export const snapshotSourceEventCode = code => {
  if (code === null || code === undefined) return null;
  if (!text(code, 64) || !CODE.test(code)) return refuse('SOURCE_EVENT_INVALID');
  return code;
};

export const isSourceEventDisposition = value => Object.values(SOURCE_EVENT_DISPOSITIONS).includes(value);
