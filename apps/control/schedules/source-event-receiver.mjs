/**
 * MB-05 closed source-event receiver.
 *
 * One inbound producer event, one dispatch attempt, one durable disposition. The receiver owns
 * NO authority of its own: the producer identity and every canonical fact are re-read from Core
 * custody over the existing service-identity transport, the approved binding is re-read from the
 * schedule schema, and the current routine generation is re-read through the existing schedule
 * owner before anything is released to the existing occurrence/Temporal dispatch owner.
 *
 * The event carries no prompt, scope grant, destination, budget or run identifier; the
 * destination, work, limits and retry come from the durable approved routine.
 *
 * Ordering that the tests pin down:
 *   resolve producer (Core) -> agree canonical facts -> current membership/client/source consent
 *   -> approved binding -> current generation/task pins -> DURABLE ACCEPT -> dispatch -> settle.
 * Nothing is dispatched before the accepted row exists, and a redelivery never produces a second
 * effect (same event identity => same occurrence key; terminal rows are frozen).
 */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {
  SOURCE_EVENT_DISPOSITIONS, SourceEventError, refuse, snapshotSourceEvent, snapshotSourceEventReceipt,
  sourceEventFactHash, sourceEventFacts, sourceEventKey,
} from './source-event-contract.mjs';
import {occurrenceIdentity, sourceEventOccurrence, sourceEventWorkflowId} from './scheduled-occurrence.mjs';

const D = SOURCE_EVENT_DISPOSITIONS;
const RETRYABLE_DISPATCH = new Set(['SCHEDULE_OCCURRENCE_UNRESOLVED']);
const field = (value, name) => {
  if (!value || typeof value !== 'object' || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\u0000');

/** Non-widening client agreement: the approved scope set must cover the owner/client Core reports now. */
function clientAgreement(scopes, ownerActor, clientId) {
  if (clientId === null)
    return scopes.some(s => s.kind === 'private-user' && s.resourceId === ownerActor);
  return scopes.some(s => s.kind !== 'private-user' && s.resourceId === clientId);
}

export function createSourceEventReceiver(configuration) {
  // A missing or malformed port set is a configuration refusal of THIS receiver, never the
  // shared contracts' generic boundary error.
  const c = (() => {
    try {
      return own(configuration, ['store', 'binding', 'scheduleOwner', 'core', 'dispatch', 'now'], ['maxRequestMs']);
    } catch {
      return refuse('SOURCE_EVENT_PORTS');
    }
  })();
  // Port methods are read through own descriptors: a getter is never invoked and a missing
  // method is a configuration refusal, not a runtime surprise mid-receipt.
  const methods = (port, names) => {
    if (!port || typeof port !== 'object' || types.isProxy(port)) refuse('SOURCE_EVENT_PORTS');
    const captured = Object.create(null);
    for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(port, name);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function') refuse('SOURCE_EVENT_PORTS');
      captured[name] = descriptor.value.bind(port);
    }
    return captured;
  };
  const store = methods(c.store, ['accept', 'settle', 'read']);
  const binder = methods(c.binding, ['read']);
  const scheduleOwner = methods(c.scheduleOwner, ['readFiring']);
  const core = methods(c.core, ['readSourceEvent']);
  const dispatch = methods(c.dispatch, ['dispatch']).dispatch;
  const maxRequestMs = c.maxRequestMs ?? 15000;
  if (typeof c.now !== 'function' || !Number.isSafeInteger(maxRequestMs) || maxRequestMs < 1 || maxRequestMs > 60000)
    refuse('SOURCE_EVENT_PORTS');
  const captured = {store, binder, scheduleOwner, core, dispatch, now: c.now, maxRequestMs};

  /**
   * The one Core custody read. A SourceEventError raised by the transport/custody reader is
   * authoritative and propagates unchanged; anything else means the canonical fact could not be
   * established, which is UNAVAILABLE — the receiver never converts that into a disposition.
   */
  async function custodyRead(event, check) {
    const request = {
      schemaVersion: event.schemaVersion, producer: event.producer, tenantId: event.tenantId, eventId: event.eventId,
      eventHash: event.eventHash, scheduleId: event.routine.scheduleId, generation: event.routine.generation,
    };
    try {
      return await captured.core.readSourceEvent(request, {check});
    } catch (error) {
      if (error instanceof SourceEventError) throw error;
      return refuse('SOURCE_EVENT_UNAVAILABLE');
    }
  }

  /** Durable terminal disposition recorded before any dispatch (or an existing row that outranks it). */
  async function recorded(unit, state, code, check) {
    const accepted = await captured.store.accept({
      tenantId: unit.event.tenantId, producer: unit.event.producer, eventId: unit.event.eventId,
      eventKey: unit.eventKey, eventHash: unit.event.eventHash, occurredAt: unit.event.occurredAt,
      scheduleId: unit.scheduleId, generation: unit.generation, occurrenceKey: unit.occurrenceKey,
      state, code,
    }, check);
    check();
    const disposition = state === 'SKIPPED' ? D.SKIPPED : state === 'UNKNOWN' ? D.UNKNOWN : D.REFUSED;
    if (accepted.outcome === 'CONFLICT')
      return result(unit, D.CONFLICT, 'SOURCE_EVENT_IDENTITY_CONFLICT', {recorded: null});
    if (accepted.outcome === 'SETTLED')
      return result(unit, D.DEDUPED, accepted.row.code, {recorded: accepted.row.state});
    // A row already accepted and not yet settled is never overwritten by a later refusal: the
    // accepted work stays visible and retryable, and this attempt reports its own truthful outcome.
    return result(unit, disposition, code, {
      recorded: accepted.outcome === 'REPLAY' ? accepted.row.state : null,
      priorOutstanding: accepted.outcome === 'REPLAY',
    });
  }

  function result(unit, disposition, code, extra = {}) {
    const wanted = (name, fallback) => (Object.hasOwn(extra, name) ? extra[name] : fallback);
    const occurrenceKey = wanted('occurrenceKey', unit.occurrenceKey ?? null);
    const binding = unit.run ?? null;
    return Object.freeze({
      disposition, code: code ?? null,
      producer: unit.event.producer, tenantId: unit.event.tenantId, eventId: unit.event.eventId,
      eventKey: unit.eventKey, eventHash: unit.event.eventHash,
      accepted: wanted('accepted', unit.accepted === true),
      dispatched: wanted('dispatched', unit.dispatched === true),
      occurrenceKey,
      recorded: wanted('recorded', null),
      priorOutstanding: wanted('priorOutstanding', false),
      causality: Object.freeze({
        eventKey: unit.eventKey,
        producer: unit.event.producer,
        eventId: unit.event.eventId,
        scheduleId: unit.scheduleId ?? null,
        generation: unit.generation ?? null,
        occurrenceKey,
        conversationId: binding?.conversationId ?? null,
        runId: binding?.runId ?? null,
        attemptId: binding?.attemptId ?? null,
        // The current continuation and its completeness belong to the existing job-lineage and
        // temporal-run-history owners; this lane never asserts more than it observed.
        continuation: null,
        historyComplete: false,
      }),
    });
  }

  /**
   * Receive exactly one producer event. `value.raw` is the closed envelope, `value.deadlineMs`
   * the caller's deadline and `value.check` the owning operation lifetime.
   */
  async function receive(value) {
    const unit = own(value, ['raw', 'check'], ['deadlineMs']);
    if (typeof unit.check !== 'function') refuse('SOURCE_EVENT_PORTS');
    const check = unit.check;
    const event = snapshotSourceEvent(unit.raw);
    const eventKey = sourceEventKey(event);
    const subject = Object.freeze({
      event, eventKey, scheduleId: null, generation: null, occurrenceKey: null, accepted: false, dispatched: false, run: null,
    });
    check();

    // 1. Producer identity and canonical facts are resolved through the existing Core service
    //    transport; a caller-supplied producer claim is never authority. A transport that cannot
    //    answer is UNAVAILABLE (fail-closed, nothing written) — never a raw transport error that
    //    could be mistaken for a truthful refusal, and never a silent acceptance.
    const receipt = snapshotSourceEventReceipt(await custodyRead(event, check));
    check();
    if (receipt.producer !== event.producer || receipt.tenantId !== event.tenantId || receipt.eventId !== event.eventId)
      return recorded(subject, 'REFUSED', 'SOURCE_EVENT_IDENTITY', check);
    if (receipt.eventHash !== event.eventHash ||
        sourceEventFactHash({tenantId: receipt.tenantId, alert: receipt.alert, source: receipt.source}) !== event.eventHash)
      return recorded(subject, 'REFUSED', 'SOURCE_EVENT_HASH', check);
    if (receipt.checkedAtMs < 0 || receipt.expiresAtMs <= receipt.checkedAtMs || receipt.expiresAtMs <= captured.now())
      return recorded(subject, 'REFUSED', 'SOURCE_EVENT_RECEIPT', check);

    // 2. Current membership / source / consent must agree with the approved routine.
    if (receipt.watch.status !== 'active') return recorded(subject, 'SKIPPED', 'SOURCE_EVENT_WATCH_INACTIVE', check);
    if (receipt.watch.membership !== 'active') return recorded(subject, 'SKIPPED', 'SOURCE_EVENT_MEMBERSHIP_INACTIVE', check);
    if (receipt.watch.sourceState !== 'current') return recorded(subject, 'SKIPPED', 'SOURCE_EVENT_SOURCE_STATE', check);
    if (receipt.consent.state !== 'active' || receipt.consent.expiresAtMs <= captured.now())
      return recorded(subject, 'SKIPPED', 'SOURCE_EVENT_CONSENT', check);
    if (!text(receipt.consent.consentId ?? '', 64)) return recorded(subject, 'SKIPPED', 'SOURCE_EVENT_CONSENT', check);

    // 3. The approved durable event binding for this producer/resource pair.
    const binding = await captured.binder.read({
      tenantId: event.tenantId, scheduleId: event.routine.scheduleId, producer: event.producer,
      sourceFamily: event.source.sourceFamily, resourceKey: event.alert.watchId,
    }, check);
    check();
    if (!binding) return recorded(subject, 'REFUSED', 'SOURCE_EVENT_BINDING_ABSENT', check);
    const bound = Object.freeze({
      ...subject, scheduleId: binding.scheduleId, generation: binding.generation,
    });
    if (binding.scheduleId !== event.routine.scheduleId || binding.generation !== event.routine.generation)
      return recorded(bound, 'REFUSED', 'SOURCE_EVENT_BINDING_STALE', check);
    if (binding.ownerActorId !== receipt.watch.ownerActorId) return recorded(bound, 'REFUSED', 'SOURCE_EVENT_OWNER', check);
    if (!clientAgreement(binding.scopes, binding.ownerActorId, receipt.watch.clientId))
      return recorded(bound, 'REFUSED', 'SOURCE_EVENT_CLIENT', check);

    // 4. The bound generation must still be the current, approved, unpaused routine.
    const firing = await captured.scheduleOwner.readFiring({tenantId: event.tenantId, scheduleId: binding.scheduleId}, check);
    check();
    if (!firing) return recorded(bound, 'REFUSED', 'SOURCE_EVENT_ROUTINE_ABSENT', check);
    if (firing.projection.state !== 'active') return recorded(bound, 'REFUSED', 'SOURCE_EVENT_ROUTINE_INACTIVE', check);
    if (firing.generation !== binding.generation || canonicalSha256(firing.projection) !== binding.projectionSha256 ||
        !firing.intent || canonicalSha256(firing.intent) !== binding.intentSha256)
      return recorded(bound, 'REFUSED', 'SOURCE_EVENT_SUPERSEDED', check);
    if (firing.activeIntent !== null) return recorded(bound, 'REFUSED', 'SOURCE_EVENT_ROUTINE_UNRESOLVED', check);
    if (canonicalSha256(firing.intent.configuration?.task) !== canonicalSha256(binding.task))
      return recorded(bound, 'REFUSED', 'SOURCE_EVENT_TASK', check);

    // 5. Occurrence identity is derived from server-set facts only (event instant + event-key
    //    derived workflow id), so a crash/redelivery of the same event names the same run.
    const occurrence = sourceEventOccurrence({
      projection: firing.projection, generation: firing.generation, task: firing.intent.configuration.task,
      eventKey, occurredAt: event.occurredAt,
      workflowId: sourceEventWorkflowId(eventKey, binding.scheduleId, binding.generation),
    });
    const identity = occurrenceIdentity(occurrence);
    check();

    // 6. Durable accepted lineage BEFORE any dispatch; no second effect on a lost ACK or replay.
    const accepted = await captured.store.accept({
      tenantId: event.tenantId, producer: event.producer, eventId: event.eventId, eventKey,
      eventHash: event.eventHash, occurredAt: event.occurredAt,
      scheduleId: binding.scheduleId, generation: binding.generation, occurrenceKey: identity.occurrenceKey,
      state: 'ACCEPTED', code: null,
    }, check);
    check();
    const acceptedUnit = Object.freeze({
      ...subject, scheduleId: binding.scheduleId, generation: binding.generation,
      occurrenceKey: identity.occurrenceKey, run: identity.binding, accepted: true,
    });
    if (accepted.outcome === 'CONFLICT') return result(acceptedUnit, D.CONFLICT, 'SOURCE_EVENT_IDENTITY_CONFLICT');
    if (accepted.outcome === 'SETTLED')
      return result(acceptedUnit, D.DEDUPED, accepted.row.code, {recorded: accepted.row.state, accepted: accepted.row.state !== 'REFUSED' && accepted.row.state !== 'SKIPPED'});
    if (accepted.row.occurrenceKey !== identity.occurrenceKey)
      return result(acceptedUnit, D.CONFLICT, 'SOURCE_EVENT_IDENTITY_CONFLICT', {occurrenceKey: accepted.row.occurrenceKey});

    // 7. Release to the existing occurrence/Temporal dispatch owner. Its own fence, catch-up
    //    window, overlap barrier and backpressure apply unchanged.
    const dispatched = await dispatch({occurrence});
    check();
    const outcome = field(dispatched, 'outcome'), code = field(dispatched, 'code');
    let state, disposition, settledCode;
    if (outcome === 'DISPATCHED') {
      state = 'DISPATCHED'; disposition = D.DISPATCHED; settledCode = null;
    } else if (outcome === 'ACTIVE') {
      state = 'QUEUED'; disposition = D.QUEUED; settledCode = null;
    } else if (outcome === 'UNKNOWN') {
      state = 'UNKNOWN'; disposition = D.UNKNOWN; settledCode = text(code, 64) ? code : null;
    } else if (outcome === 'REFUSED' && RETRYABLE_DISPATCH.has(code)) {
      // An open occurrence is backpressure, not a refusal of the event: it stays accepted and
      // retryable so already accepted work is never silently lost.
      state = 'QUEUED'; disposition = D.QUEUED; settledCode = code;
    } else if (outcome === 'REFUSED') {
      state = 'REFUSED'; disposition = D.REFUSED; settledCode = text(code, 64) ? code : null;
    } else {
      return result(acceptedUnit, D.UNKNOWN, 'SOURCE_EVENT_DISPATCH_UNKNOWN');
    }
    const settled = await captured.store.settle({
      tenantId: event.tenantId, producer: event.producer, eventId: event.eventId, eventHash: event.eventHash,
      state, code: settledCode, occurrenceKey: identity.occurrenceKey,
    }, check);
    check();
    if (!settled.settled)
      return result(acceptedUnit, D.DEDUPED, settled.row.code, {recorded: settled.row.state});
    return result(acceptedUnit, disposition, settledCode, {
      dispatched: disposition === D.DISPATCHED, recorded: settled.row.state, occurrenceKey: settled.row.occurrenceKey,
    });
  }

  return Object.freeze({receive});
}
