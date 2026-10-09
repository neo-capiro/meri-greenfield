// Producer: projects already-authorized frozen Meri events onto the upstream AI SDK
// UI message stream. No model/provider call is made and no native text/tool/reasoning
// chunk is emitted; the custom `data-meri-event` data part is the only event channel.
//
// This uses the upstream `createUIMessageStream` / `createUIMessageStreamResponse`
// helpers directly instead of a replacement SSE/parser framework.

import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import type { UIMessageChunk, UIMessageStreamOutcome } from 'ai';
import type { MeriUIMessage, UIEvent } from './types.ts';
import { MERI_EVENT_DATA_PART } from './types.ts';

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
export function createMeriEventStream(options: MeriStreamOptions): ReadableStream<UIMessageChunk> {
  const { messageId, events, outcome = { status: 'completed' } } = options;
  return createUIMessageStream<MeriUIMessage>({
    execute({ writer }) {
      writer.write({ type: 'start', messageId });
      for (const event of events) {
        writer.write({
          type: MERI_EVENT_DATA_PART,
          id: event.eventId,
          data: event,
          transient: true,
        });
      }
      writer.write({ type: 'finish' });
      writer.setOutcome(outcome);
    },
  });
}

/** Wraps the event stream as a standard SSE web `Response`. */
export function meriEventStreamResponse(options: MeriStreamOptions): Response {
  return createUIMessageStreamResponse({ stream: createMeriEventStream(options) });
}
