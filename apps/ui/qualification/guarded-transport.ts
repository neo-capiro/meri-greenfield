// Guarded chat transport: an upstream `ChatTransport` implementation that decodes and
// validates every UI chunk before it reaches projection. It wraps (does not replace)
// the upstream public `DefaultChatTransport`/`ChatTransport`.
//
// Why an explicit guard boundary is required: at this exact pin the AI SDK validates
// `dataPartSchemas[chunk.type]`, i.e. the runtime key is `data-meri-event`, while the
// `dataPartSchemas` TYPE is keyed by the unprefixed data-type name `meri-event`. A
// type-correct registration therefore never runs at runtime. The guard below enforces
// the frozen UIEvent contract explicitly and requires chunk.id equality.

import type { ChatTransport, UIMessageChunk } from 'ai';
import type { MeriUIMessage, UIEvent, UIEventValidator } from './types.ts';
import { MERI_EVENT_DATA_PART } from './types.ts';

/** Frames that are part of the frozen custom-event path or the stream lifecycle. */
const ALLOWED_FRAME_TYPES = new Set<string>([
  'start',
  'finish',
  'abort',
  'message-metadata',
  'start-step',
  'finish-step',
  'reset-step',
  'error',
  MERI_EVENT_DATA_PART,
]);

export type UiTransportGuardErrorCode =
  | 'meri-event-missing-id'
  | 'meri-event-invalid'
  | 'meri-event-id-mismatch'
  | 'unexpected-frame';

export class UiTransportGuardError extends Error {
  readonly code: UiTransportGuardErrorCode;
  readonly chunkType: string;

  constructor(code: UiTransportGuardErrorCode, message: string, chunkType: string) {
    super(message);
    this.name = 'UiTransportGuardError';
    this.code = code;
    this.chunkType = chunkType;
  }
}

export interface MeriGuardedTransportOptions {
  inner: ChatTransport<MeriUIMessage>;
  /** Injected boundary validator (offline tests may inject the unchanged root validator). */
  validateEvent: UIEventValidator;
  /** Synchronous sink for each validated event, in stream order. */
  onEvent?: (event: UIEvent) => void;
  /** Observability hook for rejected chunks (does not swallow the rejection). */
  onRejected?: (error: UiTransportGuardError, chunk: UIMessageChunk) => void;
}

/**
 * Validates a single decoded UI chunk. Returns the validated event for a custom
 * Meri frame, or `null` for an allowed lifecycle frame. Throws a
 * `UiTransportGuardError` for any malformed, mismatched or unexpected frame.
 */
export function guardUiChunk(
  chunk: UIMessageChunk,
  validateEvent: UIEventValidator,
): UIEvent | null {
  if (chunk.type === MERI_EVENT_DATA_PART) {
    if (typeof chunk.id !== 'string' || chunk.id.length === 0) {
      throw new UiTransportGuardError(
        'meri-event-missing-id',
        'Meri event frame is missing a string id',
        chunk.type,
      );
    }
    let event: UIEvent;
    try {
      event = validateEvent(chunk.data);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'validation failed';
      throw new UiTransportGuardError(
        'meri-event-invalid',
        `Meri event failed frozen-contract validation: ${detail}`,
        chunk.type,
      );
    }
    if (event.eventId !== chunk.id) {
      throw new UiTransportGuardError(
        'meri-event-id-mismatch',
        `Meri event id ${event.eventId} does not match chunk id ${chunk.id}`,
        chunk.type,
      );
    }
    return event;
  }

  if (!ALLOWED_FRAME_TYPES.has(chunk.type)) {
    throw new UiTransportGuardError(
      'unexpected-frame',
      `Unexpected UI frame type "${chunk.type}"`,
      chunk.type,
    );
  }
  return null;
}

interface GuardContext {
  validateEvent: UIEventValidator;
  onEvent: ((event: UIEvent) => void) | undefined;
  onRejected: ((error: UiTransportGuardError, chunk: UIMessageChunk) => void) | undefined;
}

function guardStream(
  source: ReadableStream<UIMessageChunk>,
  context: GuardContext,
): ReadableStream<UIMessageChunk> {
  return source.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        let event: UIEvent | null;
        try {
          event = guardUiChunk(chunk, context.validateEvent);
        } catch (error) {
          if (error instanceof UiTransportGuardError) context.onRejected?.(error, chunk);
          throw error;
        }
        if (event) context.onEvent?.(event);
        controller.enqueue(chunk);
      },
    }),
  );
}

export class MeriGuardedTransport implements ChatTransport<MeriUIMessage> {
  /** Incremental replay: reconnect returns only new events after the accepted cursor. */
  readonly resumeStreamIsReplay = false;

  private readonly inner: ChatTransport<MeriUIMessage>;
  private readonly context: GuardContext;
  private closed = false;

  constructor(options: MeriGuardedTransportOptions) {
    this.inner = options.inner;
    this.context = {
      validateEvent: options.validateEvent,
      onEvent: options.onEvent,
      onRejected: options.onRejected,
    };
  }

  async sendMessages(
    options: Parameters<ChatTransport<MeriUIMessage>['sendMessages']>[0],
  ): Promise<ReadableStream<UIMessageChunk>> {
    const stream = await this.inner.sendMessages(options);
    return guardStream(stream, this.context);
  }

  async reconnectToStream(
    options: Parameters<ChatTransport<MeriUIMessage>['reconnectToStream']>[0],
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    const stream = await this.inner.reconnectToStream(options);
    return stream ? guardStream(stream, this.context) : null;
  }

  /**
   * Releases resources owned by this transport only. It never issues a durable run
   * cancellation; only a separate authorized command may cancel a run.
   */
  close(): void {
    this.closed = true;
    this.inner.close?.();
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
