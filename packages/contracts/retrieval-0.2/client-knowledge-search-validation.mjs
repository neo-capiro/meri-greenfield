// Source projection contracts only. They neither search nor establish client authority.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail = message => { throw new Error(message); };
export const CLIENT_KNOWLEDGE_SEARCH_OPERATION_IDS = Object.freeze(['search_client_knowledge', 'query_knowledge_graph']);
const kinds = Object.freeze(['client_profile', 'client_person', 'client_facility', 'client_doc_chunk']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const graphErrors = Object.freeze([
  'clientId must be a client UUID — pass the exact id, or omit it.',
  "This conversation is scoped to one client, so the knowledge graph cannot be walked from another client's node here. Omit the seed to explore this client's graph, or switch the session's client.",
]);
const optional = (value, cap) => typeof value === 'string' ? value.trim().slice(0, cap) || null : null;
function canonicalInstant(value) {
  const at = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(at) || new Date(at).toISOString() !== value) fail('Expected canonical observation instant');
}
export function createClientKnowledgeSearchValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Client knowledge search configuration');
  function stem(id) {
    if (id === 'search_client_knowledge') return 'ClientKnowledgeSearch';
    if (id === 'query_knowledge_graph') return 'KnowledgeGraph';
    fail('Unknown client knowledge search operation');
  }
  const inputDefinition = id => `${stem(id)}Input`;
  const outputDefinition = id => `${stem(id)}Output`;
  function normalizeInput(id, request, context = {}) {
    const family = stem(id), raw = snapshotOperationData(request), ctx = snapshotOperationData(context);
    validateShape(`${family}Request`, raw);
    validateShape(`${family}Context`, ctx);
    let input;
    if (id === 'search_client_knowledge') {
      canonicalInstant(ctx.asOf);
      const query = raw.query.trim();
      if (!query) fail('query is required');
      // Preserve raw client string truthiness, exact kind and non-floored numeric LIMIT.
      input = {query, clientId: raw.clientId || null,
        kind: kinds.includes(raw.kind) ? raw.kind : null,
        limit: Math.min(20, Math.max(1, typeof raw.limit === 'number' ? raw.limit : 8))};
    } else {
      const parsed = typeof raw.depth === 'number' ? raw.depth : Number.parseInt(raw.depth ?? '', 10);
      input = {seed: optional(raw.seed, 120), clientId: optional(raw.clientId, 80),
        depth: Number.isFinite(parsed) ? Math.min(4, Math.max(1, parsed)) : 2};
    }
    validateShape(inputDefinition(id), input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({sourceConnected: false,
      authoritative: false, absenceEvidence: false, currentPolicyQualified: false,
      method: id === 'search_client_knowledge' ? 'embedding-candidates' : 'bounded-graph-projection'})});
  }
  function assertResult(id, value, request, context = {}) {
    const ctx = snapshotOperationData(context);
    const {input} = normalizeInput(id, request, ctx);
    const page = snapshotOperationData(value);
    validateShape(outputDefinition(id), page);
    if (id === 'search_client_knowledge') {
      canonicalInstant(page.generatedAt);
      if (page.generatedAt !== ctx.asOf) fail('Knowledge search observation substitution');
      if (!input.clientId) {
        if ('clientId' in page) fail('Missing-client branch substitution');
      } else {
        if (page.clientId !== input.clientId || page.query !== input.query) fail('Knowledge search selector substitution');
        if (page.note !== undefined && page.results.length) fail('Unavailable knowledge search cannot return matches');
      }
      if (page.results.length > input.limit) fail('Knowledge search limit exceeded');
      for (const row of page.results) {
        if (input.kind && row.kind !== input.kind) fail('Knowledge search kind substitution');
        // A substring may end in a space; it is a prefix of normalized full text,
        // not independently trim-normalized. UTF-16 limits preserve source slicing.
        if (row.title.length > 110 || row.snippet.length > 280 || row.title !== row.snippet.slice(0, 110) ||
            /^\s/.test(row.snippet) || /[^\S ]| {2}/.test(row.snippet)) {
          fail('Knowledge search excerpt projection mismatch');
        }
      }
    } else {
      const expectedError = input.clientId && !uuid.test(input.clientId) ? graphErrors[0] :
        input.clientId && input.seed?.startsWith('client:') && input.seed !== `client:${input.clientId}` ? graphErrors[1] : null;
      if (expectedError) {
        if (page.error !== expectedError) fail('Knowledge graph refusal substitution');
      } else if ('error' in page) fail('Unexpected knowledge graph refusal');
      if ('connections' in page) {
        const ids = new Set();
        for (const node of page.nodes) {
          if (!node.id.startsWith(`${node.type}:`) || ids.has(node.id)) fail('Knowledge graph node identity mismatch');
          if (input.clientId && node.type === 'client' && node.id !== `client:${input.clientId}`) fail('Scoped graph contains another client node');
          ids.add(node.id);
        }
        const suffix = `${input.seed ? ` within ${input.depth} hop(s) of ${input.seed}` : ''}. Edges tagged [fact]=from firm data, [mention]=from analyst notes.`;
        const prefix = `${page.nodes.length} nodes, `;
        if (!page.summary.startsWith(prefix) || !page.summary.endsWith(` connections${suffix}`)) fail('Knowledge graph summary mismatch');
        const countText = page.summary.slice(prefix.length, -` connections${suffix}`.length);
        const count = Number(countText);
        if (!/^(0|[1-9][0-9]*)$/.test(countText) || !Number.isSafeInteger(count) || page.connections.length !== Math.min(120, count))
          fail('Knowledge graph returned window mismatch');
        // Connection labels are unescaped source text. They are not safe to parse
        // back into an edge or treat as proof of current policy or factual truth.
      }
    }
    return page;
  }
  return Object.freeze({schemaId: schema.$id, operationIds: CLIENT_KNOWLEDGE_SEARCH_OPERATION_IDS,
    inputDefinition, outputDefinition, normalizeInput, assertResult});
}
