import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateUIEvent } from '@capiro/meri-contracts/browser';
import { metadata } from '@capiro/meri-contracts/metadata';
import { validateShape } from '@capiro/meri-contracts/node';

const binding = () => ({ tenantId: 'synthetic-a', actorId: 'actor-a', conversationId: randomUUID(), runId: randomUUID(), attemptId: randomUUID(), workerId: randomUUID(), writerFence: 1 });
const scope = () => ({ tenantId: 'synthetic-a', kind: 'tenant', resourceId: 'synthetic-a', policyRevision: 'fixture-1' });
const evidence = () => ({ sourceId: 'fixture', recordId: 'one', sourceVersionId: 'v1', observedAt: '2026-10-10T16:00:00Z', sourceUpdatedAt: null, citationId: randomUUID(), scopes: [scope()], contentSha256: 'a'.repeat(64), authorizationDecisionId: randomUUID() });
function events() {
  const payloads = [
    ['run.status', { state: 'running', reasonCode: null }], ['message.delta', { messageId: randomUUID(), text: 'Synthetic text' }],
    ['tool.started', { requestId: randomUUID(), tool: 'fixture' }], ['tool.completed', { requestId: randomUUID(), resultReference: randomUUID() }],
    ['source.available', evidence()], ['approval.required', { proposalId: randomUUID(), commandSha256: 'b'.repeat(64), expiresAt: '2026-10-10T16:10:00Z' }],
    ['artifact.available', { artifactId: randomUUID(), versionId: randomUUID() }], ['checkpoint.verified', { checkpointId: randomUUID() }],
    ['usage.recorded', { usageId: randomUUID() }], ['run.error', { code: 'fixture', retryable: false, message: 'Synthetic error' }],
  ];
  return payloads.map(([type, data], index) => ({ contractVersion: '0.1.0', eventId: randomUUID(), binding: binding(), sequence: index + 1, createdAt: '2026-10-10T16:00:00Z', scopes: [scope()], type, data }));
}

test('all ten frozen variants agree through deliberate browser and Node exports', () => {
  const fixtures = events();
  assert.deepEqual(fixtures.map(event => event.type), metadata.uiEventVariants);
  for (const event of fixtures) { assert.equal(validateUIEvent(event), true); assert.equal(validateShape('UIEvent', event), event); }
});

test('closed fields, dates, scopes, payloads and safe integer bounds retain strict rejection', () => {
  const mutations = [e => { e.extra = true; }, e => { e.binding.admin = true; }, e => { e.contractVersion = '0.2.0'; },
    e => { e.sequence = 0; }, e => { e.sequence = Number.MAX_SAFE_INTEGER + 1; }, e => { e.createdAt = 'yesterday'; },
    e => { e.scopes = []; }, e => { e.scopes[0].kind = 'admin'; }, e => { e.data = { text: 'wrong variant' }; },
    e => { e.binding.writerFence = '1'; }, e => { delete e.data.reasonCode; }];
  for (const mutate of mutations) {
    const fixture = events()[0]; mutate(fixture);
    assert.equal(validateUIEvent(fixture), false); assert.throws(() => validateShape('UIEvent', fixture));
  }
});

test('structural validation deliberately grants no tenant authorization', () => {
  const fixture = events()[0]; fixture.binding.tenantId = 'synthetic-other';
  assert.equal(validateUIEvent(fixture), true); assert.equal(validateShape('UIEvent', fixture), fixture);
});

test('public metadata binds the exact unchanged schema and cannot mutate its vocabulary', () => {
  const raw = readFileSync(new URL('../meri.schema.json', import.meta.url));
  assert.equal(raw.length, metadata.schemaBytes); assert.equal(createHash('sha256').update(raw).digest('hex'), metadata.schemaSha256);
  assert.equal(metadata.contractVersion, '0.1.0'); assert.equal(Object.isFrozen(metadata), true); assert.equal(Object.isFrozen(metadata.uiEventVariants), true);
  assert.throws(() => metadata.uiEventVariants.push('invented'));
});

test('generated browser ESM evaluates without Node globals, builtins or external imports', () => {
  const script = `import{readFileSync}from'node:fs';import{SourceTextModule,createContext}from'node:vm';
    const source=readFileSync(new URL(${JSON.stringify(new URL('../dist/browser.mjs', import.meta.url).href)}),'utf8');
    const context=createContext({});const module=new SourceTextModule(source,{context});
    await module.link(()=>{throw Error('external import refused')});await module.evaluate({timeout:2000});
    const event=${JSON.stringify(events()[0])};if(!module.namespace.validateUIEvent(event)||module.namespace.validateUIEvent({}))throw Error('browser validation mismatch');`;
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', script], {
    env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, TEMP: process.env.TEMP }, shell: false, timeout: 10000, maxBuffer: 65536, windowsHide: true,
  });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr.toString());
});

test('generator help and invalid arguments exit before generation', () => {
  const script = fileURLToPath(new URL('../generate.mjs', import.meta.url));
  for (const [args, status] of [[['--help'], 0], [['--execute'], 1], [['--check', '--execute'], 1]]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH }, shell: false, timeout: 5000, maxBuffer: 65536, windowsHide: true,
    });
    assert.equal(result.status, status, result.stderr.toString());
    assert.match((status ? result.stderr : result.stdout).toString(), /Usage:/);
  }
});

test('generated distribution check is independent of caller working directory', () => {
  const script = fileURLToPath(new URL('../generate.mjs', import.meta.url));
  for (const cwd of [fileURLToPath(new URL('../', import.meta.url)), fileURLToPath(new URL('../../../', import.meta.url))]) {
    const result = spawnSync(process.execPath, [script, '--check'], { cwd, shell: false, timeout: 15000, maxBuffer: 65536, windowsHide: true });
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr.toString());
  }
});
