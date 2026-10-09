// W02-05 native SDK loopback wire-capture OFFLINE tests.
//
// Run directly with:
//   node --test apps/worker/qualification/probes/sdk-capture.test.mjs
//
// Deterministic and hermetic: importing or running these tests starts NO
// server, NO native process and NO socket. Every host-side effect (settings
// resolution, workspace preparation, wire MCP server construction, native
// spawn, loopback server, query) is injected as a fake. The fakes deliberately
// include UNCOOPERATIVE paths (iterator/close/return/kill that never settle) to
// prove the orchestrator is bounded and fails closed rather than hanging or
// falsely passing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable } from 'node:stream';
import zlib from 'node:zlib';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';

import {
  LOOPBACK_HOST,
  CAPTURE_MODEL,
  WIRE_SERVER_NAME,
  WIRE_TOOL_NAME,
  WIRE_TOOL_FULLNAME,
  WIRE_TOKEN,
  WIRE_TOOL_RESULT,
  WIRE_TOOL_TIMEOUT_MS,
  WIRE_DONE_MARKER,
  CAPTURE_USER_PROMPT,
  CAPTURE_SYSTEM_PROMPT,
  CAPTURE_OPTION_FIELDS,
  CHILD_ENV_FLAGS,
  HARMLESS_PARENT_ENV_ALLOWLIST,
  buildCaptureEnv,
  buildCaptureSettings,
  buildCaptureOptions,
  validateCaptureOptions,
  scanParentEnv,
  preflightParentEnvironment,
  createPermissionCallback,
  runEchoHandler,
} from './sdk-capture-options.mjs';

import {
  hashSha256,
  errorType,
  scrubSecrets,
  looksLikeSecret,
  hasSensitiveBody,
  sanitizeHeaders,
  decodeRequestBody,
  createCaptureState,
  classifyRequest,
  validateFirstRequest,
  validateToolAdvertisement,
  validateToolRoundTrip,
  validateResolvedSettings,
  validateDeadline,
  WIRE_TOOL_USE_ID,
  buildToolUseSse,
  buildFinalSse,
  planSseResponse,
  completeUsage,
  createGate,
  syntheticPromptStream,
  buildWireTool,
  buildWireServer,
  buildSpawnHook,
  confirmChildCleanup,
  validateResultMessage,
  buildOutputLines,
  writeOnce,
  writeLines,
  realPrepareWorkspace,
  runCapture,
  main,
  MAX_RECORD_BYTES,
} from './sdk-capture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const sdkTypes = readFileSync(join(PKG, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.d.ts'), 'utf8');
const betaTypes = readFileSync(join(PKG, 'node_modules', '@anthropic-ai', 'sdk', 'resources', 'beta', 'messages', 'messages.d.ts'), 'utf8');

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const PORT = 51234;
const SESSION_UUID = '11111111-2222-3333-4444-555555555555';
const ADVERT = [{ name: WIRE_TOOL_FULLNAME }];

const req1Body = (mutate) => {
  const b = { model: CAPTURE_MODEL, stream: true, tools: ADVERT, messages: [{ role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }] }] };
  if (mutate) mutate(b);
  return b;
};
const req2Body = (mutate) => {
  const b = {
    model: CAPTURE_MODEL,
    stream: true,
    tools: ADVERT,
    messages: [
      { role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: WIRE_TOOL_USE_ID, name: WIRE_TOOL_FULLNAME, input: { value: WIRE_TOKEN } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: WIRE_TOOL_USE_ID, content: [{ type: 'text', text: WIRE_TOOL_RESULT }] }] },
    ],
  };
  if (mutate) mutate(b);
  return b;
};

function mkReq(body, { path = '/v1/messages', host = `${LOOPBACK_HOST}:${PORT}`, peer = LOOPBACK_HOST, headers = {}, contentEncoding, raw, oversize } = {}) {
  return { method: 'POST', path, host, peer, rawBytes: raw !== undefined ? raw : Buffer.from(JSON.stringify(body)), contentEncoding, oversize, headers: { host, ...headers } };
}
const stateAt = (p = PORT) => createCaptureState(p);

const VALID_RESOLVED = { effective: {}, provenance: {}, sources: [{ source: 'user', settings: {} }] };

// ---------------------------------------------------------------------------
// 1. classifyRequest success + byte/hash reconstruction
// ---------------------------------------------------------------------------

test('classifyRequest records exact raw bytes and hash for both requests', () => {
  const state = stateAt();
  const raw1 = Buffer.from(JSON.stringify(req1Body()));
  assert.equal(classifyRequest(state, mkReq(undefined, { raw: raw1 })).ok, true);
  assert.equal(state.requests[0].rawSha256, hashSha256(raw1));
  assert.equal(state.requests[0].base64, raw1.toString('base64'));
  const raw2 = Buffer.from(JSON.stringify(req2Body()));
  assert.equal(classifyRequest(state, mkReq(undefined, { path: '/v1/messages?beta=true', raw: raw2 })).ok, true);
  assert.equal(state.count, 2);
  assert.equal(state.ready, true);
});

test('hash is NOT taken over reserialized JSON', () => {
  const state = stateAt();
  const compact = Buffer.from(JSON.stringify(req1Body()));
  const pretty = Buffer.from(JSON.stringify(req1Body(), null, 2));
  classifyRequest(state, mkReq(undefined, { raw: pretty }));
  assert.notEqual(state.requests[0].rawSha256, hashSha256(compact));
  assert.equal(state.requests[0].rawSha256, hashSha256(pretty));
});

// ---------------------------------------------------------------------------
// 2. classifyRequest rejection paths
// ---------------------------------------------------------------------------

function expectAbort(req, matcher, p = PORT) {
  const state = stateAt(p);
  const d = classifyRequest(state, req);
  assert.equal(d.ok, false);
  assert.equal(d.action, 'abort');
  assert.match(state.aborted, matcher);
}
function expectAbortSeq(body2, matcher) {
  const state = stateAt();
  assert.equal(classifyRequest(state, mkReq(req1Body())).ok, true);
  const d = classifyRequest(state, mkReq({ ...body2, stream: true, model: CAPTURE_MODEL, tools: ADVERT }, { path: '/v1/messages' }));
  assert.equal(d.ok, false);
  assert.match(state.aborted, matcher);
}

test('wrong method / path / host / port / peer / model / stream fail and abort', () => {
  expectAbort({ ...mkReq(req1Body()), method: 'GET' }, /unexpected method/);
  expectAbort(mkReq(req1Body(), { path: '/v1/complete' }), /unexpected path/);
  expectAbort(mkReq(req1Body(), { host: 'api.anthropic.com' }), /host does not equal bound/);
  expectAbort(mkReq(req1Body(), { host: `${LOOPBACK_HOST}:9999` }), /host does not equal bound/);
  expectAbort(mkReq(req1Body(), { peer: '10.0.0.5' }), /non-loopback peer/);
  expectAbort(mkReq(req1Body((b) => (b.model = 'claude-sonnet-5'))), /wrong model/);
  expectAbort(mkReq(req1Body((b) => (b.stream = false))), /stream/);
});

test('oversize, malformed and unsupported-encoding fail and abort', () => {
  expectAbort(mkReq(undefined, { raw: Buffer.from('{not json') }), /malformed-json/);
  expectAbort(mkReq(undefined, { raw: Buffer.alloc(4 * 1024 * 1024 + 1, 0x61) }), /oversize/);
  expectAbort(mkReq(req1Body(), { raw: Buffer.alloc(10), oversize: true }), /oversize/);
  expectAbort(mkReq(req1Body(), { contentEncoding: 'br' }), /unsupported-encoding/);
});

test('gzip is decoded with independent raw/decompressed hashes', () => {
  const state = stateAt();
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(req1Body())));
  assert.equal(classifyRequest(state, mkReq(undefined, { raw: gz, contentEncoding: 'gzip' })).ok, true);
  assert.equal(state.requests[0].rawSha256, hashSha256(gz));
  assert.equal(state.requests[0].decompressedSha256, hashSha256(Buffer.from(JSON.stringify(req1Body()))));
});

test('strict first request: prompt continuity and exact tool advertisement', () => {
  expectAbort(mkReq(req1Body((b) => delete b.tools)), /missing tool advertisement/);
  expectAbort(mkReq(req1Body((b) => (b.tools = [{ name: WIRE_TOOL_FULLNAME }, { name: WIRE_TOOL_FULLNAME }]))), /exactly 1 advertised tool/);
  expectAbort(mkReq(req1Body((b) => (b.tools = [{ name: 'Bash' }]))), /unexpected advertised tool/);
  expectAbort(mkReq(req1Body((b) => b.messages.push({ role: 'user', content: [{ type: 'text', text: 'extra' }] }))), /exactly 1 user text block/);
  expectAbort(mkReq(req1Body((b) => (b.messages[0].content[0].text = 'unrelated'))), /not the exact synthetic prompt/);
});

test('strict second request roles and contents', () => {
  expectAbortSeq(req2Body((b) => { b.messages.splice(1, 1); b.messages.splice(1, 1); }), /tool_use|tool_result/);
  expectAbortSeq(req2Body((b) => (b.messages[1].content[0].id = 'toolu_other')), /foreign tool_use id/);
  expectAbortSeq(req2Body((b) => (b.messages[1].content[0].name = 'mcp__wire__other')), /foreign tool name/);
  expectAbortSeq(req2Body((b) => (b.messages[1].content[0].input = { value: WIRE_TOKEN, extra: 1 })), /exactly \{value:token\}/);
  expectAbortSeq(req2Body((b) => b.messages[1].content.push({ type: 'tool_use', id: 'x', name: WIRE_TOOL_FULLNAME, input: { value: WIRE_TOKEN } })), /exactly 1 tool_use/);
  expectAbortSeq(req2Body((b) => (b.messages[2].content[0].tool_use_id = 'toolu_other')), /does not match emitted id/);
  expectAbortSeq(req2Body((b) => (b.messages[2].content[0].is_error = true)), /is_error:true/);
  expectAbortSeq(req2Body((b) => (b.messages[2].content[0].content = [{ type: 'text', text: 'wrong' }])), /content mismatch/);
  expectAbortSeq(req2Body((b) => (b.messages = [b.messages[0], b.messages[2], b.messages[1]])), /order must be/);
});

test('tool_use must be in an assistant message; tool_result must be in a user message', () => {
  expectAbortSeq(
    req2Body((b) => {
      b.messages = [
        { role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }, { type: 'tool_use', id: WIRE_TOOL_USE_ID, name: WIRE_TOOL_FULLNAME, input: { value: WIRE_TOKEN } }] },
        { role: 'assistant', content: [{ type: 'tool_result', tool_use_id: WIRE_TOOL_USE_ID, content: [{ type: 'text', text: WIRE_TOOL_RESULT }] }] },
      ];
    }),
    /tool_use must be in an assistant message/,
  );
  expectAbortSeq(
    req2Body((b) => {
      b.messages = [
        { role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }] },
        { role: 'assistant', content: [{ type: 'tool_use', id: WIRE_TOOL_USE_ID, name: WIRE_TOOL_FULLNAME, input: { value: WIRE_TOKEN } }, { type: 'tool_result', tool_use_id: WIRE_TOOL_USE_ID, content: [{ type: 'text', text: WIRE_TOOL_RESULT }] }] },
      ];
    }),
    /tool_result must be in a user message/,
  );
});

test('duplicate / third request fails and aborts', () => {
  const state = stateAt();
  assert.equal(classifyRequest(state, mkReq(req1Body())).ok, true);
  assert.equal(classifyRequest(state, mkReq(req2Body())).ok, true);
  assert.match(classifyRequest(state, mkReq(req2Body())).error || state.aborted, /duplicate\/extra/);
});

test('validateFirstRequest / validateToolAdvertisement / validateToolRoundTrip are pure', () => {
  assert.equal(validateFirstRequest(req1Body()).ok, true);
  assert.equal(validateFirstRequest(req1Body((b) => delete b.tools)).ok, false);
  assert.equal(validateToolAdvertisement(req1Body()).ok, true);
  assert.equal(validateToolAdvertisement({ tools: [] }).ok, false);
  assert.equal(validateToolRoundTrip(req2Body(), WIRE_TOOL_USE_ID).ok, true);
  assert.equal(validateToolRoundTrip(req2Body(), 'toolu_other').ok, false);
});

// ---------------------------------------------------------------------------
// 3. secret scrubbing + recursive body sensitivity
// ---------------------------------------------------------------------------

test('scrubSecrets redacts bearer tokens, sk-ant keys and key=value pairs', () => {
  const raw = 'x-auth-token: Bearer abcdef0123456789 x sk-ant-api03-ABCDEFGHIJKLMNOP token: "supersecretvalue"';
  const s = scrubSecrets(raw);
  assert.equal(s.includes('sk-ant-api03'), false);
  assert.equal(s.includes('abcdef0123456789'), false);
  assert.equal(s.includes('supersecretvalue'), false);
  assert.equal(looksLikeSecret(raw), true);
  assert.equal(looksLikeSecret('plain synthetic text'), false);
});

test('hasSensitiveBody detects credential-named keys recursively', () => {
  assert.equal(hasSensitiveBody({ model: 'x', messages: [{ role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }] }] }), false);
  assert.equal(hasSensitiveBody({ nested: { api_key: 'OPAQUE_SYNTHETIC_CREDENTIAL' } }), true);
  assert.equal(hasSensitiveBody({ a: [{ b: { authorization: 'x' } }] }), true);
  assert.equal(hasSensitiveBody({ value: WIRE_TOKEN }), false);
});

test('sanitizeHeaders redacts secret names/values and retains beta names', () => {
  const out = sanitizeHeaders({ 'x-auth-token': 'v', authorization: 'Bearer sk-ant-secret', 'x-api-key': 'sk-ant-secret', cookie: 'c', 'x-custom': 'Bearer abcdef0123456789', 'anthropic-beta': 'oauth-2025-04-20', host: `${LOOPBACK_HOST}:${PORT}` });
  const byName = Object.fromEntries(out.map((h) => [h.name, h.value]));
  for (const n of ['x-auth-token', 'authorization', 'x-api-key', 'cookie', 'x-custom']) assert.equal(byName[n], '<redacted>', n);
  assert.equal(byName['anthropic-beta'], 'oauth-2025-04-20');
});

// ---------------------------------------------------------------------------
// 4. permission callback + echo handler
// ---------------------------------------------------------------------------

test('permission callback allows only the exact wire tool/provenance/input', async () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const cb = createPermissionCallback(counters);
  assert.equal((await cb(WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } })).behavior, 'allow');
  const denies = [
    ['mcp__wire__other', { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } }],
    [WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'user' } }],
    [WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: 'other', source: 'sdk' } }],
    [WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, {}],
    [WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN, extra: 1 }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } }],
  ];
  for (const [n, i, o] of denies) assert.equal((await cb(n, i, o)).behavior, 'deny', n);
  assert.equal(counters.permissionCallbacks, 1 + denies.length);
});

test('echo handler revalidates input', async () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  assert.deepEqual(await runEchoHandler(counters, { value: WIRE_TOKEN }), { content: [{ type: 'text', text: WIRE_TOOL_RESULT }] });
  await assert.rejects(() => runEchoHandler(counters, { value: WIRE_TOKEN, extra: 1 }));
  assert.equal(counters.handlerExecutions, 2);
});

// ---------------------------------------------------------------------------
// 5. wire MCP server + tool
// ---------------------------------------------------------------------------

test('buildWireServer registers one always-load echo tool', () => {
  const seen = {};
  const servers = buildWireServer({
    counters: { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 },
    createSdkMcpServer: (o) => ((seen.server = o), { tools: o.tools }),
    sdkTool: (name, d, schema, handler, extras) => ((seen.tool = { name, schema, handler, extras })),
    z: { literal: (v) => ({ __literal: v }) },
  });
  assert.deepEqual(Object.keys(servers), [WIRE_SERVER_NAME]);
  assert.equal(seen.server.name, WIRE_SERVER_NAME);
  assert.equal(seen.server.alwaysLoad, true);
  assert.equal(seen.server.timeout, WIRE_TOOL_TIMEOUT_MS);
  assert.deepEqual(seen.tool.schema, { value: { __literal: WIRE_TOKEN } });
  assert.equal(seen.tool.extras.alwaysLoad, true);
});

// ---------------------------------------------------------------------------
// 6. options + environment
// ---------------------------------------------------------------------------

test('buildCaptureEnv is a replacement env built from constants only', () => {
  const env = buildCaptureEnv(51234);
  assert.equal(env.ANTHROPIC_BASE_URL, `http://${LOOPBACK_HOST}:51234`);
  for (const [k, v] of Object.entries(CHILD_ENV_FLAGS)) assert.equal(env[k], v, k);
  const expected = new Set(['PATH', 'HOME', 'CLAUDE_CONFIG_DIR', 'TMPDIR', 'LANG', 'LC_ALL', 'NODE_ENV', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'MERI_QUALIFICATION_ONLY', 'MERI_SOURCES_ENABLED', ...Object.keys(CHILD_ENV_FLAGS)]);
  for (const name of Object.keys(env)) assert.equal(expected.has(name), true, `unexpected child env var: ${name}`);
  for (const name of HARMLESS_PARENT_ENV_ALLOWLIST) assert.equal(name in env, false, `must not copy ${name}`);
});

test('capture settings disable discovery, memory, view, remote control, workflows', () => {
  const s = buildCaptureSettings();
  for (const [k, v] of Object.entries({ autoMemoryEnabled: false, autoDreamEnabled: false, syncClaudeAiSkills: false, syncClaudeAiPlugins: false, disableAllHooks: true, enableAllProjectMcpServers: false, includeGitInstructions: false, fastMode: false, disableAutoMode: 'disable', disableAgentView: true, disableRemoteControl: true, disableWorkflows: true, remoteControlAtStartup: false })) assert.deepEqual(s[k], v, k);
  assert.deepEqual(s.permissions.ask, [WIRE_TOOL_FULLNAME]);
});

test('buildCaptureOptions validates and rejects forbidden fields', () => {
  const options = buildCaptureOptions({ abortController: new AbortController(), env: buildCaptureEnv(51234), mcpServers: { [WIRE_SERVER_NAME]: { type: 'sdk' } }, canUseTool: async () => ({ behavior: 'deny' }), spawnClaudeCodeProcess: () => ({}) });
  for (const f of ['fallbackModel', 'resume', 'continue', 'sessionStore']) assert.equal(f in options, false);
  assert.throws(() => validateCaptureOptions({ ...options, resume: 'x' }), /must not set resume/);
  assert.throws(() => validateCaptureOptions({ ...options, settingSources: ['user'] }), /settingSources must be \[\]/);
});

test('every capture option field is declared in sdk.d.ts; Settings keys declared', () => {
  const start = sdkTypes.indexOf('export declare type Options = {');
  const optionsBody = sdkTypes.slice(start, sdkTypes.indexOf('\n};', start));
  for (const field of CAPTURE_OPTION_FIELDS) assert.match(optionsBody, new RegExp(`\\b${field}\\?:`), `Options lacks ${field}`);
  for (const key of ['autoMemoryEnabled', 'autoDreamEnabled', 'claudeMdExcludes', 'disableAutoMode', 'disableAgentView', 'disableRemoteControl', 'disableWorkflows', 'remoteControlAtStartup', 'disableAllHooks', 'includeGitInstructions']) assert.match(sdkTypes, new RegExp(`\\b${key}\\?:`), `Settings lacks ${key}`);
});

// ---------------------------------------------------------------------------
// 7. parent-environment preflight
// ---------------------------------------------------------------------------

test('preflight permits harmless markers but rejects real credentials and injections', () => {
  const source = { PATH: '/usr/bin', AWS_REGION: 'us-east-1', AWS_DEFAULT_REGION: 'us-east-1', AWS_EXECUTION_ENV: 'AWS_ECS_FARGATE', ECS_CONTAINER_METADATA_URI: 'u', ECS_CONTAINER_METADATA_URI_V4: 'v', AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE', AWS_SECRET_ACCESS_KEY: 's', AWS_SESSION_TOKEN: 't', AWS_PROFILE: 'prod', ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: 'url', HTTPS_PROXY: 'p', NODE_OPTIONS: '--inspect' };
  assert.deepEqual(scanParentEnv(source), ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_PROFILE', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'HTTPS_PROXY', 'NODE_OPTIONS'].sort());
  const pre = preflightParentEnvironment({ source });
  assert.equal(pre.ok, false);
  assert.equal(JSON.stringify(pre).includes('AKIAIOSFODNN7EXAMPLE'), false);
  assert.equal(preflightParentEnvironment({ source: { AWS_REGION: 'us-east-1', ECS_CONTAINER_METADATA_URI: 'x' } }).ok, true);
});

test('validateResolvedSettings requires the full public shape and rejects managed', () => {
  assert.equal(validateResolvedSettings(VALID_RESOLVED).ok, true);
  assert.equal(validateResolvedSettings({}).ok, false);
  assert.equal(validateResolvedSettings({ effective: {}, provenance: {}, sources: 'x' }).ok, false);
  assert.equal(validateResolvedSettings({ effective: {}, provenance: {}, sources: [{ source: 'user' }] }).ok, false);
  assert.deepEqual(validateResolvedSettings({ effective: {}, provenance: {}, sources: [{ source: 'managed', settings: {} }] }), { ok: false, reason: 'managed' });
});

// ---------------------------------------------------------------------------
// 8. result validation (bounded typed shape)
// ---------------------------------------------------------------------------

test('validateResultMessage requires success/is_error/marker/end_turn/UUID session and bounds the shape', () => {
  const ok = { type: 'result', subtype: 'success', is_error: false, result: `ok ${WIRE_DONE_MARKER}`, stop_reason: 'end_turn', session_id: SESSION_UUID, num_turns: 2 };
  const r = validateResultMessage(ok);
  assert.equal(r.ok, true);
  assert.equal(r.summary.session_id, SESSION_UUID);
  assert.equal(typeof r.summary.resultSha256, 'string');
  assert.equal('result' in r.summary, false, 'raw result text is not exported');
  assert.equal(validateResultMessage({ ...ok, is_error: true }).ok, false);
  assert.equal(validateResultMessage({ ...ok, subtype: 'error_max_turns' }).ok, false);
  assert.equal(validateResultMessage({ ...ok, result: 'no marker' }).ok, false);
  assert.equal(validateResultMessage({ ...ok, stop_reason: 'max_tokens' }).ok, false);
  assert.equal(validateResultMessage({ ...ok, session_id: 'A'.repeat(1024 * 1024) }).ok, false, 'huge session_id rejected');
  assert.equal(validateResultMessage(null).ok, false);
});

// ---------------------------------------------------------------------------
// 9. SSE shapes
// ---------------------------------------------------------------------------

function parseSse(text) {
  return text.split('\n\n').filter(Boolean).map((b) => {
    const lines = b.split('\n');
    return { event: lines.find((l) => l.startsWith('event: ')).slice(7), data: JSON.parse(lines.find((l) => l.startsWith('data: ')).slice(6)) };
  });
}

test('completeUsage matches every BetaUsage field and nested values', () => {
  const usage = completeUsage();
  for (const key of ['cache_creation', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'fallback_credit', 'inference_geo', 'input_tokens', 'iterations', 'output_tokens', 'output_tokens_details', 'server_tool_use', 'service_tier', 'speed']) {
    assert.equal(key in usage, true, `BetaUsage missing ${key}`);
    assert.match(betaTypes, new RegExp(`\\b${key}:`), `declaration lacks ${key}`);
  }
  assert.equal(usage.service_tier, 'standard');
  assert.equal(usage.speed, 'standard');
});

test('tool-use SSE carries complete nullable fields and a direct caller', () => {
  const events = parseSse(buildToolUseSse());
  const start = events[0].data.message;
  for (const key of ['container', 'context_management', 'diagnostics', 'stop_details']) assert.equal(start[key], null, key);
  const block = events.find((e) => e.event === 'content_block_start').data.content_block;
  assert.equal(block.type, 'tool_use');
  assert.deepEqual(block.caller, { type: 'direct' });
  const md = events.find((e) => e.event === 'message_delta');
  assert.equal(md.data.context_management, null);
  assert.equal(md.data.delta.container, null);
  assert.equal(md.data.delta.stop_details, null);
  assert.equal(md.data.usage.iterations, null);
  assert.equal(md.data.usage.server_tool_use, null);
});

test('final SSE ends on end_turn with a citations:null text block', () => {
  const events = parseSse(buildFinalSse());
  assert.equal(events.find((e) => e.event === 'content_block_start').data.content_block.citations, null);
  assert.equal(events.find((e) => e.event === 'message_delta').data.delta.stop_reason, 'end_turn');
  assert.equal(planSseResponse(2).includes(WIRE_DONE_MARKER), true);
});

// ---------------------------------------------------------------------------
// 10. spawn hook + strict cleanup + argv honesty
// ---------------------------------------------------------------------------

function makeFakeChild({ cooperative = true } = {}) {
  const listeners = {};
  return {
    killed: false,
    exitCode: null,
    signalCode: null,
    once(ev, cb) {
      (listeners[ev] = listeners[ev] || []).push(cb);
    },
    on(ev, cb) {
      (listeners[ev] = listeners[ev] || []).push(cb);
    },
    off() {},
    kill(sig) {
      this.killed = true;
      if (cooperative) {
        this.signalCode = sig || 'SIGKILL';
        for (const cb of listeners.exit || []) cb(null, this.signalCode);
      }
      return true;
    },
  };
}

test('spawn hook hashes all argv (no slice-to-40) and records only safe flag names', () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const record = { argvFlags: [] };
  const hook = buildSpawnHook(counters, record, () => makeFakeChild({ cooperative: true }), () => {});
  const args = Array.from({ length: 60 }, (_, i) => `--flag-${i}`);
  args.push('Bearer', 'sk-ant-secretvalue');
  hook({ command: 'node', args, cwd: '/workspace/conversation', env: { ANTHROPIC_BASE_URL: 'u', ANTHROPIC_API_KEY: 'x' }, signal: undefined });
  assert.equal(record.argvCount, 62, 'argvCount is the ACTUAL length');
  assert.match(record.argvHash, /^[0-9a-f]{64}$/);
  assert.equal(record.argvFlags.length, 60, 'only flag tokens recorded');
  assert.equal(JSON.stringify(record).includes('sk-ant-secretvalue'), false);
  assert.equal(JSON.stringify(record).includes('Bearer"'), false);
});

test('a kill REQUEST alone is NOT confirmed cleanup; kill alone is not termination', async () => {
  const record = { child: makeFakeChild({ cooperative: false }), cleanedUp: false };
  assert.equal(await confirmChildCleanup(record, { graceMs: 20 }), false);
  assert.equal(record.cleanedUp, false);
});

test('cleanup is confirmed when the child actually exits after the kill', async () => {
  const record = { child: makeFakeChild({ cooperative: true }), cleanedUp: false };
  const hook = buildSpawnHook({ spawns: 0 }, record, () => record.child, () => {});
  // attach exit listener through the hook
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const h = buildSpawnHook(counters, record, () => record.child, () => {});
  h({ command: 'node', args: [], env: {}, signal: undefined });
  assert.equal(await confirmChildCleanup(record, { graceMs: 100 }), true);
  assert.equal(record.signalCode, 'SIGKILL');
});

test('spawn hook refuses a second native spawn', () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const record = { argvFlags: [] };
  let spawned = 0;
  const hook = buildSpawnHook(counters, record, () => (spawned += 1, makeFakeChild()), () => {});
  hook({ command: 'node', args: [], env: {}, signal: undefined });
  assert.throws(() => hook({ command: 'node', args: [], env: {}, signal: undefined }), /extra native spawn/);
  assert.equal(spawned, 1);
  assert.equal(record.violation, 'extra-spawn');
});

// ---------------------------------------------------------------------------
// 11. synthetic prompt stream
// ---------------------------------------------------------------------------

test('syntheticPromptStream yields one prompt then stays open until the gate resolves', async () => {
  const gate = createGate();
  const it = syntheticPromptStream(CAPTURE_USER_PROMPT, gate.promise)[Symbol.asyncIterator]();
  assert.equal((await it.next()).value.type, 'user');
  let done = false;
  const pending = it.next().then((r) => ((done = true), r));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(done, false);
  gate.resolve();
  assert.equal((await pending).done, true);
});

// ---------------------------------------------------------------------------
// 12. runCapture orchestrator
// ---------------------------------------------------------------------------

function makeFakeHost(mode = 'success', opts = {}) {
  const shared = {};
  const calls = { resolveSettings: 0, prepareWorkspace: 0, createWireServer: 0, startServer: 0, spawn: 0, query: 0 };
  const host = {
    resolveSettings: async () => {
      calls.resolveSettings += 1;
      if (opts.resolveSettings === 'hang') return new Promise(() => {});
      if (opts.resolveSettings === 'reject') throw new Error('boom sk-ant-api03-SECRET0123456789');
      return opts.resolvedShaped ?? VALID_RESOLVED;
    },
    prepareWorkspace: async () => {
      calls.prepareWorkspace += 1;
      if (opts.prepareWorkspace === 'throw') throw new Error('no dir');
      return true;
    },
    createWireServer: ({ counters }) => {
      calls.createWireServer += 1;
      const fakeTool = (name, d, schema, handler, extras) => ((shared.toolHandler = handler), { name, schema, handler, extras });
      return buildWireServer({ counters, createSdkMcpServer: (o) => ({ tools: o.tools }), sdkTool: fakeTool, z: { literal: (v) => ({ __literal: v }) } });
    },
    spawn: (spawnOptions, record) => {
      calls.spawn += 1;
      const child = makeFakeChild({ cooperative: opts.cooperativeChild !== false });
      shared.child = child;
      if (opts.stdioDone === 'hang') record.stdioDone = new Promise(() => {});
      else if (opts.stdioDone === 'immediate') record.stdioDone = Promise.resolve();
      return child;
    },
    startServer: async (cfg) => {
      calls.startServer += 1;
      shared.state = cfg.state;
      shared.signal = cfg.signal;
      if (opts.startServer === 'hang') return new Promise(() => {});
      return { port: PORT, state: cfg.state, close: () => (opts.close === 'hang' ? new Promise(() => {}) : Promise.resolve()) };
    },
    query: ({ prompt, options }) => {
      calls.query += 1;
      return opts.rawQuery ? opts.rawQuery({ prompt, options, shared }) : makeFakeQuery({ prompt, options, shared, mode });
    },
  };
  return { host, shared, calls };
}

async function* makeFakeQuery({ prompt, options, shared, mode }) {
  const it = prompt[Symbol.asyncIterator]();
  await it.next();
  if (typeof it.return === 'function') await it.return();
  if (mode === 'stuck-iterator') {
    await new Promise(() => {});
    return;
  }
  options.spawnClaudeCodeProcess({ command: 'node', args: ['--strict-mcp-config', '-p'], cwd: options.cwd, env: options.env, signal: options.abortController.signal });
  if (mode === 'extra-spawn') {
    options.spawnClaudeCodeProcess({ command: 'node', args: ['-p'], cwd: options.cwd, env: options.env, signal: options.abortController.signal });
    return;
  }
  if (mode === 'deadline') {
    await new Promise((r) => options.abortController.signal.addEventListener('abort', r, { once: true }));
    return;
  }
  const mk = (body, path = '/v1/messages') => ({ method: 'POST', path, host: `${LOOPBACK_HOST}:${PORT}`, peer: LOOPBACK_HOST, rawBytes: Buffer.from(JSON.stringify(body)), headers: { host: `${LOOPBACK_HOST}:${PORT}` } });
  if (mode === 'reject-first') {
    classifyRequest(shared.state, mk(req1Body((b) => (b.model = 'wrong'))));
    yield { type: 'result', subtype: 'success', is_error: false, result: WIRE_DONE_MARKER, stop_reason: 'end_turn', session_id: SESSION_UUID };
    return;
  }
  if (mode === 'sensitive-body') {
    if (!classifyRequest(shared.state, mk({ model: CAPTURE_MODEL, stream: true, tools: ADVERT, messages: [{ role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }], api_key: 'OPAQUE_SYNTHETIC_CREDENTIAL' }] })).ok) return;
    yield { type: 'result', subtype: 'success', is_error: false, result: WIRE_DONE_MARKER, stop_reason: 'end_turn', session_id: SESSION_UUID };
    return;
  }
  if (!classifyRequest(shared.state, mk(req1Body())).ok) return;
  await options.canUseTool(WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } });
  await shared.toolHandler({ value: WIRE_TOKEN });
  if (!classifyRequest(shared.state, mk(req2Body(), '/v1/messages?beta=true')).ok) return;
  if (mode === 'is_error') {
    yield { type: 'result', subtype: 'success', is_error: true, result: 'api error', stop_reason: 'end_turn', session_id: SESSION_UUID };
    return;
  }
  yield { type: 'result', subtype: 'success', is_error: false, result: `ok ${WIRE_DONE_MARKER}`, stop_reason: 'end_turn', num_turns: 2, session_id: SESSION_UUID };
}

test('runCapture success: two requests, one callback/handler/spawn, confirmed cleanup', async () => {
  const { host } = makeFakeHost('success');
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, true, JSON.stringify(report.reasons));
  assert.deepEqual(report.counters, { permissionCallbacks: 1, handlerExecutions: 1, spawns: 1 });
  assert.equal(report.requests.length, 2);
  assert.equal(report.spawn.cleanedUp, true);
  assert.match(report.captureId, /^[0-9a-f-]{36}$/);
});

test('resolution error/timeout/malformed STOPS before construction', async () => {
  for (const [opts, reason] of [
    [{ resolveSettings: 'reject' }, /settings resolution failed \(Error\)/],
    [{ resolveSettings: 'hang' }, /settings resolution timed out/],
    [{ resolvedShaped: {} }, /malformed resolved settings/],
  ]) {
    const { host, calls } = makeFakeHost('success', opts);
    const report = await runCapture({ host, source: {}, deadlineMs: 40 });
    assert.equal(report.ok, false);
    assert.match(report.reasons.join(' '), reason);
    assert.equal(calls.createWireServer, 0);
    assert.equal(calls.startServer, 0);
    assert.equal(calls.query, 0);
    assert.equal(calls.spawn, 0);
  }
});

test('managed tier and invalid deadline STOP', async () => {
  const { host, calls } = makeFakeHost('success');
  const r1 = await runCapture({ host, source: {}, resolvedSettings: { effective: {}, provenance: {}, sources: [{ source: 'managed', settings: {} }] } });
  assert.match(r1.reasons.join(' '), /managed settings tier/);
  assert.equal(calls.startServer, 0);
  const r2 = await runCapture({ host, source: {}, deadlineMs: 0 });
  assert.match(r2.reasons.join(' '), /invalid deadline injection/);
  assert.throws(() => validateDeadline(60001));
});

test('error messages are not exported as opaque secret text', async () => {
  const { host } = makeFakeHost('success', { resolveSettings: 'reject' });
  const report = await runCapture({ host, source: {} });
  assert.equal(JSON.stringify(report).includes('sk-ant-api03'), false);
  assert.equal(JSON.stringify(report).includes('boom'), false);
});

test('workspace preparation failure STOPS before spawn', async () => {
  const { host, calls } = makeFakeHost('success', { prepareWorkspace: 'throw' });
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /workspace preparation failed \(Error\)/);
  assert.equal(calls.spawn, 0);
});

test('server startup hang is bounded and fails closed', async () => {
  const { host } = makeFakeHost('success', { startServer: 'hang' });
  const report = await runCapture({ host, source: {}, deadlineMs: 30 });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /server startup timed out/);
});

test('runCapture fails on success-with-is_error true', async () => {
  const report = await runCapture({ host: makeFakeHost('is_error').host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /is_error/);
});

test('runCapture aborts on a rejected request', async () => {
  const report = await runCapture({ host: makeFakeHost('reject-first').host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /aborted|requests/);
});

test('runCapture is bounded when the iterator never yields', async () => {
  const report = await runCapture({ host: makeFakeHost('stuck-iterator').host, source: {}, deadlineMs: 25 });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /deadline/);
});

test('runCapture is bounded when server.close never settles', async () => {
  const report = await runCapture({ host: makeFakeHost('success', { close: 'hang' }).host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /server close did not complete/);
});

test('query cleanup via return() must succeed and is bounded', async () => {
  const rejectHost = makeFakeHost('success', {
    rawQuery: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true }), return: async () => { throw new Error('bad'); } }) }),
  }).host;
  const r1 = await runCapture({ host: rejectHost, source: {} });
  assert.match(r1.reasons.join(' '), /query cleanup failed \(Error\)/);

  const hangHost = makeFakeHost('success', {
    rawQuery: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true }), return: () => new Promise(() => {}) }) }),
  }).host;
  const r2 = await runCapture({ host: hangHost, source: {} });
  assert.match(r2.reasons.join(' '), /query cleanup timed out/);
});

test('a second native spawn is refused and the capture fails', async () => {
  const { host, calls } = makeFakeHost('extra-spawn');
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.equal(calls.spawn, 1);
  assert.match(report.reasons.join(' '), /extra native spawn/);
});

test('runCapture fails when child cleanup cannot be confirmed', async () => {
  const report = await runCapture({ host: makeFakeHost('success', { cooperativeChild: false }).host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /child cleanup not confirmed/);
});

test('sensitive body forces hash-only failure and no raw export', async () => {
  const { host } = makeFakeHost('sensitive-body');
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /sensitive material detected/);
  assert.equal(report.requests[0].hashOnly, true);
  const lines = buildOutputLines(report);
  assert.equal(lines[0].ok, false);
  assert.equal(lines.at(-1).ok, false);
  assert.equal(lines.filter((l) => l.record === 'sdk-capture-request-chunk').length, 0);
});

// ---------------------------------------------------------------------------
// 13. bounded output records
// ---------------------------------------------------------------------------

test('buildOutputLines emits indexed base64 chunks + length/hash manifest', async () => {
  const { host } = makeFakeHost('success');
  const report = await runCapture({ host, source: {} });
  const big = 'A'.repeat(133);
  report.requests[0].base64 = big;
  report.requests[0].rawLength = big.length;
  report.requests[0].path = '/v1/messages';
  const lines = buildOutputLines(report, { chunkBytes: 64 });
  assert.equal(lines[0].record, 'sdk-capture-manifest');
  assert.equal(lines[0].captureId, report.captureId);
  assert.equal(lines[0].requestCount, report.requests.length);
  assert.equal(lines[0].requestManifest[0].rawSha256, report.requests[0].rawSha256);
  const chunks = lines.filter((l) => l.record === 'sdk-capture-request-chunk' && l.index === 1);
  assert.equal(chunks.length, 3);
  assert.equal(chunks.map((c) => c.base64).join(''), big);
  assert.equal(lines.at(-1).record, 'sdk-capture-end');
  assert.equal(lines.at(-1).captureId, report.captureId);
  for (const l of lines) assert.ok(Buffer.byteLength(JSON.stringify(l)) <= MAX_RECORD_BYTES, 'record within bound');
});

test('buildOutputLines fails closed when a record would exceed the bound', () => {
  const report = { ok: true, reasons: ['x'.repeat(MAX_RECORD_BYTES * 2)], captureId: 'c', counters: {}, spawn: {}, result: null, requests: [] };
  const lines = buildOutputLines(report);
  assert.equal(lines[0].ok, false);
  assert.match(lines[0].reasons.join(' '), /exceeded bound/);
});

test('writeOnce is bounded and surfaces error/close/timeout', async () => {
  const okOut = { write: (s, cb) => (cb && cb(), true), once() {}, off() {} };
  assert.equal((await writeOnce('x', okOut, Date.now() + 1000)).ok, true);
  const errOut = { write: (s, cb) => (cb && cb(new Error('e')), true), once() {}, off() {} };
  assert.equal((await writeOnce('x', errOut, Date.now() + 1000)).ok, false);
  const hangOut = { write: () => true, once() {}, off() {} };
  const r = await writeOnce('x', hangOut, Date.now() + 20);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'write-timeout');
});

test('writeLines refuses an oversized record', async () => {
  const out = { write: (s, cb) => (cb && cb(), true), once() {}, off() {} };
  const r = await writeLines([{ record: 'x', pad: 'z'.repeat(MAX_RECORD_BYTES * 2) }], out, { deadlineAt: Date.now() + 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'record-too-large');
});

// ---------------------------------------------------------------------------
// 14. workspace preparation (no-follow, empty, exclusive)
// ---------------------------------------------------------------------------

test('realPrepareWorkspace accepts empty real dirs and rejects symlink ancestors', () => {
  const root = mkdtempSync(join(tmpdir(), 'meri-ws-'));
  const good = join(root, 'a', 'b');
  assert.equal(realPrepareWorkspace([good]), true);
  writeFileSync(join(good, 'f'), 'x');
  assert.throws(() => realPrepareWorkspace([good]), /not empty/);
  const real = join(root, 'real');
  mkdirSync(real);
  const link = join(root, 'link');
  let symlinkOk = true;
  try {
    symlinkSync(real, link);
  } catch {
    symlinkOk = false; // Windows without privilege cannot create symlinks
  }
  if (symlinkOk) assert.throws(() => realPrepareWorkspace([join(link, 'child')]), /symlink ancestor/);
});

// ---------------------------------------------------------------------------
// 15. main() guard
// ---------------------------------------------------------------------------

test('main refuses to run off Linux without building any host', async () => {
  const out = { written: '', write: (s, cb) => ((out.written += s), cb && cb(), true), once() {}, off() {} };
  assert.equal(await main({ platform: 'win32', stdout: out }), 2);
  assert.match(out.written, /linux-only probe/);
});

test('errorType never returns an opaque message', () => {
  assert.equal(errorType(new Error('secret sk-ant-x')), 'Error');
  assert.equal(errorType({ name: 'TimeoutError' }), 'TimeoutError');
  assert.equal(errorType(null), 'Error');
});

// ---------------------------------------------------------------------------
// 16. repair-3 audit regressions (reproduced, then flipped)
// ---------------------------------------------------------------------------

const AUDIT_SENTINEL = 'OPAQUE_SYNTHETIC_CREDENTIAL';
const FULL_TOOLS = [{ name: WIRE_TOOL_FULLNAME, description: 'Synthetic echo', input_schema: { type: 'object', properties: { value: { type: 'string', const: WIRE_TOKEN } }, required: ['value'], additionalProperties: false } }];
const fullFirst = (extra = {}) => ({ model: CAPTURE_MODEL, max_tokens: 256, stream: true, system: CAPTURE_SYSTEM_PROMPT, thinking: { type: 'disabled' }, metadata: { user_id: SESSION_UUID }, tools: FULL_TOOLS, messages: [{ role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }] }], ...extra });

function fakeQueryTo(host_mode, opts) {
  return makeFakeHost(host_mode, opts);
}

test('credential detection is semantic: accounting token fields are NOT credential keys', () => {
  assert.equal(hasSensitiveBody(fullFirst()), false, 'a full pinned Messages request must not be hash-only');
  assert.equal(hasSensitiveBody({ max_tokens: 256, input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 }), false);
  assert.equal(hasSensitiveBody({ api_key: AUDIT_SENTINEL }), true);
  assert.equal(hasSensitiveBody({ nested: { access_token: 'x' } }), true);
  assert.equal(hasSensitiveBody({ a: [{ b: { authorization: 'x' } }] }), true);
});

test('an opaque error NAME is never exported', () => {
  const e = new Error('ignored');
  e.name = `sk-ant-${AUDIT_SENTINEL}`;
  assert.equal(errorType(e), 'Error');
  assert.equal(errorType({ name: AUDIT_SENTINEL }), 'Error');
});

test('full-pinned Messages positive: exactly two normal requests capture and reconstruct', async () => {
  const { host } = makeFakeHost('success', {
    rawQuery: ({ options, shared: sh }) =>
      (async function* () {
        const it = syntheticPromptStream(CAPTURE_USER_PROMPT, new Promise(() => {}))[Symbol.asyncIterator]();
        await it.next();
        if (typeof it.return === 'function') await it.return();
        options.spawnClaudeCodeProcess({ command: 'never-executed', args: [], cwd: options.cwd, env: options.env, signal: options.abortController.signal });
        const classify = (b) => classifyRequest(sh.state, { method: 'POST', path: '/v1/messages', host: `${LOOPBACK_HOST}:${PORT}`, peer: LOOPBACK_HOST, rawBytes: Buffer.from(JSON.stringify(b)), headers: {} });
        assert.equal(classify(fullFirst()).ok, true);
        await options.canUseTool(WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } });
        await sh.toolHandler({ value: WIRE_TOKEN });
        const second = { ...fullFirst(), messages: [...fullFirst().messages, { role: 'assistant', content: [{ type: 'tool_use', id: WIRE_TOOL_USE_ID, name: WIRE_TOOL_FULLNAME, input: { value: WIRE_TOKEN } }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: WIRE_TOOL_USE_ID, content: [{ type: 'text', text: WIRE_TOOL_RESULT }] }] }] };
        assert.equal(classify(second).ok, true);
        yield { type: 'result', subtype: 'success', is_error: false, result: WIRE_DONE_MARKER, stop_reason: 'end_turn', session_id: SESSION_UUID, num_turns: 2 };
      })(),
  });
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, true, JSON.stringify(report.reasons));
  assert.deepEqual(report.requests.map((r) => r.hashOnly), [false, false]);
  const lines = buildOutputLines(report);
  assert.ok(lines.some((l) => l.record === 'sdk-capture-request-chunk'));
  assert.equal(lines[0].ok, true);
});

test('a foreign/secret tool_use id never appears in reasons or output', async () => {
  const { host } = makeFakeHost('success', {
    rawQuery: ({ options, shared: sh }) =>
      (async function* () {
        const it = syntheticPromptStream(CAPTURE_USER_PROMPT, new Promise(() => {}))[Symbol.asyncIterator]();
        await it.next();
        if (typeof it.return === 'function') await it.return();
        options.spawnClaudeCodeProcess({ command: 'node', args: [], cwd: options.cwd, env: options.env, signal: options.abortController.signal });
        const classify = (b) => classifyRequest(sh.state, { method: 'POST', path: '/v1/messages', host: `${LOOPBACK_HOST}:${PORT}`, peer: LOOPBACK_HOST, rawBytes: Buffer.from(JSON.stringify(b)), headers: {} });
        classify(req1Body());
        classify(req2Body((b) => (b.messages[1].content[0].id = `sk-ant-${AUDIT_SENTINEL}`)));
        yield { type: 'result', subtype: 'success', is_error: false, result: WIRE_DONE_MARKER, stop_reason: 'end_turn', session_id: SESSION_UUID };
      })(),
  });
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.equal(JSON.stringify(report).includes(AUDIT_SENTINEL), false);
  assert.equal(JSON.stringify(buildOutputLines(report)).includes(AUDIT_SENTINEL), false);
});

test('flag values (and value-bearing flags) are never exported; only sanitized names', () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const record = { argvFlags: [] };
  const hook = buildSpawnHook(counters, record, () => makeFakeChild(), () => {});
  const args = [`--api-key=${AUDIT_SENTINEL}`, `--settings={"secret":"${AUDIT_SENTINEL}"}`, `--sk-ant-${AUDIT_SENTINEL}`];
  hook({ command: 'node', args, cwd: '/workspace/conversation', env: {}, signal: undefined });
  assert.equal(record.argvCount, 3, 'full argv count preserved');
  assert.match(record.argvHash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(record).includes(AUDIT_SENTINEL), false);
  assert.deepEqual(record.argvFlags.slice(0, 2), ['--api-key', '--settings']);
  assert.match(record.argvFlags[2], /^--hashed-[0-9a-f]{12}$/);
});

test('main derives exit from emitted protocol + write outcome, not report.ok alone', async () => {
  const src = readFileSync(join(HERE, 'sdk-capture.mjs'), 'utf8');
  const mainSrc = src.slice(src.indexOf('export async function main('), src.indexOf('const invokedDirectly')).replace('export async function', 'async function');
  const badReport = { ok: true, reasons: [], captureId: SESSION_UUID, counters: {}, spawn: {}, result: null, requests: [{ index: 1, path: '/v1/messages', rawLength: 1, rawSha256: 'a'.repeat(64), decompressedLength: 1, decompressedSha256: 'b'.repeat(64), decoded: {}, base64: 'eA==', headers: [{ name: 'x-long', value: 'A'.repeat(MAX_RECORD_BYTES * 2) }] }] };
  const main = new Function('buildRealHost', 'runCapture', 'buildOutputLines', 'writeLines', `${mainSrc};return main;`)(async () => ({}), async () => badReport, buildOutputLines, writeLines);
  const written = [];
  const stdout = { write: (s, cb) => (written.push(JSON.parse(s)), cb(), true), once() {}, off() {} };
  const exit = await main({ platform: 'linux', source: {}, stdout });
  assert.notEqual(exit, 0);
  assert.deepEqual(written.map((w) => w.ok), [false, false]);
});

test('writeLines with an expired absolute deadline writes nothing and fails', async () => {
  let time = 6000;
  let writes = 0;
  const stdout = { write: (_s, cb) => (++writes, time++, cb(), false), once() {}, off() {} };
  const r = await writeLines(Array.from({ length: 100 }, () => ({ record: 'synthetic' })), stdout, { deadlineAt: 0, now: () => time });
  assert.equal(r.ok, false);
  assert.equal(writes, 0);
  assert.equal((await writeLines([], stdout, { deadlineAt: NaN })).error, 'invalid-output-deadline');
});

test('a write callback error does not surface an uncaught error', async () => {
  let unhandled;
  const listener = (e) => (unhandled = e.name);
  process.once('uncaughtException', listener);
  const stdout = new Writable({
    write(_c, _e, cb) {
      cb(new Error('synthetic write failure'));
    },
  });
  const r = await writeOnce('synthetic', stdout, Date.now() + 200);
  await new Promise((res) => setTimeout(res, 20));
  process.off('uncaughtException', listener);
  assert.equal(r.ok, false);
  assert.equal(unhandled ?? null, null);
});

test('runCapture requires child stdio EOF before a PASS', async () => {
  const okHost = fakeQueryTo('success', { stdioDone: 'immediate' }).host;
  const okReport = await runCapture({ host: okHost, source: {} });
  assert.equal(okReport.ok, true, JSON.stringify(okReport.reasons));

  const stuckHost = fakeQueryTo('success', { stdioDone: 'hang' }).host;
  const stuckReport = await runCapture({ host: stuckHost, source: {} });
  assert.equal(stuckReport.ok, false);
  assert.match(stuckReport.reasons.join(' '), /child stdio not drained/);
});

// Owner corrections exercise the real adapter body with a fake child. No
// process, SDK, server or socket starts, and production spawn code is unchanged.
function isolatedRealSpawner(child) {
  const source = readFileSync(join(HERE, 'sdk-capture.mjs'), 'utf8');
  const body = source.slice(source.indexOf('export function realSpawner('), source.indexOf('// Synthetic input stream')).replace('export function', 'function');
  return new Function('nodeSpawn', 'createHash', 'MAX_STDERR_BYTES', 'STDERR_PREVIEW_CHARS', 'boundedPreview', `${body};return realSpawner;`)(() => child, createHash, 65536, 2048, () => '[scrubbed]');
}

test('real adapter waits for child close after stderr EOF and snapshots final bytes', async () => {
  const child = new EventEmitter(); child.stderr = new EventEmitter();
  const record = {};
  isolatedRealSpawner(child)({ command: 'never-executed', args: [] }, record);
  let closed = false; record.stdioDone.then(() => { closed = true; });
  child.stderr.emit('data', Buffer.from('first'));
  child.stderr.emit('end');
  await Promise.resolve();
  assert.equal(closed, false, 'stderr EOF cannot establish all child stdio closed');
  child.emit('close', 0);
  await record.stdioDone;
  assert.equal(closed, true);
  assert.equal(record.stderrTotalBytes, 5);
  assert.equal(record.stderrSha256, createHash('sha256').update('first').digest('hex'));
});

test('real adapter overflow and read error reach the violation callback', async () => {
  const child = new EventEmitter(); child.stderr = new EventEmitter();
  const record = {}; const violations = [];
  isolatedRealSpawner(child)({ command: 'never-executed', args: [] }, record, (reason) => violations.push(reason));
  child.stderr.emit('data', Buffer.alloc(65537, 120));
  child.stderr.emit('error', new Error('OPAQUE_SYNTHETIC_CREDENTIAL'));
  child.emit('close', 1);
  await record.stdioDone;
  assert.deepEqual(violations, ['stderr overflow', 'stderr read failed']);
  assert.equal(record.stderrReadError, true);
  assert.equal(record.stderrTotalBytes, 65537);
  assert.equal(record.stderrHashedBytes, 65536);
  assert.equal(record.stderrTruncated, true);
});

test('public spawn hook forwards the violation callback to its adapter', () => {
  const violations = []; const callback = (reason) => violations.push(reason);
  const record = {}; const counters = { spawns: 0 };
  const hook = buildSpawnHook(counters, record, (_options, _record, onViolation) => { onViolation('synthetic adapter violation'); return makeFakeChild(); }, callback);
  hook({ command: 'never-executed', args: [], env: {} });
  assert.deepEqual(violations, ['synthetic adapter violation']);
});

test('top-level fatal output uses a fixed bounded write and sanitized error type', async () => {
  const source = readFileSync(join(HERE, 'sdk-capture.mjs'), 'utf8');
  const body = source.slice(source.lastIndexOf('.catch(async (error) => {') + '.catch(async (error) => {'.length, source.lastIndexOf('\n    });'));
  assert.ok(body.includes('writeLines'));
  const fakeProcess = { exitCode: 0, stdout: {} }; const writes = [];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fatal = new AsyncFunction('error', 'process', 'writeLines', 'errorType', body);
  const before = Date.now();
  await fatal({ name: 'OPAQUE_SYNTHETIC_CREDENTIAL' }, fakeProcess, async (...args) => { writes.push(args); return { ok: false }; }, errorType);
  assert.equal(fakeProcess.exitCode, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1], fakeProcess.stdout);
  assert.ok(writes[0][2].deadlineAt >= before + 5000 && writes[0][2].deadlineAt <= Date.now() + 5000);
  assert.equal(JSON.stringify(writes).includes('OPAQUE_SYNTHETIC_CREDENTIAL'), false);
});
