/**
 * Native PPTX chart-workbook flows for the EXISTING qualification framework
 * (SCRUM-241 / cool#16243).
 *
 * One invocation is bound to ONE manifest identity, that identity's exact
 * original fixture and its own chart slots: open -> no-edit Save -> reopen ->
 * title edit + Save -> intentional chart-data edit + Save -> reopen -> verify.
 * The two affected documents are separate invocations (pptx-03 and pptx-04);
 * pptx-04 keeps its distinct per-chart edits B2=9 and B2=11.
 *
 * Contract facts encoded here:
 *
 *  - a case document may only be used with its own identity and original: the
 *    original's file name and SHA-256 must match the manifest entry before any
 *    navigation, and every edit must belong to that one case;
 *  - reopen renews claims and reopens the SAVED identity through `/qualify`;
 *    `/fresh` resets and is used for the initial open only;
 *  - both reopens must keep the bytes AND the host save sequence unchanged;
 *  - editor controls are checked in an explicit preflight. A control that is
 *    unavailable in preflight is NOT RUN; once an effectful edit or save method
 *    has been invoked, any error (including ControlUnavailable) is FAIL, with
 *    the partial stage evidence preserved;
 *  - verify is correlated with the observed artifact: identity, byte length,
 *    sha256 and sequence, plus the retained boolean evidence;
 *  - stage results are written after every stage, including on failure, and a
 *    NOT RUN makes the run INCOMPLETE with a non-zero exit.
 *
 * This module starts no CODE, host or browser.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename, join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  ControlUnavailable, InputRefused, parseFixtureLabel, resolveFixtureLabel,
} from './isolation-adapter.mjs';

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

const sha256 = payload => createHash('sha256').update(payload).digest('hex');

/**
 * Bind one case document to one manifest identity and its exact original.
 *
 * @param document cases.json content
 * @param identity routable label (manifest id plus optional supported suffix)
 * @param manifestEntry the manifest entry for that id
 * @param originalSha256 SHA-256 of the original fixture being opened
 * @param originalName file name of that original
 */
export function selectCases(document, identity, {manifestEntry, originalSha256, originalName}) {
  const parsed = parseFixtureLabel(identity);
  if (!parsed) throw new InputRefused('a routable identity is required');
  const caseId = parsed.baseId;
  const cases = Array.isArray(document) ? document : document?.cases;
  if (!Array.isArray(cases) || !cases.length) {
    throw new InputRefused('the cases document must contain a non-empty cases array');
  }
  if (!manifestEntry) throw new InputRefused(`no manifest entry was supplied for ${caseId}`);
  if (manifestEntry.id !== caseId) {
    throw new InputRefused(`manifest entry ${manifestEntry.id} does not match identity ${caseId}`);
  }
  if (manifestEntry.filename && originalName && basename(originalName) !== manifestEntry.filename) {
    throw new InputRefused(
      `original ${originalName} is not ${caseId}'s fixture ${manifestEntry.filename}`);
  }
  if (manifestEntry.sha256 && originalSha256 !== manifestEntry.sha256) {
    throw new InputRefused(
      `original SHA-256 does not match the manifest hash for ${caseId}`);
  }
  const entry = cases.find(item => item.id === caseId);
  if (!entry) throw new InputRefused(`${caseId} is not in the cases document`);
  const charts = Array.isArray(entry.charts) ? entry.charts : [];
  if (!charts.length) throw new InputRefused(`${caseId} declares no chart slots`);
  const edits = charts.map(chart => {
    const edit = chart.intentionalEdit;
    if (!edit || !edit.cell) {
      throw new InputRefused(`${caseId} chart ${chart.ordinal} declares no intentional edit`);
    }
    return {
      id: caseId,
      slide: chart.slide,
      ordinal: chart.ordinal,
      sheet: edit.sheet ?? 'Sheet1',
      cell: edit.cell,
      value: String(edit.value),
      expectedWorkbookPart: chart.workbookPart,
    };
  });
  return {caseId, edits};
}

function aggregate(stages) {
  if (stages.some(stage => stage.outcome === 'FAIL')) return {outcome: 'FAIL', exit: 1};
  if (stages.some(stage => stage.outcome === 'NOT RUN')) return {outcome: 'INCOMPLETE', exit: 3};
  return {outcome: 'COMPLETE', exit: 0};
}

export async function runFlows({host, editor, runCheck, outDir, cases, identity, season = {}}) {
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new InputRefused('runFlows requires at least one chart edit');
  }
  const caseIds = new Set(cases.map(entry => entry.id));
  if (caseIds.size !== 1) {
    throw new InputRefused(`one invocation may only carry one case identity, got ${[...caseIds]}`);
  }
  const caseId = [...caseIds][0];
  const base = parseFixtureLabel(identity ?? '').baseId;
  if (caseId !== base) {
    throw new InputRefused(`edits for ${caseId} cannot run against identity ${identity}`);
  }

  await mkdir(outDir, {recursive: true});
  const stages = [];
  let observation = null;

  const persist = async () => {
    await writeFile(join(outDir, 'stages.json'), JSON.stringify({
      caseId,
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
    const path = join(outDir, `${identity ?? caseId}-${stage}.pptx`);
    await writeFile(path, current.bytes);
    const result = runCheck(path, expectations);
    return push(stage, {
      ...extra, path, bytes: current.bytes.length, sha256: sha256(current.bytes),
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

  // 1b. preflight: availability is decided here, before any effectful call
  let controls = {title: false, chartData: false};
  let preflightReason = 'the editor driver exposes no preflight';
  try {
    if (typeof editor.preflight === 'function') {
      const declared = await editor.preflight();
      controls = {title: declared?.title === true, chartData: declared?.chartData === true};
      preflightReason = controls.title && controls.chartData
        ? undefined : 'preflight reported an unavailable editor control';
    }
  } catch (error) {
    if (error instanceof ControlUnavailable) {
      preflightReason = error.message;
    } else {
      await fail('preflight', error);
      return {stages, ...aggregate(stages)};
    }
  }
  await push('preflight', {outcome: 'PASS', controls, reason: preflightReason});

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
    await check(STAGE.REOPEN_NOEDIT, [], {reopenedSameBytes: true,
      reopenedSameSequence: true});
  } catch (error) {
    await fail(STAGE.REOPEN_NOEDIT, error);
  }

  // 4. unrelated title edit
  if (!controls.title) {
    await push(STAGE.TITLE, {outcome: 'NOT RUN', reason: preflightReason});
  } else try {
    // Invoked: from here on any error is a failure of the stage.
    await editor.editTitle();
    await host.save();
    await check(STAGE.TITLE);
  } catch (error) {
    await fail(STAGE.TITLE, error);
  }

  // 5. intentional chart-data edit bound to each slot of this one case
  let dataEditNotRun = false;
  if (!controls.chartData) {
    dataEditNotRun = true;
    await push(STAGE.DATAEDIT, {outcome: 'NOT RUN', reason: preflightReason});
  } else try {
    for (const entry of cases) await editor.editChartData(entry);
    await host.save();
    await check(STAGE.DATAEDIT, expectationArgs());
  } catch (error) {
    await fail(STAGE.DATAEDIT, error);
  }

  // 6. reopen after the edit: same bytes AND same sequence
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
    if (after.sequence !== before.sequence) {
      throw new Error(
        `reopen after edit changed the save sequence (${before.sequence} -> ${after.sequence})`);
    }
    await check(STAGE.REOPEN_DATAEDIT, expectationArgs(), {reopenedSameBytes: true,
      reopenedSameSequence: true});
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
      if (body.id !== identity) problems.push(`id ${body.id} is not ${identity}`);
      if (body.sha256 !== sha256(current.bytes)) {
        problems.push('sha256 does not match the observed artifact');
      }
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
  const required = ['origin', 'identity', 'manifest', 'cases', 'original', 'out',
    'checker', 'editor'];
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
    const parsed = resolveFixtureLabel(arg('identity'), manifestIds);
    const manifestEntry = manifest.find(entry => entry.id === parsed.baseId);
    const original = await readFile(arg('original'));
    const selection = selectCases(JSON.parse(await readFile(arg('cases'), 'utf8')),
      arg('identity'), {manifestEntry, originalSha256: sha256(original),
        originalName: arg('original')});
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
      cases: selection.edits,
      identity: arg('identity'),
    });
    console.log(JSON.stringify({caseId: selection.caseId, outcome: result.outcome,
      exit: result.exit, stages: result.stages.map(stage => stage.stage + ':' + stage.outcome)}));
    process.exitCode = result.exit;
  } catch (error) {
    console.error(`${error.name}: ${error.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && process.argv[1].endsWith('native-chart-flows.mjs')) {
  await main();
}
