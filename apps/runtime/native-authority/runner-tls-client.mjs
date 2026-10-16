/** One verified original-task TLS connection, with one bounded HTTP exchange. */
import {connect as tlsConnect, createSecureContext} from 'node:tls';
import {Agent, request as httpRequest} from 'node:http';
import {X509Certificate, constants} from 'node:crypto';
import {isIPv4} from 'node:net';
import {types} from 'node:util';
import {own, nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {taskRouterFault, taskRouterOperation} from './task-router-boundary.mjs';

const PORT = 8080, MAX_HEADERS = 16384, MAX_BODY = 67108864;
const fail = () => taskRouterFault();
const clock = now => {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 1) throw fail();
  return value;
};
function validZone(zone) {
  return typeof zone === 'string' && zone.length <= 220 &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(zone);
}
export function runnerTaskServername({taskArn, zone}) {
  if (!validZone(zone)) throw fail();
  if (typeof taskArn !== 'string' || !/^arn:aws(?:-us-gov|-cn)?:ecs:[a-z0-9-]+:[0-9]{12}:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u.test(taskArn)) throw fail();
  return taskArn.slice(taskArn.lastIndexOf('/') + 1) + '.' + zone;
}
function snapshotCandidate(value, zone, now) {
  const candidate = own(value, ['privateIPv4Address', 'taskArn', 'port', 'checkedAtMs', 'expiresAtMs'],
    ['clusterArn', 'taskDefinitionArn', 'bindingSha256', 'executionKey', 'createdAtMs', 'networkInterfaceId', 'subnetId', 'vpcId', 'securityGroupIds', 'containerName']);
  const ip = candidate.privateIPv4Address;
  if (typeof ip !== 'string' || !isIPv4(ip) || !/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/u.test(ip) || candidate.port !== PORT ||
      !Number.isSafeInteger(candidate.checkedAtMs) || candidate.checkedAtMs < 1 || candidate.checkedAtMs > now ||
      !Number.isSafeInteger(candidate.expiresAtMs) || candidate.expiresAtMs <= now || candidate.checkedAtMs >= candidate.expiresAtMs) throw fail();
  return Object.freeze({...candidate, taskName: runnerTaskServername({taskArn: candidate.taskArn, zone})});
}

/** Chain trust belongs to Node TLS; this adds exact task identity and lifetime. */
export function assertRunnerPeerCertificate({certificate, taskName, nowMs, expiresAtMs}) {
  try {
    const leaf = certificate instanceof X509Certificate ? certificate : new X509Certificate(certificate);
    const from = Date.parse(leaf.validFrom), until = Date.parse(leaf.validTo);
    if (typeof taskName !== 'string' || !Number.isSafeInteger(nowMs) || !Number.isSafeInteger(expiresAtMs) ||
        !Number.isSafeInteger(from) || !Number.isSafeInteger(until) || from > nowMs || until <= nowMs || until > expiresAtMs ||
        leaf.ca || !leaf.keyUsage?.includes('1.3.6.1.5.5.7.3.1') || leaf.subjectAltName !== 'DNS:' + taskName) throw fail();
    return until;
  } catch { throw fail(); }
}

function compile(configuration) {
  const c = own(configuration, ['ca', 'zone'], ['now']);
  const now = c.now ?? Date.now;
  if (typeof now !== 'function' || types.isProxy(now) || !validZone(c.zone) ||
      !(typeof c.ca === 'string' && c.ca.length > 0 || Buffer.isBuffer(c.ca) && c.ca.length > 0)) throw fail();
  const ca = Buffer.isBuffer(c.ca) ? Buffer.from(c.ca) : c.ca;
  let secureContext;
  try { secureContext = createSecureContext({ca, minVersion: 'TLSv1.3', secureOptions: constants.SSL_OP_NO_TICKET}); }
  catch { throw fail(); }
  return {now, zone: c.zone, secureContext};
}

function makeConnector(configuration, connectImpl) {
  const c = compile(configuration);
  return Object.freeze({async connect(value) {
    const input = own(value, ['candidate'], ['signal']);
    nativeSignal(input.signal);
    if (input.signal?.aborted) throw fail();
    const candidate = snapshotCandidate(input.candidate, c.zone, clock(c.now));
    let socket, peerExpiresAtMs, closed = false, used = false, pendingReject;
    const close = () => {
      if (closed) return;
      closed = true;
      input.signal?.removeEventListener('abort', abortConnection);
      socket?.destroy();
      pendingReject?.(fail());
    };
    const abortConnection = () => close();
    input.signal?.addEventListener('abort', abortConnection, {once: true});
    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => { clearTimeout(timer); socket?.off('secureConnect', secure); socket?.off('error', error); socket?.off('close', ended); };
        const done = problem => { if (settled) return; settled = true; cleanup(); pendingReject = undefined; problem ? reject(fail()) : resolve(); };
        const error = () => done(fail()), ended = () => done(fail());
        const secure = () => {
          try {
            if (closed || input.signal?.aborted || socket.authorized !== true || socket.authorizationError ||
                socket.remoteAddress !== candidate.privateIPv4Address || socket.remotePort !== PORT || socket.getProtocol() !== 'TLSv1.3' ||
                socket.alpnProtocol && socket.alpnProtocol !== 'http/1.1') throw fail();
            peerExpiresAtMs = assertRunnerPeerCertificate({certificate: socket.getPeerX509Certificate(), taskName: candidate.taskName,
              nowMs: clock(c.now), expiresAtMs: candidate.expiresAtMs});
            done();
          } catch { done(fail()); }
        };
        const timer = setTimeout(error, Math.min(3000, candidate.expiresAtMs - clock(c.now)));
        pendingReject = error;
        try {
          socket = connectImpl({host: candidate.privateIPv4Address, port: PORT, family: 4, servername: candidate.taskName,
            secureContext: c.secureContext, minVersion: 'TLSv1.3', rejectUnauthorized: true, ALPNProtocols: ['http/1.1'],
            checkServerIdentity(hostname, certificate) {
              try {
                if (hostname !== candidate.taskName) throw fail();
                assertRunnerPeerCertificate({certificate: certificate.raw, taskName: candidate.taskName, nowMs: clock(c.now), expiresAtMs: candidate.expiresAtMs});
              } catch { return fail(); }
            }});
          socket.once('secureConnect', secure);
          socket.once('error', error);
          socket.once('close', ended);
          // Own late errors even after the handshake listener has been removed.
          socket.on('error', () => {});
          if (closed || input.signal?.aborted) close();
        } catch { done(fail()); }
      });
      if (closed || input.signal?.aborted) throw fail();
    } catch { close(); throw fail(); }

    return Object.freeze({close, async send(value) {
      if (used || closed) throw fail();
      used = true;
      let sendSignal, request, response, agent, timer, abort;
      try {
        const input = own(value, ['operation', 'body', 'authorization'], ['signal', 'maxResponseBytes']);
        const operation = taskRouterOperation(input.operation), maxBytes = input.maxResponseBytes ?? MAX_BODY;
        sendSignal = nativeSignal(input.signal);
        const expiresAtMs = Math.min(candidate.expiresAtMs, peerExpiresAtMs);
        if (sendSignal?.aborted || clock(c.now) >= expiresAtMs ||
            typeof input.authorization !== 'string' || !/^Bearer [\x21-\x7e]{1,8192}$/u.test(input.authorization) ||
            !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BODY) throw fail();
        const body = Buffer.isBuffer(input.body) ? Buffer.from(input.body) : typeof input.body === 'string' ? Buffer.from(input.body, 'utf8') : null;
        if (!body || body.length > MAX_BODY) throw fail();
        // No body or credential is written before the verified socket reaches here.
        return await new Promise((resolve, reject) => {
          let settled = false;
          const finish = (problem, result) => {
            if (settled) return;
            settled = true;
            pendingReject = undefined;
            clearTimeout(timer);
            sendSignal?.removeEventListener('abort', abort);
            problem ? reject(fail()) : resolve(result);
          };
          abort = () => finish(fail());
          pendingReject = abort;
          sendSignal?.addEventListener('abort', abort, {once: true});
          timer = setTimeout(abort, Math.min(30000, expiresAtMs - clock(c.now)));
          agent = new Agent({keepAlive: false, maxSockets: 1, maxTotalSockets: 1});
          agent.createConnection = () => socket;
          request = httpRequest({hostname: candidate.taskName, port: PORT, method: 'POST', path: '/v1/native-task/' + operation,
            agent, maxHeaderSize: MAX_HEADERS, insecureHTTPParser: false, headers: {
              host: candidate.taskName, authorization: input.authorization, 'content-type': 'application/json',
              'content-length': String(body.length), 'accept-encoding': 'identity', connection: 'close'
            }}, incoming => {
            response = incoming;
            try {
              if (incoming.httpVersion !== '1.1' || incoming.statusCode < 200 || incoming.statusCode >= 600 || incoming.statusCode >= 300 && incoming.statusCode < 400 ||
                  incoming.rawHeaders.length > 128) throw fail();
              const headers = new Map();
              for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
                const name = incoming.rawHeaders[index].toLowerCase(), value = incoming.rawHeaders[index + 1];
                if (headers.has(name)) throw fail();
                headers.set(name, value);
              }
              const length = headers.get('content-length'), transfer = headers.get('transfer-encoding');
              if (headers.has('content-encoding') && headers.get('content-encoding') !== 'identity' ||
                  !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(headers.get('content-type') ?? '') ||
                  length === undefined && transfer !== 'chunked' || length !== undefined && (transfer !== undefined || !/^(0|[1-9][0-9]*)$/u.test(length) || Number(length) > maxBytes)) throw fail();
              let received = 0;
              const chunks = [];
              incoming.on('data', chunk => {
                received += chunk.length;
                if (received > maxBytes) { finish(fail()); incoming.destroy(); return; }
                chunks.push(chunk);
              });
              incoming.once('end', () => {
                try {
                  if (!incoming.complete || incoming.rawTrailers.length || length !== undefined && received !== Number(length) ||
                      clock(c.now) >= expiresAtMs) finish(fail());
                  else finish(null, {status: incoming.statusCode, body: Buffer.concat(chunks, received)});
                } catch { finish(fail()); }
              });
              incoming.once('aborted', abort);
              incoming.once('error', abort);
            } catch { finish(fail()); incoming.destroy(); }
          });
          request.maxHeadersCount = 0;
          request.once('error', abort);
          request.once('upgrade', abort);
          request.once('connect', abort);
          request.once('information', abort);
          if (closed || sendSignal?.aborted) finish(fail());
          else request.end(body);
        });
      } catch { throw fail(); }
      finally {
        clearTimeout(timer);
        sendSignal?.removeEventListener('abort', abort);
        response?.destroy();
        request?.destroy();
        agent?.destroy();
        close();
      }
    }});
  }});
}

export function createRunnerTlsConnector(configuration) {
  return makeConnector(configuration, tlsConnect);
}

/** Explicit trusted test construction; never exposed through request configuration. */
export function createRunnerTlsConnectorForTrustedTesting(configuration, dependencies) {
  const d = own(dependencies, ['connectImpl']);
  if (typeof d.connectImpl !== 'function' || types.isProxy(d.connectImpl)) throw fail();
  return makeConnector(configuration, d.connectImpl);
}
