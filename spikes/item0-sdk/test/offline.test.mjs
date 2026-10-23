import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {InMemorySessionStore, query, forkSession, getSessionMessages, importSessionToStore} from '@anthropic-ai/claude-agent-sdk';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {parseArgs, sdkOptions} from '../run.mjs';
import {projectKey, prepareFixture, startFixtureMcp, questions} from '../fixture.mjs';
import {snapshotStore, restoreStore} from '../session-fixture.mjs';

const env = {CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'us-east-1'};
const args = ['--run', '--question', 'seed', '--model', 'synthetic-model-id', '--work', resolve('scratch'), '--out', resolve('evidence')];

test('CLI help and invalid configuration do not invoke a model or require credentials', () => {
  for (const [argv, code] of [[['--help'], 0], [[], 2], [['--run'], 2]]) {
    const result = spawnSync(process.execPath, ['run.mjs', ...argv], {cwd: new URL('..', import.meta.url), encoding: 'utf8', env: {PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT}});
    assert.equal(result.status, code, result.stderr);
  }
});

test('only explicit direct Bedrock configuration and bounded known questions are accepted', () => {
  assert.equal(parseArgs(args, env).question.id, 'seed');
  assert.throws(() => parseArgs(args, {}), /DIRECT_BEDROCK/);
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_BEDROCK_BASE_URL', 'AWS_BEARER_TOKEN_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'MAX_THINKING_TOKENS', 'CLAUDE_CODE_SKIP_BEDROCK_AUTH']) {
    assert.throws(() => parseArgs(args, {...env, [key]: 'synthetic-override'}), /OVERRIDE_REFUSED/);
  }
  assert.throws(() => parseArgs([...args, '--stop-after-ms', '0'], env), /INVALID_STOP/);
  assert.throws(() => parseArgs([...args, '--unknown', 'value'], env), /INVALID_ARGUMENTS/);
  assert.throws(() => parseArgs(args.map(x => x === 'seed' ? 'resume' : x), env), /SEED_OUTPUT/);
});

test('pinned native surface and full preset configuration preserve supported mechanisms', async () => {
  const pkg = JSON.parse(await readFile(new URL('../node_modules/@anthropic-ai/claude-agent-sdk/package.json', import.meta.url)));
  assert.equal(pkg.version, '0.3.295'); assert.equal(pkg.claudeCodeVersion, '2.1.295');
  for (const fn of [query, forkSession, getSessionMessages, importSessionToStore]) assert.equal(typeof fn, 'function');
  const config = parseArgs(args, env);
  const options = sdkOptions(config, {plugin: '/fixture/plugin', store: new InMemorySessionStore(), mcp: {type: 'http', url: 'http://127.0.0.1/mcp'}, controller: new AbortController(), configDirectory: '/scratch/config'});
  assert.deepEqual(options.tools, {type: 'preset', preset: 'claude_code'});
  assert.equal(options.systemPrompt.preset, 'claude_code');
  assert.equal(options.thinking, undefined); assert.equal(options.maxThinkingTokens, undefined);
  assert.equal(options.sessionStoreFlush, 'batched'); assert.equal(options.maxTurns, 12); assert.equal(options.maxBudgetUsd, 1);
  assert(options.disallowedTools.includes('Bash')); assert(!options.allowedTools.includes('Bash'));
  assert.equal(options.mcpServers.fixture.type, 'http');
  assert.equal(options.canUseTool && (await options.canUseTool('Bash', {}, {})).behavior, 'deny');
});

test('native SDK store snapshot round-trip includes subagent data without editing opaque entries', async () => {
  const store = new InMemorySessionStore(), key = {projectKey, sessionId: randomUUID()};
  const entries = [{type: 'user', uuid: randomUUID(), message: {role: 'user', content: 'synthetic'}}];
  await store.append(key, entries); await store.append({...key, subpath: 'subagents/agent-synthetic'}, entries);
  const snapshot = await snapshotStore(store);
  const restored = await restoreStore(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(await restored.load(key), entries);
  assert.deepEqual(await restored.listSubkeys(key), ['subagents/agent-synthetic']);
  assert.deepEqual(await snapshotStore(restored), snapshot);
  await assert.rejects(restoreStore({...snapshot, sdk: 'other'}), /INVALID_SYNTHETIC/);
  await assert.rejects(restoreStore({...snapshot, rows: [{key: {...key, projectKey: 'foreign'}, entries}]}), /INVALID_SYNTHETIC/);
});

test('native HTTP MCP fixture requires its synthetic header and exposes only synthetic read data', async () => {
  const fixture = await startFixtureMcp();
  const client = new Client({name: 'offline-spike-test', version: '1.0.0'});
  try {
    assert.equal((await fetch(fixture.config.url, {method: 'POST'})).status, 401);
    await client.connect(new StreamableHTTPClientTransport(new URL(fixture.config.url), {requestInit: {headers: fixture.config.headers}}));
    const listed = await client.listTools(); assert.deepEqual(listed.tools.map(x => x.name), ['fixture_records']);
    const result = await client.callTool({name: 'fixture_records', arguments: {client: 'Atlas'}});
    assert.match(result.content[0].text, /SYNTHETIC DATA ONLY/);
    assert.equal(result.isError, undefined);
    const refused = await client.callTool({name: 'fixture_records', arguments: {client: 'unknown'}});
    assert.equal(refused.isError, true); assert.equal(fixture.toolCalls.length, 1);
  } finally { await client.close(); await fixture.close(); }
});

test('existing skill bytes are retained and disabled automatic invocation remains visible', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'meri-item0-fixture-'));
  try {
    const prepared = await prepareFixture(directory);
    assert.equal(prepared.skills.length, 14);
    assert(prepared.skills.every(skill => skill.modelInvocationDisabled));
    assert(questions[0].prompt.startsWith('/meri-original-skills:meri-meeting-prep'));
    const installed = await readFile(join(prepared.plugin, 'skills', 'meri-meeting-prep', 'SKILL.md'));
    const original = await readFile(new URL('../../../packages/skills/originals/meeting_prep/1.0.1/SKILL.md', import.meta.url));
    assert.deepEqual(installed, original);
  } finally {
    const target = resolve(directory), root = resolve(tmpdir());
    assert(target.startsWith(root + (process.platform === 'win32' ? '\\' : '/')));
    await rm(target, {recursive: true, force: true});
  }
});
