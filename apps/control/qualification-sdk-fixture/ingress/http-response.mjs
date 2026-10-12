// Canonical response transmission for the private mTLS ingress.
//
// Owns exactly two terminal writes: the canonical UTF-8 success body that the
// private wire decoder accepts, and a bodyless content-free transport failure.
// No protocol outcome (including any stale-binding denial) is ever synthesized
// here, and no worker- or handler-supplied text is ever transmitted.
import { statusFor } from './errors.mjs';

const JSON_MEDIA = 'application/json';

/** The socket is closed on every terminal outcome; owned here, not by the caller. */
export function closeSocket(res) {
  try { res?.socket?.destroy(); } catch { /* the connection is already gone */ }
}

/**
 * Transmits validated canonical response bytes as the only 200 this ingress
 * emits: exact media type, exact length, no encoding, no redirect, no keep-alive.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {Buffer} raw canonical UTF-8 bytes produced from a validated response
 */
export function transmitCanonicalResponse(res, raw) {
  res.statusCode = 200;
  res.setHeader('content-type', JSON_MEDIA);
  res.setHeader('content-length', String(raw.length));
  res.setHeader('connection', 'close');
  res.shouldKeepAlive = false;
  res.end(raw);
}

/**
 * Transmits a fixed, bodyless failure and closes the connection. The status is
 * transport metadata for the refusal class; the body is empty and no stale
 * binding, grant or storage outcome is implied.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {string} code one of INGRESS_CODES
 */
export function transmitTransportFailure(res, code) {
  const status = statusFor(code);
  try {
    res.statusCode = status;
    res.setHeader('content-type', JSON_MEDIA);
    res.setHeader('content-length', '0');
    res.setHeader('connection', 'close');
    res.shouldKeepAlive = false;
    res.once('finish', () => closeSocket(res));
    res.end();
  } catch { closeSocket(res); }
  return status;
}
