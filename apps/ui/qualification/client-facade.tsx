// Client facade (compiled for type-checking only; not mounted in this qualification).
//
// The runtime factory `createMeriChat` lives in `./guarded-transport.ts` (a plain .ts
// module) so the composed path can be exercised directly in offline Node tests without
// transpiling TSX or mounting React. This facade adds the editor-facing hook and a
// detach helper.
//
// One external `Chat` per conversation/authorized view. `Chat` is exported by
// `@ai-sdk/react` and extends `ai.AbstractChat`. `useChat({ chat })` (externally
// managed) preserves the transport's `resumeStreamIsReplay`/`close`; inline
// `useChat({ transport })` at this exact pin forwards only `sendMessages`/
// `reconnectToStream` and drops those flags. Automatic resubmission is disabled.
// Nothing is mounted and no browser/React render runs here.

import { Chat, useChat } from '@ai-sdk/react';
import type { UseChatHelpers } from '@ai-sdk/react';
import { createMeriChat } from './guarded-transport.ts';
import type { CreateMeriChatOptions, MeriChatHandle } from './guarded-transport.ts';
import type { MeriUIMessage } from './types.ts';

export { createMeriChat };
export type { CreateMeriChatOptions, MeriChatHandle };
export type { AuthorizedView } from './projection.ts';

/** Facade over an externally managed chat; `resume` is disabled. */
export function useMeriChat(chat: Chat<MeriUIMessage>): UseChatHelpers<MeriUIMessage> {
  return useChat<MeriUIMessage>({ chat, resume: false });
}

/** Subscriber detach/dispose. Never issues a durable run cancellation. */
export async function detachMeriView(handle: MeriChatHandle): Promise<void> {
  await handle.chat.dispose();
}
