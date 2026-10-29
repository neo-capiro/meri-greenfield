/** Primary public web discovery through the approved AWS managed Web Search MCP target.
 *
 * The target is a model-independent MCP connector (`connectorId: "web-search"`) exposed by an
 * AgentCore Gateway; the Claude SDK loop is unchanged. Discovery is `tools/call` on the gateway
 * `/mcp` endpoint with IAM (SigV4) inbound authorization, so no third-party search key exists and
 * the query is served inside AWS. Playwright and the native page owner keep page interaction.
 *
 * Documented interface (verified 29 October 2026):
 *  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html
 *  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-add-target-api-target-config.html
 *  https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-using-mcp-call.html
 *  https://modelcontextprotocol.io/specification/2025-11-25/server/tools#error-handling
 * Result text is untrusted source material and carries no Capiro authority. */
import {GatewayDenied,deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {cancelBody,responseBody} from '../json-response.mjs';
import {ownFields} from '../source-admission.mjs';
import {signAwsRequest,resolveAwsCredentials} from './aws-signing.mjs';

/** Provider label of the AWS-owned index; distinct from `tavily`, `serper`, `duckduckgo` and from Claude's builtin. */
export const AGENTCORE_SEARCH_PROVIDER = 'agentcore-web-search';
/** Gateway target tool name. One constant feeds the provisioned target configuration and the runtime
 * binding, because the gateway exposes the connector's `configurations[].name` as the MCP tool name. */
export const AGENTCORE_SEARCH_TOOL = 'WebSearch';
/** Official pricing read 29 October 2026 (https://aws.amazon.com/bedrock/agentcore/pricing/):
 * USD 7 per 1000 web searches plus USD 0.005 per 1000 gateway invocations = 7005 microUSD for each
 * submitted `tools/call`, before any additional gateway operation or fee. Managed is not free. */
export const AGENTCORE_SEARCH_UNIT_MICROUSD = 7005;
/** One submitted attempt by default: a retry is a second billable gateway invocation and search. */
export const AGENTCORE_SEARCH_DEFAULT_ATTEMPTS = 1, AGENTCORE_SEARCH_MAX_ATTEMPTS = 2;
/** Documented contract: query <= 200 characters, maxResults 1-25 (default 10). */
const MAX_QUERY_CHARS = 200, MIN_RESULTS = 1, MAX_RESULTS = 25, DEFAULT_RESULTS = 10;
/** Frozen receiving-contract caps (`packages/contracts/retrieval-0.2/public-web.schema.json`). */
const MAX_ROW_RESULTS = 12, MAX_TITLE = 180, MAX_SNIPPET = 320, MAX_URL = 2000, MAX_DATE = 40;
const DEFAULT_PROTOCOL = '2026-07-28', DEFAULT_RESPONSE_BYTES = 262144, DEFAULT_REQUEST_MS = 8000;
/** Stateless MCP revision 2026-07-28: no `initialize` handshake and no session, so one tools/call is
 * one gateway invocation. Client identity travels in the documented `_meta` fields. */
const CLIENT_INFO = Object.freeze({name: 'meri-control', version: '1.0.0'});

const boundedText = (value, cap) => {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized ? normalized.slice(0, cap) : null;
};
const clamp = (value, minimum, maximum, fallback) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.trunc(parsed))) : fallback;
};
/** A locator is published byte-for-byte or not at all: no truncation, no repair, http(s) only. */
const locator = value => {
  if (typeof value !== 'string' || !value || value.length > MAX_URL || value !== value.trim() ||
      !/^https?:\/\/[^\s\\]+$/u.test(value)) return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? value : null;
  } catch { return null; }
};

/** MCP streams responses as `text/event-stream` when the gateway chooses to; both forms are documented. */
export function readMcpPayload(contentType, body) {
  if (typeof body !== 'string' || !body) return undefined;
  if (!/text\/event-stream/iu.test(contentType ?? '')) {
    try { return JSON.parse(body); } catch { return undefined; }
  }
  let last;
  for (const line of body.split(/\r?\n/u)) {
    const match = /^data:\s*(.+)$/u.exec(line.trim());
    if (match) { try { last = JSON.parse(match[1]); } catch { /* ignore keep-alives */ } }
  }
  return last;
}

/** Map one documented `results[]` row to the discovery projection. A row without a byte-exact valid
 * http(s) locator is dropped, and an absent title/snippet/date stays null rather than being invented. */
export function projectRow(row) {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) return undefined;
  const url = locator(row.url);
  if (url === null) return undefined;
  return Object.freeze({title: boundedText(row.title, MAX_TITLE), url,
    snippet: boundedText(row.text ?? row.snippet, MAX_SNIPPET), source: AGENTCORE_SEARCH_PROVIDER,
    publishedAt: boundedText(row.publishedDate ?? row.publishedAt, MAX_DATE)});
}

/** Bounded response read: the lifetime owns cancellation, this owns bytes. */
async function readBoundedBody(response, lifetime, maxBytes) {
  const body = responseBody(response);
  if (![null, 'identity'].includes(response.headers.get('content-encoding'))) deny('INVALID_RESULT');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maxBytes)) deny('RESOURCE_LIMIT');
  if (!body) deny('INVALID_RESULT');
  const reader = body.getReader(), decoder = new TextDecoder('utf-8', {fatal: true});
  try {
    let bytes = 0, out = '';
    for (;;) {
      const part = await lifetime.run(() => reader.read());
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) deny('INVALID_RESULT');
      bytes += part.value.byteLength;
      if (bytes > maxBytes) deny('RESOURCE_LIMIT');
      out += decoder.decode(part.value, {stream: true});
    }
    out += decoder.decode(); lifetime.check();
    return out;
  } finally {
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {}
    try { reader.releaseLock(); } catch {}
  }
}

/**
 * @param {{endpoint:string,region:string,toolName:string,now?:()=>number,fetchImpl?:Function,
 *  credentials?:Function,protocolVersion?:string,maxAttempts?:number,maxRequestMs?:number,
 *  maxResponseBytes?:number}} configuration
 */
export function createPrimaryWebSearch(configuration) {
  let c;
  try {
    c = ownFields(configuration, ['endpoint', 'region', 'toolName'],
      ['now', 'fetchImpl', 'credentials', 'protocolVersion', 'maxAttempts', 'maxRequestMs', 'maxResponseBytes']);
    // The documented gatewayUrl IS the MCP invocation endpoint (…/mcp). It is bound as given: no
    // origin-only form, no double append and no arbitrary path.
    const address = new URL(c.endpoint);
    if (address.protocol !== 'https:' || address.search || address.hash || address.username || address.password ||
        address.pathname !== '/mcp' || c.endpoint !== address.origin + '/mcp') deny('GATEWAY_CONFIGURATION');
    if (typeof c.region !== 'string' || !/^[a-z]{2}(-gov)?-[a-z]+-\d$/u.test(c.region)) deny('GATEWAY_CONFIGURATION');
    // The tool name is bound from the provisioned target, never defaulted here.
    if (typeof c.toolName !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/u.test(c.toolName)) deny('GATEWAY_CONFIGURATION');
    // One complete documented protocol path: the stateless 2026-07-28 revision.
    if (c.protocolVersion !== undefined && c.protocolVersion !== DEFAULT_PROTOCOL) deny('GATEWAY_CONFIGURATION');
  } catch { deny('GATEWAY_CONFIGURATION'); }
  const now = c.now ?? Date.now, fetchImpl = c.fetchImpl ?? globalThis.fetch;
  // The default chain keeps the caller's deadline signal and byte bound, so the real container
  // credential fetch is cancellable instead of racing only inside the lifetime.
  const credentials = c.credentials ?? (options => resolveAwsCredentials({fetchImpl,
    ...(options?.signal === undefined ? {} : {signal: options.signal}),
    ...(options?.maxResponseBytes === undefined ? {} : {maxResponseBytes: options.maxResponseBytes})}));
  const toolName = c.toolName, protocolVersion = DEFAULT_PROTOCOL;
  const url = c.endpoint;
  const maxAttempts = c.maxAttempts ?? AGENTCORE_SEARCH_DEFAULT_ATTEMPTS;
  const maxRequestMs = c.maxRequestMs ?? DEFAULT_REQUEST_MS, maxResponseBytes = c.maxResponseBytes ?? DEFAULT_RESPONSE_BYTES;
  if (typeof now !== 'function' || typeof fetchImpl !== 'function' || typeof credentials !== 'function' ||
      !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > AGENTCORE_SEARCH_MAX_ATTEMPTS ||
      !Number.isSafeInteger(maxRequestMs) || maxRequestMs < 1000 || maxRequestMs > 30000 ||
      !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 4096 || maxResponseBytes > 1048576) deny('GATEWAY_CONFIGURATION');

  /** One owned lifetime covers credential acquisition, dispatch and the bounded body read. */
  async function invoke(query, maxResults, deadlineMs, signal) {
    if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= now()) deny('DEADLINE');
    // Stateless 2026-07-28 request shape: version in the header AND in params._meta (they must match),
    // request metadata headers Mcp-Method/Mcp-Name, and no initialize handshake.
    const body = JSON.stringify({jsonrpc: '2.0', id: `web-search-${now()}`, method: 'tools/call',
      params: {name: toolName, arguments: {query, maxResults},
        _meta: {'io.modelcontextprotocol/protocolVersion': protocolVersion,
          'io.modelcontextprotocol/clientInfo': {...CLIENT_INFO},
          'io.modelcontextprotocol/clientCapabilities': {}}}});
    const lifetime = createDispatchLifetime({deadlineMs: Math.min(deadlineMs, now() + maxRequestMs), now, signal});
    let lastError = 'UNAVAILABLE';
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        lifetime.check();
        let acquired;
        try {
          const proof = await lifetime.run(proofSignal => credentials({signal: proofSignal, maxResponseBytes: 16384}));
          if (proof === undefined) deny('UNAVAILABLE');
          const signed = signAwsRequest({method: 'POST', url, body, region: c.region, service: 'bedrock-agentcore',
            credentials: proof, nowMs: now()});
          // No paid dispatch after the cutoff: recheck after credential acquisition and signing.
          lifetime.check();
          const response = await lifetime.run(fetchSignal => fetchImpl(url, {
            method: 'POST', redirect: 'error', cache: 'no-store', signal: fetchSignal,
            headers: {...signed.headers, accept: 'application/json, text/event-stream',
              'mcp-protocol-version': protocolVersion, 'mcp-method': 'tools/call', 'mcp-name': toolName},
            body,
          }));
          acquired = response;
          if (response.status === 401 || response.status === 403) deny('ACCESS_DENIED');
          if (response.status === 400) deny('INVALID_ARGUMENTS');
          if (response.status === 404) deny('INVALID_RESULT');
          if (response.status !== 200 || response.redirected) { lastError = 'UNAVAILABLE'; continue; }
          const raw = await readBoundedBody(response, lifetime, maxResponseBytes);
          lifetime.check();
          const payload = readMcpPayload(response.headers.get('content-type'), raw);
          if (payload === null || typeof payload !== 'object') deny('INVALID_RESULT');
          if (payload.error !== undefined) deny('UNAVAILABLE');
          // An MCP tool execution error is a result with `isError: true`, never a successful discovery.
          if (payload.result?.isError === true) deny('UNAVAILABLE');
          const content = payload.result?.content;
          if (!Array.isArray(content)) deny('INVALID_RESULT');
          const inner = content.find(item => item?.type === 'text' && typeof item.text === 'string')?.text;
          if (typeof inner !== 'string') deny('INVALID_RESULT');
          let parsed;
          try { parsed = JSON.parse(inner); } catch { deny('INVALID_RESULT'); }
          if (!Array.isArray(parsed?.results)) deny('INVALID_RESULT');
          return parsed.results;
        } catch (error) {
          // Closed gateway denials are final; transport failures stay retryable within the attempt bound.
          if (error instanceof GatewayDenied) throw error;
          if (signal?.aborted) deny('CANCELLED');
          lastError = 'UNAVAILABLE';
          // An exhausted cutoff during a retry stays visible as DEADLINE, not as a fresh attempt.
          lifetime.check();
        } finally {
          // Every acquired response is released on every path, including refusals and retries.
          if (acquired) { try { cancelBody(responseBody(acquired)); } catch {} }
        }
      }
      deny(lastError);
    } catch (error) { throw safeFailure(error); }
    finally { lifetime.close(); }
  }

  return Object.freeze({
    provider: AGENTCORE_SEARCH_PROVIDER,
    toolName,
    /** Finite admission facts for the shared budget/tariff owner (SCRUM-238): the worst case is
     * `maxAttempts` submitted calls at `unitMicroUsd` each; an unclassified outcome stays unknown. */
    admission: Object.freeze({provider: AGENTCORE_SEARCH_PROVIDER, unitMicroUsd: AGENTCORE_SEARCH_UNIT_MICROUSD, maxAttempts,
      maxMicroUsd: AGENTCORE_SEARCH_UNIT_MICROUSD * maxAttempts, maxCallsPerInvocation: maxAttempts,
      billing: 'aws-agentcore-web-search-and-gateway-invocation'}),
    /** @returns {Promise<{tool:string,contentStatus:string,generatedAt:string,provider:string,total:number,results:object[]}>} */
    async search({query, limit, deadlineMs, signal} = {}) {
      try {
        const value = typeof query === 'string' ? query.replace(/\s+/gu, ' ').trim() : '';
        if (!value) deny('INVALID_ARGUMENTS');
        const bounded = value.slice(0, MAX_QUERY_CHARS);
        const wanted = clamp(limit, MIN_RESULTS, MAX_RESULTS, DEFAULT_RESULTS);
        const rows = await invoke(bounded, wanted, deadlineMs, signal);
        const results = rows.map(projectRow).filter(row => row !== undefined).slice(0, Math.min(wanted, MAX_ROW_RESULTS));
        return Object.freeze({tool: 'search_public_web', contentStatus: 'discovered', generatedAt: new Date(now()).toISOString(),
          provider: AGENTCORE_SEARCH_PROVIDER, total: results.length, results: Object.freeze(results)});
      } catch (error) { throw safeFailure(error); }
    },
  });
}

/** `readSource` port of the retained read transport: primary discovery for search only. */
export function createPrimarySearchReadSource(primary) {
  if (primary === null || typeof primary !== 'object' || typeof primary.search !== 'function') deny('GATEWAY_CONFIGURATION');
  return async ({operation, input, deadlineMs, signal}) => {
    if (operation !== 'search_public_web') deny('GATEWAY_CONFIGURATION');
    return primary.search({query: input?.query, limit: input?.limit, deadlineMs, signal});
  };
}

/** Deployment fact: the documented MCP invocation endpoint, region and selected target tool name exist
 * only together. A partial or wrongly shaped value leaves the family off (old Core route), never a crash. */
export function primarySearchTarget(env = process.env) {
  const endpoint = env.MERI_WEB_SEARCH_GATEWAY_ENDPOINT, toolName = env.MERI_WEB_SEARCH_TOOL;
  if (typeof endpoint !== 'string' || !endpoint || typeof toolName !== 'string' || !toolName) return undefined;
  const region = env.MERI_WEB_SEARCH_REGION ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  if (typeof region !== 'string' || !region) return undefined;
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(toolName)) return undefined;
  try {
    const address = new URL(endpoint);
    if (address.protocol !== 'https:' || address.pathname !== '/mcp' || address.search || address.hash ||
        address.username || address.password || endpoint !== address.origin + '/mcp') return undefined;
  } catch { return undefined; }
  return Object.freeze({endpoint, region, toolName});
}

/** The paid admission implied by the ACTUAL selected deployment target: nothing when the primary is off,
 * otherwise the exact numbers the producer bills and the budget owner must reserve. One derivation, used by
 * the allocation render and the tests; a target that exists without paid admission is a wiring defect. */
export function primarySearchAdmission(env = process.env) {
  if (primarySearchTarget(env) === undefined) return undefined;
  return Object.freeze({provider: AGENTCORE_SEARCH_PROVIDER, unitMicroUsd: AGENTCORE_SEARCH_UNIT_MICROUSD,
    maxAttempts: AGENTCORE_SEARCH_DEFAULT_ATTEMPTS});
}
