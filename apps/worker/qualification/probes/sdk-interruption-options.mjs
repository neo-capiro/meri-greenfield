// Qualification-only options. No SDK import or resource allocation.
import { buildCaptureEnv, buildCaptureOptions, CAPTURE_CWD } from './sdk-capture-options.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const ACTIVE_MARKER = 'MERI_INTERRUPT_ACTIVE';
export const CONTINUITY_MARKER = 'MERI_RESUMED_CONTINUITY';
export const MAX_PHASE_MS = 60000;
export function validateScenario(value, now = Date.now()) {
  const keys = ['runUuid', 'sessionId', 't0Ms', 'deadlineMs', 'cleanupDeadlineMs', 'phaseDeadlineMs'];
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k)) ||
      !UUID.test(value.runUuid) || !UUID.test(value.sessionId) || value.runUuid === value.sessionId ||
      value.runUuid === 'f1bdbc76-068f-4d04-bc91-5abd2608f05f' ||
      keys.slice(2).some(k => !Number.isSafeInteger(value[k])) ||
      value.t0Ms > now || value.deadlineMs !== value.t0Ms + 720000 ||
      value.cleanupDeadlineMs !== value.t0Ms + 900000 ||
      value.phaseDeadlineMs <= now || value.phaseDeadlineMs > Math.min(value.deadlineMs, now + MAX_PHASE_MS)) {
    throw new Error('SCENARIO_BINDING');
  }
  return Object.freeze({ ...value });
}
export function phaseContext(scenario, phase) {
  if (!['interrupt', 'resume'].includes(phase)) throw new Error('PHASE');
  return Object.freeze({ runUuid: scenario.runUuid, sessionId: scenario.sessionId,
    attempt: phase === 'interrupt' ? 1 : 2, fence: phase === 'interrupt' ? 1 : 2,
    operation: phase, deadlineMs: scenario.deadlineMs });
}
export function sessionBinding(scenario) {
  return Object.freeze({ cwd: CAPTURE_CWD, projectKey: CAPTURE_CWD.replace(/[^a-zA-Z0-9]/g, '-'),
    sessionId: scenario.sessionId });
}
export function buildInterruptionOptions({ scenario, phase, port, abortController,
  spawnClaudeCodeProcess, canUseTool }) {
  phaseContext(scenario, phase);
  const options = buildCaptureOptions({ env: buildCaptureEnv(port), abortController,
    spawnClaudeCodeProcess, canUseTool, mcpServers: {}, sessionId: scenario.sessionId,
    title: `meri-interruption-${scenario.runUuid}` });
  options.persistSession = true;
  if (phase === 'resume') { delete options.sessionId; options.resume = scenario.sessionId; }
  // No external SessionStore is invented. This file bundle is a partial spike.
  return options;
}
