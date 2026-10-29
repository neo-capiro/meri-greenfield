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
 * Result text is untrusted source material and carries no Capiro authority. */
import {GatewayDenied,deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {signAwsRequest,resolveAwsCredentials} from './aws-signing.mjs';

/** Provider label of the AWS-owned index; distinct from `tavily`, `serper`, `duckduckgo` and from Claude's builtin. */
export const AGENTCORE_SEARCH_PROVIDER = 'agentcore-web-search';
/** Gateway target tool name fixed by the connector target configuration. */
export const AGENTCORE_SEARCH_TOOL = 'WebSearch';
/** Documented contract: query <= 200 characters, maxResults 1-25 (default 10). */
const MAX_QUERY_CHARS = 200, MIN_RESULTS = 1, MAX_RESULTS = 25, DEFAULT_RESULTS = 10;
/** Frozen receiving-contract caps (`packages/contracts/retrieval-0.2/public-web.schema.json`). */
const MAX_ROW_RESULTS = 12, MAX_TITLE = 180, MAX_SNIPPET = 320, MAX_URL = 2000, MAX_DATE = 40;
const DEFAULT_PROTOCOL = '2025-11-25';

const projected = (value, cap) => {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, cap) : null;
};
const clamp = (value, minimum, maximum, fallback) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.trunc(parsed))) : fallback;
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

/** Map one documented `results[]` row to the discovery projection; rows without a citable URL are dropped,
 * and absent title/date stay null rather than being invented. */
export function projectRow(row) {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) return undefined;
  const url = projected(row.url, MAX_URL);
  if (url === null || !/^https?:\/\//iu.test(url)) return undefined;
  const snippet = projected(row.text ?? row.snippet, MAX_SNIPPET);
  const title = projected(row.title, MAX_TITLE) ?? projected(url, MAX_TITLE);
  const publishedAt = projected(row.publishedDate ?? row.publishedAt, MAX_DATE);
  return Object.freeze({title, url, snippet, source: AGENTCORE_SEARCH_PROVIDER, publishedAt});
}

/**
 * @param {{endpoint:string,region:string,now?:()=>number,fetchImpl?:Function,
 *  credentials?:()=>Promise<{accessKeyId:string,secretAccessKey:string,sessionToken?:string}>,
 *  toolName?:string,protocolVersion?:string,maxAttempts?:number,maxRequestMs?:number}} configuration
 */
export function createPrimaryWebSearch(configuration) {
  let c;
  try {
    c = ownFields(configuration, ['endpoint', 'region'],
      ['now', 'fetchImpl', 'credentials', 'toolName', 'protocolVersion', 'maxAttempts', 'maxRequestMs']);
    const address = new URL(c.endpoint);
    if (address.protocol !== 'https:' || address.origin !== c.endpoint.replace(/\/$/u, '') || address.search || address.hash) deny('GATEWAY_CONFIGURATION');
    if (typeof c.region !== 'string' || !/^[a-z]{2}(-gov)?-[a-z]+-\d$/u.test(c.region)) deny('GATEWAY_CONFIGURATION');
  } catch { deny('GATEWAY_CONFIGURATION'); }
  const now = c.now ?? Date.now, fetchImpl = c.fetchImpl ?? globalThis.fetch;
  const credentials = c.credentials ?? (() => resolveAwsCredentials({fetchImpl}));
  const toolName = c.toolName ?? AGENTCORE_SEARCH_TOOL, protocolVersion = c.protocolVersion ?? DEFAULT_PROTOCOL;
  const maxAttempts = c.maxAttempts ?? 2, maxRequestMs = c.maxRequestMs ?? 8000;
  if (typeof now !== 'function' || typeof fetchImpl !== 'function' || typeof credentials !== 'function' ||
      !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3 ||
      !Number.isSafeInteger(maxRequestMs) || maxRequestMs < 1000 || maxRequestMs > 30000) deny('GATEWAY_CONFIGURATION');
  const url = `${c.endpoint.replace(/\/$/u, '')}/mcp`;

  /** One signed MCP call with bounded attempts; 401/403/400 are never retried. */
  async function invoke(query, maxResults, deadlineMs, signal) {
    const body = JSON.stringify({jsonrpc: '2.0', id: `web-search-${now()}`, method: 'tools/call',
      params: {name: toolName, arguments: {query, maxResults}}});
    let lastError = 'UNAVAILABLE';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const remaining = Math.min(deadlineMs, now() + maxRequestMs) - now();
      if (!Number.isSafeInteger(deadlineMs) || remaining < 1) deny('DEADLINE');
      try {
        const proof = await credentials();
        if (proof === undefined) deny('UNAVAILABLE');
        const signed = signAwsRequest({method: 'POST', url, body, region: c.region, service: 'bedrock-agentcore',
          credentials: proof, nowMs: now()});
        const response = await fetchImpl(url, {
          method: 'POST', redirect: 'error', cache: 'no-store',
          signal: signal === undefined ? AbortSignal.timeout(remaining) : AbortSignal.any([signal, AbortSignal.timeout(remaining)]),
          headers: {...signed.headers, accept: 'application/json, text/event-stream',
            'mcp-protocol-version': protocolVersion},
          body,
        });
        if (response.status === 401 || response.status === 403) deny('ACCESS_DENIED');
        if (response.status === 400) deny('INVALID_ARGUMENTS');
        if (response.status === 429 || response.status >= 500) { lastError = 'UNAVAILABLE'; continue; }
        if (!response.ok) { lastError = 'UNAVAILABLE'; continue; }
        const payload = readMcpPayload(response.headers.get('content-type'), await response.text());
        if (payload === null || typeof payload !== 'object') deny('INVALID_RESULT');
        if (payload.error !== undefined) deny('UNAVAILABLE');
        const content = payload.result?.content;
        if (!Array.isArray(content)) deny('INVALID_RESULT');
        const text = content.find(item => item?.type === 'text' && typeof item.text === 'string')?.text;
        if (typeof text !== 'string') deny('INVALID_RESULT');
        let parsed;
        try { parsed = JSON.parse(text); } catch { deny('INVALID_RESULT'); }
        if (!Array.isArray(parsed?.results)) deny('INVALID_RESULT');
        return parsed.results;
      } catch (error) {
        // Closed gateway denials are final; transport failures stay retryable within the attempt bound.
        if (error instanceof GatewayDenied) throw error;
        if (signal?.aborted) deny('CANCELLED');
        lastError = 'UNAVAILABLE';
      }
    }
    deny(lastError);
  }

  return Object.freeze({
    provider: AGENTCORE_SEARCH_PROVIDER,
    /** @returns {Promise<{tool:string,contentStatus:string,generatedAt:string,provider:string,total:number,results:object[]}>} */
    async search({query, limit, deadlineMs, signal} = {}) {
      try {
        const text = typeof query === 'string' ? query.replace(/\s+/gu, ' ').trim() : '';
        if (!text) deny('INVALID_ARGUMENTS');
        const bounded = text.slice(0, MAX_QUERY_CHARS);
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

/** Deployment fact: the gateway endpoint and region exist only when the approved target is provisioned. */
export function primarySearchTarget(env = process.env) {
  const endpoint = env.MERI_WEB_SEARCH_GATEWAY_ENDPOINT;
  if (typeof endpoint !== 'string' || !endpoint) return undefined;
  const region = env.MERI_WEB_SEARCH_REGION ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  if (typeof region !== 'string' || !region) return undefined;
  return Object.freeze({endpoint, region});
}
