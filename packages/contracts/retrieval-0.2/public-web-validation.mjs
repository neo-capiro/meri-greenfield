/** Pure public-web evidence contracts. No transport, parser or source authority. */
import {snapshotOperationData} from './operation-contracts.mjs';
export const PUBLIC_WEB_OPERATION_IDS = Object.freeze(['search_public_web', 'scrape_web_page']);
const fail = message => { throw new Error(message); };
function instant(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    fail('Public-web generatedAt requires a canonical JSON instant');
}
function boundedText(value, cap) {
  if (value.length > cap || value !== value.replace(/\s+/g, ' ').trim())
    fail('Public-web text must be a bounded normalized UTF-16 projection');
}
function webUrl(value, credentialsAllowed = false) {
  let parsed;
  try { parsed = new URL(value); } catch { fail('Public-web URL syntax'); }
  if (!['http:', 'https:'].includes(parsed.protocol) ||
      !credentialsAllowed && (parsed.username || parsed.password)) fail('Public-web URL scheme or credentials');
  // This is syntax only. DNS/address/redirect/egress checks belong to the
  // qualified adapter. Passing this check is never permission to fetch a URL.
  return parsed;
}
function clamped(value, minimum, maximum, fallback) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.trunc(parsed))) : fallback;
}
export function createPublicWebValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || schema?.$id !== 'urn:meri:retrieval:public-web:0.2.0' || !schema.$defs)
    fail('Public-web validator configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  function stem(id) {
    if (typeof id !== 'string' || !PUBLIC_WEB_OPERATION_IDS.includes(id)) fail('Unknown public-web operation');
    return id === 'search_public_web' ? 'PublicWebSearch' : 'PublicWebPage';
  }
  function publicWebInputDefinition(id) { return `${stem(id)}Input`; }
  function publicWebOutputDefinition(id) { return `${stem(id)}Output`; }
  function validatePublicWebShape(name, value) {
    if (typeof name !== 'string' || !definitions.has(name)) fail('Unknown public-web definition');
    const data = snapshotOperationData(value);
    validateShape(name, data);
    if (name === 'PublicWebSearchOutput') {
      instant(data.generatedAt);
      if (data.total !== data.results.length) fail('Public-web returned count mismatch');
      for (const row of data.results) {
        boundedText(row.title, 180);
        if (row.snippet !== null) boundedText(row.snippet, 320);
        if (data.provider !== 'duckduckgo') {
          boundedText(row.url, 2000);
          if (!/^https?:\/\//i.test(row.url)) fail('Provider URL prefix mismatch');
          if (row.publishedAt !== null) boundedText(row.publishedAt, 40);
        }
      }
    } else if (['PublicWebPageOutput', 'PublicWebHtmlOutput', 'PublicWebPdfOutput'].includes(name)) {
      instant(data.generatedAt);
      const url = webUrl(data.url), pdf = data.kind === 'pdf';
      boundedText(data.text, 20000);
      if (data.contentType !== data.contentType.toLowerCase()) fail('Content type must preserve lowercase projection');
      if (data.coverage.locator.url !== data.url || data.coverage.locator.characterEnd !== data.text.length ||
          data.coverage.truncated !== data.truncated || data.coverage.complete !== !data.truncated)
        fail('Public-web coverage projection mismatch');
      if (pdf) {
        if (data.coverage.pages !== data.pages || data.totalChars < data.text.length)
          fail('PDF count projection mismatch');
        const explicitPdf = data.contentType.includes('application/pdf') || data.contentType.includes('application/x-pdf');
        if (!explicitPdf && (['text/', 'html', 'xml', 'json'].some(part => data.contentType.includes(part)) ||
            !url.pathname.toLowerCase().endsWith('.pdf'))) fail('PDF content classification mismatch');
      } else {
        if (data.contentType.includes('application/pdf') || data.contentType.includes('application/x-pdf') ||
            !['text/html', 'application/xhtml+xml'].some(type => data.contentType.includes(type)))
          fail('HTML content classification mismatch');
        if (data.title !== null) boundedText(data.title, Infinity);
        if (data.totalChars !== (data.truncated ? null : data.text.length)) fail('HTML totalChars mismatch');
        const links = new Set();
        for (const link of data.links) {
          webUrl(link.url, true);
          if (links.has(link.url)) fail('Duplicate HTML link URL');
          links.add(link.url);
          if (link.text !== null) boundedText(link.text, 120);
        }
      }
    }
    return data;
  }
  function normalizePublicWebInput(id, request, options = {}) {
    const prefix = stem(id), raw = snapshotOperationData(request);
    validatePublicWebShape('PublicWebOptions', options);
    validatePublicWebShape(`${prefix}Request`, raw);
    let input;
    if (id === 'search_public_web') {
      const query = raw.query.trim().slice(0, 240);
      if (!query) fail('Public-web query is required');
      input = {query, limit: clamped(raw.limit, 1, 12, 6)};
    } else {
      const url = raw.url.trim().slice(0, 2000);
      if (!url) fail('Public-web URL is required');
      webUrl(url);
      const mode = raw.mode?.trim().slice(0, 20) || 'summary';
      input = {url, mode, maxChars: clamped(raw.maxChars, 500, 20000, mode === 'extract' ? 12000 : 4000)};
    }
    validatePublicWebShape(`${prefix}Input`, input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({})});
  }
  function assertPublicWebOutput(id, value, request, options = {}) {
    const {input} = normalizePublicWebInput(id, request, options);
    const page = validatePublicWebShape(publicWebOutputDefinition(id), value);
    if (id === 'search_public_web') {
      if (page.results.length > input.limit) fail('Public-web result limit mismatch');
    } else {
      if (page.text.length > input.maxChars) fail('Public-web text limit mismatch');
      if (page.kind === 'pdf' && (page.truncated !== (page.totalChars > input.maxChars) ||
          !page.truncated && page.totalChars !== page.text.length)) fail('PDF truncation mismatch');
      // final URL can legitimately differ after redirects. Neither syntax nor
      // matching metadata verifies network admission, bytes, hash or freshness.
    }
    return page;
  }
  return Object.freeze({publicWebSchemaId: schema.$id, PUBLIC_WEB_OPERATION_IDS,
    publicWebInputDefinition, publicWebOutputDefinition, normalizePublicWebInput,
    validatePublicWebShape, assertPublicWebOutput});
}
