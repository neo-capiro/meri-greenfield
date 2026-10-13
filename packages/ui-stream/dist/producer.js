// Producer: projects already-authorized frozen Meri events onto the upstream AI SDK
// UI message stream. No model/provider call is made and no native text/tool/reasoning
// chunk is emitted; the custom `data-meri-event` data part is the only event channel.
//
// This uses the upstream `createUIMessageStream` / `createUIMessageStreamResponse`
// helpers directly instead of a replacement SSE/parser framework.
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { MERI_EVENT_DATA_PART } from './protocol.js';
/**
 * Emits a stable `start` envelope, one `data-meri-event` chunk per frozen event
 * (with `id = event.eventId` and `transient: true`), a `finish`, and an explicit
 * stream outcome. The outcome describes this subscription only; it is not proof
 * that the durable run completed.
 */
export function createMeriEventStream(options) {
    const { messageId, events, outcome = { status: 'completed' } } = options;
    return createUIMessageStream({
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
export function meriEventStreamResponse(options) {
    return createUIMessageStreamResponse({ stream: createMeriEventStream(options) });
}
/** Projects a live event source through upstream merge so cancellation reaches its reader. */
export function createMeriLiveEventStream(options) {
    return createUIMessageStream({
        onError: () => 'Meri event subscription unavailable',
        execute({ writer }) {
            writer.write({ type: 'start', messageId: options.messageId });
            writer.merge(options.events.pipeThrough(new TransformStream({
                transform(event, controller) {
                    controller.enqueue({ type: MERI_EVENT_DATA_PART, id: event.eventId, data: event, transient: true });
                },
                flush(controller) {
                    controller.enqueue({ type: 'finish' });
                    writer.setOutcome({ status: 'completed' });
                },
            })));
        },
    });
}
export function meriLiveEventStreamResponse(options) {
    return createUIMessageStreamResponse({ stream: createMeriLiveEventStream(options) });
}
