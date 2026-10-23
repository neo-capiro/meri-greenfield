import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join, isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {questions, prepareFixture, startFixtureMcp, projectKey, sha256} from './fixture.mjs';
import {snapshotStore, restoreStore} from './session-fixture.mjs';

export const usage = `Usage: node run.mjs --run --question seed|resume|fork|compare|web --model MODEL --work ABS_DIR --out ABS_NEW_DIR [--resume-from ABS_SEED_OUTPUT] [--stop-after-ms N]
Runs one synthetic SDK question. Only root executes model calls. Use a fresh container for each question.
Bounds: 12 turns, estimated USD 1 per query, 4096 output tokens per model request, 120 seconds wall time.
Exit 0: completed report; 1: query/fixture failed or interrupted; 2: invalid configuration. --help is offline.
No Core, database, product auth, or external write tools. Raw sessions/answers are synthetic evidence only.`;

export function parseArgs(args, env = process.env) {
  if (args.length === 1 && args[0] === '--help') return {help: true};
  if (args[0] !== '--run') throw Error('EXPLICIT_RUN_REQUIRED');
  const flags = new Map();
  for (let i = 1; i < args.length; i += 2) {
    if (!['--question', '--model', '--work', '--out', '--resume-from', '--stop-after-ms'].includes(args[i]) ||
        !args[i + 1] || args[i + 1].startsWith('--') || flags.has(args[i])) throw Error('INVALID_ARGUMENTS');
    flags.set(args[i], args[i + 1]);
  }
  const question = questions.find(q => q.id === flags.get('--question'));
  const model = flags.get('--model');
  if (!question || !model || !/^[A-Za-z0-9:./_-]+$/.test(model)) throw Error('QUESTION_AND_MODEL_REQUIRED');
  const work = flags.get('--work'), out = flags.get('--out'), resumeFrom = flags.get('--resume-from');
  if (!work || !out || !isAbsolute(work) || !isAbsolute(out) || resolve(work) === resolve(out)) throw Error('ABSOLUTE_SEPARATE_PATHS_REQUIRED');
  if (['resume', 'fork'].includes(question.id) !== Boolean(resumeFrom) || resumeFrom && !isAbsolute(resumeFrom)) throw Error('SEED_OUTPUT_REQUIRED_ONLY_FOR_CONTINUITY');
  if (env.CLAUDE_CODE_USE_BEDROCK !== '1' || env.AWS_REGION !== 'us-east-1') throw Error('DIRECT_BEDROCK_REGION_REQUIRED');
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_BEDROCK_BASE_URL',
    'AWS_BEARER_TOKEN_BEDROCK', 'AWS_ENDPOINT_URL', 'AWS_ENDPOINT_URL_BEDROCK_RUNTIME', 'CLAUDE_CODE_SKIP_BEDROCK_AUTH',
    'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_ANTHROPIC_AWS', 'CLAUDE_CODE_USE_BEDROCK_MANTLE',
    'CLAUDE_CODE_USE_ANTHROPIC_GOOGLE', 'ANTHROPIC_BEDROCK_MANTLE_BASE_URL', 'MAX_THINKING_TOKENS',
    'CLAUDE_CODE_EFFORT_LEVEL', 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING']) {
    if (env[key]) throw Error('ALTERNATE_PROVIDER_OR_CREDENTIAL_OVERRIDE_REFUSED');
  }
  const stopAfterMs = flags.has('--stop-after-ms') ? Number(flags.get('--stop-after-ms')) : undefined;
  if (stopAfterMs !== undefined && (!Number.isInteger(stopAfterMs) || stopAfterMs < 1000 || stopAfterMs > 60000)) throw Error('INVALID_STOP_TIME');
  return {question, model, work: resolve(work), out: resolve(out), resumeFrom, stopAfterMs};
}

/** @returns {import('@anthropic-ai/claude-agent-sdk').Options} */
export function sdkOptions(config, {plugin, store, mcp, controller, configDirectory}) {
  const {model, work, question} = config;
  return {
    cwd: work, model, abortController: controller,
    systemPrompt: {type: 'preset', preset: 'claude_code', append:
      `You are Meri, Capiro's evidence-focused assistant. Rehearsal scope: ${question.scope}. All client records here are synthetic. State evidence gaps and label inference. Never perform external mutations.`},
    tools: {type: 'preset', preset: 'claude_code'},
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList', 'Agent', 'Skill',
      'mcp__fixture__fixture_records', ...(question.id === 'web' ? ['WebSearch', 'WebFetch'] : [])],
    disallowedTools: ['Bash', 'NotebookEdit', ...(question.id === 'web' ? [] : ['WebSearch', 'WebFetch'])],
    canUseTool: async () => ({behavior: 'deny', message: 'Interactive permission is unavailable in this bounded synthetic experiment.'}),
    permissionMode: 'default', settingSources: [], strictMcpConfig: true,
    plugins: [{type: 'local', path: plugin}], skills: 'all',
    agents: {verification: {description: 'Check a synthetic brief against supplied fixture records.',
      prompt: 'Read fixture-records.txt, check the delegated claims, and return discrepancies and missing evidence. This is synthetic. Do not write or use external sources.',
      tools: ['Read', 'Glob', 'Grep'], disallowedTools: ['Bash', 'Agent', 'Write', 'Edit'], model: 'inherit', maxTurns: 4}},
    mcpServers: {fixture: mcp},
    maxTurns: 12, maxBudgetUsd: 1, includePartialMessages: true,
    sessionStore: store, sessionStoreFlush: 'batched', loadTimeoutMs: 10000,
    env: {...process.env, CLAUDE_CONFIG_DIR: configDirectory, CLAUDE_CODE_PROJECT_DIR_NAME: projectKey,
      CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'us-east-1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: '4096',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: model, ANTHROPIC_DEFAULT_SONNET_MODEL: model, ANTHROPIC_DEFAULT_OPUS_MODEL: model},
  };
}

export async function run(config) {
  const {query, InMemorySessionStore} = await import('@anthropic-ai/claude-agent-sdk');
  const sdkPackage = JSON.parse(await readFile(new URL('./node_modules/@anthropic-ai/claude-agent-sdk/package.json', import.meta.url), 'utf8'));
  if (sdkPackage.version !== '0.3.295') throw Error('SDK_PIN_MISMATCH');
  // A fresh output directory prevents a retry from overwriting earlier evidence.
  await mkdir(config.out);
  const fixture = await prepareFixture(config.work);
  const configDirectory = join(config.work, 'sdk-config');
  await mkdir(configDirectory, {recursive: true});
  let store = new InMemorySessionStore(), seed;
  if (config.resumeFrom) {
    seed = JSON.parse(await readFile(join(config.resumeFrom, 'report.json'), 'utf8'));
    if (seed.question !== 'seed' || seed.outcome !== 'success' || !seed.sessionId || seed.mirrorErrors) throw Error('SUCCESSFUL_SEED_REQUIRED');
    store = await restoreStore(JSON.parse(await readFile(join(config.resumeFrom, 'session-store.json'), 'utf8')));
    if (!(await store.load({projectKey, sessionId: seed.sessionId}))?.length) throw Error('SEED_TRANSCRIPT_REQUIRED');
  }
  const before = await snapshotStore(store);
  const mcp = await startFixtureMcp();
  const controller = new AbortController();
  const options = sdkOptions(config, {plugin: fixture.plugin, store, mcp: mcp.config, controller, configDirectory});
  if (seed) Object.assign(options, {resume: seed.sessionId, ...(config.question.id === 'fork' ? {forkSession: true} : {})});
  const started = performance.now(), events = [], tools = [], toolResults = [], reports = [];
  let firstTextMs = null, firstEventMs = null, lastTextMs = null, sessionId, init, errorName, interrupted = false, interruptRequestedMs, mirrorErrors = 0;
  let operation;
  const abortTimer = setTimeout(() => controller.abort(), 120000);
  const interruptTimer = config.stopAfterMs === undefined ? undefined : setTimeout(() => {
    interrupted = true; interruptRequestedMs = Math.round(performance.now() - started);
    void operation?.interrupt().catch(() => controller.abort());
  }, config.stopAfterMs);
  try {
    operation = query({prompt: config.question.prompt, options});
    for await (const message of operation) {
      const elapsedMs = Math.round(performance.now() - started);
      if (firstEventMs === null) firstEventMs = elapsedMs;
      if (message.session_id) sessionId = message.session_id;
      const subagent = 'parent_tool_use_id' in message && Boolean(message.parent_tool_use_id);
      events.push({type: message.type, subtype: 'subtype' in message ? message.subtype : undefined, elapsedMs, subagent});
      if (message.type === 'system' && message.subtype === 'init') init = {
        model: message.model, tools: message.tools, skills: message.skills, agents: message.agents, mcp_servers: message.mcp_servers};
      if (message.type === 'system' && message.subtype === 'mirror_error') mirrorErrors++;
      if (message.type === 'stream_event' && message.event?.type === 'content_block_delta' && message.event.delta?.type === 'text_delta') {
        if (firstTextMs === null) firstTextMs = elapsedMs; lastTextMs = elapsedMs;
      }
      const blocks = (message.type === 'assistant' || message.type === 'user') && Array.isArray(message.message.content) ? message.message.content : [];
      for (const block of blocks) {
        if (block.type === 'tool_use') tools.push({name: block.name, id: block.id, elapsedMs, subagent});
        if (block.type === 'tool_result') toolResults.push({id: block.tool_use_id, isError: Boolean(block.is_error), elapsedMs});
      }
      if (message.type === 'result') reports.push({subtype: message.subtype, isError: message.is_error,
        answer: message.subtype === 'success' ? message.result : undefined, usage: message.usage, modelUsage: message.modelUsage, totalCostUsdEstimate: message.total_cost_usd,
        durationMs: message.duration_ms, apiDurationMs: message.duration_api_ms, turns: message.num_turns,
        stopReason: message.stop_reason, permissionDenials: message.permission_denials?.map(x => x.tool_name), elapsedMs});
    }
  } catch (error) { errorName = error?.name ?? 'Error'; }
  finally {
    clearTimeout(abortTimer); clearTimeout(interruptTimer);
    operation?.close(); await mcp.close();
  }
  const after = await snapshotStore(store);
  const final = reports.at(-1);
  const originalUnchanged = !seed || config.question.id !== 'fork' ||
    sha256(JSON.stringify(before.rows.filter(row => row.key.sessionId === seed.sessionId))) ===
    sha256(JSON.stringify(after.rows.filter(row => row.key.sessionId === seed.sessionId)));
  const sessionMatches = !seed || (config.question.id === 'fork' ? sessionId !== seed.sessionId : sessionId === seed.sessionId);
  const outcome = !errorName && !interrupted && !mirrorErrors && originalUnchanged && sessionMatches && final?.subtype === 'success' && !final.isError ? 'success' : 'adjust';
  const report = {kind: 'synthetic-item0-sdk-experiment', sdk: sdkPackage.version, bundledClaudeCode: sdkPackage.claudeCodeVersion,
    platform: process.platform, arch: process.arch, question: config.question.id, model: config.model,
    outcome, sessionId, resumedFrom: seed?.sessionId, originalUnchanged, sessionMatches, interrupted, interruptRequestedMs, errorName, mirrorErrors,
    firstEventMs, firstTextMs, lastTextMs, elapsedMs: Math.round(performance.now() - started),
    afterLastTextMs: lastTextMs === null ? null : Math.round(performance.now() - started) - lastTextMs,
    init, tools, toolResults, mcpRequests: mcp.requests, fixtureToolCalls: mcp.toolCalls, skills: fixture.skills, results: reports,
    limits: {maxTurns: 12, maxBudgetUsdEstimate: 1, maxOutputTokens: 4096, deadlineMs: 120000},
    limitations: ['Synthetic fixtures do not qualify Core permissions, production isolation, Temporal, SSE or billing.',
      'InMemorySessionStore snapshots are experiment transport, not a production backend.',
      'Actual claude.ai side-by-side review remains a separate acceptance step.']};
  await writeFile(join(config.out, 'session-store.json'), JSON.stringify(after));
  await writeFile(join(config.out, 'events.json'), JSON.stringify(events, null, 2));
  await writeFile(join(config.out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({question: report.question, outcome, firstTextMs, elapsedMs: report.elapsedMs, mirrorErrors}));
  return outcome === 'success' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let config;
  try { config = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(error.message); console.error(usage); process.exitCode = 2; }
  if (config?.help) console.log(usage);
  else if (config) {
    try { process.exitCode = await run(config); }
    catch (error) { console.error(`SPIKE_FAILED:${error?.code ?? error?.name ?? 'Error'}`); process.exitCode = 1; }
  }
}
