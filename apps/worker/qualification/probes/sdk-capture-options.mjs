// W02-05 native SDK loopback wire-capture OPTIONS module (PREPARATION ONLY).
//
// Offline, dependency-free: importing this module performs NO SDK query, spawn,
// socket, server, browser, Office, cloud, provider or source call. It only
// builds the exact capture-specific SDK options, the REPLACEMENT child
// environment, and pure validation helpers.
//
// Every option field name and every environment-variable name below was read
// from the INSTALLED upstream source in this session:
//   - @anthropic-ai/claude-agent-sdk 0.3.295 (bundled CLI 2.1.295):
//       node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts  (`Options`,
//       `Settings`, `ThinkingConfig`, `SpawnOptions`, `SpawnedProcess`)
//       node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs   (recognized
//       CLAUDE_CODE_* / DISABLE_* environment names; public runtime exports
//       `query`, `createSdkMcpServer`, `tool`, `resolveSettings`)
// Nothing here invents an unsupported option or environment flag; a field the
// published types do not declare is deliberately omitted (see the report's
// limitations, e.g. the nested `remoteControl` object).

import { createHash, randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Fixed synthetic coordinates
// ---------------------------------------------------------------------------

/** Stable loopback host. The capture server binds ONLY this address. */
export const LOOPBACK_HOST = '127.0.0.1';

/** Accepted request paths (exactly, with the optional beta query form). */
export const ACCEPTED_PATHS = Object.freeze(['/v1/messages', '/v1/messages?beta=true']);

/** The synthetic model alias that must match the accepted proxy alias. */
export const CAPTURE_MODEL = 'meri-sonnet-qualification';

/**
 * Clearly synthetic fixture key. This is NEVER a copied credential; it is
 * inert data sent only to the owned loopback server.
 */
export const SYNTHETIC_API_KEY =
  'sk-ant-synthetic-meri-qualification-0000000000000000000000000000';

/** Stable synthetic cwd / config / home / tmp inside the owned workspace. */
export const CAPTURE_CWD = '/workspace/conversation';
export const CAPTURE_CONFIG_DIR = '/workspace/config';
export const CAPTURE_HOME = '/workspace/home';
export const CAPTURE_TMPDIR = '/tmp';
export const CAPTURE_MIN_PATH =
  '/opt/meri-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

/** Bounded loopback capture limits. */
export const CAPTURE_DEADLINE_MS = 60000;
export const MAX_REQUESTS = 2;
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_DECOMPRESSED_BYTES = 8 * 1024 * 1024;
export const MAX_OUTPUT_TOKENS = 256;
export const MAX_TURNS = 3;
// A LOCAL SDK fixture cap only. It is never the authoritative aggregate
// Bedrock spend cap (that lives in the owner's control plane).
export const LOCAL_MAX_BUDGET_USD = 0.01;

/** Public wire MCP server / echo tool coordinates. */
export const WIRE_SERVER_NAME = 'wire';
export const WIRE_TOOL_NAME = 'echo';
export const WIRE_TOOL_FULLNAME = `mcp__${WIRE_SERVER_NAME}__${WIRE_TOOL_NAME}`;
export const WIRE_TOKEN = 'meri-wire-token';
export const WIRE_TOOL_RESULT = 'meri-wire-tool-result';
export const WIRE_TOOL_TIMEOUT_MS = 5000;
export const WIRE_DONE_MARKER = 'MERI_WIRE_DONE';

/** Tiny opaque synthetic system prompt; carries no real instructions. */
export const CAPTURE_SYSTEM_PROMPT =
  'MERI_WIRE_QUALIFICATION_SYSTEM (synthetic; no real instructions)';

/** The single synthetic user prompt kept open until result/deadline. */
export const CAPTURE_USER_PROMPT =
  'MERI_WIRE_QUALIFICATION_PROMPT: call the wire echo tool once.';

// ---------------------------------------------------------------------------
// Replacement child environment (built from constants, NEVER process.env)
// ---------------------------------------------------------------------------

/**
 * Exact recognized disable/limit flags, read from the installed CLI/SDK source.
 * Each value is a string because Options.env values are strings.
 */
export const CHILD_ENV_FLAGS = Object.freeze({
  // Bounded synthetic output and retries.
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(MAX_OUTPUT_TOKENS),
  CLAUDE_CODE_MAX_RETRIES: '0',
  CLAUDE_CODE_NONSTREAMING_TIMEOUT_RETRIES: '0',
  CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK: '1',
  CLAUDE_CODE_NO_MODEL_FALLBACK: '1',
  CLAUDE_CODE_DISABLE_MODEL_ACCESS_FALLBACK: '1',
  // Thinking disabled.
  CLAUDE_CODE_DISABLE_THINKING: '1',
  CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1',
  // Prompt cache / interleaved / experimental betas disabled.
  DISABLE_PROMPT_CACHING: '1',
  DISABLE_INTERLEAVED_THINKING: '1',
  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
  // Nonessential traffic / telemetry / errors / updates / feedback disabled.
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  DISABLE_TELEMETRY: '1',
  CLAUDE_CODE_ENABLE_TELEMETRY: '0',
  DISABLE_ERROR_REPORTING: '1',
  DISABLE_BUG_COMMAND: '1',
  DISABLE_FEEDBACK_COMMAND: '1',
  DISABLE_GROWTHBOOK: '1',
  DISABLE_AUTOUPDATER: '1',
  DISABLE_UPDATES: '1',
  DO_NOT_TRACK: '1',
  // Background + MCP-background tasks and marketplace auto-install disabled.
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1',
  CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND: '1',
  CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
  // Auto-memory, agent view, workflows, git instructions, fast mode disabled.
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
  CLAUDE_CODE_DISABLE_AGENT_VIEW: '1',
  CLAUDE_CODE_DISABLE_WORKFLOWS: '1',
  CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS: '1',
  CLAUDE_CODE_DISABLE_FAST_MODE: '1',
});

/**
 * Build the REPLACEMENT subprocess environment. It is constructed purely from
 * constants and the supplied port; it NEVER spreads process.env. Cloud/provider
 * selectors, AWS/metadata credentials, OAuth, proxy vars, NODE_OPTIONS, custom
 * CA, OTEL and helper settings are deliberately absent.
 */
export function buildCaptureEnv(port, { apiKey = SYNTHETIC_API_KEY } = {}) {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`invalid loopback port: ${port}`);
  }
  const env = {
    PATH: CAPTURE_MIN_PATH,
    HOME: CAPTURE_HOME,
    CLAUDE_CONFIG_DIR: CAPTURE_CONFIG_DIR,
    TMPDIR: CAPTURE_TMPDIR,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    NODE_ENV: 'production',
    ANTHROPIC_BASE_URL: `http://${LOOPBACK_HOST}:${port}`,
    ANTHROPIC_API_KEY: apiKey,
    MERI_QUALIFICATION_ONLY: 'true',
    MERI_SOURCES_ENABLED: 'false',
    ...CHILD_ENV_FLAGS,
  };
  return env;
}

// ---------------------------------------------------------------------------
// Explicit SDK settings overlay (disables discovery / memory / attribution)
// ---------------------------------------------------------------------------

/** Build the exact explicit settings overlay. */
export function buildCaptureSettings() {
  return {
    autoMemoryEnabled: false,
    autoDreamEnabled: false,
    syncClaudeAiSkills: false,
    syncClaudeAiPlugins: false,
    disableAllHooks: true,
    enabledPlugins: {},
    enabledMcpjsonServers: [],
    disabledMcpjsonServers: [],
    enableAllProjectMcpServers: false,
    attribution: false,
    includeCoAuthoredBy: false,
    includeGitInstructions: false,
    fastMode: false,
    disableAutoMode: 'disable',
    disableAgentView: true,
    disableRemoteControl: true,
    disableWorkflows: true,
    remoteControlAtStartup: false,
    autoCompactEnabled: false,
    claudeMdExcludes: ['**/CLAUDE.md', '**/CLAUDE.md.*', '**/.claude/rules/**'],
    permissions: {
      defaultMode: 'default',
      ask: [WIRE_TOOL_FULLNAME],
      allow: [],
      deny: [],
      disableBypassPermissionsMode: 'disable',
      additionalDirectories: [],
      blockReadsOutsideWorkingDirectories: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Capture-specific SDK options
// ---------------------------------------------------------------------------

/**
 * The exact capture-specific public Options fields, in one frozen list. Tests
 * assert each name is declared in the installed sdk.d.ts (source evidence).
 */
export const CAPTURE_OPTION_FIELDS = Object.freeze([
  'abortController',
  'cwd',
  'additionalDirectories',
  'settingSources',
  'settings',
  'agents',
  'tools',
  'plugins',
  'skills',
  'hooks',
  'strictMcpConfig',
  'permissionMode',
  'canUseTool',
  'thinking',
  'includePartialMessages',
  'maxTurns',
  'maxBudgetUsd',
  'model',
  'systemPrompt',
  'title',
  'persistSession',
  'enableFileCheckpointing',
  'sessionId',
  'env',
  'mcpServers',
  'spawnClaudeCodeProcess',
  'verbatimPrompts',
  'promptSuggestions',
  'agentProgressSummaries',
]);

/**
 * Build the capture-specific Options. Everything restrictive stays on; no
 * fallback/resume/continue/sessionStore/OAuth field is ever set.
 */
export function buildCaptureOptions({
  abortController,
  env,
  mcpServers,
  canUseTool,
  spawnClaudeCodeProcess,
  sessionId = randomUUID(),
  title = `meri-wire-capture-${randomUUID().slice(0, 8)}`,
} = {}) {
  const options = {
    abortController,
    cwd: CAPTURE_CWD,
    additionalDirectories: [],
    settingSources: [],
    settings: buildCaptureSettings(),
    agents: {},
    tools: [],
    plugins: [],
    skills: [],
    hooks: {},
    strictMcpConfig: true,
    permissionMode: 'default',
    canUseTool,
    thinking: { type: 'disabled' },
    includePartialMessages: true,
    maxTurns: MAX_TURNS,
    maxBudgetUsd: LOCAL_MAX_BUDGET_USD,
    model: CAPTURE_MODEL,
    systemPrompt: CAPTURE_SYSTEM_PROMPT,
    title,
    persistSession: false,
    enableFileCheckpointing: false,
    sessionId,
    env,
    mcpServers,
    spawnClaudeCodeProcess,
    verbatimPrompts: true,
    promptSuggestions: false,
    agentProgressSummaries: false,
  };
  validateCaptureOptions(options);
  return options;
}

/** Fail closed on any option set that drifts from the capture contract. */
export function validateCaptureOptions(options) {
  if (!options || typeof options !== 'object') throw new Error('capture options must be an object');
  for (const forbidden of ['fallbackModel', 'resume', 'continue', 'sessionStore', 'sessionStoreFlush']) {
    if (forbidden in options) throw new Error(`capture must not set ${forbidden}`);
  }
  const unexpected = Object.keys(options).filter((k) => !CAPTURE_OPTION_FIELDS.includes(k));
  if (unexpected.length) throw new Error(`unexpected capture option(s): ${unexpected.join(', ')}`);
  const eq = (k, v) => {
    if (options[k] !== v) throw new Error(`capture option ${k} must be ${JSON.stringify(v)}`);
  };
  eq('cwd', CAPTURE_CWD);
  eq('model', CAPTURE_MODEL);
  eq('permissionMode', 'default');
  eq('strictMcpConfig', true);
  eq('verbatimPrompts', true);
  eq('promptSuggestions', false);
  eq('agentProgressSummaries', false);
  eq('includePartialMessages', true);
  eq('maxTurns', MAX_TURNS);
  eq('persistSession', false);
  eq('enableFileCheckpointing', false);
  for (const empty of ['additionalDirectories', 'settingSources', 'tools', 'plugins', 'skills']) {
    const v = options[empty];
    if (!Array.isArray(v) || v.length !== 0) throw new Error(`capture option ${empty} must be []`);
  }
  for (const empty of ['agents', 'hooks']) {
    const v = options[empty];
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== 0) {
      throw new Error(`capture option ${empty} must be {}`);
    }
  }
  if (!options.thinking || options.thinking.type !== 'disabled') {
    throw new Error('capture option thinking must be {type:"disabled"}');
  }
  if (typeof options.sessionId !== 'string' || !options.sessionId) {
    throw new Error('capture option sessionId must be a fresh non-empty string');
  }
  if (!options.env || typeof options.env !== 'object') throw new Error('capture option env is required');
  if (!options.mcpServers || typeof options.mcpServers !== 'object') {
    throw new Error('capture option mcpServers is required');
  }
  if (typeof options.canUseTool !== 'function') throw new Error('capture option canUseTool is required');
  if (typeof options.spawnClaudeCodeProcess !== 'function') {
    throw new Error('capture option spawnClaudeCodeProcess is required');
  }
  return true;
}

// ---------------------------------------------------------------------------
// Parent-process preflight (names only, never values)
// ---------------------------------------------------------------------------

/**
 * Harmless parent-environment NAMES that are explicitly permitted to exist in
 * the parent (their presence is NOT a violation). They are NEVER copied into the
 * replacement child environment, which is built purely from constants.
 */
export const HARMLESS_PARENT_ENV_ALLOWLIST = Object.freeze(
  new Set([
    'AWS_REGION',
    'AWS_DEFAULT_REGION',
    'AWS_EXECUTION_ENV',
    'ECS_CONTAINER_METADATA_URI',
    'ECS_CONTAINER_METADATA_URI_V4',
  ]),
);

/**
 * Sensitive inherited-configuration patterns. This preflight REJECTS an
 * inherited variable whose NAME matches any pattern unless it is on the
 * harmless allowlist. Only names are ever reported; values are never read,
 * printed or logged. Actual credentials, credential URIs/tokens/files/profiles,
 * provider selectors, and endpoint/helper/proxy injections are all caught.
 */
export const SENSITIVE_ENV_PATTERNS = Object.freeze([
  /^ANTHROPIC_/,
  /^OPENAI_/,
  /^GOOGLE_/,
  /^GCP_/,
  /^AZURE_/,
  /^BEDROCK/i,
  /OAuth/i,
  /OAUTH/,
  // All AWS_* except the harmless allowlist markers.
  /^AWS_/,
  // Credential material by name.
  /_API_KEY$/,
  /_ACCESS_KEY_ID$/,
  /_SECRET_ACCESS_KEY$/,
  /_SESSION_TOKEN$/,
  /_TOKEN$/,
  /SECRET/i,
  /PASSWORD/i,
  /CREDENTIAL/i,
  /_KEY$/,
  /PROFILE$/,
  // Endpoint / helper / proxy injection.
  /_ENDPOINT$/,
  /_BASE_URL$/,
  /_HELPER$/,
  /PROXY/i,
  // Node / TLS / telemetry injections.
  /^NODE_OPTIONS$/,
  /^NODE_EXTRA_CA_CERTS$/,
  /^SSL_CERT/,
  /CA_BUNDLE/i,
  /OTEL/,
  // Provider selection / managed-tier overrides.
  /^CLAUDE_CODE_USE_/,
  /^CLAUDE_CODE_SSE_PORT$/,
  /^CLAUDE_CODE_MANAGED_SETTINGS_PATH$/,
  /^CLAUDE_CODE_REMOTE_SETTINGS_PATH$/,
]);

/**
 * Return the sorted NAMES of inherited variables that match a sensitive
 * pattern and are not on the harmless allowlist. Never returns or logs a value.
 */
export function scanParentEnv(source = process.env) {
  const offenders = new Set();
  for (const name of Object.keys(source || {})) {
    if (HARMLESS_PARENT_ENV_ALLOWLIST.has(name)) continue;
    if (SENSITIVE_ENV_PATTERNS.some((re) => re.test(name))) offenders.add(name);
  }
  return [...offenders].sort();
}

/**
 * Preflight the parent environment and the resolved settings cascade. Fails
 * closed if inherited sensitive configuration is present, or if a mandatory
 * managed settings tier is unexpectedly present (settingSources:[] does NOT
 * override managed policy). Exactly no values are returned.
 */
export function preflightParentEnvironment({ source = process.env, resolved } = {}) {
  const reasons = [];
  const offenders = scanParentEnv(source);
  if (offenders.length) {
    reasons.push(`inherited sensitive configuration present: ${offenders.join(', ')}`);
  }
  if (resolved && Array.isArray(resolved.sources)) {
    const managed = resolved.sources.filter((s) => s && s.source === 'managed');
    if (managed.length) {
      reasons.push(`unexpected managed settings tier present (${managed.length} source(s))`);
    }
  }
  return { ok: reasons.length === 0, reasons, offenders };
}

// ---------------------------------------------------------------------------
// Permission callback
// ---------------------------------------------------------------------------

/**
 * The explicit strict canUseTool. It allows ONLY the exact wire echo tool with
 * the exact declared provenance and exact input, and denies everything else.
 * It counts every invocation so the probe can require exactly one.
 */
export function createPermissionCallback(counters) {
  return async function canUseTool(toolName, input, options) {
    counters.permissionCallbacks += 1;
    const provenance = options && options.mcpServer;
    const okName = toolName === WIRE_TOOL_FULLNAME;
    const okSource = !!provenance && provenance.source === 'sdk';
    const okServer = !!provenance && provenance.name === WIRE_SERVER_NAME;
    const okInput =
      !!input &&
      typeof input === 'object' &&
      Object.keys(input).length === 1 &&
      input.value === WIRE_TOKEN;
    if (okName && okSource && okServer && okInput) {
      return { behavior: 'allow', updatedInput: input };
    }
    const reasons = [];
    if (!okName) reasons.push(`tool ${toolName}`);
    if (!okSource) reasons.push('provenance.source!==sdk');
    if (!okServer) reasons.push('provenance.name!==wire');
    if (!okInput) reasons.push('unexpected input shape');
    return { behavior: 'deny', message: `denied by wire-capture permission callback: ${reasons.join('; ')}` };
  };
}

/**
 * The echo tool handler. It revalidates the exact input before returning the
 * fixed result, counts its executions, and rejects anything else.
 */
export async function runEchoHandler(counters, args) {
  counters.handlerExecutions += 1;
  if (!args || typeof args !== 'object' || Object.keys(args).length !== 1 || args.value !== WIRE_TOKEN) {
    throw new Error('wire echo handler rejected unexpected arguments');
  }
  return { content: [{ type: 'text', text: WIRE_TOOL_RESULT }] };
}
