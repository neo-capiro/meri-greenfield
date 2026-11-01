/** Recorded-shape MCP payloads of the AWS managed Web Search gateway target (documented `tools/call` result
 * carrying a JSON document in the text content item, rows `{text,publishedDate,url,title}`), plus the refusal
 * and malformed forms the producer must classify. Synthetic values; no AWS call recorded anything here. */
const envelope = (result, id = 'web-search-recorded') => ({jsonrpc: '2.0', id, result});
const textResult = document => ({isError: false, content: [{type: 'text', text: JSON.stringify(document)}]});

/** Two dated official articles ahead of an undated row: the shape a "two most recent articles" answer needs. */
export const SUCCESS_ROWS = Object.freeze([
  {title: 'Agency publishes final rule on reporting thresholds', url: 'https://public.example.invalid/news/final-rule-2026',
    text: 'The agency published its final rule on 28 October 2026, raising the reporting threshold.', publishedDate: '2026-10-28T14:00:00Z'},
  {title: 'Proposed rule opens comment period', url: 'https://public.example.invalid/news/proposed-rule-2026',
    text: 'A proposed rule opened a 30-day comment period on 1 October 2026.', publishedDate: '2026-10-01'},
  {title: 'About the agency', url: 'https://public.example.invalid/about', text: 'Mission statement and leadership.'},
]);
export const success = (rows = SUCCESS_ROWS) => envelope(textResult({id: 'recorded-search', results: rows}));
/** The same discovery published through MCP `structuredContent` with an empty content list. */
export const structuredSuccess = (rows = SUCCESS_ROWS) => envelope({isError: false, content: [], structuredContent: {id: 'recorded-search', results: rows}});
/** A streamed response: a notification before and after the response frame, keep-alives in between. */
export const streamedSuccess = (rows = SUCCESS_ROWS) => [
  'event: message', `data: ${JSON.stringify({jsonrpc: '2.0', method: 'notifications/message', params: {level: 'info', data: 'searching'}})}`, '',
  ': keep-alive', '',
  'event: message', `data: ${JSON.stringify(success(rows))}`, '',
  'event: message', `data: ${JSON.stringify({jsonrpc: '2.0', method: 'notifications/progress', params: {progressToken: 'p', progress: 1, total: 1}})}`, '',
].join('\n');
/** Gateway inbound authorization refused the IAM caller (401/403 bodies as the gateway returns them). */
export const denied = Object.freeze({status: 403, body: JSON.stringify({message: 'User is not authorized to perform: bedrock-agentcore:InvokeGateway'})});
export const unauthenticated = Object.freeze({status: 401, body: JSON.stringify({message: 'Missing Authentication Token'})});
/** The target executed and reported a tool error (an MCP execution error, not a protocol error). */
export const toolError = envelope({isError: true, content: [{type: 'text', text: 'Web search failed: upstream rate limit exceeded'}]});
/** A JSON-RPC protocol error from the gateway itself. */
export const protocolError = Object.freeze({jsonrpc: '2.0', id: 'web-search-recorded', error: {code: -32602, message: 'Unknown tool name'}});
/** Malformed forms: not JSON, a result without a document, a document without rows, a non-JSON document. */
export const malformed = Object.freeze({
  notJson: '<html>502 Bad Gateway</html>',
  noContent: JSON.stringify(envelope({isError: false})),
  noRows: JSON.stringify(envelope(textResult({id: 'recorded-search'}))),
  textNotJson: JSON.stringify(envelope({isError: false, content: [{type: 'text', text: 'Search results: none'}]})),
  emptyBody: '',
});
