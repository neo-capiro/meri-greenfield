/**
 * Native PPTX chart-workbook flows for the EXISTING qualification framework
 * (SCRUM-241 / cool#16243).
 *
 * Stage order per case: open -> no-edit Save -> reopen of that saved identity
 * -> unrelated title edit + Save -> intentional chart-data edit + Save ->
 * reopen and re-check of the post-reopen bytes -> canonical Core verify.
 *
 * Corrected versus the first preparation:
 *
 *  - reopen addresses the identity that was already saved. It never re-opens
 *    `/fresh`, which creates a new document from the corpus input and would
 *    silently reset the file; the bytes are hashed before and after reopen and
 *    a change fails the stage.
 *  - the flow takes host and editor adapters, and every origin, identity,
 *    module and output path is an explicit input. There is no default host, so
 *    the retained fixture cannot be reused by accident, and its retained
 *    output/report destinations are never targeted (see isolation-adapter.mjs).
 *  - the intentional edit names the chart slot (slide + ordinal) plus sheet and
 *    cell, and the checker binds the expectation to that slot.
 *  - a missing editor control is NOT RUN; any error after an edit or save has
 *    begun is FAIL; NOT RUN makes the whole run INCOMPLETE with a non-zero exit.
 *  - the canonical `/verify` body is inspected, not just the HTTP status.
 *  - stage results are written after every stage, including on failure.
 *
 * This module does not start CODE, a host or a browser.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ControlUnavailable} from './isolation-adapter.mjs';

const STAGE = {
  OPEN: 'open',
  NOEDIT: 'noedit-save',
  REOPEN_NOEDIT: 'reopen-noedit',
  TITLE: 'title-edit-save',
  DATAEDIT: 'chart-data-edit-save',
  REOPEN_DATAEDIT: 'reopen-dataedit',
  VERIFY: 'core-verify',
};

function aggregate(stages) {
  if (stages.some(stage => stage.outcome === 'FAIL')) return {outcome: 'FAIL', exit: 1};
  if (stages.some(stage => stage.outcome === 'NOT RUN')) return {outcome: 'INCOMPLETE', exit: 3};
  return {outcome: 'COMPLETE', exit: 0};
}

/**
 * @param host   {open, save, reopen, bytes, sequence, verify}
 * @param editor {ready, editTitle, editChartData}
 * @param runCheck (savedPath, expectations) -> {exit, outcome}
 * @param cases  [{slide, ordinal, sheet, cell, value}] intentional edits
 */
export async function runFlows({host, editor, runCheck, outDir, cases = [], evidence = {}}) {
  await mkdir(outDir, {recursive: true});
  const stages = [];

  const persist = async () => {
    await writeFile(join(outDir, 'stages.json'),
      JSON.stringify({stages, evidence: {
        caseId: evidence.caseId ?? null,
        origin: evidence.origin ?? null,
        identity: evidence.identity ?? null,
        adapterEvents: evidence.events ? evidence.events() : undefined,
      }}, null, 2) + '\n');
  };
  const push = async (stage, result) => {
    stages.push({stage, ...result});
    await persist();
    console.log(JSON.stringify({stage, outcome: result.outcome, reason: result.reason}));
    return result;
  };
  const fail = async (stage, error) => push(stage, {
    outcome: 'FAIL', reason: (error && error.message) || String(error),
    errorType: (error && error.name) || 'Error',
  });

  // 1. open
  try {
    await host.open();
    await editor.ready();
    await push(STAGE.OPEN, {outcome: 'OPENED'});
  } catch (error) {
    await fail(STAGE.OPEN, error);
    const summary = aggregate(stages);
    return {stages, ...summary};
  }

  const expectationArgs = () => cases.map(entry =>
    `${entry.slide}#${entry.ordinal}:${entry.sheet}!${entry.cell}=${entry.value}`);

  const check = async (stage, expectations = [], extra = {}) => {
    const bytes = await host.bytes();
    const path = join(outDir, `${evidence.caseId ?? 'case'}-${stage}.pptx`);
    await writeFile(path, bytes);
    const result = runCheck(path, expectations);
    return push(stage, {
      ...extra, path, bytes: bytes.length,
      sha256: evidence.sha256 ? evidence.sha256(bytes) : null,
      check: {exit: result.exit, outcome: result.exit === 0 ? 'PASS' : 'DIFFERENCE'},
      outcome: result.exit === 0 ? 'PASS' : 'FAIL',
      reason: result.exit === 0 ? undefined : 'chart-workbook-fidelity reported DIFFERENCE',
    });
  };

  // 2. no-edit Save
  try {
    await host.save();
    await check(STAGE.NOEDIT);
  } catch (error) {
    await fail(STAGE.NOEDIT, error);
  }

  // 3. reopen the SAME saved identity; the bytes must not change
  try {
    const before = await host.bytes();
    await host.reopen();
    const after = await host.bytes();
    if (!before.equals(after)) {
      throw new Error('reopen changed the document bytes; the host re-seeded instead of reopening');
    }
    await check(STAGE.REOPEN_NOEDIT, [], {reopenedSameBytes: true});
  } catch (error) {
    await fail(STAGE.REOPEN_NOEDIT, error);
  }

  // 4. unrelated title edit
  try {
    await editor.editTitle();
    await host.save();
    await check(STAGE.TITLE);
  } catch (error) {
    if (error instanceof ControlUnavailable) {
      await push(STAGE.TITLE, {outcome: 'NOT RUN', reason: error.message});
    } else {
      await fail(STAGE.TITLE, error);
    }
  }

  // 5. intentional chart-data edit, bound to each case slot
  let dataEditNotRun = false;
  try {
    for (const entry of cases) await editor.editChartData(entry);
    await host.save();
    await check(STAGE.DATAEDIT, expectationArgs());
  } catch (error) {
    if (error instanceof ControlUnavailable) {
      dataEditNotRun = true;
      await push(STAGE.DATAEDIT, {outcome: 'NOT RUN', reason: error.message});
    } else {
      await fail(STAGE.DATAEDIT, error);
    }
  }

  // 6. reopen after the edit and re-check the post-reopen bytes. There is
  //    nothing to reopen for when the edit never happened, so that leg is
  //    NOT RUN as well instead of passing on unedited bytes.
  if (dataEditNotRun) {
    await push(STAGE.REOPEN_DATAEDIT, {outcome: 'NOT RUN',
      reason: 'the intentional chart-data edit was not performed'});
  } else try {
    const before = await host.bytes();
    await host.reopen();
    const after = await host.bytes();
    if (!before.equals(after)) {
      throw new Error('reopen after edit changed the document bytes');
    }
    await check(STAGE.REOPEN_DATAEDIT, expectationArgs(), {reopenedSameBytes: true});
  } catch (error) {
    await fail(STAGE.REOPEN_DATAEDIT, error);
  }

  // 7. canonical Core verification body
  try {
    const {status, body} = await host.verify();
    const problems = [];
    if (status !== 200) problems.push(`status ${status}`);
    if (!body || typeof body !== 'object') problems.push('no canonical verify body');
    for (const key of ['continuousNativeCodeToCore', 'nativeCoreReadExact',
      'exactPublishedBytes', 'parentPreserved', 'replaySameVersion']) {
      if (body && body[key] !== true) problems.push(`${key} is not true`);
    }
    if (body && evidence.caseId && body.id !== evidence.caseId) {
      problems.push(`verify body id ${body.id} is not ${evidence.caseId}`);
    }
    await push(STAGE.VERIFY, problems.length
      ? {outcome: 'FAIL', reason: problems.join('; '), body}
      : {outcome: 'PASS', body});
  } catch (error) {
    await fail(STAGE.VERIFY, error);
  }

  const summary = aggregate(stages);
  await persist();
  return {stages, ...summary};
}

/** Run the offline checker and return its verdict. */
export function createChecker({python = 'python', script, original}) {
  return (savedPath, expectations = []) => {
    const args = [script, '--original', original, '--saved', savedPath,
      '--json', savedPath + '.report.json'];
    for (const entry of expectations) args.push('--expect-edit', entry);
    const result = spawnSync(python, args, {encoding: 'utf8'});
    return {
      exit: result.status ?? 1,
      stdout: (result.stdout || '').trim().split('\n').slice(-1)[0] || '',
      stderr: (result.stderr || '').trim(),
    };
  };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = name => {
    const index = args.indexOf('--' + name);
    return index < 0 ? undefined : args[index + 1];
  };
  const required = ['origin', 'identity', 'original', 'out', 'cases', 'checker'];
  const missing = required.filter(name => !arg(name));
  if (missing.length) {
    console.error('missing explicit inputs: ' + missing.map(name => '--' + name).join(', ')
      + ' (there is no default host, identity or output path)');
    process.exitCode = 2;
    return;
  }
  const {createHttpAdapter, assertIsolatedIdentity, ControlUnavailable: Missing} =
    await import('./isolation-adapter.mjs');
  const {readFile} = await import('node:fs/promises');
  const {createHash} = await import('node:crypto');
  assertIsolatedIdentity(arg('identity'));
  const cases = JSON.parse(await readFile(arg('cases'), 'utf8'));
  const host = await createHttpAdapter({origin: arg('origin'), identity: arg('identity')});
  const noControls = async message => { throw new Missing(message); };
  const editor = arg('editor')
    ? await (await import(arg('editor'))).createEditor({
        origin: arg('origin'), identity: arg('identity'),
        selectors: arg('selectors'), playwright: arg('playwright')})
    : {ready: async () => {}, editTitle: () => noControls('no editor driver configured'),
       editChartData: () => noControls('no editor driver configured')};
  const result = await runFlows({
    host, editor,
    runCheck: createChecker({python: arg('python') || 'python', script: arg('checker'),
      original: arg('original')}),
    outDir: arg('out'),
    cases,
    evidence: {
      caseId: arg('identity'), origin: arg('origin'), identity: arg('identity'),
      sha256: payload => createHash('sha256').update(payload).digest('hex'),
    },
  });
  console.log(JSON.stringify({outcome: result.outcome, exit: result.exit,
    stages: result.stages.map(stage => stage.stage + ':' + stage.outcome)}));
  process.exitCode = result.exit;
}

if (process.argv[1] && process.argv[1].endsWith('native-chart-flows.mjs')) {
  await main();
}
