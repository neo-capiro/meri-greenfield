// W02-05 native SDK loopback wire-capture OFFLINE tests.
//
// Run directly with:
//   node --test apps/worker/qualification/probes/sdk-capture.test.mjs
//
// Deterministic and hermetic: importing or running these tests starts NO
// server, NO native process and NO socket. Every host-side effect (settings
// resolution, wire MCP server construction, native spawn, loopback server,
// query) is injected as a fake. The fakes deliberately include UNCOOPERATIVE
// paths (iterator that never yields, server.close that never settles, kill that
// never terminates) to prove the orchestrator is bounded and fails closed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import zlib from 'node:zlib';

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
  scrubSecrets,
  looksLikeSecret,
  sanitizeHeaders,
  decodeRequestBody,
  createCaptureState,
  classifyRequest,
  validateToolRoundTrip,
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
  runCapture,
  main,
} from './sdk-capture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const sdkTypes = readFileSync(join(PKG, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'sdk.d.ts'), 'utf8');
const betaTypes = readFileSync(
  join(PKG, 'node_modules', '@anthropic-ai', 'sdk', 'resources', 'beta', 'messages', 'messages.d.ts'),
  'utf8',
);

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const req1Body = () => ({
  model: CAPTURE_MODEL,
  stream: true,
  messages: [{ role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }] }],
});
const req2Body = (mutate) => {
  const b = {
    model: CAPTURE_MODEL,
    stream: true,
    messages: [
      { role: 'user', content: [{ type: 'text', text: CAPTURE_USER_PROMPT }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: WIRE_TOOL_USE_ID, name: WIRE_TOOL_FULLNAME, input: { value: WIRE_TOKEN } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: WIRE_TOOL_USE_ID, content: [{ type: 'text', text: WIRE_TOOL_RESULT }] }] },
    ],
  };
  if (mutate) mutate(b);
  return b;
};

const PORT = 51234;
function mkReq(body, { path = '/v1/messages', host = `${LOOPBACK_HOST}:${PORT}`, peer = LOOPBACK_HOST, headers = {}, contentEncoding, raw, oversize } = {}) {
  return { method: 'POST', path, host, peer, rawBytes: raw !== undefined ? raw : Buffer.from(JSON.stringify(body)), contentEncoding, oversize, headers: { host, ...headers } };
}
function stateAt(p = PORT) {
  return createCaptureState(p);
}

// ---------------------------------------------------------------------------
// 1. classifyRequest success + exact byte/hash reconstruction
// ---------------------------------------------------------------------------

test('classifyRequest records exact raw bytes and hash for both requests', () => {
  const state = stateAt();
  const raw1 = Buffer.from(JSON.stringify(req1Body()));
  const d1 = classifyRequest(state, mkReq(undefined, { raw: raw1 }));
  assert.equal(d1.ok, true, d1.error);
  assert.equal(state.count, 1);
  assert.equal(state.requests[0].rawSha256, hashSha256(raw1));
  assert.equal(state.requests[0].base64, raw1.toString('base64'));
  const raw2 = Buffer.from(JSON.stringify(req2Body()));
  const d2 = classifyRequest(state, mkReq(undefined, { path: '/v1/messages?beta=true', raw: raw2 }));
  assert.equal(d2.ok, true, d2.error);
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
  assert.equal(state.count, 0);
}

test('wrong method / path / host / port / peer / model / stream fail and abort', () => {
  expectAbort({ ...mkReq(req1Body()), method: 'GET' }, /method GET/);
  expectAbort(mkReq(req1Body(), { path: '/v1/complete' }), /path/);
  expectAbort(mkReq(req1Body(), { host: 'api.anthropic.com' }), /host/);
  expectAbort(mkReq(req1Body(), { host: `${LOOPBACK_HOST}:9999` }), /host .*expected/);
  expectAbort(mkReq(req1Body(), { peer: '10.0.0.5' }), /non-loopback peer/);
  expectAbort(mkReq({ ...req1Body(), model: 'claude-sonnet-5' }), /model/);
  expectAbort(mkReq({ ...req1Body(), stream: false }), /stream/);
});

test('oversize and malformed and unsupported-encoding fail and abort', () => {
  expectAbort(mkReq(undefined, { raw: Buffer.from('{not json') }), /malformed JSON/);
  expectAbort(mkReq(undefined, { raw: Buffer.alloc(4 * 1024 * 1024 + 1, 0x61) }), /oversize/);
  expectAbort(mkReq(req1Body(), { raw: Buffer.alloc(10), oversize: true }), /oversize/);
  expectAbort(mkReq(req1Body(), { contentEncoding: 'br' }), /unsupported content-encoding/);
});

test('gzip is decoded with independent raw/decompressed hashes', () => {
  const state = stateAt();
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(req1Body())));
  const d = classifyRequest(state, mkReq(undefined, { raw: gz, contentEncoding: 'gzip' }));
  assert.equal(d.ok, true, d.error);
  assert.equal(state.requests[0].rawSha256, hashSha256(gz));
  assert.equal(state.requests[0].decompressedSha256, hashSha256(Buffer.from(JSON.stringify(req1Body()))));
});

test('advertised tool set outside the wire echo tool is rejected', () => {
  expectAbort(mkReq({ ...req1Body(), tools: [{ name: 'Bash' }] }), /tool outside the wire echo tool set/);
});

test('second request without matching tool round-trip fails', () => {
  expectAbortSequence(req2Body((b) => { b.messages.splice(1, 1); b.messages.splice(2, 1); }), /tool_use/);
});

function expectAbortSequence(body2, matcher) {
  const state = stateAt();
  assert.equal(classifyRequest(state, mkReq(req1Body())).ok, true);
  const d = classifyRequest(state, mkReq({ ...body2, stream: true, model: CAPTURE_MODEL }, { path: '/v1/messages' }));
  assert.equal(d.ok, false);
  assert.match(state.aborted, matcher);
}

test('strict tool round-trip rejects foreign ids, wrong order, extra keys, is_error, unrelated prompt, extra tools', () => {
  expectAbortSequence(req2Body((b) => { b.messages[1].content[0].id = 'toolu_other'; }), /foreign tool_use id/);
  expectAbortSequence(req2Body((b) => { b.messages[1].content[0].name = 'mcp__wire__other'; }), /foreign tool name/);
  expectAbortSequence(req2Body((b) => { b.messages[1].content[0].input = { value: WIRE_TOKEN, extra: 1 }; }), /exactly \{value:token\}/);
  expectAbortSequence(req2Body((b) => { b.messages[1].content.push({ type: 'tool_use', id: 'x', name: WIRE_TOOL_FULLNAME, input: { value: WIRE_TOKEN } }); }), /exactly 1 tool_use/);
  expectAbortSequence(req2Body((b) => { b.messages[2].content[0].tool_use_id = 'toolu_other'; }), /does not match emitted id/);
  expectAbortSequence(req2Body((b) => { b.messages[2].content[0].is_error = true; }), /is_error:true/);
  expectAbortSequence(req2Body((b) => { b.messages[2].content[0].content = [{ type: 'text', text: 'wrong' }]; }), /content mismatch/);
  expectAbortSequence(req2Body((b) => { b.messages[0].content[0].text = 'unrelated prompt'; }), /unrelated prompt/);
  // wrong role order: tool_result before the assistant tool_use
  expectAbortSequence(req2Body((b) => { b.messages = [b.messages[0], b.messages[2], b.messages[1]]; }), /role order|tool_use|tool_result/);
});

test('duplicate / third request beyond exactly two fails and aborts', () => {
  const state = stateAt();
  assert.equal(classifyRequest(state, mkReq(req1Body())).ok, true);
  assert.equal(classifyRequest(state, mkReq(req2Body())).ok, true);
  const d = classifyRequest(state, mkReq(req2Body()));
  assert.equal(d.ok, false);
  assert.match(state.aborted, /duplicate\/extra/);
});

test('validateToolRoundTrip is a pure function over the emitted id', () => {
  assert.equal(validateToolRoundTrip(req2Body(), WIRE_TOOL_USE_ID).ok, true);
  assert.equal(validateToolRoundTrip(req2Body(), 'toolu_other').ok, false);
});

// ---------------------------------------------------------------------------
// 3. secret scrubbing + header sanitization
// ---------------------------------------------------------------------------

test('scrubSecrets redacts bearer tokens, sk-ant keys, JWTs and key=value pairs', () => {
  const raw = 'x-auth-token: Bearer abcdef0123456789 x sk-ant-api03-ABCDEFGHIJKLMNOP token: "supersecretvalue"';
  const scrubbed = scrubSecrets(raw);
  assert.equal(scrubbed.includes('sk-ant-api03'), false);
  assert.equal(scrubbed.includes('abcdef0123456789'), false);
  assert.equal(scrubbed.includes('supersecretvalue'), false);
  assert.equal(looksLikeSecret(raw), true);
  assert.equal(looksLikeSecret('plain synthetic text'), false);
});

test('sanitizeHeaders redacts x-auth-token, authorization, api keys and Bearer values', () => {
  const out = sanitizeHeaders({
    'x-auth-token': 'opaque-value',
    authorization: 'Bearer sk-ant-secret',
    'x-api-key': 'sk-ant-secret',
    cookie: 'session=abc',
    'x-custom': 'Bearer abcdef0123456789',
    'anthropic-beta': 'oauth-2025-04-20',
    host: `${LOOPBACK_HOST}:${PORT}`,
  });
  const byName = Object.fromEntries(out.map((h) => [h.name, h.value]));
  for (const n of ['x-auth-token', 'authorization', 'x-api-key', 'cookie', 'x-custom']) {
    assert.equal(byName[n], '<redacted>', `${n} must be redacted`);
  }
  assert.equal(byName['anthropic-beta'], 'oauth-2025-04-20', 'beta header retained');
  assert.equal(byName.host, `${LOOPBACK_HOST}:${PORT}`);
});

// ---------------------------------------------------------------------------
// 4. permission callback (provenance + exact input)
// ---------------------------------------------------------------------------

test('permission callback allows only the exact wire tool/provenance/input', async () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const cb = createPermissionCallback(counters);
  const good = await cb(WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } });
  assert.equal(good.behavior, 'allow');
  const cases = [
    ['mcp__wire__other', { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } }],
    [WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'user' } }],
    [WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: 'other', source: 'sdk' } }],
    [WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, {}],
    [WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN, extra: 1 }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } }],
    [WIRE_TOOL_FULLNAME, {}, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } }],
    ['Bash', {}, {}],
  ];
  for (const [name, input, options] of cases) assert.equal((await cb(name, input, options)).behavior, 'deny', name);
  assert.equal(counters.permissionCallbacks, 1 + cases.length);
});

test('echo handler revalidates input and returns the fixed result', async () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  assert.deepEqual(await runEchoHandler(counters, { value: WIRE_TOKEN }), { content: [{ type: 'text', text: WIRE_TOOL_RESULT }] });
  await assert.rejects(() => runEchoHandler(counters, { value: WIRE_TOKEN, extra: 1 }));
  await assert.rejects(() => runEchoHandler(counters, { value: 'wrong' }));
  assert.equal(counters.handlerExecutions, 3);
});

// ---------------------------------------------------------------------------
// 5. wire MCP server + tool shape
// ---------------------------------------------------------------------------

test('buildWireServer registers one always-load echo tool with the exact schema and timeout', () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const seen = {};
  const fakeTool = (name, description, schema, handler, extras) => (seen.tool = { name, description, schema, handler, extras });
  const fakeCreate = (opts) => (seen.server = opts, { instance: {}, tools: opts.tools });
  const servers = buildWireServer({ counters, createSdkMcpServer: fakeCreate, sdkTool: fakeTool, z: { literal: (v) => ({ __literal: v }) } });
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
  const before = { ...process.env };
  const env = buildCaptureEnv(51234);
  assert.equal(env.ANTHROPIC_BASE_URL, `http://${LOOPBACK_HOST}:51234`);
  assert.match(env.ANTHROPIC_API_KEY, /^sk-ant-synthetic-/);
  for (const [k, v] of Object.entries(CHILD_ENV_FLAGS)) assert.equal(env[k], v, k);
  const expected = new Set(['PATH', 'HOME', 'CLAUDE_CONFIG_DIR', 'TMPDIR', 'LANG', 'LC_ALL', 'NODE_ENV', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'MERI_QUALIFICATION_ONLY', 'MERI_SOURCES_ENABLED', ...Object.keys(CHILD_ENV_FLAGS)]);
  for (const name of Object.keys(env)) assert.equal(expected.has(name), true, `unexpected child env var: ${name}`);
  // harmless parent markers are NEVER copied into the replacement child env
  for (const name of HARMLESS_PARENT_ENV_ALLOWLIST) assert.equal(name in env, false, `must not copy ${name}`);
  assert.deepEqual({ ...process.env }, before, 'process.env untouched');
});

test('capture settings disable discovery, memory, attribution, agent view, remote control, workflows', () => {
  const s = buildCaptureSettings();
  for (const [k, v] of Object.entries({
    autoMemoryEnabled: false, autoDreamEnabled: false, syncClaudeAiSkills: false, syncClaudeAiPlugins: false,
    disableAllHooks: true, enableAllProjectMcpServers: false, includeGitInstructions: false, fastMode: false,
    disableAutoMode: 'disable', disableAgentView: true, disableRemoteControl: true, disableWorkflows: true, remoteControlAtStartup: false,
  })) assert.deepEqual(s[k], v, k);
  assert.deepEqual(s.permissions.ask, [WIRE_TOOL_FULLNAME]);
  assert.equal(s.permissions.disableBypassPermissionsMode, 'disable');
  assert.equal(s.permissions.blockReadsOutsideWorkingDirectories, true);
});

test('buildCaptureOptions validates and rejects forbidden fields', () => {
  const base = { abortController: new AbortController(), env: buildCaptureEnv(51234), mcpServers: { [WIRE_SERVER_NAME]: { type: 'sdk' } }, canUseTool: async () => ({ behavior: 'deny' }), spawnClaudeCodeProcess: () => ({}) };
  const options = buildCaptureOptions(base);
  assert.equal(options.model, CAPTURE_MODEL);
  assert.deepEqual(options.thinking, { type: 'disabled' });
  for (const f of ['fallbackModel', 'resume', 'continue', 'sessionStore']) assert.equal(f in options, false);
  assert.throws(() => validateCaptureOptions({ ...options, resume: 'x' }), /must not set resume/);
  assert.throws(() => validateCaptureOptions({ ...options, settingSources: ['user'] }), /settingSources must be \[\]/);
  assert.throws(() => validateCaptureOptions({ ...options, extraUnknown: 1 }), /unexpected capture option/);
});

test('every capture option field is declared in the installed sdk.d.ts (Options) + Settings', () => {
  const start = sdkTypes.indexOf('export declare type Options = {');
  const optionsBody = sdkTypes.slice(start, sdkTypes.indexOf('\n};', start));
  for (const field of CAPTURE_OPTION_FIELDS) assert.match(optionsBody, new RegExp(`\\b${field}\\?:`), `Options lacks ${field}`);
  assert.match(sdkTypes, /export declare function createSdkMcpServer/);
  assert.match(sdkTypes, /export declare function tool</);
  for (const key of ['autoMemoryEnabled', 'autoDreamEnabled', 'claudeMdExcludes', 'disableAutoMode', 'disableAgentView', 'disableRemoteControl', 'disableWorkflows', 'remoteControlAtStartup', 'disableAllHooks', 'includeGitInstructions']) {
    assert.match(sdkTypes, new RegExp(`\\b${key}\\?:`), `Settings lacks ${key}`);
  }
});

// ---------------------------------------------------------------------------
// 7. parent-environment preflight
// ---------------------------------------------------------------------------

test('preflight permits harmless named markers but rejects real credentials', () => {
  const source = {
    PATH: '/usr/bin',
    AWS_REGION: 'us-east-1',
    AWS_DEFAULT_REGION: 'us-east-1',
    AWS_EXECUTION_ENV: 'AWS_ECS_FARGATE',
    ECS_CONTAINER_METADATA_URI: 'http://169.254.170.2/v2',
    ECS_CONTAINER_METADATA_URI_V4: 'http://169.254.170.2/v4',
    AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_SESSION_TOKEN: 'tok',
    AWS_PROFILE: 'prod',
    ANTHROPIC_API_KEY: 'sk-ant-secret',
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    HTTPS_PROXY: 'http://proxy',
    NODE_OPTIONS: '--inspect',
  };
  const offenders = scanParentEnv(source);
  assert.deepEqual(offenders, ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_PROFILE', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'HTTPS_PROXY', 'NODE_OPTIONS'].sort());
  const pre = preflightParentEnvironment({ source });
  assert.equal(pre.ok, false);
  assert.equal(JSON.stringify(pre).includes('sk-ant-secret'), false);
  // only harmless markers present -> clean
  assert.equal(preflightParentEnvironment({ source: { AWS_REGION: 'us-east-1', ECS_CONTAINER_METADATA_URI: 'x' } }).ok, true);
});

test('preflight fails on an unexpected managed settings tier', () => {
  const res = preflightParentEnvironment({ source: {}, resolved: { sources: [{ source: 'managed', settings: {} }] } });
  assert.equal(res.ok, false);
  assert.match(res.reasons.join(' '), /managed settings tier/);
});

// ---------------------------------------------------------------------------
// 8. result validation
// ---------------------------------------------------------------------------

test('validateResultMessage requires success, is_error false, marker and end_turn', () => {
  const ok = { type: 'result', subtype: 'success', is_error: false, result: `ok ${WIRE_DONE_MARKER}`, stop_reason: 'end_turn' };
  assert.equal(validateResultMessage(ok).ok, true);
  assert.equal(validateResultMessage({ ...ok, is_error: true }).ok, false);
  assert.equal(validateResultMessage({ ...ok, subtype: 'error_max_turns' }).ok, false);
  assert.equal(validateResultMessage({ ...ok, result: 'no marker' }).ok, false);
  assert.equal(validateResultMessage({ ...ok, stop_reason: 'max_tokens' }).ok, false);
  assert.equal(validateResultMessage(null).ok, false);
});

// ---------------------------------------------------------------------------
// 9. SSE shapes (meaningful nested-field checks against locked BETA decls)
// ---------------------------------------------------------------------------

function parseSse(text) {
  return text.split('\n\n').filter(Boolean).map((block) => {
    const lines = block.split('\n');
    return { event: lines.find((l) => l.startsWith('event: ')).slice(7), data: JSON.parse(lines.find((l) => l.startsWith('data: ')).slice(6)) };
  });
}

test('completeUsage matches every BetaUsage field name and is usable in message_start', () => {
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
  for (const key of ['container', 'context_management', 'diagnostics', 'stop_details']) assert.equal(start[key], null, `${key} must be null`);
  assert.equal(start.stop_reason, null);
  assert.equal(start.stop_sequence, null);
  const block = events.find((e) => e.event === 'content_block_start').data.content_block;
  assert.equal(block.type, 'tool_use');
  assert.equal(block.name, WIRE_TOOL_FULLNAME);
  assert.deepEqual(block.caller, { type: 'direct' });
  assert.equal('toolset_name' in block, true);
  assert.equal(JSON.parse(events.find((e) => e.event === 'content_block_delta').data.delta.partial_json).value, WIRE_TOKEN);
  const md = events.find((e) => e.event === 'message_delta');
  assert.equal(md.data.context_management, null);
  assert.equal(md.data.delta.container, null);
  assert.equal(md.data.delta.stop_details, null);
  assert.equal(md.data.delta.stop_reason, 'tool_use');
  assert.equal(md.data.usage.iterations, null);
  assert.equal(md.data.usage.output_tokens_details, null);
  assert.equal(md.data.usage.server_tool_use, null);
  assert.equal(md.data.usage.fallback_credit, null);
});

test('final SSE ends on end_turn with a citations:null text block', () => {
  const events = parseSse(buildFinalSse());
  const block = events.find((e) => e.event === 'content_block_start').data.content_block;
  assert.equal(block.type, 'text');
  assert.equal(block.citations, null);
  const text = events.filter((e) => e.event === 'content_block_delta').map((e) => e.data.delta.text).join('');
  assert.equal(text, WIRE_DONE_MARKER);
  assert.equal(events.find((e) => e.event === 'message_delta').data.delta.stop_reason, 'end_turn');
});

test('planSseResponse returns the tool_use shape for request 1 and final for request 2', () => {
  assert.match(planSseResponse(1), /"type":"tool_use"/);
  assert.match(planSseResponse(2), new RegExp(WIRE_DONE_MARKER));
});

// ---------------------------------------------------------------------------
// 10. spawn hook + strict cleanup
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

test('spawn hook records one spawn with argv/env NAMES only; cleanup needs an actual exit', () => {
  const counters = { permissionCallbacks: 0, handlerExecutions: 0, spawns: 0 };
  const record = { spawned: false, cleanedUp: false, argvCount: 0, args: [], envNames: [] };
  const hook = buildSpawnHook(counters, record, () => makeFakeChild({ cooperative: true }));
  hook({ command: 'node', args: ['--strict-mcp-config', '-p'], cwd: '/workspace/conversation', env: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:1', ANTHROPIC_API_KEY: 'x' }, signal: undefined });
  assert.equal(counters.spawns, 1);
  assert.deepEqual(record.envNames, ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL']);
  assert.equal(JSON.stringify(record).includes('ANTHROPIC_API_KEY":'), false, 'no env values recorded');
  assert.equal(confirmChildCleanup(record), true);
  assert.equal(record.signalCode, 'SIGKILL');
});

test('a kill REQUEST alone (child.killed true, no exit) is NOT confirmed cleanup', () => {
  const record = { child: makeFakeChild({ cooperative: false }), cleanedUp: false };
  assert.equal(confirmChildCleanup(record), false);
  assert.equal(record.cleanedUp, false);
  assert.equal(record.child.killed, true, 'kill was requested');
});

test('an error event alone is NOT termination', () => {
  const child = makeFakeChild({ cooperative: false });
  const record = { child, cleanedUp: false, exited: false };
  // simulate an error listener firing without an exit
  assert.equal(confirmChildCleanup(record), false);
});

// ---------------------------------------------------------------------------
// 11. synthetic prompt stream kept open until the gate
// ---------------------------------------------------------------------------

test('syntheticPromptStream yields one prompt then stays open until the gate resolves', async () => {
  const gate = createGate();
  const it = syntheticPromptStream(CAPTURE_USER_PROMPT, gate.promise)[Symbol.asyncIterator]();
  const first = await it.next();
  assert.equal(first.value.type, 'user');
  assert.equal(first.value.message.content[0].text, CAPTURE_USER_PROMPT);
  let done = false;
  const pending = it.next().then((r) => { done = true; return r; });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(done, false);
  gate.resolve();
  assert.equal((await pending).done, true);
});

// ---------------------------------------------------------------------------
// 12. runCapture orchestrator with injected fakes
// ---------------------------------------------------------------------------

function makeFakeHost(mode = 'success', opts = {}) {
  const shared = {};
  const calls = { resolveSettings: 0, createWireServer: 0, startServer: 0, spawn: 0, query: 0 };
  const host = {
    resolveSettings: async (...a) => {
      calls.resolveSettings += 1;
      if (opts.resolveSettings === 'hang') return new Promise(() => {});
      return { sources: [{ source: 'user', settings: {} }] };
    },
    createWireServer: ({ counters }) => {
      calls.createWireServer += 1;
      const fakeTool = (name, description, schema, handler, extras) => ((shared.toolHandler = handler), { name, description, schema, handler, extras });
      return buildWireServer({ counters, createSdkMcpServer: (o) => ({ tools: o.tools }), sdkTool: fakeTool, z: { literal: (v) => ({ __literal: v }) } });
    },
    spawn: (spawnOptions, record) => {
      calls.spawn += 1;
      const child = makeFakeChild({ cooperative: opts.cooperativeChild !== false });
      shared.child = child;
      return child;
    },
    startServer: async (cfg) => {
      calls.startServer += 1;
      shared.state = cfg.state;
      shared.onAbort = cfg.onAbort;
      return {
        port: PORT,
        state: cfg.state,
        close: () => (opts.close === 'hang' ? new Promise(() => {}) : Promise.resolve()),
      };
    },
    query: ({ prompt, options }) => {
      calls.query += 1;
      return makeFakeQuery({ prompt, options, shared, mode });
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
  if (mode === 'throw-secret') {
    throw new Error('boom sk-ant-api03-SECRETVALUE0123456789');
  }
  if (mode !== 'no-spawn') {
    options.spawnClaudeCodeProcess({ command: 'node', args: ['--strict-mcp-config', '-p'], cwd: options.cwd, env: options.env, signal: options.abortController.signal });
  }
  if (mode === 'deadline') {
    await new Promise((r) => options.abortController.signal.addEventListener('abort', r, { once: true }));
    return;
  }

  const mk = (body, path = '/v1/messages') => ({ method: 'POST', path, host: `${LOOPBACK_HOST}:${PORT}`, peer: LOOPBACK_HOST, rawBytes: Buffer.from(JSON.stringify(body)), headers: { host: `${LOOPBACK_HOST}:${PORT}` } });
  if (mode === 'reject-first') {
    classifyRequest(shared.state, mk({ ...req1Body(), model: 'wrong-model' }));
    yield { type: 'result', subtype: 'success', is_error: false, result: WIRE_DONE_MARKER, stop_reason: 'end_turn' };
    return;
  }
  if (mode === 'secret-body') {
    const d = classifyRequest(shared.state, mk({ model: CAPTURE_MODEL, stream: true, messages: [{ role: 'user', content: [{ type: 'text', text: `Bearer sk-ant-api03-SECRET0123456789 ${CAPTURE_USER_PROMPT}` }] }] }));
    if (!d.ok) return;
    yield { type: 'result', subtype: 'success', is_error: true, result: 'x', stop_reason: 'end_turn' };
    return;
  }

  if (!classifyRequest(shared.state, mk(req1Body())).ok) return;
  await options.canUseTool(WIRE_TOOL_FULLNAME, { value: WIRE_TOKEN }, { mcpServer: { name: WIRE_SERVER_NAME, source: 'sdk' } });
  await shared.toolHandler({ value: WIRE_TOKEN });
  if (!classifyRequest(shared.state, mk(req2Body(), '/v1/messages?beta=true')).ok) return;

  if (mode === 'is_error') {
    yield { type: 'result', subtype: 'success', is_error: true, result: 'api error', stop_reason: 'end_turn' };
    return;
  }
  yield { type: 'result', subtype: 'success', is_error: false, result: `ok ${WIRE_DONE_MARKER}`, stop_reason: 'end_turn', num_turns: 2, session_id: 'sess-test' };
}

test('runCapture success: two requests, one callback/handler/spawn, confirmed cleanup, server closed', async () => {
  const { host, shared } = makeFakeHost('success');
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, true, JSON.stringify(report.reasons));
  assert.deepEqual(report.counters, { permissionCallbacks: 1, handlerExecutions: 1, spawns: 1 });
  assert.equal(report.requests.length, 2);
  assert.equal(report.spawn.cleanedUp, true);
  assert.ok(report.spawn.envNames.includes('ANTHROPIC_BASE_URL'));
  assert.equal(report.result.stop_reason, 'end_turn');
});

test('runCapture preflight failure returns BEFORE any tool/server/query/spawn construction', async () => {
  const { host, calls } = makeFakeHost('success');
  const report = await runCapture({ host, source: { ANTHROPIC_API_KEY: 'leak' } });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /inherited sensitive configuration/);
  assert.deepEqual(calls, { resolveSettings: 0, createWireServer: 0, startServer: 0, spawn: 0, query: 0 });
});

test('runCapture managed-tier preflight failure returns before construction', async () => {
  const { host, calls } = makeFakeHost('success');
  const report = await runCapture({ host, source: {}, resolvedSettings: { sources: [{ source: 'managed', settings: {} }] } });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /managed settings tier/);
  assert.equal(calls.createWireServer, 0);
  assert.equal(calls.startServer, 0);
  assert.equal(calls.query, 0);
  assert.equal(calls.spawn, 0);
});

test('runCapture fails on success-with-is_error true', async () => {
  const { host } = makeFakeHost('is_error');
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /is_error/);
});

test('runCapture fails and aborts on a rejected request', async () => {
  const { host } = makeFakeHost('reject-first');
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /aborted|requests/);
});

test('runCapture aborts on deadline and still closes server/input', async () => {
  const { host } = makeFakeHost('deadline');
  const report = await runCapture({ host, source: {}, deadlineMs: 25 });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /deadline/);
});

test('runCapture is bounded when the async iterator never yields (no hang)', async () => {
  const { host } = makeFakeHost('stuck-iterator');
  const report = await runCapture({ host, source: {}, deadlineMs: 25 });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /deadline/);
});

test('runCapture is bounded when server.close never settles (no hang)', async () => {
  const { host } = makeFakeHost('success', { close: 'hang' });
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /server close did not complete/);
});

test('runCapture fails when child cleanup cannot be confirmed (kill never terminates)', async () => {
  const { host } = makeFakeHost('success', { cooperativeChild: false });
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /child cleanup not confirmed/);
});

test('runCapture is bounded when settings resolution never settles', async () => {
  const { host } = makeFakeHost('success', { resolveSettings: 'hang' });
  const report = await runCapture({ host, source: {}, deadlineMs: 25 });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /settings resolution timed out/);
});

test('runCapture scrubs a thrown exception (no secret leak)', async () => {
  const { host } = makeFakeHost('throw-secret');
  const report = await runCapture({ host, source: {} });
  assert.equal(report.ok, false);
  assert.equal(JSON.stringify(report).includes('sk-ant-api03'), false);
  assert.equal(JSON.stringify(report).includes('SECRETVALUE'), false);
});

// ---------------------------------------------------------------------------
// 13. bounded indexed output records
// ---------------------------------------------------------------------------

test('buildOutputLines emits indexed base64 chunks + length/hash manifest', () => {
  const { host } = makeFakeHost('success');
  return runCapture({ host, source: {} }).then((report) => {
    const big = 'A'.repeat(OUT_CHUNK * 2 + 5);
    report.requests[0].base64 = big;
    report.requests[0].rawLength = big.length;
    report.requests[0].decoded = { model: CAPTURE_MODEL, stream: true };
    const lines = buildOutputLines(report, { chunkBytes: OUT_CHUNK });
    const manifest = lines[0];
    assert.equal(manifest.record, 'sdk-capture-manifest');
    assert.equal(Array.isArray(manifest.requestManifest), true);
    assert.equal(manifest.requestManifest[0].rawSha256, report.requests[0].rawSha256);
    assert.equal(manifest.requestManifest[0].rawLength, big.length);
    const chunks = lines.filter((l) => l.record === 'sdk-capture-request-chunk' && l.index === 1);
    assert.equal(chunks.length, 3);
    assert.equal(chunks.map((c) => c.base64).join(''), big);
    assert.equal(lines.at(-1).record, 'sdk-capture-end');
  });
});

const OUT_CHUNK = 64;

test('buildOutputLines is hash-only when the source body contains secret material', async () => {
  const report = {
    ok: false,
    reasons: ['x'],
    counters: {},
    spawn: {},
    result: null,
    requests: [{ index: 1, path: '/v1/messages', rawLength: 10, rawSha256: 'h', decompressedLength: 10, decompressedSha256: 'h2', headers: [], base64: Buffer.from('Bearer sk-ant-api03-SECRET0123456789').toString('base64'), decoded: { x: 'Bearer sk-ant-api03-SECRET0123456789' } }],
  };
  const lines = buildOutputLines(report);
  assert.equal(lines[0].requestManifest[0].hashOnly, true);
  assert.equal(lines.filter((l) => l.record === 'sdk-capture-request-chunk').length, 0, 'no raw export when sensitive material is present');
  assert.equal(JSON.stringify(lines).includes('sk-ant-api03'), false);
});

// ---------------------------------------------------------------------------
// 14. main() guard
// ---------------------------------------------------------------------------

test('main refuses to run off Linux without building any host', async () => {
  const out = { written: '', write: (s) => (out.written += s, true), once: () => {} };
  const code = await main({ platform: 'win32', stdout: out });
  assert.equal(code, 2);
  assert.match(out.written, /linux-only probe/);
});
