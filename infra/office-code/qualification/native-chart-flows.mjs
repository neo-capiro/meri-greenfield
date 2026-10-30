/**
 * Native PPTX chart-workbook flows for the EXISTING qualification framework
 * (SCRUM-241 / cool#16243).
 *
 * Per case: open -> no-edit Save -> reopen of that saved identity -> unrelated
 * title edit + Save -> intentional chart-data edit + Save -> reopen and
 * re-check of the post-reopen bytes -> canonical Core verify.
 *
 * Contract facts this module encodes:
 *
 *  - reopen renews claims and reopens the SAVED identity through `/qualify`.
 *    `/fresh` resets the document, so it is only used for the initial open.
 *  - the host adapter performs editor navigation/save through an injected
 *    editor driver, and save must advance the host's observed sequence.
 *  - the selection must be non-empty and must name manifest identities, which
 *    is what the host can route.
 *  - a missing editor control is NOT RUN only while the stage has not started
 *    work; once an edit or save has begun, any ControlUnavailable or other
 *    error is FAIL.
 *  - verify is correlated against the observed artifact: identity, byte
 *    length, sha256 and sequence, plus the retained boolean evidence.
 *  - stage results are written after every stage, including on failure, and a
 *    NOT RUN makes the run INCOMPLETE with a non-zero exit.
 *
 * This module starts no CODE, host or browser.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ControlUnavailable, InputRefused, resolveFixtureLabel} from './isolation-adapter.mjs';

const STAGE = {
  OPEN: 'open',
  NOEDIT: 'noedit-save',
  REOPEN_NOEDIT: 'reopen-noedit',
  TITLE: 'title-edit-save',
  DATAEDIT: 'chart-data-edit-save',
  REOPEN_DATAEDIT: 'reopen-dataedit',
  VERIFY: 'core-verify',
};

const VERIFY_FLAGS = ['continuousNativeCodeToCore', 'nativeCoreReadExact',
  'exactPublishedBytes', 'parentPreserved', 'replaySameVersion'];

/**
 * Map the committed cases.json schema to the flat edits the flow performs.
 * A case with no intentional edit cannot qualify anything and is refused.
 */
export function selectCases(document, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new InputRefused('a non-empty --case-ids selection is required');
  }
  const cases = Array.isArray(document) ? document : document?.cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new InputRefused('the cases document must contain a non-empty cases array');
  }
  const selected = [];
  for (const id of ids) {
    const entry = cases.find(item => item.id === id);
    if (!entry) throw new InputRefused(`${id} is not in the cases document`);
    const charts = Array.isArray(entry.charts) ? entry.charts : [];
    if (!charts.length) throw new InputRefused(`${id} declares no chart slots`);
    for (const chart of charts) {
      const edit = chart.intentionalEdit;
      if (!edit || !edit.cell) {
        throw new InputRefused(`${id} chart ${chart.ordinal} declares no intentional edit`);
      }
      selected.push({
        id,
        slide: chart.slide,
        ordinal: chart.ordinal,
        sheet: edit.sheet ?? 'Sheet1',
        cell: edit.cell,
        value: String(edit.value),
        expectedWorkbookPart: chart.workbookPart,
      });
    }
  }
  if (!selected.length) throw new InputRefused('the selection produced no chart edits');
  return selected;
}

function aggregate(stages) {
  if (stages.some(stage => stage.outcome === 'FAIL')) return {outcome: 'FAIL', exit: 1};
  if (stages.some(stage => stage.outcome === 'NOT RUN')) return {outcome: 'INCOMPLETE', exit: 3};
  return {outcome: 'COMPLETE', exit: 0};
}

export async function runFlows({host, editor, runCheck, outDir, cases, identity, season = {}}) {
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new InputRefused('runFlows requires at least one case edit');
  }
  await mkdir(outDir, {recursive: true});
  const stages = [];
  let observation = null; // {bytes, sequence} of the last host state read

  const persist = async () => {
    await writeFile(join(outDir, 'stages.json'), JSON.stringify({
      identity: identity ?? host.identity ?? null,
      origin: host.origin ?? null,
      stages,
      evidence: season.evidence ? season.evidence() : undefined,
    }, null, 2) + '\n');
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

  const observe = async () => {
    const bytes = await host.bytes();
    observation = {bytes, sequence: await host.sequence()};
    return observation;
  };

  const expectationArgs = () => cases.map(entry =>
    `${entry.slide}#${entry.ordinal}:${entry.sheet}!${entry.cell}=${entry.value}`);

  const check = async (stage, expectations = [], extra = {}) => {
    const current = await observe();
    const path = join(outDir, `${identity ?? 'case'}-${stage}.pptx`);
    await writeFile(path, current.bytes);
    const result = runCheck(path, expectations);
    return push(stage, {
      ...extra, path, bytes: current.bytes.length,
      sha256: createHash('sha256').update(current.bytes).digest('hex'),
      sequence: current.sequence,
      check: {exit: result.exit, outcome: result.exit === 0 ? 'PASS' : 'DIFFERENCE'},
      outcome: result.exit === 0 ? 'PASS' : 'FAIL',
      reason: result.exit === 0 ? undefined : 'chart-workbook-fidelity reported DIFFERENCE',
    });
  };

  // 1. open: the only stage that may reset through /fresh
  try {
    await host.open();
    await editor.ready?.();
    await push(STAGE.OPEN, {outcome: 'OPENED'});
  } catch (error) {
    await fail(STAGE.OPEN, error);
    return {stages, ...aggregate(stages)};
  }

  // 2. no-edit Save
  try {
    await host.save();
    await check(STAGE.NOEDIT);
  } catch (error) {
    await fail(STAGE.NOEDIT, error);
  }

  // 3. reopen the saved identity without resetting it
  try {
    const before = observation ?? await observe();
    await host.reopen();
    const after = await observe();
    if (!before.bytes.equals(after.bytes)) {
      throw new Error('reopen changed the document bytes; the host reset instead of reopening');
    }
    if (after.sequence !== before.sequence) {
      throw new Error(`reopen changed the save sequence (${before.sequence} -> ${after.sequence})`);
    }
    await check(STAGE.REOPEN_NOEDIT, [], {reopenedSameBytes: true});
  } catch (error) {
    await fail(STAGE.REOPEN_NOEDIT, error);
  }

  // 4. unrelated title edit
  let workStarted = false;
  try {
    await editor.editTitle();
    workStarted = true;
    await host.save();
    await check(STAGE.TITLE);
  } catch (error) {
    if (error instanceof ControlUnavailable && !workStarted) {
      await push(STAGE.TITLE, {outcome: 'NOT RUN', reason: error.message});
    } else {
      await fail(STAGE.TITLE, error);
    }
  }

  // 5. intentional chart-data edit bound to each slot
  let dataEditNotRun = false;
  workStarted = false;
  try {
    for (const entry of cases) {
      await editor.editChartData(entry);
      workStarted = true;
    }
    await host.save();
    await check(STAGE.DATAEDIT, expectationArgs());
  } catch (error) {
    if (error instanceof ControlUnavailable && !workStarted) {
      dataEditNotRun = true;
      await push(STAGE.DATAEDIT, {outcome: 'NOT RUN', reason: error.message});
    } else {
      await fail(STAGE.DATAEDIT, error);
    }
  }

  // 6. reopen and re-check the post-reopen bytes
  if (dataEditNotRun) {
    await push(STAGE.REOPEN_DATAEDIT, {outcome: 'NOT RUN',
      reason: 'the intentional chart-data edit was not performed'});
  } else try {
    const before = await observe();
    await host.reopen();
    const after = await observe();
    if (!before.bytes.equals(after.bytes)) {
      throw new Error('reopen after edit changed the document bytes');
    }
    await check(STAGE.REOPEN_DATAEDIT, expectationArgs(), {reopenedSameBytes: true});
  } catch (error) {
    await fail(STAGE.REOPEN_DATAEDIT, error);
  }

  // 7. canonical verify correlated with the observed artifact
  try {
    const current = observation ?? await observe();
    const {status, body} = await host.verify();
    const problems = [];
    if (status !== 200) problems.push(`status ${status}`);
    if (!body || typeof body !== 'object') {
      problems.push('no canonical verify body');
    } else {
      const digest = createHash('sha256').update(current.bytes).digest('hex');
      if (body.id !== identity) problems.push(`id ${body.id} is not ${identity}`);
      if (body.sha256 !== digest) problems.push('sha256 does not match the observed artifact');
      if (body.bytes !== current.bytes.length) {
        problems.push(`bytes ${body.bytes} is not ${current.bytes.length}`);
      }
      if (body.sequence !== current.sequence) {
        problems.push(`sequence ${body.sequence} is not ${current.sequence}`);
      }
      for (const flag of VERIFY_FLAGS) {
        if (body[flag] !== true) problems.push(`${flag} is not true`);
      }
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
  const required = ['origin', 'identity', 'manifest', 'cases', 'case-ids', 'original',
    'out', 'checker', 'editor'];
  const missing = required.filter(name => !arg(name));
  if (missing.length) {
    console.error('missing explicit inputs: ' + missing.map(name => '--' + name).join(', '));
    process.exitCode = 2;
    return;
  }
  try {
    const {createHttpAdapter} = await import('./isolation-adapter.mjs');
    const manifest = JSON.parse(await readFile(arg('manifest'), 'utf8'));
    const manifestIds = Array.isArray(manifest) ? manifest.map(entry => entry.id) : [];
    resolveFixtureLabel(arg('identity'), manifestIds);
    const cases = selectCases(JSON.parse(await readFile(arg('cases'), 'utf8')),
      arg('case-ids').split(',').map(id => id.trim()).filter(Boolean));
    const editor = await (await import(arg('editor'))).createEditor({
      origin: arg('origin'), identity: arg('identity'),
      selectors: arg('selectors'), playwright: arg('playwright'),
    });
    const host = await createHttpAdapter({
      origin: arg('origin'), identity: arg('identity'), editor, manifestIds,
    });
    const result = await runFlows({
      host, editor,
      runCheck: createChecker({python: arg('python') || 'python',
        script: arg('checker'), original: arg('original')}),
      outDir: arg('out'),
      cases,
      identity: arg('identity'),
    });
    console.log(JSON.stringify({outcome: result.outcome, exit: result.exit,
      stages: result.stages.map(stage => stage.stage + ':' + stage.outcome)}));
    process.exitCode = result.exit;
  } catch (error) {
    console.error(`${error.name}: ${error.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && process.argv[1].endsWith('native-chart-flows.mjs')) {
  await main();
}
