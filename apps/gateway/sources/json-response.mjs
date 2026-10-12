/** One bounded, strict JSON response reader; caller owns fetch and its lifetime. */
import { types } from 'node:util';
import { deny, parseRawJson } from '../dispatch/operation-result.mjs';

export const cancelBody = body => { try { Promise.resolve(body?.cancel()).catch(() => {}); } catch {} };
export function responseBody(response) {
  if (!response || types.isProxy(response) || !(response instanceof Response)) deny('INVALID_RESULT');
  return response.body;
}
export async function readJsonResponse(response, {lifetime, maxResponseBytes}) {
  let body, reader;
  try {
    body = responseBody(response);
    if (response.status !== 200 || response.redirected ||
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') ?? '') ||
        ![null,'identity'].includes(response.headers.get('content-encoding'))) deny('INVALID_RESULT');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) ||
        Number(length) > maxResponseBytes)) deny('RESOURCE_LIMIT');
    if (!body) deny('INVALID_RESULT');
    reader = body.getReader();
    const decoder = new TextDecoder('utf-8', {fatal:true});
    let bytes = 0, text = '';
    while (true) {
      const part = await lifetime.run(() => reader.read());
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) deny('INVALID_RESULT');
      bytes += part.value.byteLength;
      if (bytes > maxResponseBytes) deny('RESOURCE_LIMIT');
      text += decoder.decode(part.value, {stream:true});
    }
    text += decoder.decode(); lifetime.check();
    if (length !== null && bytes !== Number(length)) deny('INVALID_RESULT');
    return parseRawJson(text, maxResponseBytes, 'INVALID_RESULT');
  } finally {
    // Request cancellation without waiting on an uncooperative transport.
    // Physical socket retirement remains the transport owner's runtime gate.
    if (reader) {
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {}
      try { reader.releaseLock(); } catch {}
    } else cancelBody(body);
  }
}
