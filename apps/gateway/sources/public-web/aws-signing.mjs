/** Minimal AWS Signature Version 4 for the AgentCore Gateway MCP endpoint.
 * The runtime's existing role supplies credentials through the ordinary AWS chain;
 * this module adds no dependency, no key storage and no ambient network call at import. */
import {createHash,createHmac} from 'node:crypto';

const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value, 'utf8').digest();
const fail = code => { throw Object.assign(Error(code), {code}); };

/** Canonical `YYYYMMDD'T'HHMMSS'Z'` for a millisecond instant. */
export function amzDate(nowMs) {
  if (!Number.isSafeInteger(nowMs)) fail('INVALID_INSTANT');
  return new Date(nowMs).toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}/u, '');
}

/** RFC 3986 encoding used by SigV4 canonical query strings. */
const encodeRfc3986 = value => encodeURIComponent(value).replace(/[!'()*]/gu, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * @param {{method:string,url:string|URL,body:string,region:string,service:string,
 *  credentials:{accessKeyId:string,secretAccessKey:string,sessionToken?:string},nowMs:number}} c
 * @returns {{headers:Record<string,string>}}
 */
export function signAwsRequest(c) {
  const address = new URL(c.url), service = c.service, region = c.region;
  if (address.protocol !== 'https:' || address.username || address.password) fail('INVALID_ENDPOINT');
  if (typeof c.credentials?.accessKeyId !== 'string' || !c.credentials.accessKeyId ||
      typeof c.credentials?.secretAccessKey !== 'string' || !c.credentials.secretAccessKey) fail('CREDENTIALS_UNAVAILABLE');
  const stamp = amzDate(c.nowMs), day = stamp.slice(0, 8);
  const payload = hash(c.body ?? '');
  const headers = {'content-type': 'application/json', host: address.host, 'x-amz-date': stamp};
  if (c.credentials.sessionToken) headers['x-amz-security-token'] = c.credentials.sessionToken;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map(name => `${name}:${headers[name]}\n`).join('');
  const query = [...address.searchParams].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`).join('&');
  const canonicalRequest = [c.method.toUpperCase(), address.pathname || '/', query, canonicalHeaders, names.join(';'), payload].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', stamp, scope, hash(canonicalRequest)].join('\n');
  let key = hmac(`AWS4${c.credentials.secretAccessKey}`, day);
  for (const part of [region, service, 'aws4_request']) key = hmac(key, part);
  const signature = createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex');
  return {headers: Object.freeze({
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${c.credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  })};
}

/**
 * Standard AWS credential chain for the AgentCore runtime role: process environment,
 * then the container credential endpoint. No static key is read from product config.
 * @param {{env?:Record<string,string|undefined>,fetchImpl?:Function}} [sources]
 * @returns {Promise<{accessKeyId:string,secretAccessKey:string,sessionToken?:string}|undefined>}
 */
export async function resolveAwsCredentials({env = process.env, fetchImpl = globalThis.fetch, signal, maxResponseBytes = 16384} = {}) {
  const staticKey = env.AWS_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY;
  if (typeof staticKey === 'string' && staticKey && typeof env.AWS_SECRET_ACCESS_KEY === 'string' && env.AWS_SECRET_ACCESS_KEY) {
    const sessionToken = env.AWS_SESSION_TOKEN;
    return Object.freeze({accessKeyId: staticKey, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, ...(sessionToken ? {sessionToken} : {})});
  }
  const relative = env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI, full = env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
  const address = relative ? `http://169.254.170.2${relative}` : typeof full === 'string' && /^https?:\/\//u.test(full) ? full : undefined;
  if (address === undefined) return undefined;
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 256 || maxResponseBytes > 65536) fail('CREDENTIALS_UNAVAILABLE');
  if (signal?.aborted) fail('CREDENTIALS_ABORTED');
  const authorization = env.AWS_CONTAINER_AUTHORIZATION_TOKEN;
  const response = await fetchImpl(address, {
    method: 'GET', redirect: 'error', cache: 'no-store', ...(signal === undefined ? {} : {signal}),
    headers: {accept: 'application/json', ...(authorization ? {authorization} : {})},
  });
  if (response.status === 401 || response.status === 403) fail('CREDENTIALS_UNAVAILABLE');
  if (!response.ok) fail('CREDENTIALS_UNAVAILABLE');
  // A credential document is small, fixed and short-lived: read it under the same lifetime and size bound.
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > maxResponseBytes)) fail('CREDENTIALS_UNAVAILABLE');
  if (!response.body) fail('CREDENTIALS_UNAVAILABLE');
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', {fatal: true});
  let bytes = 0, raw = '';
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxResponseBytes) fail('CREDENTIALS_UNAVAILABLE');
      raw += decoder.decode(part.value, {stream: true});
    }
    raw += decoder.decode();
  } finally {
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {}
    try { reader.releaseLock(); } catch {}
  }
  let value;
  try { value = JSON.parse(raw); } catch { fail('CREDENTIALS_UNAVAILABLE'); }
  if (typeof value?.AccessKeyId !== 'string' || typeof value?.SecretAccessKey !== 'string') fail('CREDENTIALS_UNAVAILABLE');
  return Object.freeze({
    accessKeyId: value.AccessKeyId,
    secretAccessKey: value.SecretAccessKey,
    ...(typeof value.Token === 'string' && value.Token ? {sessionToken: value.Token} : {}),
  });
}
