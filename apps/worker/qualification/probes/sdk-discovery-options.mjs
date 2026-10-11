// Inert deferred-tool qualification configuration. No SDK import or execution.
// RunBinding validation is shape checking; the caller must inject trusted context
// and gateway-owned permission/execution callbacks. Discovery never grants access.
import { validateShape, contractVersion } from '../../../../packages/contracts/validate.mjs';
import {
  buildCaptureEnv, buildCaptureOptions, validateCaptureOptions,
  CAPTURE_CWD, CAPTURE_MODEL, WIRE_SERVER_NAME,
} from './sdk-capture-options.mjs';

const freeze = (value) => {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freeze(child);
  }
  return Object.freeze(value);
};

// DATA for the future native fixture's public tool()/createSdkMcpServer() calls.
// These are synthetic descriptions, not a capability catalog or live handlers.
export const DISCOVERY_FIXTURE = freeze({
  server: { name: WIRE_SERVER_NAME, version: '1.0.0', alwaysLoad: false },
  tools: [
    { name: 'lookup_message', description: 'Find one synthetic message by exact message identifier.',
      searchHint: 'locate a particular email by its identifier', alwaysLoad: false },
    { name: 'lookup_messages', description: 'Find synthetic messages matching words in a subject.',
      searchHint: 'search email subjects for a phrase', alwaysLoad: false },
  ],
  cases: [
    { id: 'similar-name', prompt: 'Locate the synthetic email with identifier fixture-message-7.',
      expectedTool: 'lookup_message', disposition: 'execution-requires-current-gateway-grant' },
    { id: 'paraphrase', prompt: 'Which synthetic emails mention the orchard meeting in their subject?',
      expectedTool: 'lookup_messages', disposition: 'execution-requires-current-gateway-grant' },
    { id: 'unavailable', prompt: 'Fetch the attachment for synthetic fixture-message-7.',
      absentTool: 'lookup_message_attachment', disposition: 'must-not-execute-unavailable-tool' },
    { id: 'revoked-after-discovery', prompt: 'Locate synthetic fixture-message-7 after its grant is revoked.',
      expectedTool: 'lookup_message', disposition: 'gateway-must-refuse-after-revocation' },
  ],
});

const fields = Object.freeze([
  'runBinding', 'contractVersion', 'sessionId', 'cwd', 'model', 'loopbackIngress',
  'abortController', 'mcpServer', 'canUseTool', 'spawnClaudeCodeProcess',
]);

function record(value, label, expected) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be an ordinary record`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) throw new Error(`${label} symbol fields are forbidden`);
  if (expected && (keys.length !== expected.length || keys.some((key) => !expected.includes(key)))) {
    throw new Error(`${label} fields must be exact`);
  }
  if (keys.some((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !('value' in descriptor) || !descriptor.enumerable;
  })) {
    throw new Error(`${label} accessors/nonenumerable fields are forbidden`);
  }
}

/**
 * Compose the canonical capture builder with the supported discovery env flag.
 * No raw options/env override is accepted, including beta-disable attempts.
 * The trusted caller supplies a public createSdkMcpServer() result, constructed
 * with DISCOVERY_FIXTURE.server and per-tool alwaysLoad:false. An instance's
 * hidden registration state cannot be established by this source-only builder.
 * Canonical capture persistence/resume restrictions intentionally remain intact.
 */
export function buildDiscoveryOptions(input) {
  record(input, 'discovery input', fields);
  record(input.runBinding, 'RunBinding');
  validateShape('RunBinding', input.runBinding);
  if (input.contractVersion !== contractVersion) throw new Error('contract version mismatch');
  // Reuse the public UUID format owner rather than introducing another regex.
  validateShape('RunBinding', { ...input.runBinding, conversationId: input.sessionId });
  if (input.cwd !== CAPTURE_CWD || input.model !== CAPTURE_MODEL) {
    throw new Error('discovery cwd/model must match the canonical capture profile');
  }
  record(input.loopbackIngress, 'loopback ingress', ['host', 'port', 'baseUrl']);
  const env = buildCaptureEnv(input.loopbackIngress.port);
  if (input.loopbackIngress.host !== '127.0.0.1' ||
      input.loopbackIngress.baseUrl !== env.ANTHROPIC_BASE_URL) {
    throw new Error('discovery requires exact loopback ingress');
  }
  if (!(input.abortController instanceof AbortController) || input.abortController.signal.aborted) {
    throw new Error('a live caller-owned AbortController is required');
  }
  record(input.mcpServer, 'SDK MCP server', ['type', 'name', 'instance']);
  if (input.mcpServer.type !== 'sdk' || input.mcpServer.name !== WIRE_SERVER_NAME ||
      !input.mcpServer.instance || typeof input.mcpServer.instance !== 'object') {
    throw new Error('an exact trusted in-process SDK MCP server is required');
  }
  delete env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS;
  env.ENABLE_TOOL_SEARCH = 'true';
  const options = buildCaptureOptions({
    abortController: input.abortController,
    env: Object.freeze(env),
    mcpServers: Object.freeze({ [WIRE_SERVER_NAME]: Object.freeze({ ...input.mcpServer }) }),
    canUseTool: input.canUseTool,
    spawnClaudeCodeProcess: input.spawnClaudeCodeProcess,
    sessionId: input.sessionId,
    title: `meri-discovery-${input.runBinding.runId}`,
  });
  // Route the declared synthetic tools through the injected permission callback.
  // This is fixture configuration, never a second authorization implementation.
  options.settings.permissions.ask = DISCOVERY_FIXTURE.tools.map(
    ({ name }) => `mcp__${WIRE_SERVER_NAME}__${name}`,
  );
  validateCaptureOptions(options);
  const context = freeze({
    contractVersion,
    runBinding: { ...input.runBinding },
    sessionId: input.sessionId,
  });
  // Do not recursively freeze borrowed AbortController/server/function objects.
  freeze(options.settings);
  return Object.freeze({ options: Object.freeze(options), context, fixture: DISCOVERY_FIXTURE });
}
