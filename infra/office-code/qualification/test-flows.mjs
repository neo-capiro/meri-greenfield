/**
 * Inert tests for the Office241 flow orchestration and run-root materialization
 * (SCRUM-241). No host, socket, browser or CODE process is started.
 *
 * The flow tests drive the real adapter against a route-accurate in-memory host.
 * The materialization tests use real public harness source text: pass
 * `--public-fixture <code-native dir>` to use the actual published host and
 * fixture modules, otherwise embedded text with the same import/spawn shape is
 * used. Only public `.mjs` text and the public corpus manifest/input are read;
 * retained private TLS/config is never touched, and the copied modules are never
 * executed.
 *
 * Usage: node test-flows.mjs [--scratch <dir>] [--public-fixture <dir>]
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  ControlUnavailable, CORE_BRIDGE_FILE, InputRefused, IsolationRefused,
  adaptCoreBridge, adaptRuntimeImports, createHttpAdapter, createInertHost,
  materializeRunRoot, resolveFixtureLabel,
} from './isolation-adapter.mjs';
import {runFlows, selectCases} from './native-chart-flows.mjs';

const argv = process.argv.slice(2);
const option = name => {
  const index = argv.indexOf('--' + name);
  return index < 0 ? undefined : argv[index + 1];
};
const root = option('scratch') ?? join(tmpdir(), 'office241-flows');
const publicFixture = option('public-fixture');
await mkdir(root, {recursive: true});

const results = [];
const record = (name, ok, detail = '') => {
  results.push({control: name, pass: ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(62)} ${detail}`);
};

const MANIFEST = [
  {id: 'pptx-03', filename: 'pptx-03.pptx', sha256: 'a'.repeat(64)},
  {id: 'pptx-04', filename: 'pptx-04.pptx', sha256: 'b'.repeat(64)},
];
const MANIFEST_IDS = MANIFEST.map(entry => entry.id);
const ORIGINAL = Buffer.from('original-package');
const SAVED = Buffer.from('saved-package-with-workbooks');
const sha = payload => createHash('sha256').update(payload).digest('hex');

const CASES = [{
  id: 'pptx-03',
  charts: [{slide: 'ppt/slides/slide1.xml', ordinal: 0,
    workbookPart: 'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx',
    intentionalEdit: {sheet: 'Sheet1', cell: 'B2', value: '9'}}],
}, {
  id: 'pptx-04',
  charts: [
    {slide: 'ppt/slides/slide1.xml', ordinal: 0,
      workbookPart: 'ppt/embeddings/Microsoft_Excel_Worksheet2.xlsx',
      intentionalEdit: {sheet: 'Sheet1', cell: 'B2', value: '9'}},
    {slide: 'ppt/slides/slide1.xml', ordinal: 1,
      workbookPart: 'ppt/embeddings/Microsoft_Excel_Worksheet3.xlsx',
      intentionalEdit: {sheet: 'Sheet1', cell: 'B2', value: '11'}},
  ],
}];
const entryFor = id => ({...MANIFEST.find(entry => entry.id === id),
  sha256: sha(ORIGINAL)});
const selection = (identity = 'pptx-04') => selectCases({cases: CASES}, identity,
  {manifestEntry: entryFor(identity.replace(/-(renew|restart|revoke|expire|lostack)$/, '')),
    originalSha256: sha(ORIGINAL), originalName: `${identity.replace(/-(renew|restart|revoke|expire|lostack)$/, '')}.pptx`});

const goodVerify = ({label, entry}) => ({
  id: label, bytes: entry.bytes.length, sha256: sha(entry.bytes), sequence: entry.sequence,
  continuousNativeCodeToCore: true, nativeCoreReadExact: true, exactPublishedBytes: true,
  parentPreserved: true, replaySameVersion: true,
});

function harness({label = 'pptx-04', verify, preflight, editTitle, editChartData} = {}) {
  const host = createInertHost({manifestIds: MANIFEST_IDS,
    documents: {'pptx-03': ORIGINAL, 'pptx-04': ORIGINAL}, verifyBody: verify ?? goodVerify});
  const events = [];
  const driver = {
    async ready() { events.push('ready'); },
    async navigate(path) {
      events.push(`navigate ${path}`);
      const response = await host.fetchImpl(`https://inert.invalid${path}`);
      if (!response.ok) throw new Error(`navigate ${path} failed: ${response.status}`);
    },
    async save() { events.push('save'); host.save(label, SAVED); },
    async preflight() {
      events.push('preflight');
      if (preflight) return preflight();
      return {title: true, chartData: true};
    },
    async editTitle() {
      events.push('editTitle');
      if (editTitle) return editTitle();
    },
    async editChartData(spec) {
      events.push(`editChartData ${spec.ordinal}`);
      if (editChartData) return editChartData(spec);
    },
  };
  return {host, driver, events};
}

async function run(options = {}) {
  const label = options.label ?? 'pptx-04';
  const {host, driver, events} = harness({...options, label});
  const adapter = await createHttpAdapter({
    origin: 'https://inert.invalid', identity: label, editor: driver,
    manifestIds: MANIFEST_IDS, fetchImpl: host.fetchImpl,
  });
  const result = await runFlows({host: adapter, editor: driver,
    runCheck: options.runCheck ?? (() => ({exit: 0})),
    outDir: options.outDir ?? join(root, `run-${results.length}`),
    cases: selection(label).edits, identity: label});
  return {result, events, host};
}

// ---------------------------------------------------------------- binding
{
  let mismatch = false;
  try {
    selectCases({cases: CASES}, 'pptx-04',
      {manifestEntry: entryFor('pptx-03'), originalSha256: sha(ORIGINAL),
        originalName: 'pptx-03.pptx'});
  } catch (error) {
    mismatch = error instanceof InputRefused;
  }
  record('case document is bound to its own manifest entry', mismatch);

  let hashMismatch = false;
  try {
    selectCases({cases: CASES}, 'pptx-04',
      {manifestEntry: entryFor('pptx-04'), originalSha256: 'c'.repeat(64),
        originalName: 'pptx-04.pptx'});
  } catch (error) {
    hashMismatch = error instanceof InputRefused;
  }
  record('original SHA-256 must match the manifest', hashMismatch);

  let nameMismatch = false;
  try {
    selectCases({cases: CASES}, 'pptx-04',
      {manifestEntry: entryFor('pptx-04'), originalSha256: sha(ORIGINAL),
        originalName: 'pptx-03.pptx'});
  } catch (error) {
    nameMismatch = error instanceof InputRefused;
  }
  record('original file name must match the manifest', nameMismatch);

  const bound = selection('pptx-04');
  record('pptx-04 keeps its own slots 9 and 11',
    bound.caseId === 'pptx-04' && bound.edits.length === 2
    && bound.edits[0].value === '9' && bound.edits[1].value === '11',
    bound.edits.map(edit => `${edit.ordinal}:${edit.value}`).join(','));

  const suffixBound = selection('pptx-04-restart');
  record('a supported suffix still binds to the same case',
    suffixBound.caseId === 'pptx-04' && suffixBound.edits.length === 2);

  let mixed = false;
  try {
    await runFlows({host: {}, editor: {}, runCheck: () => ({exit: 0}),
      outDir: join(root, 'mixed'),
      cases: [...selection('pptx-03').edits, ...selection('pptx-04').edits],
      identity: 'pptx-04'});
  } catch (error) {
    mixed = error instanceof InputRefused;
  }
  record('mixed case edits are refused in one invocation', mixed);
}

// ---------------------------------------------------------------- orchestration
{
  const {result, events} = await run();
  record('pptx-04 invocation is COMPLETE', result.outcome === 'COMPLETE',
    `${result.outcome}/${result.exit}`);
  record('preflight runs before any edit control',
    events.indexOf('preflight') < events.indexOf('editTitle'), events.join(','));
  record('/fresh is used once, reopen renews and qualifies',
    events.filter(event => event === 'navigate /fresh/pptx-04').length === 1
    && events.filter(event => event === 'navigate /qualify/pptx-04').length === 2,
    `fresh=${events.filter(event => event.startsWith('navigate /fresh')).length}`);
  record('both reopens record byte and sequence stability',
    result.stages.filter(stage => stage.reopenedSameBytes === true).length === 2
    && result.stages.filter(stage => stage.reopenedSameSequence === true).length === 2);
}

// second reopen advancing the sequence must fail
{
  const label = 'pptx-04';
  const host = createInertHost({manifestIds: MANIFEST_IDS,
    documents: {'pptx-04': ORIGINAL}, verifyBody: goodVerify});
  let reopens = 0;
  const driver = {async ready() {}, async preflight() { return {title: true, chartData: true}; },
    async navigate(path) {
      const response = await host.fetchImpl(`https://inert.invalid${path}`);
      if (!response.ok) throw new Error(`navigate ${path} failed: ${response.status}`);
    },
    async save() { host.save(label, SAVED); }, async editTitle() {},
    async editChartData() {}};
  const base = await createHttpAdapter({
    origin: 'https://inert.invalid', identity: label, editor: driver,
    manifestIds: MANIFEST_IDS, fetchImpl: host.fetchImpl,
  });
  const adapter = {...base, async reopen() {
    reopens += 1;
    if (reopens === 2) host.state.get(label).sequence += 1;
    await base.reopen();
  }};
  const result = await runFlows({host: adapter, editor: driver, runCheck: () => ({exit: 0}),
    outDir: join(root, 'second-reopen-sequence'), cases: selection(label).edits,
    identity: label});
  const stage = result.stages.find(entry => entry.stage === 'reopen-dataedit');
  record('second reopen must keep the sequence too',
    stage.outcome === 'FAIL' && /sequence/.test(stage.reason) && result.outcome === 'FAIL',
    stage.reason);
}

// preflight unavailable -> NOT RUN, incomplete, non-zero
{
  const {result} = await run({preflight: () => {
    throw new ControlUnavailable('chart data table not exposed');
  }});
  const title = result.stages.find(entry => entry.stage === 'title-edit-save');
  const data = result.stages.find(entry => entry.stage === 'chart-data-edit-save');
  record('unavailable preflight is NOT RUN and never invoked',
    title.outcome === 'NOT RUN' && data.outcome === 'NOT RUN',
    `${title.outcome}/${data.outcome}`);
  record('NOT RUN makes the run INCOMPLETE and non-zero',
    result.outcome === 'INCOMPLETE' && result.exit === 3, `${result.outcome}/${result.exit}`);
}

// a partially applied title edit that then loses its control is FAIL
{
  const outDir = join(root, 'partial-title');
  const {result, events} = await run({outDir, editTitle: () => {
    throw new ControlUnavailable('control lost after partial edit');
  }});
  const stage = result.stages.find(entry => entry.stage === 'title-edit-save');
  record('partial title edit then control loss is FAIL',
    stage.outcome === 'FAIL' && result.outcome === 'FAIL'
    && events.includes('editTitle'), `${stage.outcome}: ${stage.reason}`);
  record('partial stage evidence is preserved',
    JSON.parse(await readFile(join(outDir, 'stages.json'), 'utf8'))
      .stages.some(entry => entry.stage === 'title-edit-save' && entry.outcome === 'FAIL'));
}

// a partially applied first chart edit that then loses its control is FAIL
{
  let calls = 0;
  const {result} = await run({editChartData: () => {
    calls += 1;
    if (calls === 1) throw new ControlUnavailable('chart 1 control lost mid-edit');
  }});
  const stage = result.stages.find(entry => entry.stage === 'chart-data-edit-save');
  record('partial first chart edit then control loss is FAIL',
    stage.outcome === 'FAIL' && result.outcome === 'FAIL', stage.reason);
}

// verify correlation
for (const [name, mutate] of [
  ['verify sha256 must match the artifact', body => ({...body, sha256: 'd'.repeat(64)})],
  ['verify sequence must match the host state', body => ({...body, sequence: body.sequence + 3})],
  ['verify byte length must match the artifact', body => ({...body, bytes: 1})],
  ['verify identity must match', body => ({...body, id: 'pptx-03'})],
  ['verify body must be present', () => null],
]) {
  const {result} = await run({verify: ({label, entry}) => mutate(goodVerify({label, entry}))});
  const stage = result.stages.find(entry => entry.stage === 'core-verify');
  record(name, stage.outcome === 'FAIL' && result.outcome === 'FAIL', stage.reason);
}

// Save that does not advance the host sequence
{
  const host = createInertHost({manifestIds: MANIFEST_IDS,
    documents: {'pptx-04': ORIGINAL}, verifyBody: goodVerify});
  const driver = {async ready() {}, async preflight() { return {title: true, chartData: true}; },
    async navigate() {}, async save() {}, async editTitle() {}, async editChartData() {}};
  const adapter = await createHttpAdapter({origin: 'https://inert.invalid',
    identity: 'pptx-04', editor: driver, manifestIds: MANIFEST_IDS, fetchImpl: host.fetchImpl});
  const result = await runFlows({host: adapter, editor: driver, runCheck: () => ({exit: 0}),
    outDir: join(root, 'no-sequence'), cases: selection('pptx-04').edits, identity: 'pptx-04'});
  const stage = result.stages.find(entry => entry.stage === 'noedit-save');
  record('Save that does not advance the sequence fails', stage.outcome === 'FAIL', stage.reason);
}

// ---------------------------------------------------------------- materialization
async function fixture(rootDir, {traversal = false} = {}) {
  const inputs = join(rootDir, 'corpus', 'inputs');
  await mkdir(inputs, {recursive: true});
  const seed = Buffer.from('public corpus input');
  const filename = traversal ? '../escape.pptx' : 'pptx-04.pptx';
  await writeFile(join(inputs, 'pptx-04.pptx'), seed);
  const manifest = [{id: 'pptx-04', format: 'pptx', filename, sha256: sha(seed)}];
  await writeFile(join(rootDir, 'corpus', 'manifest.json'), JSON.stringify(manifest));

  const source = {};
  if (publicFixture) {
    for (const name of ['host-font-corpus.mjs', 'qualification-fixture.mjs',
      'qualification-pg-fixture.mjs', CORE_BRIDGE_FILE]) {
      source[name] = await readFile(join(publicFixture, name), 'utf8');
    }
  } else {
    source['host-font-corpus.mjs'] = [
      "import {wopiFixture} from './qualification-fixture.mjs';",
      "await import('./core-native-port.mjs');",
      "const root = new URL('./', import.meta.url);", ''].join('\n');
    source['qualification-fixture.mjs'] =
      "import {x} from 'file:///mnt/c/Users/retained/fi/work/wave6-capabilities-runtime/apps/a.mjs';\n";
    source['qualification-pg-fixture.mjs'] =
      "import {coreNativeCall} from './core-native-port.mjs';\n"
      + "import {x} from 'file:///mnt/c/Users/retained/fi/work/wave6-capabilities-runtime/apps/a.mjs';\n";
    source[CORE_BRIDGE_FILE] = [
      "import {spawn} from 'node:child_process';",
      "const child=spawn(process.platform==='win32'?process.execPath:'/mnt/c/Program Files/nodejs/node.exe',['C:/retained/core-native.cjs'],{stdio:['pipe','pipe','pipe']});",
      'export const child$ = child;', ''].join('\n');
  }
  for (const [name, text] of Object.entries(source)) {
    await writeFile(join(rootDir, name), text);
  }
  // Operator runtime stub mirroring every absolute import suffix.
  const runtime = join(rootDir, '..', `${rootDir.split(/[\\/]/).pop()}-runtime`);
  const suffixes = new Set();
  for (const text of [source['qualification-fixture.mjs'], source['qualification-pg-fixture.mjs']]) {
    for (const match of text.matchAll(/wave6-capabilities-runtime\/([^'"]+)/g)) suffixes.add(match[1]);
  }
  for (const suffix of suffixes) {
    const path = join(runtime, ...suffix.split('/'));
    await mkdir(join(path, '..'), {recursive: true});
    await writeFile(path, 'export const stub = true;\n');
  }
  const pki = join(rootDir, '..', `${rootDir.split(/[\\/]/).pop()}-pki`);
  await mkdir(pki, {recursive: true});
  await writeFile(join(pki, 'cert.pem'), 'fresh certificate\n');
  await writeFile(join(pki, 'key.pem'), 'fresh key\n');
  const bridgeDir = join(rootDir, '..', `${rootDir.split(/[\\/]/).pop()}-bridge`);
  await mkdir(bridgeDir, {recursive: true});
  await writeFile(join(bridgeDir, 'bridge.cjs'), '// isolated bridge stub\n');
  await writeFile(join(rootDir, 'cert.pem'), 'retained certificate\n');
  await writeFile(join(rootDir, 'key.pem'), 'retained key\n');
  return {manifest, runtime, pki, seed, bridge: join(bridgeDir, 'bridge.cjs')};
}

{
  const fixtureRoot = join(root, 'fixture');
  const setup = await fixture(fixtureRoot);
  const runRoot = join(root, 'run-root');
  const recordFile = await materializeRunRoot({fixtureRoot, runRoot, corpusIds: ['pptx-04'],
    runtimeRoot: setup.runtime,
    coreBridge: {script: setup.bridge, nodeExecutable: process.execPath},
    operatorPki: {certPath: join(setup.pki, 'cert.pem'),
      keyPath: join(setup.pki, 'key.pem')}});

  const fixtureCopy = await readFile(join(runRoot, 'qualification-fixture.mjs'), 'utf8');
  const bridgeCopy = await readFile(join(runRoot, CORE_BRIDGE_FILE), 'utf8');
  record('copied fixtures no longer import the retained runtime',
    !fixtureCopy.includes('wave6-capabilities-runtime'), fixtureCopy.trim().slice(0, 70));
  record('copied fixtures import the operator runtime',
    fixtureCopy.includes(setup.runtime.replace(/\\/g, '/')), recordFile.runtime.url);
  const bridgeLiteral = JSON.stringify(setup.bridge).slice(1, -1);
  record('copied bridge spawns the operator bridge, not the retained one',
    bridgeCopy.includes(bridgeLiteral)
    && !bridgeCopy.includes('C:/retained/core-native.cjs'),
    bridgeLiteral.slice(0, 48));
  record('run root records runtime, bridge and adaptations',
    recordFile.runtime.root.endsWith('fixture-runtime')
    && recordFile.bridge.script === setup.bridge
    && recordFile.adaptations.some(item => item.file === CORE_BRIDGE_FILE));
  record('declared outputs match the host-relative layout',
    recordFile.outputs.saved === join(runRoot, 'font-corpus', 'saved'),
    recordFile.outputs.saved);
  record('operator PKI replaces retained TLS',
    (await readFile(join(runRoot, 'cert.pem'), 'utf8')) === 'fresh certificate\n');
  record('corpus input copied with its manifest hash',
    sha(await readFile(join(runRoot, 'corpus', 'inputs', 'pptx-04.pptx'))) === sha(setup.seed));
}

// refusals, all before writes
{
  const cases = [
    ['missing runtime source', async (fixtureRoot, setup, runRoot) =>
      materializeRunRoot({fixtureRoot, runRoot, corpusIds: ['pptx-04'],
        coreBridge: {script: setup.bridge},
        operatorPki: {certPath: join(setup.pki, 'cert.pem'), keyPath: join(setup.pki, 'key.pem')}}),
      IsolationRefused],
    ['missing isolated bridge', async (fixtureRoot, setup, runRoot) =>
      materializeRunRoot({fixtureRoot, runRoot, corpusIds: ['pptx-04'],
        runtimeRoot: setup.runtime,
        operatorPki: {certPath: join(setup.pki, 'cert.pem'), keyPath: join(setup.pki, 'key.pem')}}),
      IsolationRefused],
    ['run root inside the fixture', async (fixtureRoot, setup) =>
      materializeRunRoot({fixtureRoot, runRoot: join(fixtureRoot, 'inside'),
        corpusIds: ['pptx-04'], runtimeRoot: setup.runtime,
        coreBridge: {script: setup.bridge},
        operatorPki: {certPath: join(setup.pki, 'cert.pem'), keyPath: join(setup.pki, 'key.pem')}}),
      IsolationRefused],
    ['retained PKI is refused', async (fixtureRoot, setup, runRoot) =>
      materializeRunRoot({fixtureRoot, runRoot, corpusIds: ['pptx-04'],
        runtimeRoot: setup.runtime, coreBridge: {script: setup.bridge},
        operatorPki: {certPath: join(fixtureRoot, 'cert.pem'),
          keyPath: join(fixtureRoot, 'key.pem')}}),
      IsolationRefused],
    ['bridge inside the run root is refused', async (fixtureRoot, setup, runRoot) =>
      materializeRunRoot({fixtureRoot, runRoot, corpusIds: ['pptx-04'],
        runtimeRoot: setup.runtime,
        coreBridge: {script: join(runRoot, 'bridge.cjs')},
        operatorPki: {certPath: join(setup.pki, 'cert.pem'), keyPath: join(setup.pki, 'key.pem')}}),
      IsolationRefused],
    ['empty corpus selection is refused', async (fixtureRoot, setup, runRoot) =>
      materializeRunRoot({fixtureRoot, runRoot, corpusIds: [],
        runtimeRoot: setup.runtime, coreBridge: {script: setup.bridge},
        operatorPki: {certPath: join(setup.pki, 'cert.pem'), keyPath: join(setup.pki, 'key.pem')}}),
      InputRefused],
  ];
  for (const [name, call, expected] of cases) {
    const fixtureRoot = join(root, `refuse-${name.replace(/\W+/g, '-')}`);
    const setup = await fixture(fixtureRoot);
    const runRoot = join(root, `refuse-${name.replace(/\W+/g, '-')}-root`);
    let refused = false;
    try {
      await call(fixtureRoot, setup, runRoot);
    } catch (error) {
      refused = error instanceof expected;
    }
    let created = true;
    try {
      await readFile(join(runRoot, 'run-root.json'));
    } catch {
      created = false;
    }
    record(name, refused && !created, 'no run root written');
  }

  // traversal in the manifest file name
  const traversalRoot = join(root, 'fixture-traversal');
  const setup = await fixture(traversalRoot, {traversal: true});
  await writeFile(join(traversalRoot, 'corpus', 'manifest.json'),
    JSON.stringify([{id: 'pptx-04', format: 'pptx', filename: '../escape.pptx',
      sha256: sha(setup.seed)}]));
  let traversalRefused = false;
  try {
    await materializeRunRoot({fixtureRoot: traversalRoot, runRoot: join(root, 'traversal-root'),
      corpusIds: ['pptx-04'], runtimeRoot: setup.runtime,
      coreBridge: {script: setup.bridge},
      operatorPki: {certPath: join(setup.pki, 'cert.pem'), keyPath: join(setup.pki, 'key.pem')}});
  } catch (error) {
    traversalRefused = error instanceof IsolationRefused;
  }
  record('manifest path traversal is refused', traversalRefused);

  // manifest hash mismatch
  const mismatchRoot = join(root, 'fixture-hash');
  const mismatch = await fixture(mismatchRoot);
  await writeFile(join(mismatchRoot, 'corpus', 'manifest.json'),
    JSON.stringify([{id: 'pptx-04', format: 'pptx', filename: 'pptx-04.pptx',
      sha256: 'e'.repeat(64)}]));
  let hashRefused = false;
  try {
    await materializeRunRoot({fixtureRoot: mismatchRoot, runRoot: join(root, 'hash-root'),
      corpusIds: ['pptx-04'], runtimeRoot: mismatch.runtime,
      coreBridge: {script: mismatch.bridge},
      operatorPki: {certPath: join(mismatch.pki, 'cert.pem'),
        keyPath: join(mismatch.pki, 'key.pem')}});
  } catch (error) {
    hashRefused = error instanceof IsolationRefused;
  }
  record('manifest hash mismatch is refused', hashRefused);

  // missing runtime module for an absolute import
  const partialRoot = join(root, 'fixture-partial-runtime');
  const partial = await fixture(partialRoot);
  const emptyRuntime = join(root, 'empty-runtime');
  await mkdir(emptyRuntime, {recursive: true});
  let missingImport = false;
  try {
    await materializeRunRoot({fixtureRoot: partialRoot, runRoot: join(root, 'partial-root'),
      corpusIds: ['pptx-04'], runtimeRoot: emptyRuntime,
      coreBridge: {script: partial.bridge},
      operatorPki: {certPath: join(partial.pki, 'cert.pem'),
        keyPath: join(partial.pki, 'key.pem')}});
  } catch (error) {
    missingImport = error instanceof IsolationRefused;
  }
  record('missing operator runtime module is refused', missingImport);
}

// adaptation helpers are pure and inspectable
{
  const adapted = adaptRuntimeImports("import x from 'file:///mnt/c/a/wave6-capabilities-runtime/apps/a.mjs';",
    'C:/operator/runtime');
  record('runtime import adaptation is a path-only rewrite',
    adapted.count === 1 && adapted.adapted.includes('file:///C:/operator/runtime/apps/a.mjs'),
    adapted.adapted.trim());
  const bridge = adaptCoreBridge(
    "const c=spawn(process.execPath,['C:/retained/core-native.cjs'],{stdio:'pipe'});",
    {script: 'C:/bridge/core.cjs', nodeExecutable: 'C:/node/node.exe'});
  record('bridge adaptation is a path-only rewrite',
    bridge.adapted.includes('C:/bridge/core.cjs') && bridge.adapted.includes('{stdio:'),
    bridge.adapted.trim());
  record('routable labels are manifest ids with supported suffixes',
    resolveFixtureLabel('pptx-04-restart', MANIFEST_IDS).baseId === 'pptx-04');
}

const failed = results.filter(result => !result.pass);
console.log(`\n${results.length} flow controls, ${failed.length} failed`);
if (failed.length) {
  for (const result of failed) console.log(`  FAILED: ${result.control} ${result.detail}`);
  process.exitCode = 1;
}
