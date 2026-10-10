import type { UIMessageChunk, UIMessageStreamOutcome } from 'ai';
import type { UIEvent } from '@capiro/meri-contracts';
export interface MeriStreamOptions {
    /** Stable id for the transport message envelope (not a frozen event field). */
    messageId: string;
    /** Frozen events, already authorized and ordered for this subscription. */
    events: readonly UIEvent[];
    /** Operation-level outcome for the composed stream; defaults to completed. */
    outcome?: UIMessageStreamOutcome;
}
/**
 * Emits a stable `start` envelope, one `data-meri-event` chunk per frozen event
 * (with `id = event.eventId` and `transient: true`), a `finish`, and an explicit
 * stream outcome. The outcome describes this subscription only; it is not proof
 * that the durable run completed.
 */
export declare function createMeriEventStream(options: MeriStreamOptions): ReadableStream<UIMessageChunk>;
/** Wraps the event stream as a standard SSE web `Response`. */
export declare function meriEventStreamResponse(options: MeriStreamOptions): Response;
