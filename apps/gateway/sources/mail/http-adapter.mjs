/** Explicit canonical mail-page HTTP port; no ambient credentials, guessed routes or retries. */
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny, safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody, responseBody, readJsonResponse} from '../json-response.mjs';
import {assertMailPage, frozenData, operationIds, ownFields, readContext} from './request-context.mjs';

function configuredEndpoints(value) {
  const fields = ownFields(value, operationIds), endpoints = {};
  for (const id of operationIds) {
    try {
      if (typeof fields[id] !== 'string') deny('GATEWAY_CONFIGURATION');
      const url = new URL(fields[id]);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) deny('GATEWAY_CONFIGURATION');
      endpoints[id] = url.href;
    } catch { deny('GATEWAY_CONFIGURATION'); }
  }
  return Object.freeze(endpoints);
}

export function createMailHttpAdapter(options) {
  const {endpoints: configured, getCredentials, fetchImpl = globalThis.fetch, now, maxRequestMs = 15000, maxResponseBytes = 1048576} =
    ownFields(options, ['endpoints', 'getCredentials', 'now'], ['fetchImpl', 'maxRequestMs', 'maxResponseBytes']);
  if (typeof getCredentials !== 'function' || typeof fetchImpl !== 'function' || typeof now !== 'function' ||
      !Number.isSafeInteger(maxRequestMs) || maxRequestMs < 1 || maxRequestMs > 3600000 ||
      !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 16777216) deny('GATEWAY_CONFIGURATION');
  const endpoints = configuredEndpoints(configured);
  async function read(call) {
    let lifetime, acquired;
    try {
      const context = readContext(call, now);
      const body = JSON.stringify({input: context.input, metadata: context.metadata});
      const path = `/api/clio/tools/${context.operation.id}`;
      const target = Object.freeze({method: 'POST', path,
        bodySha256: createHash('sha256').update(body, 'utf8').digest('hex')});
      const correlation = {binding: context.authority.binding, subject: context.authority.subject,
        policyRevision: context.authority.policyRevision, normalizationContext: null};
      const correlationJson = canonicalize(correlation);
      if (typeof correlationJson !== 'string') deny('ACCESS_DENIED');
      const correlationBytes = Buffer.from(correlationJson, 'utf8');
      if (correlationBytes.length > 8192) deny('ACCESS_DENIED');
      const correlationSha256 = createHash('sha256').update(correlationBytes).digest('hex');
      let cutoff = Math.min(context.deadlineMs, context.active() + maxRequestMs);
      lifetime = createDispatchLifetime({deadlineMs: cutoff, now, signal: context.signal});
      const active = () => { lifetime.check(); return context.active(cutoff); };
      const pins = Object.freeze({operation: context.operation, input: context.input, metadata: context.metadata,
        argumentsSha256: context.argumentsSha256, requestSha256: context.requestSha256,
        binding: context.authority.binding, subject: context.authority.subject,
        policyRevision: context.authority.policyRevision, sourceIds: context.authority.sourceIds,
        ...(context.invocationId === undefined ? {} : {invocationId: context.invocationId})});
      const credentials = frozenData(await lifetime.run(signal => {
        active(); return getCredentials(Object.freeze({...pins, deadlineMs: cutoff, target, correlationSha256, signal}));
      }));
      if (context.invocationId !== undefined && !Object.hasOwn(credentials, 'invocationId')) deny('ACCESS_DENIED');
      ownFields(credentials, ['operation', 'argumentsSha256', 'metadata', 'requestSha256', 'binding', 'subject', 'policyRevision', 'sourceIds',
        'bearerToken', 'serviceSecret', 'expiresAtMs',
        ...(context.invocationId === undefined ? [] : ['invocationId'])], ['authorizationScheme', 'target', 'correlationSha256']);
      if (['operation', 'metadata', 'binding', 'subject', 'sourceIds'].some(key => canonicalSha256(credentials[key]) !== canonicalSha256(pins[key])) ||
          credentials.argumentsSha256 !== pins.argumentsSha256 || credentials.requestSha256 !== pins.requestSha256 ||
          credentials.policyRevision !== pins.policyRevision ||
          (context.invocationId !== undefined && credentials.invocationId !== pins.invocationId) ||
          (Object.hasOwn(credentials, 'target') && canonicalSha256(credentials.target) !== canonicalSha256(target)) ||
          (Object.hasOwn(credentials, 'correlationSha256') && credentials.correlationSha256 !== correlationSha256) ||
          (Object.hasOwn(credentials, 'authorizationScheme') &&
            !['Bearer', 'CapiroMeriRead'].includes(credentials.authorizationScheme)) ||
          !Number.isSafeInteger(credentials.expiresAtMs) || credentials.expiresAtMs <= active() ||
          ![credentials.bearerToken, credentials.serviceSecret].every(token => typeof token === 'string' &&
            token.length >= 1 && token.length <= 8192 && /^[\x21-\x7e]+$/.test(token))) deny('ACCESS_DENIED');
      if (credentials.authorizationScheme === 'CapiroMeriRead' &&
          (context.invocationId === undefined || !Object.hasOwn(credentials, 'target') ||
            new URL(endpoints[context.operation.id]).pathname !== path ||
            credentials.correlationSha256 !== correlationSha256 ||
            credentials.expiresAtMs > context.deadlineMs))
        deny('ACCESS_DENIED');
      if (credentials.authorizationScheme !== 'CapiroMeriRead' &&
          (context.invocationId !== undefined || new URL(endpoints[context.operation.id]).pathname === path))
        deny('ACCESS_DENIED');
      cutoff = Math.min(cutoff, credentials.expiresAtMs); lifetime.limitDeadline(cutoff); active();
      const response = await lifetime.run(async signal => {
        active();
        const result = await fetchImpl(endpoints[context.operation.id], {method: 'POST', redirect: 'error',
          credentials: 'omit', cache: 'no-store', signal,
          headers: {authorization: `${credentials.authorizationScheme ?? 'Bearer'} ${credentials.bearerToken}`,
            'x-internal-service-secret': credentials.serviceSecret, 'x-meri-deadline-at': String(cutoff),
            ...(credentials.authorizationScheme === 'CapiroMeriRead' ?
              {'x-meri-read-correlation': correlationBytes.toString('base64url')} : {}),
            'content-type': 'application/json', accept: 'application/json', 'accept-encoding': 'identity'}, body});
        acquired = result;
        try { active(); return result; } catch (error) { try { cancelBody(responseBody(result)); } catch {} throw error; }
      });
      const bounded = {run: fn => lifetime.run(signal => { active(); return fn(signal); }), check: active};
      const page = frozenData(await readJsonResponse(response, {lifetime: bounded, maxResponseBytes}));
      active(); assertMailPage(page, context); active(); return page;
    } catch (error) { throw safeFailure(error); }
    finally { try { if (acquired) cancelBody(responseBody(acquired)); } catch {} lifetime?.close(); }
  }
  return Object.freeze({read});
}
