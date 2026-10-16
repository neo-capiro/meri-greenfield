import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, connect as tlsConnect} from 'node:tls';
import {once} from 'node:events';
import {assertRunnerPeerCertificate, createRunnerTlsConnector, createRunnerTlsConnectorForTrustedTesting} from '../runner-tls-client.mjs';
import {createRunnerTlsCertificateFixture} from './runner-tls-fixture.mjs';

const zone = 'runner.internal', taskId = 'a'.repeat(32), name = taskId + '.' + zone;
const address = '10.42.0.8', authorization = 'Bearer synthetic-task-capability';
const {ca, issueLeaf: leaf} = createRunnerTlsCertificateFixture(test);
const good = leaf('good', 'DNS:' + name), extra = leaf('extra', 'DNS:' + name + ',DNS:extra.' + zone), wildcard = leaf('wildcard', 'DNS:*.' + zone);

function candidate(overrides = {}) {
  return {taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/runner/' + taskId, privateIPv4Address: address, port: 8080,
    checkedAtMs: Date.now(), expiresAtMs: Date.now() + 2 * 86400000, ...overrides};
}
async function fixture(t, {certificate = good, response, tlsOptions = {}, mapAddress = true} = {}) {
  const writes = [], sockets = new Set(), received = Promise.withResolvers();
  const server = createServer({...certificate, minVersion: 'TLSv1.3', ...tlsOptions}, socket => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    let request = Buffer.alloc(0), replied = false;
    socket.on('data', data => {
      writes.push(Buffer.from(data));
      request = Buffer.concat([request, data]);
      const at = request.indexOf('\r\n\r\n');
      if (at < 0 || replied) return;
      const length = Number(/\r\ncontent-length: ([0-9]+)/iu.exec(request.subarray(0, at).toString())?.[1]);
      if (request.length < at + 4 + length) return;
      replied = true;
      received.resolve();
      const reply = response === undefined ? 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}' : response;
      if (reply !== null) socket.end(reply);
    });
  });
  server.on('tlsClientError', () => {});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  const dials = [];
  const connectImpl = options => {
    dials.push(options);
    const socket = tlsConnect({...options, host: '127.0.0.1', port: server.address().port});
    if (mapAddress) {
      // Only this explicit trusted test seam remaps the verified production dial.
      Object.defineProperty(socket, 'remoteAddress', {value: address});
      Object.defineProperty(socket, 'remotePort', {value: 8080});
    }
    return socket;
  };
  const connector = createRunnerTlsConnectorForTrustedTesting({ca, zone}, {connectImpl});
  return {connector, dials, writes, connectImpl, received: received.promise};
}
const send = (connection, overrides = {}) => connection.send({operation: 'inspect', body: '{}', authorization, ...overrides});

test('pure leaf validation requires one exact DNS SAN, present validity, and original expiry', () => {
  const nowMs = Date.now(), expiresAtMs = nowMs + 2 * 86400000;
  const check = (certificate, changes = {}) => assertRunnerPeerCertificate({certificate, taskName: name, nowMs, expiresAtMs, ...changes});
  assert.ok(check(good.cert) > nowMs);
  for (const cert of [extra.cert, wildcard.cert, ca]) assert.throws(() => check(cert));
  assert.throws(() => check(good.cert, {taskName: 'b'.repeat(32) + '.' + zone}));
  assert.throws(() => check(good.cert, {expiresAtMs: nowMs + 3600000}));
  assert.throws(() => check(good.cert, {nowMs: nowMs + 3 * 86400000}));
  assert.throws(() => check(good.cert, {nowMs: nowMs - 3 * 86400000}));
});

test('factory is inert and refuses configuration/destination overrides before dialing', async () => {
  let calls = 0;
  const connector = createRunnerTlsConnectorForTrustedTesting({ca, zone}, {connectImpl() { calls++; throw Error(); }});
  assert.equal(calls, 0);
  for (const change of [{privateIPv4Address: '127.0.0.1'}, {privateIPv4Address: '8.8.8.8'}, {privateIPv4Address: '10.1.2.03'}, {port: 443}, {checkedAtMs: Date.now() + 100000}, {expiresAtMs: 1}, {taskArn: 'arbitrary'}]) {
    await assert.rejects(connector.connect({candidate: candidate(change)}));
  }
  assert.equal(calls, 0);
  assert.throws(() => createRunnerTlsConnector({ca, zone, connectImpl() {}}));
  assert.throws(() => createRunnerTlsConnector({ca, zone, host: 'other'}));
  assert.throws(() => createRunnerTlsConnector({ca, zone: '*.internal'}));
});

test('real TLS verifies configured CA and task SNI before a single exact HTTP request', async t => {
  const x = await fixture(t), connection = await x.connector.connect({candidate: candidate({clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/runner',
    taskDefinitionArn: 'arn:aws:ecs:us-east-1:123456789012:task-definition/runner:1', bindingSha256: 'b'.repeat(64), executionKey: 'c'.repeat(64),
    createdAtMs: Date.now() - 1000, networkInterfaceId: 'eni-12345678', subnetId: 'subnet-12345678', vpcId: 'vpc-12345678', securityGroupIds: ['sg-12345678']})});
  assert.equal(x.writes.length, 0);
  const response = await send(connection);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, Buffer.from('{}'));
  assert.equal(x.dials.length, 1);
  const options = x.dials[0];
  assert.equal(options.host, address); assert.equal(options.port, 8080); assert.equal(options.servername, name);
  assert.equal(options.minVersion, 'TLSv1.3'); assert.equal(options.rejectUnauthorized, true);
  assert.deepEqual(options.ALPNProtocols, ['http/1.1']);
  const request = Buffer.concat(x.writes).toString();
  assert.ok(request.startsWith('POST /v1/native-task/inspect HTTP/1.1\r\n'));
  assert.match(request, new RegExp('host: ' + name.replaceAll('.', '\\.') + '\r\n', 'u'));
  assert.ok(request.includes('authorization: ' + authorization + '\r\n'));
  assert.ok(request.includes('content-length: 2\r\n'));
  await assert.rejects(send(connection));
  connection.close();
});

test('wrong CA, extra SAN, wrong remote socket, old TLS and excessive certificate lifetime release no bearer', async t => {
  // This distinct self-signed CA must not fall back to ambient trust.
  const otherCa = createRunnerTlsCertificateFixture(t).ca;
  const cases = [{certificate: extra}, {mapAddress: false}, {tlsOptions: {minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2'}}, {expires: Date.now() + 3600000}, {otherCa}];
  for (const item of cases) {
    const x = await fixture(t, item);
    const connector = item.otherCa ? createRunnerTlsConnectorForTrustedTesting({ca: item.otherCa, zone}, {connectImpl: x.connectImpl}) : x.connector;
    await assert.rejects(connector.connect({candidate: candidate(item.expires ? {expiresAtMs: item.expires} : {})}));
    assert.equal(x.writes.length, 0);
  }
});

test('strict responses reject redirect, encoding, ambiguous framing, overflows and truncation', async t => {
  const replies = [
    'HTTP/1.1 302 Found\r\nLocation: https://other.invalid/\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}',
    'HTTP/1.0 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}',
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Encoding: gzip\r\nContent-Length: 2\r\n\r\n{}',
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nContent-Length: 2\r\n\r\n{}',
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n',
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 99\r\n\r\n{}',
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n0\r\n\r\n',
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nX-Large: ' + 'a'.repeat(17000) + '\r\n\r\n{}',
    'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{}'
  ];
  for (const response of replies) {
    const x = await fixture(t, {response}), connection = await x.connector.connect({candidate: candidate()});
    await assert.rejects(send(connection, {maxResponseBytes: 2}));
    assert.equal(x.dials.length, 1);
  }
});

test('bounded chunked JSON works; cancellation and invalid input close the one-use connection', async t => {
  const x = await fixture(t, {response: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n'});
  assert.deepEqual((await send(await x.connector.connect({candidate: candidate()}), {maxResponseBytes: 2})).body, Buffer.from('{}'));
  const c = await x.connector.connect({candidate: candidate()});
  await assert.rejects(send(c, {operation: '../other'}));
  await assert.rejects(send(c));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(x.connector.connect({candidate: candidate(), signal: abort.signal}));
  const c2 = await x.connector.connect({candidate: candidate()});
  await assert.rejects(send(c2, {signal: abort.signal}));
  const active = new AbortController(), c3 = await x.connector.connect({candidate: candidate(), signal: active.signal});
  active.abort();
  await assert.rejects(send(c3));
});

test('cancellation during handshake and during a pending response promptly destroys owned sockets', async t => {
  const x = await fixture(t, {response: null});
  const handshake = new AbortController(), connecting = x.connector.connect({candidate: candidate(), signal: handshake.signal});
  handshake.abort();
  await assert.rejects(connecting);
  assert.equal(x.writes.length, 0);
  const connection = await x.connector.connect({candidate: candidate()}), response = new AbortController();
  const pending = send(connection, {signal: response.signal});
  await x.received;
  response.abort();
  await assert.rejects(pending);
  await assert.rejects(send(connection));
});

test('original or leaf expiry between authenticated connect and send releases no bearer', async t => {
  const x = await fixture(t), originalCandidate = candidate();
  let now = Date.now();
  const connector = createRunnerTlsConnectorForTrustedTesting({ca, zone, now: () => now}, {connectImpl: x.connectImpl});
  const leafExpiry = assertRunnerPeerCertificate({certificate: good.cert, taskName: name, nowMs: now, expiresAtMs: originalCandidate.expiresAtMs});
  for (const expiry of [originalCandidate.expiresAtMs, leafExpiry]) {
    now = Date.now();
    const connection = await connector.connect({candidate: originalCandidate});
    now = expiry;
    await assert.rejects(send(connection));
  }
  assert.equal(x.writes.length, 0);
});
