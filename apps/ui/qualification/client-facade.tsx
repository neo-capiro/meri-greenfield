// Client facade (compiled for type-checking only; not mounted in this qualification).
//
// One external `Chat` per conversation/authorized view. The `Chat` is exported by
// `@ai-sdk/react` and extends `ai.AbstractChat`. It is driven by the guarded
// `MeriGuardedTransport` (which wraps the upstream public `DefaultChatTransport`).
//
// `useChat({ chat })` (externally managed) preserves the transport's
// `resumeStreamIsReplay`/`close`; inline `useChat({ transport })` at this exact pin
// forwards only `sendMessages`/`reconnectToStream` and drops those flags. Automatic
// resubmission is disabled. Nothing is mounted and no browser/React render runs here.

import { Chat, useChat } from '@ai-sdk/react';
import type { UseChatHelpers } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MeriGuardedTransport } from './guarded-transport.ts';
import type { MeriGuardedTransportOptions } from './guarded-transport.ts';
import { ConversationProjection } from './projection.ts';
import type { AuthorizedView } from './projection.ts';
import type { MeriUIMessage, UIEventValidator } from './types.ts';

export interface CreateMeriChatOptions {
  view: AuthorizedView;
  /** Injected frozen-contract validator (the unchanged root validator in Node tests). */
  validateEvent: UIEventValidator;
  api?: string;
  /** Test/mocked fetch. A production deployment injects its authenticated fetch here. */
  fetchImpl?: typeof fetch;
}

export interface MeriChatHandle {
  chat: Chat<MeriUIMessage>;
  transport: MeriGuardedTransport;
  projection: ConversationProjection;
}

function toHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (headers === undefined) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...(headers as Record<string, string>) };
}

/**
 * Builds one externally managed `Chat` for a conversation/authorized view. The
 * reconnect request sends the last accepted contiguous conversation sequence in an
 * authenticated header (not the SSE `Last-Event-ID`). No `dataPartSchemas` is
 * registered: at this pin the runtime key (`data-meri-event`) differs from the typed
 * key (`meri-event`), so schema registration does not validate frozen events; the
 * guard is the enforcement boundary.
 */
export function createMeriChat(options: CreateMeriChatOptions): MeriChatHandle {
  const projection = new ConversationProjection(options.view);
  const api = options.api ?? '/api/chat';

  const inner = new DefaultChatTransport<MeriUIMessage>({
    api,
    ...(options.fetchImpl ? { fetch: options.fetchImpl } : {}),
    prepareSendMessagesRequest: ({ body, headers }) => ({
      // The client-sent conversation id/messages are untrusted; send an intended command only.
      body: { ...body, command: { conversationId: options.view.conversationId, intent: 'view.subscribe' } },
      headers: toHeaderRecord(headers),
    }),
    prepareReconnectToStreamRequest: ({ headers }) => ({
      headers: {
        ...toHeaderRecord(headers),
        'x-meri-resume-sequence': String(projection.currentCursor),
      },
    }),
  });

  const guardOptions: MeriGuardedTransportOptions = {
    inner,
    validateEvent: options.validateEvent,
    onEvent: (event) => {
      projection.accept(event);
    },
  };
  const transport = new MeriGuardedTransport(guardOptions);

  const chat = new Chat<MeriUIMessage>({
    transport,
    sendAutomaticallyWhen: () => false,
    onError: () => {
      // Transport error is surfaced through chat state; it is never treated as a run result.
    },
    onData: () => {
      // Unawaited, non-persisting observer only. Projection is driven by the guard sink.
    },
  });

  return { chat, transport, projection };
}

/** Facade over an externally managed chat; `resume` is disabled. */
export function useMeriChat(chat: Chat<MeriUIMessage>): UseChatHelpers<MeriUIMessage> {
  return useChat<MeriUIMessage>({ chat, resume: false });
}

/** Subscriber detach/dispose. Never issues a durable run cancellation. */
export async function detachMeriView(handle: MeriChatHandle): Promise<void> {
  await handle.chat.dispose();
}

export type { AuthorizedView };
