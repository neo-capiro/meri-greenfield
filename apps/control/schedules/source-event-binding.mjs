/**
 * MB-05 durable approved event binding.
 *
 * An event trigger is only legitimate when an APPROVED routine exists for exactly the
 * producer/resource pair. The approval is the closed `sourceTrigger` field the 0.3 lifecycle owner
 * persists on the acknowledged generation's immutable intent as
 * `intent.configuration.sourceTrigger` — NOT a top-level intent field and NOT the frozen 0.1
 * `ScheduleProjection` (which has no trigger slot and stays unchanged). It is already covered by
 * the existing `intent_sha256` (and the projection by `projection_sha256`), so changing it is a
 * re-approval rather than a silent edit, and it can never be inferred from an ordinary cron, taken
 * from the caller, or taken from the event.
 *
 * The pair is DERIVED from that canonical approved intent. The approved acknowledgement itself
 * (`reconcile`) takes no producer/family/resource argument at all: a Core producer's side argument
 * is never the source of an approval, only a claim that is checked against it.
 *
 * The binding is stored append-only, keyed by generation: a later approved generation appends its
 * own row instead of retargeting the pair, and every producer-facing read is confirmed against the
 * canonical owner's CURRENT acknowledged generation. A paused, superseded, deleted or replaced
 * routine therefore can neither orphan nor retarget a supported binding. New bindings commit
 * atomically with the acknowledged generation. Historical absent rows remain derivable from that
 * generation alone, never by widening or re-approving one.
 */
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertScheduleIntent, canonicalSha256} from './schedule-validators.mjs';
import {refuse} from './source-event-contract.mjs';

const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\u0000');
/** The exact closed trigger field set an approved generation carries on its intent. */
export const SOURCE_EVENT_TRIGGER_KEYS = Object.freeze(['producer', 'sourceFamily', 'resourceKey']);

/**
 * The approved trigger of the validated 0.3 intent, and only when it names EXACTLY this pair.
 * Reading `configuration.sourceTrigger` is the whole authorization: the 0.3 lifecycle owner has
 * already refused an absent selector without a time trigger, a mixed clock/jitter/runNow policy,
 * an unknown family, a non-UUID watch key or any extra field. Absent or mismatched is not an
 * approval, so nothing may be bound from it.
 */
export function approvedSourceTrigger(intent, pair) {
  const trigger = intent?.configuration?.sourceTrigger;
  if (!trigger || typeof trigger !== 'object' || Array.isArray(trigger)) return null;
  const names = Object.keys(trigger);
  if (names.length !== SOURCE_EVENT_TRIGGER_KEYS.length || names.some(name => !SOURCE_EVENT_TRIGGER_KEYS.includes(name)))
    return null;
  return trigger.producer === pair.producer && trigger.sourceFamily === pair.sourceFamily &&
    trigger.resourceKey === pair.resourceKey ? trigger : null;
}

/** Derive the insert-only event binding inside the schedule owner's ACK transaction.
 * Ordinary timed, paused and cancelled intents have no active event binding. */
export function acknowledgedSourceEventBinding(value) {
  if (!value?.configuration?.sourceTrigger) return null;
  const intent = assertScheduleIntent(value, value.projection.owner.tenantId);
  if (intent.projection.state !== 'active' || intent.configuration.paused) return null;
  const trigger = approvedSourceTrigger(intent, intent.configuration.sourceTrigger);
  if (!trigger) refuse('SOURCE_EVENT_TRIGGER_UNAPPROVED');
  const p = intent.projection;
  return {
    tenantId: p.owner.tenantId, scheduleId: p.scheduleId, generation: intent.generation,
    intentSha256: canonicalSha256(intent), projectionSha256: canonicalSha256(p),
    temporalScheduleId: p.temporalScheduleId, ownerActorId: p.owner.actorId,
    producer: trigger.producer, sourceFamily: trigger.sourceFamily, resourceKey: trigger.resourceKey,
    task: intent.configuration.task, scopes: p.scopes,
  };
}

export function createSourceEventBinding({scheduleOwner, store, now = Date.now, log}) {
  if (!scheduleOwner || typeof scheduleOwner.readFiring !== 'function' || !store ||
      typeof store.bind !== 'function' || typeof store.readBinding !== 'function' || typeof now !== 'function')
    refuse('SOURCE_EVENT_BINDING_PORTS');

  function pair(value) {
    const s = data(value);
    if (!text(s.tenantId, 256) || !text(s.scheduleId, 64) || !text(s.producer, 128) ||
        !text(s.sourceFamily, 32) || !text(s.resourceKey, 256))
      refuse('SOURCE_EVENT_INVALID');
    return s;
  }

  function schedule(value) {
    const s = data(value);
    if (!text(s.tenantId, 256) || !text(s.scheduleId, 64)) refuse('SOURCE_EVENT_INVALID');
    return s;
  }

  /**
   * The canonical acknowledged generation of one schedule, as an APPROVED source-triggered
   * routine. `assertScheduleIntent` is the real 0.3 preparation/lifecycle owner: it validates the
   * whole reviewed intent shape (closed selector, source-only policy) before anything is read from
   * it. An unresolved intent, a paused routine, a non-active projection or an intent whose
   * acknowledged generation carries no selector is a refusal, never an empty approval.
   */
  async function approvedGeneration(s, check) {
    const firing = await scheduleOwner.readFiring({tenantId: s.tenantId, scheduleId: s.scheduleId}, check);
    if (!firing) refuse('SOURCE_EVENT_BINDING_ABSENT');
    if (firing.activeIntent !== null || !firing.intent || !firing.intent.configuration ||
        firing.projection.state !== 'active')
      refuse('SOURCE_EVENT_ROUTINE_UNRESOLVED');
    if (firing.intent.configuration.paused === true) refuse('SOURCE_EVENT_ROUTINE_PAUSED');
    const intent = assertScheduleIntent(firing.intent, s.tenantId);
    const trigger = approvedSourceTrigger(intent, intent?.configuration?.sourceTrigger ?? {});
    if (!trigger) refuse('SOURCE_EVENT_TRIGGER_UNAPPROVED');
    return {firing, intent, trigger};
  }

  /** Every append-only row for the pair, newest generation first (the store orders them). */
  const rowsFor = async (s, check) => {
    const rows = await store.readBinding(
      {tenantId: s.tenantId, producer: s.producer, sourceFamily: s.sourceFamily, resourceKey: s.resourceKey}, check);
    return Array.isArray(rows) ? rows : [];
  };

  /**
   * Bind the approved generation of one schedule. Called by the approved-schedule ACKNOWLEDGEMENT
   * path itself, so the pair is DERIVED from the acknowledged intent and no producer argument can
   * select it. Idempotent per (pair, generation); a schedule whose acknowledged generation is not
   * an approved source-triggered routine is a refusal, and nothing is written.
   */
  async function reconcile(value, check = () => {}) {
    const s = schedule(value);
    const {intent, trigger} = await approvedGeneration(s, check);
    const stored = await store.bind(acknowledgedSourceEventBinding(intent), check);
    return Object.freeze({created: stored.created === true, binding: stored.binding,
      sourceTrigger: Object.freeze({...trigger}), boundAtMs: now()});
  }

  /**
   * Bind a CLAIMED pair after checking it against the same canonical approved generation. The
   * claim never creates an approval: a pair the acknowledged generation does not approve is
   * refused and nothing is written.
   */
  async function bind(value, check = () => {}) {
    const claimed = pair(value);
    const {intent} = await approvedGeneration(claimed, check);
    if (!approvedSourceTrigger(intent, claimed)) refuse('SOURCE_EVENT_TRIGGER_UNAPPROVED');
    const stored = await store.bind(acknowledgedSourceEventBinding(intent), check);
    return Object.freeze({created: stored.created === true, binding: stored.binding, boundAtMs: now()});
  }

  const resource = value => {
    const s = data(value);
    if (!text(s.tenantId, 256) || !text(s.producer, 128) || !text(s.sourceFamily, 32) || !text(s.resourceKey, 256))
      refuse('SOURCE_EVENT_INVALID');
    return s;
  };

  /**
   * The binding the routine is CURRENTLY approved by, confirmed against the canonical owner's
   * acknowledged generation and its projection/intent hashes. Null is the honest "this pair has
   * no current approved routine" — never a paused, superseded, deleted or replaced one.
   */
  async function confirmed(s, row, check) {
    const firing = await scheduleOwner.readFiring({tenantId: s.tenantId, scheduleId: row.scheduleId}, check);
    if (!firing || firing.activeIntent !== null || !firing.intent) return null;
    let intent;
    try { intent = assertScheduleIntent(firing.intent, s.tenantId); } catch { return null; }
    if (!approvedSourceTrigger(intent, s)) return null;
    return row.generation === firing.generation && row.projectionSha256 === canonicalSha256(firing.projection) &&
      row.intentSha256 === canonicalSha256(intent) ? row : null;
  }

  /**
   * The stored binding of the routine the event claims. A missing row is not an answer when the
   * schedule's own acknowledged generation IS an approved source-triggered routine: the row is
   * derivable from it, so exactly one derivation is attempted before absence is reported (the
   * acknowledgement crash window). A derivation that fails is reported as absence for THIS event
   * only — the next event or the next acknowledgement derives the same row again, and no argument
   * is trusted in the meantime. An advanced generation is returned as the newer row, so the
   * receiver reports the claim as STALE instead of silently taking the newer approval; the receiver
   * confirms the current generation against the same canonical owner before any effect.
   */
  async function read(value, check = () => {}) {
    const s = pair(value);
    let rows = (await rowsFor(s, check)).filter(row => row.scheduleId === s.scheduleId);
    if (rows.length === 0) {
      try { await reconcile({tenantId: s.tenantId, scheduleId: s.scheduleId}, check); }
      catch (error) {
        if (typeof log === 'function') log({code: 'SOURCE_EVENT_BINDING_RECOVERY', reason: error?.code ?? null});
      }
      rows = (await rowsFor(s, check)).filter(row => row.scheduleId === s.scheduleId);
    }
    return rows.length === 0 ? null : rows[0];
  }

  /**
   * The single approved binding for a producer/resource pair, for the producer-facing read. It is
   * confirmed against the canonical owner, and ambiguity refuses: if the pair is currently
   * approved by more than one routine, no answer is safer than an invented one.
   */
  async function lookup(value, check = () => {}) {
    const s = resource(value);
    const rows = await rowsFor(s, check);
    const approved = [];
    for (const row of rows) {
      const current = await confirmed(s, row, check);
      if (current) approved.push(current);
    }
    if (approved.length === 0) return null;
    if (approved.length > 1) refuse('SOURCE_EVENT_BINDING_CONFLICT');
    return approved[0];
  }

  return Object.freeze({bind, reconcile, read, lookup});
}
