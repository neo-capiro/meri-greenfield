import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveryOptions, DISCOVERY_FIXTURE } from './sdk-discovery-options.mjs';
import {
  buildCaptureEnv, buildCaptureOptions, validateCaptureOptions,
  CAPTURE_CWD, CAPTURE_MODEL, SYNTHETIC_API_KEY,
} from './sdk-capture-options.mjs';

const binding = () => ({
  tenantId: 'synthetic-tenant', actorId: 'synthetic-actor',
  conversationId: '11111111-1111-4111-8111-111111111111',
  runId: '22222222-2222-4222-8222-222222222222',
  attemptId: '33333333-3333-4333-8333-333333333333',
  workerId: '44444444-4444-4444-8444-444444444444', writerFence: 7,
});
const input = () => ({
  runBinding: binding(), contractVersion: '0.1.0',
  sessionId: '55555555-5555-4555-8555-555555555555',
  cwd: CAPTURE_CWD, model: CAPTURE_MODEL,
  loopbackIngress: { host: '127.0.0.1', port: 23456, baseUrl: 'http://127.0.0.1:23456' },
  abortController: new AbortController(),
  mcpServer: { type: 'sdk', name: 'wire', instance: {} },
  canUseTool: async () => ({ behavior: 'deny', message: 'synthetic current grant absent' }),
  spawnClaudeCodeProcess: () => { throw new Error('source-only fixture must never spawn'); },
});

test('discovery composes exact canonical environment with only two flag changes', () => {
  const original = buildCaptureEnv(23456);
  const expected = { ...original, ENABLE_TOOL_SEARCH: 'true' };
  delete expected.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS;
  const { options } = buildDiscoveryOptions(input());
  assert.deepEqual(options.env, expected);
  assert.equal(Object.hasOwn(options.env, 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS'), false);
  assert.equal(options.env.ANTHROPIC_API_KEY, SYNTHETIC_API_KEY);
  assert.equal(Object.hasOwn(options, 'enableToolSearch'), false);
  assert.equal(validateCaptureOptions(options), true);
});

test('accepted beta-disabled capture profile remains unchanged', () => {
  buildDiscoveryOptions(input());
  const old = buildCaptureOptions({ ...input(), env: buildCaptureEnv(23456), mcpServers: {} });
  assert.equal(old.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS, '1');
  assert.equal(Object.hasOwn(old.env, 'ENABLE_TOOL_SEARCH'), false);
  assert.equal(old.settings.permissions.ask[0], 'mcp__wire__echo');
});

test('full binding/version/session retained separately; caller mutations cannot alter them', () => {
  const source = input();
  const result = buildDiscoveryOptions(source);
  assert.deepEqual(result.context.runBinding, binding());
  assert.equal(result.context.contractVersion, '0.1.0');
  assert.equal(result.context.sessionId, source.sessionId);
  assert.equal(result.options.sessionId, source.sessionId);
  source.runBinding.writerFence = 900;
  assert.equal(result.context.runBinding.writerFence, 7);
  assert.throws(() => { result.context.runBinding.tenantId = 'other'; }, TypeError);
  assert.equal(JSON.stringify(result.options).includes('synthetic-tenant'), false);
});

test('borrowed lifecycle/permission/spawn/server identities preserved without execution', () => {
  const source = input();
  const { options } = buildDiscoveryOptions(source);
  assert.equal(options.abortController, source.abortController);
  assert.equal(options.canUseTool, source.canUseTool);
  assert.equal(options.spawnClaudeCodeProcess, source.spawnClaudeCodeProcess);
  assert.equal(options.mcpServers.wire.instance, source.mcpServer.instance);
  assert.equal(Object.isFrozen(source.mcpServer.instance), false);
  assert.equal(Object.isFrozen(source.abortController), false);
  assert.deepEqual(options.settings.permissions.ask, ['mcp__wire__lookup_message', 'mcp__wire__lookup_messages']);
  assert.deepEqual(options.settings.permissions.allow, []);
});

test('canonical capture session/default restrictions remain explicit partial qualification', () => {
  const { options } = buildDiscoveryOptions(input());
  assert.equal(options.persistSession, false);
  assert.equal(options.enableFileCheckpointing, false);
  assert.equal(options.settings.autoCompactEnabled, false);
  for (const field of ['resume', 'continue', 'sessionStore', 'fallbackModel']) assert.equal(Object.hasOwn(options, field), false);
  for (const field of ['tools', 'plugins', 'skills', 'settingSources', 'additionalDirectories']) assert.deepEqual(options[field], []);
  assert.equal(options.strictMcpConfig, true);
});

test('canonical RunBinding rejects missing/extra/invalid identity, fence and version/session drift', () => {
  const mutations = [
    (x) => { delete x.runBinding.workerId; },
    (x) => { x.runBinding.extra = 'not-a-contract-field'; },
    (x) => { x.runBinding.runId = 'not-a-uuid'; },
    (x) => { x.runBinding.writerFence = 0; },
    (x) => { x.runBinding.tenantId = ''; },
    (x) => { x.contractVersion = '0.2.0'; },
    (x) => { x.sessionId = 'not-a-uuid'; },
  ];
  for (const mutate of mutations) { const x = input(); mutate(x); assert.throws(() => buildDiscoveryOptions(x)); }
});

test('model/cwd and exact loopback reject route substitution and malformed ports', () => {
  const mutations = [
    (x) => { x.cwd = '/tmp'; }, (x) => { x.model = 'provider-model'; },
    (x) => { x.loopbackIngress.host = 'localhost'; },
    (x) => { x.loopbackIngress.baseUrl = 'https://127.0.0.1:23456'; },
    (x) => { x.loopbackIngress.baseUrl += '/v1'; },
    (x) => { x.loopbackIngress.port = 0; }, (x) => { x.loopbackIngress.port = '23456'; },
    (x) => { x.loopbackIngress.port = 65536; },
  ];
  for (const mutate of mutations) { const x = input(); mutate(x); assert.throws(() => buildDiscoveryOptions(x)); }
});

test('no caller environment, credentials, beta-disable, SDK options or persistence overrides', () => {
  for (const [name, value] of Object.entries({
    env: { ENABLE_TOOL_SEARCH: 'false' }, apiKey: 'foreign-key',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1', enableToolSearch: false,
    resume: 'old-session', sessionStore: {}, settings: {},
  })) assert.throws(() => buildDiscoveryOptions({ ...input(), [name]: value }), /fields must be exact/);
});

test('records refuse accessors and prototype-based configuration before reading accessors', () => {
  const x = input(); let calls = 0;
  Object.defineProperty(x, 'model', { enumerable: true, get() { calls += 1; return CAPTURE_MODEL; } });
  assert.throws(() => buildDiscoveryOptions(x), /accessors/);
  assert.equal(calls, 0);
  assert.throws(() => buildDiscoveryOptions(Object.assign(Object.create({}), input())), /ordinary record/);
  const hidden = input();
  Object.defineProperty(hidden.runBinding, 'tenantId', { value: 'synthetic-tenant', enumerable: false });
  assert.throws(() => buildDiscoveryOptions(hidden), /nonenumerable/);
  const symbol = input();
  symbol.runBinding[Symbol('hidden')] = 'not-contract-data';
  assert.throws(() => buildDiscoveryOptions(symbol), /symbol/);
});

test('aborted/missing controller, foreign MCP transports/names and missing callbacks refuse', () => {
  const mutations = [
    (x) => { x.abortController.abort(); }, (x) => { x.abortController = {}; },
    (x) => { x.mcpServer.type = 'http'; }, (x) => { x.mcpServer.name = 'foreign'; },
    (x) => { x.mcpServer.url = 'http://remote'; }, (x) => { x.mcpServer.instance = null; },
    (x) => { x.canUseTool = null; }, (x) => { x.spawnClaudeCodeProcess = null; },
  ];
  for (const mutate of mutations) { const x = input(); mutate(x); assert.throws(() => buildDiscoveryOptions(x)); }
});

test('fixture declares deferred similar/paraphrased tools and unavailable/revoked follow-ups', () => {
  assert.equal(DISCOVERY_FIXTURE.server.alwaysLoad, false);
  assert.deepEqual(DISCOVERY_FIXTURE.tools.map((x) => x.name), ['lookup_message', 'lookup_messages']);
  assert.equal(DISCOVERY_FIXTURE.tools.every((x) => x.alwaysLoad === false && x.searchHint.length > 0), true);
  assert.equal(DISCOVERY_FIXTURE.cases.find((x) => x.id === 'unavailable').absentTool, 'lookup_message_attachment');
  assert.equal(DISCOVERY_FIXTURE.tools.some((x) => x.name === 'lookup_message_attachment'), false);
  assert.equal(DISCOVERY_FIXTURE.cases.find((x) => x.id === 'revoked-after-discovery').disposition, 'gateway-must-refuse-after-revocation');
  assert.throws(() => { DISCOVERY_FIXTURE.tools[0].alwaysLoad = true; }, TypeError);
});
