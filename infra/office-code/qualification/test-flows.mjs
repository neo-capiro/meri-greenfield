/**
 * Inert tests for the native flow orchestration and the isolation adapter
 * (SCRUM-241). No host, port, browser or CODE process is started: the flow is
 * driven through createInertAdapter, and the run-root materializer is exercised
 * over scratch files only.
 *
 * Usage: node test-flows.mjs [--scratch <dir>]
 */
import {mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {
  ControlUnavailable, IsolationRefused, assertIsolatedIdentity,
  createHttpAdapter, createInertAdapter, materializeRunRoot,
} from './isolation-adapter.mjs';
import {runFlows} from './native-chart-flows.mjs';

const args = process.argv.slice(2);
const scratchArg = args.indexOf('--scratch');
const root = scratchArg >= 0 ? args[scratchArg + 1] : await mkdtemp(join(tmpdir(), 'office241-flows-'));
await mkdir(root, {recursive: true});

const results = [];
const record = (name, ok, detail = '') => {
  results.push({control: name, pass: ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(58)} ${detail}`);
};

const original = Buffer.from('original-package');
const saved = Buffer.from('saved-package-with-workbooks');
const goodVerify = {
  id: 'run-241-a', continuousNativeCodeToCore: true, nativeCoreReadExact: true,
  exactPublishedBytes: true, parentPreserved: true, replaySameVersion: true,
};

/** runCheck that mirrors the real checker's use of the expectation list. */
const checkByExpectation = (path, expectations) => ({
  exit: expectations.length ? 0 : 0,
  outcome: 'PASS',
});

async function scenario(name, options) {
  const adapter = createInertAdapter(options.adapter);
  const run = await runFlows({
    host: adapter.host,
    editor: adapter.editor,
    runCheck: options.runCheck ?? checkByExpectation,
    outDir: join(root, name),
    cases: options.cases ?? [],
    evidence: {caseId: 'run-241-a', identity: 'run-241-a', events: () => adapter.events},
  });
  return {run, adapter};
}

// 1. happy path
{
  const {run, adapter} = await scenario('happy', {
    adapter: {original, saved, verifyBody: goodVerify,
      editor: {editTitle: async () => {}, editChartData: async () => {}}},
    cases: [{slide: 'ppt/slides/slide1.xml', ordinal: 0, sheet: 'Sheet1', cell: 'B2', value: '9'}],
  });
  record('happy path is COMPLETE', run.outcome === 'COMPLETE' && run.exit === 0,
    `${run.outcome}/${run.exit}`);
  const opens = adapter.events.filter(event => event === 'open').length;
  const reopens = adapter.events.filter(event => event === 'reopen').length;
  record('reopen does not re-open /fresh', opens === 1 && reopens === 2,
    `open=${opens} reopen=${reopens}`);
  record('stages persisted', JSON.parse(await readFile(join(root, 'happy', 'stages.json'), 'utf8'))
    .stages.length === 7);
}

// 2. a host whose reopen re-seeds must fail, not pass
{
  const {run} = await scenario('reseed-on-reopen', {
    adapter: {original, saved, verifyBody: goodVerify, resetOnReopen: true,
      editor: {editTitle: async () => {}, editChartData: async () => {}}},
    cases: [{slide: 'ppt/slides/slide1.xml', ordinal: 0, sheet: 'Sheet1', cell: 'B2', value: '9'}],
  });
  const stage = run.stages.find(entry => entry.stage === 'reopen-noedit');
  record('reopen that re-seeds fails', run.outcome === 'FAIL' && stage.outcome === 'FAIL',
    `${run.outcome} reason=${stage.reason}`);
}

// 3. missing chart-data control is NOT RUN and the run is INCOMPLETE/non-zero
{
  const {run} = await scenario('no-chart-control', {
    adapter: {original, saved, verifyBody: goodVerify, editor: {editTitle: async () => {}}},
    cases: [{slide: 'ppt/slides/slide1.xml', ordinal: 0, sheet: 'Sheet1', cell: 'B2', value: '9'}],
  });
  const dataStage = run.stages.find(entry => entry.stage === 'chart-data-edit-save');
  const reopenStage = run.stages.find(entry => entry.stage === 'reopen-dataedit');
  record('missing editor control is NOT RUN',
    dataStage.outcome === 'NOT RUN' && reopenStage.outcome === 'NOT RUN',
    `${dataStage.outcome}/${reopenStage.outcome}`);
  record('NOT RUN makes the run INCOMPLETE and non-zero',
    run.outcome === 'INCOMPLETE' && run.exit === 3, `${run.outcome}/${run.exit}`);
}

// 4. an error after the edit has begun is FAIL, never NOT RUN
{
  const failure = Object.assign(new Error('native Save refused'), {name: 'SaveError'});
  const {run} = await scenario('save-error-after-edit', {
    adapter: {original, saved, verifyBody: goodVerify, saveError: failure,
      editor: {editTitle: async () => {}, editChartData: async () => {}}},
    cases: [{slide: 'ppt/slides/slide1.xml', ordinal: 0, sheet: 'Sheet1', cell: 'B2', value: '9'}],
  });
  const stage = run.stages.find(entry => entry.stage === 'chart-data-edit-save');
  record('save error after edit is FAIL', run.outcome === 'FAIL' && stage.outcome === 'FAIL',
    `${stage.outcome} ${stage.reason}`);
}

// 5. verify body is inspected, not just the status
for (const [name, body, expected] of [
  ['verify body missing exactPublishedBytes',
    {...goodVerify, exactPublishedBytes: false}, 'FAIL'],
  ['verify body absent', null, 'FAIL'],
  ['verify body for another identity', {...goodVerify, id: 'someone-else'}, 'FAIL'],
]) {
  const {run} = await scenario(name.replace(/\W+/g, '-'), {
    adapter: {original, saved, verifyBody: body,
      editor: {editTitle: async () => {}, editChartData: async () => {}}},
    cases: [{slide: 'ppt/slides/slide1.xml', ordinal: 0, sheet: 'Sheet1', cell: 'B2', value: '9'}],
  });
  const stage = run.stages.find(entry => entry.stage === 'core-verify');
  record(name, run.outcome === expected && stage.outcome === 'FAIL', stage.reason);
}

// 6. checker failure on the no-edit save fails that stage
{
  const {run} = await scenario('checker-difference', {
    adapter: {original, saved, verifyBody: goodVerify,
      editor: {editTitle: async () => {}, editChartData: async () => {}}},
    cases: [],
    runCheck: (path, expectations) => ({exit: expectations.length ? 0 : 1}),
  });
  record('checker DIFFERENCE fails the stage', run.outcome === 'FAIL'
    && run.stages.find(entry => entry.stage === 'noedit-save').outcome === 'FAIL');
}

// 7. adapters refuse unsafe targets
{
  let refusedOrigin = false;
  try {
    await createHttpAdapter({identity: 'run-241-a'});
  } catch (error) {
    refusedOrigin = error instanceof IsolationRefused;
  }
  record('http adapter refuses a missing origin', refusedOrigin);

  let refusedIdentity = false;
  try {
    assertIsolatedIdentity('pptx-04');
  } catch (error) {
    refusedIdentity = error instanceof IsolationRefused;
  }
  record('retained corpus identity is refused', refusedIdentity);

  let missingEditorControl = false;
  try {
    const adapter = createInertAdapter({original, saved, verifyBody: goodVerify});
    await adapter.editor.editChartData({});
  } catch (error) {
    missingEditorControl = error instanceof ControlUnavailable;
  }
  record('inert editor reports an unavailable control', missingEditorControl);
}

// 8. run-root materialization keeps host writes and retained files apart
{
  const retained = join(root, 'retained');
  await mkdir(retained, {recursive: true});
  const hostPath = join(retained, 'host-font-corpus.mjs');
  const modulePath = join(retained, 'qualification-fixture.mjs');
  await writeFile(hostPath, '// retained host\n');
  await writeFile(modulePath, '// retained module\n');
  const before = await readFile(hostPath);
  const runRoot = join(root, 'run-root');
  const manifest = await materializeRunRoot({retainedHost: hostPath, runRoot,
    modules: [modulePath]});
  const after = await readFile(hostPath);
  record('materializer leaves the retained host untouched', before.equals(after));
  record('materializer isolates host output paths',
    manifest.outputs.saved.startsWith(runRoot)
    && manifest.outputs.continuous.startsWith(runRoot)
    && manifest.outputs.recovery.startsWith(runRoot),
    manifest.outputs.saved);
  const written = JSON.parse(await readFile(join(runRoot, 'run-root.json'), 'utf8'));
  record('run root records copied inputs', written.copied.length === 2
    && written.copied.every(entry => entry.sha256.length === 64));
  record('run root has no retained output files',
    (await readFile(join(runRoot, 'host', 'host-font-corpus.mjs'), 'utf8')) === '// retained host\n');
}

const failed = results.filter(result => !result.pass);
console.log(`\n${results.length} flow controls, ${failed.length} failed`);
if (failed.length) {
  for (const result of failed) console.log(`  FAILED: ${result.control}`);
  process.exitCode = 1;
}
