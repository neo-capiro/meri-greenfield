/** Workspace generation leaf: the real canonical caller for a supported
 * Workspace generated phase.
 *
 * This is an adapter over owners that already exist — it never introduces a
 * queue, a run journal, a model, or a second authority:
 *   * authority  — the existing action-session owner issues one opaque session
 *                  for the CURRENT identity credential in the `authorization`
 *                  header; its returned context (tenant/actor/client) is the
 *                  only authority. The request body is checked AGAINST that
 *                  context and can never select it.
 *   * execution  — the existing conversation service admits exactly ONE
 *                  canonical conversation turn (`submit`) and observes it with
 *                  the existing `observe` window; replay/UNKNOWN/cancel come
 *                  from that owner's own retained request identity.
 *   * outputs    — a phase answer is read from the run's durable events under a
 *                  closed shape. A run that ended with a retained approval
 *                  requirement is reported with its existing proposal id, and a
 *                  document body is handed back section-keyed to the approved
 *                  outline: the Core bridge admits it as a PENDING proposal
 *                  through the existing Workspace revision owner, so this leaf
 *                  never writes document content itself.
 *
 * Transport trust is the protected listener; the request must also present the
 * existing Core service secret. Both are additional to — never instead of — the
 * verified current identity.
 */
import {timingSafeEqual} from 'node:crypto';
import {data, own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {isAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
import {fail, terminal} from '../boundary.mjs';
import {
  WORKSPACE_GENERATION_SCHEMA_VERSION,
  workspaceGenerationErrorStatuses,
  workspaceGenerationLimits,
  workspaceGenerationPaths,
  workspaceGenerationPhases,
} from './protocol.mjs';
import {assistantText, conversationRequestIdFor, documentSectionIds, parsePhaseOutput, workspaceConversationIdFor, workspaceGenerationPrompt} from './phases.mjs';

const headers = {'cache-control': 'no-store', 'x-content-type-options': 'nosniff'};
const noStore = extra => ({...headers, ...extra});
const response = (status, body, extra = {}) => Response.json(body, {status, headers: noStore(extra)});
const error = (status, code, outcome) => response(status, {error: {code, ...(outcome === undefined ? {} : {outcome})}});
const fault = code => Object.assign(Error(code), {code});
const matches = (actual, expected) => {
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
const REQUEST_ID = /^wsgen:[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const boundedText = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max;
const secret = value => typeof value === 'string' && value.length >= 16 && value.length <= 8192 && !/[\s\x00-\x1f\x7f]/u.test(value);

export function createWorkspaceGenerationApplication(options = {}) {
  const c = own(options, ['sessions', 'service'], ['getServiceSecret', 'now', 'maxRequestMs', 'requestBytes', 'observeMs', 'pollMs', 'idleRecheckMs']);
  const now = c.now ?? Date.now;
  const maxRequestMs = c.maxRequestMs ?? workspaceGenerationLimits.maxRequestMs;
  const requestBytes = c.requestBytes ?? workspaceGenerationLimits.requestBytes;
  const observeMs = c.observeMs ?? workspaceGenerationLimits.observeMs;
  const pollMs = c.pollMs ?? workspaceGenerationLimits.observePollMs;
  const idleRecheckMs = c.idleRecheckMs ?? workspaceGenerationLimits.observeIdleRecheckMs;
  if (typeof now !== 'function' || typeof c.sessions?.issue !== 'function' ||
      ['allocateInput', 'submit', 'history', 'cancel', 'observe'].some(name => typeof c.service?.[name] !== 'function') ||
      (c.getServiceSecret !== undefined && typeof c.getServiceSecret !== 'function') ||
      ![maxRequestMs, requestBytes, observeMs, pollMs, idleRecheckMs].every(value => Number.isSafeInteger(value) && value >= 1) ||
      requestBytes > 65536 || maxRequestMs > 30000 || observeMs > maxRequestMs) throw fault('WORKSPACE_GENERATION_UNAVAILABLE');

  /** The identity facts every Workspace request must agree with. */
  function validateIdentity(request) {
    if (!REQUEST_ID.test(request.requestId) || !boundedText(request.tenantId) || !boundedText(request.actorId) ||
        !boundedText(request.draftId) ||
        !(request.clientId === null || (boundedText(request.clientId, 64) && UUID.test(request.clientId)))) fail('WORKSPACE_GENERATION_REFUSED');
  }

  const closedShape = (raw, required, optional) => {
    try { return own(raw, required, optional); } catch { fail('WORKSPACE_GENERATION_REFUSED'); }
  };

  const TURN_KEYS = ['requestId', 'phase', 'tenantId', 'actorId', 'draftId', 'clientId', 'expectedRevision', 'paidGeneration', 'sources'];

  /** The shared closed shape of the exact Workspace request: ids, pins and retained sources. */
  function readTurnRequest(request) {
    validateIdentity(request);
    if (!workspaceGenerationPhases.includes(request.phase) ||
        !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0 ||
        request.paidGeneration !== true || !Array.isArray(request.sources) || !request.sources.length || request.sources.length > 256) fail('WORKSPACE_GENERATION_REFUSED');
    const sources = request.sources.map(source => {
      const item = closedShape(source, ['id', 'kind']);
      if (!boundedText(item.id, 256) || !boundedText(item.kind, 64)) fail('WORKSPACE_GENERATION_REFUSED');
      return {id: item.id, kind: item.kind};
    });
    return {...request, sources};
  }

  /** The closed Workspace request one turn submits. Nothing here selects authority. */
  function readRequest(raw) {
    return readTurnRequest(closedShape(raw, TURN_KEYS));
  }

  /**
   * The EXACT retained request a read addresses: the same closed turn request,
   * plus the retained run when the caller holds it. The conversation is DERIVED
   * from that exact request, so the binding is never body-selected; when the
   * retained run is present the resolved binding must be exactly it.
   */
  function readSubjectShape(raw) {
    const request = readTurnRequest(closedShape(raw, TURN_KEYS, ['runId']));
    if (request.runId !== undefined && !UUID.test(request.runId)) fail('WORKSPACE_GENERATION_REFUSED');
    return request;
  }

  /**
   * The closed retained-request identity a cancel addresses: the retained
   * identity and the exact run the original turn started. The conversation is
   * derived from the same exact request, so a cancel only ever re-selects the
   * retained binding and never allocates one.
   */
  function cancelSubjectShape(raw) {
    const subject = closedShape(raw, ['requestId', 'tenantId', 'actorId', 'draftId', 'clientId', 'runId']);
    validateIdentity(subject);
    if (!UUID.test(subject.runId)) fail('WORKSPACE_GENERATION_REFUSED');
    return subject;
  }

  /**
   * Verify the current identity through the existing session owner and check the
   * request against the authority that owner resolved. A mismatch is refused; a
   * body can never widen or repoint the authority.
   *
   * Verify the current identity through the existing session owner and check the
   * request against the authority that owner resolved. A mismatch is refused; a
   * body can never widen or repoint the authority.
   *
   * The conversation is DERIVED from the exact request (`workspaceConversationIdFor`),
   * so no body ever selects it. On a turn the session owner's own initial-binding
   * journal CLAIMS it (the only place a Workspace generation conversation is
   * created); on a read or cancel the same closed hints re-select the retained
   * original binding, and a retained run the caller carried must be the one the
   * owner resolves.
   */
  async function authorize({request, identityCredential, signal, deadlineMs}) {
    const conversationId = workspaceConversationIdFor(request.requestId);
    const retainedRunId = request.runId ?? null;
    let issued;
    try {
      issued = await c.sessions.issue({
        identityCredential,
        hints: {conversationId, clientId: request.clientId, ...(retainedRunId === null ? {} : {runId: retainedRunId})},
        signal,
        deadlineMs,
      });
    } catch (caught) {
      // The session owner's refusal is the current-authority refusal; a dependency
      // that did not answer keeps its own transient mark.
      if (isAuthorityUnavailable(caught)) fail('WORKSPACE_GENERATION_UNAVAILABLE');
      fail('WORKSPACE_GENERATION_AUTHORITY_REFUSED');
    }
    const context = own(issued?.context, ['tenantId', 'actorId', 'conversationId', 'runId', 'selectedClientId']);
    if (typeof issued?.credential !== 'string' || !Number.isSafeInteger(issued?.expiresAtMs) || issued.expiresAtMs <= now() ||
        context.tenantId !== request.tenantId || context.actorId !== request.actorId || (context.selectedClientId ?? null) !== request.clientId ||
        context.conversationId !== conversationId || !UUID.test(context.runId) || (retainedRunId !== null && context.runId !== retainedRunId)) {
      fail('WORKSPACE_GENERATION_SCOPE_REFUSED');
    }
    return {credential: issued.credential, expiresAtMs: issued.expiresAtMs, conversationId: context.conversationId, runId: context.runId};
  }

  /** The last run state the run's own `run.status` events published. */
  function lastRunState(events) {
    let state;
    for (const event of events) if (event.type === 'run.status' && typeof event.data?.state === 'string') state = event.data.state;
    return state;
  }

  /** Map the durable events of one run to the Workspace outcome. */
  function outcome({request, runId, events, runState}) {
    const approval = events.find(event => event.type === 'approval.required');
    if (approval) {
      if (typeof approval.data?.proposalId !== 'string' || !approval.data.proposalId) fail('WORKSPACE_GENERATION_OUTPUT_REFUSED');
      return {status: 'approval_required', runId, proposalId: approval.data.proposalId};
    }
    if (!terminal(runState)) return {status: 'unknown', requestId: request.requestId, runId};
    if (runState !== 'completed') return {status: 'failed', runId, state: runState};
    // A document body is parsed under the RETAINED approved-outline section ids
    // the exact request carried, and handed back as a section-keyed result. It is
    // never written here: the Core bridge admits it as a PENDING proposal through
    // the existing Workspace revision owner, and only a reviewing actor's accept
    // lands it. An answer that does not key the approved sections exactly is refused.
    if (request.phase === 'document')
      return {status: 'complete', runId, result: parsePhaseOutput('document', assistantText(events), documentSectionIds(request))};
    const parsed = parsePhaseOutput(request.phase, assistantText(events));
    return {status: 'complete', runId, result: parsed};
  }

  /** Admit exactly one conversation turn for the exact request. */
  async function turn({request, identityCredential, signal, life}) {
    const authority = await life.run(signal => authorize({request, identityCredential, signal, deadlineMs: life.deadline()}));
    life.limitDeadline(authority.expiresAtMs);
    const conversationRequestId = conversationRequestIdFor(request.requestId);
    const input = {requestId: conversationRequestId, prompt: workspaceGenerationPrompt(request)};
    // The canonical initial-input owner RESERVES this conversation's original
    // input (its own durable allocation), and only then does the conversation
    // service accept the request and dispatch exactly one run. Both are the
    // existing owners; this leaf allocates no identity of its own.
    const allocation = data(await life.run(signal => c.service.allocateInput({credential: authority.credential, input, signal})));
    const allocated = allocation?.allocation?.binding;
    if (allocated?.conversationId !== authority.conversationId || typeof allocated?.runId !== 'string') fail('WORKSPACE_GENERATION_REQUEST_REFUSED');
    const receipt = data(await life.run(signal => c.service.submit({credential: authority.credential, input, signal})));
    if (receipt?.requestId !== conversationRequestId || receipt.run?.binding?.runId !== allocated.runId) fail('WORKSPACE_GENERATION_REQUEST_REFUSED');
    const runId = receipt.run.binding.runId;
    const events = [];
    try {
      await life.run(signal => c.service.observe({credential: authority.credential, after: 0, untilMs: Math.min(now() + observeMs, life.deadline()),
        pollMs, idleRecheckMs, signal, deliver: page => events.push(...data(page)), opened: run => { if (run.binding.runId !== runId) fail('WORKSPACE_GENERATION_REQUEST_REFUSED'); }}));
    } catch (caught) {
      // An observe window that ends without a terminal run is exactly the UNKNOWN
      // outcome: the run is retained and re-read, never re-dispatched. A refusal of
      // this leaf's own vocabulary still decides.
      if (typeof caught?.code === 'string' && caught.code.startsWith('WORKSPACE_GENERATION_')) throw caught;
    }
    return {...outcome({request, runId, events, runState: lastRunState(events) ?? receipt.run.state}), conversationId: authority.conversationId};
  }

  /**
   * Read the EXACT retained request back. This is the only observation an
   * UNKNOWN performs: the conversation owner's retained request identity is
   * compared with the identity derived from the exact Workspace request, and
   * nothing is ever re-dispatched.
   */
  async function read({request, identityCredential, signal, life}) {
    const authority = await life.run(signal => authorize({request, identityCredential, signal, deadlineMs: life.deadline()}));
    life.limitDeadline(authority.expiresAtMs);
    const page = data(await life.run(signal => c.service.history({credential: authority.credential, after: 0, limit: 100, signal})));
    if (page?.run?.binding?.runId !== authority.runId || page?.run?.binding?.conversationId !== authority.conversationId ||
        conversationRequestIdFor(request.requestId) !== page?.request?.requestId) return null;
    return outcome({request, runId: authority.runId, events: data(page.events ?? []), runState: page.run?.state});
  }

  /** Cancel the exact retained request. A different retained request is refused. */
  async function cancel({request, identityCredential, signal, life}) {
    const authority = await life.run(signal => authorize({request, identityCredential, signal, deadlineMs: life.deadline()}));
    life.limitDeadline(authority.expiresAtMs);
    const page = data(await life.run(signal => c.service.history({credential: authority.credential, after: 0, limit: 1, signal})));
    if (page?.run?.binding?.runId !== authority.runId || page?.run?.binding?.conversationId !== authority.conversationId ||
        conversationRequestIdFor(request.requestId) !== page?.request?.requestId) fail('WORKSPACE_GENERATION_REQUEST_REFUSED');
    const result = data(await life.run(signal => c.service.cancel({credential: authority.credential, signal})));
    if (typeof result?.state !== 'string') fail('WORKSPACE_GENERATION_REQUEST_REFUSED');
    return {state: result.state};
  }

  return Object.freeze({async handle(request) {
    const url = new URL(request.url);
    const route = Object.entries(workspaceGenerationPaths).find(([, path]) => path === url.pathname);
    if (route === undefined || url.search || url.hash) return null;
    let life;
    try {
      if (!(request instanceof Request) || request.method !== 'POST' || !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type') ?? '') || request.headers.has('content-encoding')) {
        return error(400, 'WORKSPACE_GENERATION_REQUEST_REFUSED');
      }
      life = createOperationLifetime({now, signal: request.signal, deadlineMs: now() + maxRequestMs, errorFactory: () => fault('WORKSPACE_GENERATION_DEADLINE')});
      const supplied = request.headers.get('x-internal-service-secret');
      if (c.getServiceSecret === undefined || !secret(supplied)) return error(503, 'WORKSPACE_GENERATION_UNAVAILABLE');
      const expected = await life.run(signal => c.getServiceSecret({signal}));
      life.check();
      if (!secret(expected) || !matches(supplied, expected)) return error(503, 'WORKSPACE_GENERATION_UNAVAILABLE');
      const authorization = request.headers.get('authorization');
      if (!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(authorization ?? '')) return error(403, 'WORKSPACE_GENERATION_AUTHORITY_REFUSED');
      const identityCredential = authorization.slice(7);
      const length = request.headers.get('content-length');
      if (length !== null && (!/^[1-9][0-9]*$/u.test(length) || Number(length) > requestBytes)) return error(400, 'WORKSPACE_GENERATION_REQUEST_REFUSED');
      let body;
      try { body = own(await request.json(), ['schemaVersion', 'request']); }
      catch { return error(400, 'WORKSPACE_GENERATION_REQUEST_REFUSED'); }
      life.check();
      if (body.schemaVersion !== WORKSPACE_GENERATION_SCHEMA_VERSION) return error(400, 'WORKSPACE_GENERATION_REQUEST_REFUSED');
      const closed = route[0] === 'turn' ? readRequest(body.request) : route[0] === 'read' ? readSubjectShape(body.request) : cancelSubjectShape(body.request);
      let payload;
      if (route[0] === 'turn') payload = {outcome: await turn({request: closed, identityCredential, signal: request.signal, life})};
      else if (route[0] === 'read') payload = {outcome: await read({request: closed, identityCredential, signal: request.signal, life})};
      else payload = {state: (await cancel({request: closed, identityCredential, signal: request.signal, life})).state};
      life.check();
      const encoded = JSON.stringify({schemaVersion: WORKSPACE_GENERATION_SCHEMA_VERSION, ...payload});
      if (Buffer.byteLength(encoded) > workspaceGenerationLimits.responseBytes) fail('WORKSPACE_GENERATION_OUTPUT_REFUSED');
      return response(200, JSON.parse(encoded));
    } catch (caught) {
      const code = caught?.code;
      if (code === 'WORKSPACE_GENERATION_UNKNOWN') return error(503, code, 'UNKNOWN');
      if (Object.hasOwn(workspaceGenerationErrorStatuses, code ?? '')) return error(workspaceGenerationErrorStatuses[code][0], code, code === 'WORKSPACE_GENERATION_OUTPUT_REFUSED' ? 'RETRY_READ_ONLY' : undefined);
      return error(503, 'WORKSPACE_GENERATION_UNAVAILABLE');
    } finally {
      life?.close();
    }
  }});
}
