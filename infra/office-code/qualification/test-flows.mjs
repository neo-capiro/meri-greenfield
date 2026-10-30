/**
 * Inert tests for the Office241 native flow and its adapter (SCRUM-241).
 *
 * The adapter is exercised against a route-accurate in-memory host that serves
 * the same paths as the retained public host (/fresh, /qualify, /renew, /state,
 * /saved, /verify), so the request contract, the save-sequence observation and
 * the verify correlation are tested without a socket, browser or CODE.
 *
 * Usage: node test-flows.mjs [--scratch <dir>]
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  ControlUnavailable, InputRefused, IsolationRefused, createHttpAdapter,
  createInertHost, materializeRunRoot, parseFixtureLabel, resolveFixtureLabel,
} from './isolation-adapter.mjs';
import {runFlows, selectCases} from './native-chart-flows.mjs';

const args = process.argv.slice(2);
const scratchIndex = args.indexOf('--scratch');
const root = scratchIndex >= 0 ? args[scratchIndex + 1]
  : join(tmpdir(), 'office241-flows');
await mkdir(root, {recursive: true});

const results = [];
const record = (name, ok, detail = '') => {
  results.push({control: name, pass: ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(60)} ${detail}`);
};

const MANIFEST = ['pptx-03', 'pptx-04'];
const ORIGINAL = Buffer.from('original-package');
const SAVED = Buffer.from('saved-package-with-workbooks');
const EDITED = Buffer.from('saved-package-after-chart-data-edit');
const sha = payload => createHash('sha256').update(payload).digest('hex');

const goodVerify = ({label, entry}) => ({
  id: label, bytes: entry.bytes.length, sha256: sha(entry.bytes),
  sequence: entry.sequence, continuousNativeCodeToCore: true,
  nativeCoreReadExact: true, exactPublishedBytes: true, parentReserved: false,
  parentPreserved: true, replaySameVersion: true,
});

const CASES = [{
  id: 'pptx-04',
  charts: [
    {slide: 'ppt/slides/slide1.xml', ordinal: 0,
      workbookPart: 'ppt/embeddings/Microsoft_Excel_Worksheet2.xlsx',
      intentionalEdit: {sheet: 'Sheet1', cell: 'B2', value: '9'}},
    {slide: 'ppt/slides/slide1.xml', ordinal: 1,
      workbookPart: 'ppt/embeddings/Microsoft_Excel_Worksheet3.xlsx',
      intentionalEdit: {sheet: 'Sheet1', cell: 'B2', value: '11'}},
  ],
}, {
  id: 'pptx-03',
  charts: [{slide: 'ppt/slides/slide1.xml', ordinal: 0,
    workbookPart: 'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx',
    intentionalEdit: {sheet: 'Sheet1', cell: 'B2', value: '9'}}],
}];

function harness({label = 'pptx-04', verify, editor = {}, hostOptions = {}} = {}) {
  const host = createInertHost({
    manifestIds: MANIFEST,
    documents: {'pptx-03': ORIGINAL, 'pptx-04': ORIGINAL},
    verifyBody: verify ?? goodVerify,
    ...hostOptions,
  });
  const events = [];
  const driver = {
    async ready() { events.push('ready'); },
    async navigate(path) {
      // The real driver navigates the browser; here the inert host serves it.
      events.push(`navigate ${path}`);
      const response = await host.fetchImpl(`https://inert.invalid${path}`);
      if (!response.ok) throw new Error(`navigate ${path} failed: ${response.status}`);
    },
    async save() {
      events.push('editor.save');
      host.save(label, SAVED);
    },
    async editTitle() {
      events.push('editTitle');
      if (editor.editTitle) return editor.editTitle();
    },
    async editChartData(spec) {
      events.push(`editChartData ${spec.ordinal}`);
      if (editor.editChartData) return editor.editChartData(spec);
    },
  };
  return {host, driver, events};
}

const checkByExpectation = () => ({exit: 0});

// 1. route contract and save-sequence observation
{
  const {host, driver, events} = harness();
  const adapter = await createHttpAdapter({
    origin: 'https://inert.invalid', identity: 'pptx-04', editor: driver,
    manifestIds: MANIFEST, fetchImpl: host.fetchImpl,
  });
  await adapter.open();
  const {sequence} = await adapter.save();
  await adapter.reopen();
  await adapter.bytes();
  await adapter.verify();
  const paths = host.requests.map(request => `${request.method} ${request.path}`);
  record('open uses /fresh for the initial document',
    events[0] === 'navigate /fresh/pptx-04', events[0]);
  record('save observes the advanced host sequence', sequence === 1, `sequence=${sequence}`);
  const freshNavigations = events.filter(event => event === 'navigate /fresh/pptx-04');
  record('reopen renews then qualifies and adds no second /fresh',
    paths.includes('POST /renew/pptx-04')
    && events.includes('navigate /qualify/pptx-04')
    && freshNavigations.length === 1,
    `renew=${paths.includes('POST /renew/pptx-04')} fresh=${freshNavigations.length}`);
  record('verify uses POST /verify on the same label',
    paths.includes('POST /verify/pptx-04'));
}

// 2. happy path
{
  const {host, driver} = harness();
  const adapter = await createHttpAdapter({
    origin: 'https://inert.invalid', identity: 'pptx-04', editor: driver,
    manifestIds: MANIFEST, fetchImpl: host.fetchImpl,
  });
  const run = await runFlows({host: adapter, editor: driver,
    runCheck: checkByExpectation, outDir: join(root, 'happy'),
    cases: selectCases({cases: CASES}, ['pptx-04']), identity: 'pptx-04'});
  record('happy path is COMPLETE', run.outcome === 'COMPLETE', `${run.outcome}/${run.exit}`);
  record('all seven stages recorded', run.stages.length === 7,
    `${run.stages.length} stages`);
  record('stages.json persisted',
    JSON.parse(await readFile(join(root, 'happy', 'stages.json'), 'utf8')).stages.length === 7);
}

// 3. verify correlation: truthy booleans alone are not enough
for (const [name, mutate, expect] of [
  ['verify sha256 differs from the artifact',
    body => ({...body, sha256: 'a'.repeat(64)}), 'FAIL'],
  ['verify sequence differs from the host state',
    body => ({...body, sequence: body.sequence + 5}), 'FAIL'],
  ['verify bytes differ from the artifact', body => ({...body, bytes: 1}), 'FAIL'],
  ['verify reports another identity', body => ({...body, id: 'pptx-03'}), 'FAIL'],
  ['verify omits the canonical body', () => null, 'FAIL'],
]) {
  const {host, driver} = harness({verify: ({label, entry}) =>
    mutate(goodVerify({label, entry}))});
  const adapter = await createHttpAdapter({
    origin: 'https://inert.invalid', identity: 'pptx-04', editor: driver,
    manifestIds: MANIFEST, fetchImpl: host.fetchImpl,
  });
  const run = await runFlows({host: adapter, editor: driver,
    runCheck: checkByExpectation, outDir: join(root, `verify-${expect}-${results.length}`),
    cases: selectCases({cases: CASES}, ['pptx-04']), identity: 'pptx-04'});
  const stage = run.stages.find(entry => entry.stage === 'core-verify');
  record(name, run.outcome === expect && stage.outcome === 'FAIL', stage.reason);
}

// 4. selection schema and non-empty requirement
{
  let emptyRefused = false;
  try {
    selectCases({cases: CASES}, []);
  } catch (error) {
    emptyRefused = error instanceof InputRefused;
  }
  record('empty case selection is refused', emptyRefused);

  let unknownRefused = false;
  try {
    selectCases({cases: CASES}, ['pptx-99']);
  } catch (error) {
    unknownRefused = error instanceof InputRefused;
  }
  record('unknown case id is refused', unknownRefused);

  const selected = selectCases({cases: CASES}, ['pptx-04']);
  record('cases.json maps to per-chart edits 9 and 11',
    selected.length === 2 && selected[0].value === '9' && selected[1].value === '11',
    selected.map(entry => `${entry.ordinal}:${entry.value}`).join(','));

  let noCases = false;
  try {
    await runFlows({host: {}, editor: {}, runCheck: () => ({exit: 0}),
      outDir: join(root, 'empty'), cases: [], identity: 'pptx-04'});
  } catch (error) {
    noCases = error instanceof InputRefused;
  }
  record('runFlows refuses an empty case list', noCases);
}

// 5. availability semantics
{
  const {host, driver} = harness({editor: {
    editChartData: () => { throw new ControlUnavailable('no chart data table'); }}});
  const adapter = await createHttpAdapter({
    origin: 'https://inert.invalid', identity: 'pptx-04', editor: driver,
    manifestIds: MANIFEST, fetchImpl: host.fetchImpl,
  });
  const run = await runFlows({host: adapter, editor: driver,
    runCheck: checkByExpectation, outDir: join(root, 'not-run'),
    cases: selectCases({cases: CASES}, ['pptx-04']), identity: 'pptx-04'});
  const dataStage = run.stages.find(entry => entry.stage === 'chart-data-edit-save');
  record('unavailable control is NOT RUN and the run is INCOMPLETE',
    dataStage.outcome === 'NOT RUN' && run.outcome === 'INCOMPLETE' && run.exit === 3,
    `${dataStage.outcome}/${run.outcome}/${run.exit}`);
}

// 5b. the same error after a first edit has started is FAIL
{
  let calls = 0;
  const {host, driver} = harness({editor: {
    editChartData: () => {
      calls += 1;
      if (calls > 1) throw new ControlUnavailable('chart 2 control vanished');
    }}});
  const adapter = await createHttpAdapter({
    origin: 'https://inert.invalid', identity: 'pptx-04', editor: driver,
    manifestIds: MANIFEST, fetchImpl: host.fetchImpl,
  });
  const run = await runFlows({host: adapter, editor: driver,
    runCheck: checkByExpectation, outDir: join(root, 'mid-stage'),
    cases: selectCases({cases: CASES}, ['pptx-04']), identity: 'pptx-04'});
  const dataStage = run.stages.find(entry => entry.stage === 'chart-data-edit-save');
  record('control loss after work started is FAIL',
    dataStage.outcome === 'FAIL' && run.outcome === 'FAIL',
    `${dataStage.outcome}/${run.outcome}`);
}

// 6. a Save that does not advance the host sequence is a failure
{
  const host = createInertHost({manifestIds: MANIFEST,
    documents: {'pptx-04': ORIGINAL}, verifyBody: goodVerify});
  const driver = {async ready() {}, async navigate() {},
    async save() {},
    async editTitle() {}, async editChartData() {}};
  const adapter = await createHttpAdapter({
    origin: 'https://inert.invalid', identity: 'pptx-04', editor: driver,
    manifestIds: MANIFEST, fetchImpl: host.fetchImpl,
  });
  const run = await runFlows({host: adapter, editor: driver,
    runCheck: checkByExpectation, outDir: join(root, 'no-sequence'),
    cases: selectCases({cases: CASES}, ['pptx-04']), identity: 'pptx-04'});
  const stage = run.stages.find(entry => entry.stage === 'noedit-save');
  record('Save that does not advance the sequence fails', stage.outcome === 'FAIL',
    stage.reason);
}

// 7. label routing: manifest ids with supported suffixes are the routable set
{
  record('corpus label with a supported suffix parses',
    JSON.stringify(parseFixtureLabel('pptx-04-restart'))
      === JSON.stringify({baseId: 'pptx-04', suffix: '-restart'}));
  let accepted = true;
  try {
    resolveFixtureLabel('pptx-04-restart', MANIFEST);
  } catch {
    accepted = false;
  }
  record('manifest label with suffix is routable', accepted);

  let refused = false;
  try {
    resolveFixtureLabel('run-241-novel', MANIFEST);
  } catch (error) {
    refused = error instanceof IsolationRefused;
  }
  record('novel label is refused as unroutable', refused);

  let adapterRefused = false;
  try {
    await createHttpAdapter({origin: 'https://x.invalid', identity: 'run-241-novel',
      editor: {navigate: async () => {}, save: async () => {}}, manifestIds: MANIFEST});
  } catch (error) {
    adapterRefused = error instanceof IsolationRefused;
  }
  record('adapter refuses an unroutable identity', adapterRefused);

  let noEditor = false;
  try {
    await createHttpAdapter({origin: 'https://x.invalid', identity: 'pptx-04',
      manifestIds: MANIFEST});
  } catch (error) {
    noEditor = error instanceof IsolationRefused;
  }
  record('adapter requires an editor driver', noEditor);
}

// 8. run-root materialization preserves the real layout and refuses unsafe roots
{
  const fixture = join(root, 'fixture');
  const inputs = join(fixture, 'corpus', 'inputs');
  await mkdir(inputs, {recursive: true});
  const seed = Buffer.from('corpus-input-bytes');
  await writeFile(join(inputs, 'pptx-04.pptx'), seed);
  const manifest = [{id: 'pptx-04', format: 'pptx', filename: 'pptx-04.pptx',
    sha256: sha(seed), bytes: seed.length}];
  await writeFile(join(fixture, 'corpus', 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(fixture, 'host-font-corpus.mjs'), [
    "import {wopiFixture} from './qualification-fixture.mjs';",
    "await import('./core-native-port.mjs');",
    "const root = new URL('./', import.meta.url);",
    '',
  ].join('\n'));
  await writeFile(join(fixture, 'qualification-fixture.mjs'), 'export const wopiFixture = 1;\n');
  await writeFile(join(fixture, 'qualification-pg-fixture.mjs'), 'export const x = 1;\n');
  await writeFile(join(fixture, 'core-native-port.mjs'), 'export const y = 1;\n');
  await writeFile(join(fixture, 'cert.pem'), 'retained certificate\n');
  await writeFile(join(fixture, 'key.pem'), 'retained key\n');
  const pki = join(root, 'operator-pki');
  await mkdir(pki, {recursive: true});
  await writeFile(join(pki, 'cert.pem'), 'fresh certificate\n');
  await writeFile(join(pki, 'key.pem'), 'fresh key\n');

  const runRoot = join(root, 'run-root');
  const recordFile = await materializeRunRoot({fixtureRoot: fixture, runRoot,
    corpusIds: ['pptx-04'],
    operatorPki: {certPath: join(pki, 'cert.pem'), keyPath: join(pki, 'key.pem')}});
  record('materialized host sits at the run root it resolves outputs from',
    recordFile.hostRoot === runRoot.replace(/\\/g, '\\') || recordFile.hostRoot === runRoot,
    recordFile.hostRoot);
  record('declared saved root matches the host-relative path',
    recordFile.outputs.saved === join(runRoot, 'font-corpus', 'saved'),
    recordFile.outputs.saved);
  record('corpus manifest and inputs are copied',
    JSON.parse(await readFile(join(runRoot, 'corpus', 'manifest.json'), 'utf8')).length === 1
    && (await readFile(join(runRoot, 'corpus', 'inputs', 'pptx-04.pptx'), 'utf8'))
      === 'corpus-input-bytes');
  record('operator PKI is used, retained TLS is not copied',
    (await readFile(join(runRoot, 'cert.pem'), 'utf8')) === 'fresh certificate\n');
  record('run-root record lists host imports and hashes',
    recordFile.copied.length >= 2 && recordFile.inputs[0].sha256 === sha(seed));
  record('run root records its own saved directory',
    recordFile.outputs.saved.startsWith(runRoot));

  let overlap = false;
  try {
    await materializeRunRoot({fixtureRoot: fixture, runRoot: join(fixture, 'inside'),
      corpusIds: ['pptx-04'],
      operatorPki: {certPath: join(pki, 'cert.pem'), keyPath: join(pki, 'key.pem')}});
  } catch (error) {
    overlap = error instanceof IsolationRefused;
  }
  record('run root inside the fixture is refused', overlap);

  let retainedPki = false;
  try {
    await materializeRunRoot({fixtureRoot: fixture, runRoot: join(root, 'pki-refused'),
      corpusIds: ['pptx-04'],
      operatorPki: {certPath: join(fixture, 'cert.pem'), keyPath: join(fixture, 'key.pem')}});
  } catch (error) {
    retainedPki = error instanceof IsolationRefused;
  }
  record('retained PKI inside the fixture is refused', retainedPki);

  let reusedRoot = false;
  try {
    await materializeRunRoot({fixtureRoot: fixture, runRoot,
      corpusIds: ['pptx-04'],
      operatorPki: {certPath: join(pki, 'cert.pem'), keyPath: join(pki, 'key.pem')}});
  } catch (error) {
    reusedRoot = error instanceof IsolationRefused;
  }
  record('existing non-empty run root is refused', reusedRoot);

  let emptySelection = false;
  try {
    await materializeRunRoot({fixtureRoot: fixture, runRoot: join(root, 'empty-selection'),
      corpusIds: [], operatorPki: {certPath: join(pki, 'cert.pem'),
        keyPath: join(pki, 'key.pem')}});
  } catch (error) {
    emptySelection = error instanceof InputRefused;
  }
  record('empty corpus selection is refused', emptySelection);
}

const failed = results.filter(result => !result.pass);
console.log(`\n${results.length} flow controls, ${failed.length} failed`);
if (failed.length) {
  for (const result of failed) console.log(`  FAILED: ${result.control} ${result.detail}`);
  process.exitCode = 1;
}
