// Conversation-wide projection of frozen Meri events.
//
// Synchronous and dependency-free (browser-safe): cursor acceptance is explicit and
// the durable browser storage layer is later work. The projection is the only place
// that decides whether a validated event is accepted; transport/stream success never
// implies a run completed.
//
// Immutability: every accepted/pending event is a deep-frozen snapshot taken at
// `accept` time, so later mutation of the caller's input object cannot rewrite
// accepted history. `accepted` returns a fresh frozen array; internal state is never
// exposed as a mutable reference.

import type { RunStatusState, UIEvent, RunBinding } from './types.ts';

export type ProjectionStatus = 'accepted' | 'duplicate' | 'conflict' | 'gap' | 'out-of-scope';

export interface ProjectionResult {
  status: ProjectionStatus;
  eventId: string;
  sequence: number;
  /** Last accepted contiguous conversation sequence after handling this event. */
  cursor: number;
  reason?: string;
}

/** The authorized view the projection is scoped to (offline fixture, not authentication). */
export interface AuthorizedView {
  tenantId: string;
  actorId: string;
  conversationId: string;
}

export interface RunStatusProjection {
  state: RunStatusState;
  reasonCode: string | null;
}

/**
 * Raised by `acceptOrReject` on a conflict or out-of-scope outcome, so the guarded
 * data path aborts the subscription before the offending chunk is forwarded.
 */
export class ProjectionRejectionError extends Error {
  readonly result: ProjectionResult;

  constructor(result: ProjectionResult) {
    super(`projection rejected event: ${result.status} (${result.reason ?? 'no reason'})`);
    this.name = 'ProjectionRejectionError';
    this.result = result;
  }
}

/**
 * Synchronous acceptance for the guarded data path: throws `ProjectionRejectionError`
 * on an immutable-event/sequence conflict or an out-of-scope binding. Duplicates
 * (idempotent) and gaps (paused, cursor preserved) are allowed and returned.
 */
export function acceptOrReject(projection: ConversationProjection, event: UIEvent): ProjectionResult {
  const result = projection.accept(event);
  if (result.status === 'conflict' || result.status === 'out-of-scope') {
    throw new ProjectionRejectionError(result);
  }
  return result;
}

/** Deterministic, key-sorted canonical string for immutable payload dedup. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

/** Recursively freezes a JSON-ish value and returns it. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function snapshotEvent(event: UIEvent): UIEvent {
  return deepFreeze(structuredClone(event));
}

function sameView(binding: RunBinding, view: AuthorizedView): boolean {
  return (
    binding.tenantId === view.tenantId &&
    binding.actorId === view.actorId &&
    binding.conversationId === view.conversationId
  );
}

export class ConversationProjection {
  readonly view: AuthorizedView;

  private cursor = 0;
  private readonly byEventId = new Map<string, { payloadKey: string; sequence: number }>();
  private readonly bySequence = new Map<number, { eventId: string; payloadKey: string }>();
  private readonly pending = new Map<number, UIEvent>();
  private readonly ordered: UIEvent[] = [];
  private lastStatus: RunStatusProjection | undefined;
  private streamOutcome: 'unknown' | 'completed' | 'failed' | 'aborted' = 'unknown';

  constructor(view: AuthorizedView) {
    this.view = Object.freeze({ ...view });
  }

  /**
   * Accepts a validated frozen event. Every frozen event is handled exactly once:
   * immutable (eventId + canonical payload) dedup, duplicate-sequence conflict
   * detection, contiguous cursor advance, and gap pausing without advancing the
   * cursor. Legitimate historical prior-fence events are preserved by sequence;
   * stale publication is rejected upstream at the broker, not by discarding history.
   *
   * The stored value is a deep-frozen snapshot: the caller's object is never retained.
   */
  accept(event: UIEvent): ProjectionResult {
    if (!sameView(event.binding, this.view)) {
      return {
        status: 'out-of-scope',
        eventId: event.eventId,
        sequence: event.sequence,
        cursor: this.cursor,
        reason: 'event binding is outside the authorized view',
      };
    }

    const snapshot = snapshotEvent(event);
    const payloadKey = stableStringify(snapshot);

    const existing = this.byEventId.get(snapshot.eventId);
    if (existing) {
      return {
        status: existing.payloadKey === payloadKey ? 'duplicate' : 'conflict',
        eventId: snapshot.eventId,
        sequence: snapshot.sequence,
        cursor: this.cursor,
        reason:
          existing.payloadKey === payloadKey
            ? 'eventId re-delivered with identical payload'
            : 'eventId reused with changed content',
      };
    }

    const sequenceOwner = this.bySequence.get(snapshot.sequence);
    if (sequenceOwner && sequenceOwner.eventId !== snapshot.eventId) {
      return {
        status: 'conflict',
        eventId: snapshot.eventId,
        sequence: snapshot.sequence,
        cursor: this.cursor,
        reason: 'sequence already bound to a different eventId',
      };
    }

    this.byEventId.set(snapshot.eventId, { payloadKey, sequence: snapshot.sequence });
    this.bySequence.set(snapshot.sequence, { eventId: snapshot.eventId, payloadKey });

    if (snapshot.sequence <= this.cursor) {
      return {
        status: 'duplicate',
        eventId: snapshot.eventId,
        sequence: snapshot.sequence,
        cursor: this.cursor,
        reason: 'replay of an already-accepted sequence',
      };
    }

    if (snapshot.sequence === this.cursor + 1) {
      this.commit(snapshot);
      this.drainPending();
      return { status: 'accepted', eventId: snapshot.eventId, sequence: snapshot.sequence, cursor: this.cursor };
    }

    this.pending.set(snapshot.sequence, snapshot);
    return {
      status: 'gap',
      eventId: snapshot.eventId,
      sequence: snapshot.sequence,
      cursor: this.cursor,
      reason: 'out-of-order event paused until the missing sequence arrives',
    };
  }

  private commit(event: UIEvent): void {
    this.ordered.push(event);
    this.cursor = event.sequence;
    if (event.type === 'run.status') {
      this.lastStatus = deepFreeze({ state: event.data.state, reasonCode: event.data.reasonCode });
    }
  }

  private drainPending(): void {
    for (;;) {
      const next = this.pending.get(this.cursor + 1);
      if (!next) return;
      this.pending.delete(this.cursor + 1);
      this.commit(next);
    }
  }

  /** Records the connection/stream outcome separately from any durable run result. */
  setStreamOutcome(outcome: 'unknown' | 'completed' | 'failed' | 'aborted'): void {
    this.streamOutcome = outcome;
  }

  /** A fresh frozen snapshot array; mutating it never affects internal history. */
  get accepted(): readonly UIEvent[] {
    return Object.freeze([...this.ordered]);
  }

  get currentCursor(): number {
    return this.cursor;
  }

  get pendingSequences(): number[] {
    return [...this.pending.keys()].sort((a, b) => a - b);
  }

  get runStatus(): RunStatusProjection | undefined {
    return this.lastStatus;
  }

  get connectionOutcome(): 'unknown' | 'completed' | 'failed' | 'aborted' {
    return this.streamOutcome;
  }

  /**
   * A run is complete only when an authoritative `run.status` event says so.
   * A finish chunk, `[DONE]`, ready hook status or HTTP 204 is never sufficient.
   */
  isRunCompleted(): boolean {
    return this.lastStatus?.state === 'completed';
  }
}

const APPROVED_RUN_ERROR_MESSAGES = new Map<string, string>([
  ['provider_unavailable', 'The assistant service is temporarily unavailable.'],
  ['budget_exceeded', 'The run stopped because its budget was reached.'],
  ['authorization_denied', 'The run stopped because access was not authorized.'],
  ['internal_error', 'The run stopped because of an internal error.'],
]);

/**
 * Renders a `run.error` event by approved code or a generic message. The raw
 * transport/exception text in `event.data.message` is never surfaced.
 */
export function renderRunError(event: Extract<UIEvent, { type: 'run.error' }>): {
  code: string;
  retryable: boolean;
  message: string;
} {
  return {
    code: event.data.code,
    retryable: event.data.retryable,
    message: APPROVED_RUN_ERROR_MESSAGES.get(event.data.code) ?? 'The run stopped because of an error.',
  };
}
