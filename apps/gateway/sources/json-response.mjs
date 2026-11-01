/** One bounded, strict JSON response reader; caller owns fetch and its lifetime. */
import { types } from 'node:util';
import { deny, parseRawJson } from '../dispatch/operation-result.mjs';

export const cancelBody = body => { try { Promise.resolve(body?.cancel()).catch(() => {}); } catch {} };
/** One closed meaning per non-200 source status, so a denied scope, an unsupported route and an unanswered
 * source never collapse into one "invalid result": 401/403 denied; 404/410/501 the route is not served
 * (unsupported operation); 408/425/429 and every 5xx the source did not answer this call; anything else is a
 * malformed result. No status carries source detail and none is an empty result. */
export function sourceStatusCode(status) {
  if (status === 401 || status === 403) return 'ACCESS_DENIED';
  if (status === 404 || status === 410 || status === 501) return 'UNAVAILABLE';
  if (status === 408 || status === 425 || status === 429 || status >= 500) return 'SOURCE_UNAVAILABLE';
  return 'INVALID_RESULT';
}
export function responseBody(response) {
  if (!response || types.isProxy(response) || !(response instanceof Response)) deny('INVALID_RESULT');
  return response.body;
}
export async function readJsonResponse(response, {lifetime, maxResponseBytes}) {
  let body, reader;
  try {
    body = responseBody(response);
    if (response.redirected) deny('INVALID_RESULT');
    if (response.status !== 200) deny(sourceStatusCode(response.status));
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') ?? '') ||
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
