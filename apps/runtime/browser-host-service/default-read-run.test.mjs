/** The browser-only service's DEFAULT readRun: constructed from the authenticated currentness client and the same
 * pinned placement, with no caller-injected readRun. Inert: no service start, socket, TLS or I/O. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {browserHostServiceReadiness, createBrowserHostServiceEntrypoint} from './entrypoint.mjs';
import {serviceFixture} from './fixture.mjs';
import {createBrowserOnlyReadRun} from './read-run.mjs';

function fullClient(base) {
  return {
    ...base.browserClient,
    async readFacts() { return {facts: {}}; },
    async resolveBrowserWorkflow() { return {workflow: null}; },
    async decideBrowserApproval() { return {permitted: false}; },
    async recordBrowserReceipt() { return {recorded: true}; },
    async recordBrowserDownloadReceipt() { return {recorded: true}; },
    async ingest() { return {versionId: 'synthetic'}; },
  };
}

test('the entrypoint constructs readRun from the currentness client when none is injected', () => {
  const base = serviceFixture().input;
  const {readRun, ...withoutReadRun} = base;
  const inputs = {...withoutReadRun, browserClient: fullClient(base)};
  assert.equal(readRun !== undefined, true);
  assert.equal(typeof createBrowserOnlyReadRun(inputs).readRun,'function');
  const entrypoint = createBrowserHostServiceEntrypoint({inputs});
  assert.equal(entrypoint.ready, true);
  assert.deepEqual(entrypoint.missing, []);
});

test('a client without the closed ingest method yields no readRun and readiness names it', () => {
  const base = serviceFixture().input;
  const {readRun, ...withoutReadRun} = base;
  const client = fullClient(base);
  delete client.ingest;
  const inputs = {...withoutReadRun, browserClient: client};
  assert.throws(() => createBrowserOnlyReadRun(inputs), /BROWSER_HOST_SERVICE_READRUN_UNBOUND/u);
  const readiness = browserHostServiceReadiness({inputs});
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.includes('readRun'));
});

test('readRun construction refuses a client that cannot read canonical facts', () => {
  const base = serviceFixture().input;
  const {readRun, ...withoutReadRun} = base;
  const client = fullClient(base);
  delete client.readFacts;
  assert.throws(() => createBrowserOnlyReadRun({...withoutReadRun, browserClient: client}),
    /BROWSER_HOST_READ_RUN_REFUSED/u);
});
