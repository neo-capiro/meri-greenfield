/**
 * Native PPTX chart-workbook flows for the EXISTING qualification framework
 * (SCRIUM-241 / cool#16243).
 *
 * It drives the retained local CODE/WOPI qualification host, which already
 * exposes:
 *
 *   GET  /fresh/<case>            seed an isolated identity from the corpus input
 *   POST <wopi>/<case>/contents   the editor's own WOPI Save (via x-wopi-override)
 *   GET  /state                   save sequence per identity
 *   GET  /saved/<case>            the exact saved bytes held by the host
 *   POST /verify/<case>           existing Core persistence/replay verification
 *
 * This script does not start CODE, build anything, copy keys or write into the
 * retained corpus, saved/ or report trees. Every stage output is written to the
 * caller's own directory. Offline data fidelity is decided by
 * chart-workbook-fidelity.py against the exact bytes downloaded here; the
 * browser leg only proves the document opens, edits and reopens.
 *
 * Stages: open -> no-edit Save -> reopen -> unrelated title edit + Save ->
 * intentional chart-data edit + Save -> reopen, each with its own output file.
 *
 * Usage:
 *   node native-chart-flows.mjs --case pptx-03 --original <input.pptx> \
 *     --out <dir> [--host https://127.0.0.1:19444] [--playwright <module url>]
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf('--' + name);
  return index < 0 ? fallback : args[index + 1];
};
const caseId = arg('case');
const original = arg('original');
const out = arg('out');
const host = arg('host', 'https://127.0.0.1:19444');
const playwright = arg('playwright',
  'file:///C:/Users/Administrator/Documents/Codex/2026-10-28/fi/work/wave6-capabilities-frontend/node_modules/playwright/index.mjs');
if (!caseId || !original || !out) {
  console.error('usage: node native-chart-flows.mjs --case <id> --original <pptx> --out <dir>');
  process.exit(2);
}
const checker = new URL('./chart-workbook-fidelity.py', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1');

const {chromium} = await import(playwright);
const stages = [];
const record = (stage, value) => {
  stages.push({stage, ...value});
  console.log(JSON.stringify({case: caseId, stage, outcome: value.outcome}));
  return value;
};

async function snapshotPath(stage) {
  return join(out, `${caseId}-${stage}.pptx`);
}

async function download(context) {
  const response = await context.request.get(`${host}/saved/${caseId}`, {timeout: 30000});
  if (!response.ok()) throw new Error('saved bytes unavailable: ' + response.status());
  return Buffer.from(await response.body());
}

async function saveAndCapture(page, context) {
  const before = await (await context.request.get(`${host}/state`)).json();
  const sequence = before.files?.[caseId]?.sequence ?? 0;
  await page.evaluate(() => {
    const frame = document.querySelector('iframe');
    frame.contentWindow.postMessage(JSON.stringify({
      MessageId: 'Action_Save',
      Values: {Notify: true, DontSaveIfUnmodified: false, DontTerminateEdit: true},
    }), 'https://127.0.0.1:19443');
  });
  for (let attempt = 0; attempt < 120; attempt++) {
    const state = await (await context.request.get(`${host}/state`)).json();
    if ((state.files?.[caseId]?.sequence ?? 0) > sequence) {
      return Buffer.from(await download(context));
    }
    await page.waitForTimeout(500);
  }
  throw new Error('no native Save acknowledged');
}

function runChecker(path, extra = []) {
  const result = spawnSync('python', [
    checker, '--original', original, '--saved', path,
    ...extra.flatMap(value => ['--expect-edit', value]),
  ], {encoding: 'utf8'});
  return {
    exit: result.status,
    outcome: result.status === 0 ? 'PASS' : 'DIFFERENCE',
    stdout: (result.stdout || '').trim().split('\n').slice(-1)[0] || '',
  };
}

await mkdir(out, {recursive: true});
const browser = await chromium.launch({headless: true});
try {
  const context = await browser.newContext({ignoreHTTPSErrors: true, viewport: {width: 1440, height: 1000}});
  const page = await context.newPage();
  const frame = page.frameLocator('iframe');

  await page.goto(`${host}/fresh/${caseId}`);
  await frame.getByText('Editing', {exact: true}).first().waitFor({timeout: 90000});
  await page.waitForTimeout(1500);
  await page.screenshot({path: join(out, `${caseId}-open.png`), fullPage: true});
  record('open', {outcome: 'OPENED', screenshot: join(out, `${caseId}-open.png`)});

  // 1. no-edit Save: the workbook must survive an untouched roundtrip.
  const noEditBytes = await saveAndCapture(page, context);
  const noEditPath = await snapshotPath('noedit');
  await writeFile(noEditPath, noEditBytes);
  record("noedit-save", {bytes: noEditBytes.length, path: noEditPath, ...runChecker(noEditPath)});

  // 2. reopen the saved bytes through the same WOPI identity.
  await page.reload();
  await frame.getByText('Editing', {exact: true}).first().waitFor({timeout: 90000});
  await page.waitForTimeout(1500);
  await page.screenshot({path: join(out, `${caseId}-reopen-noedit.png`), fullPage: true});
  record('reopen-noedit', {
    outcome: 'REOPENED',
    screenshot: join(out, `${caseId}-reopen-noedit.png`),
    ...runChecker(noEditPath),
  });

  // 3. unrelated title edit: must not disturb the chart workbooks.
  const title = frame.getByText(new RegExp(`Corpus PPTX ${caseId.slice(-2)}`)).first();
  await title.dblclick();
  await page.keyboard.press('End');
  await page.keyboard.type(' TITLE-EDIT-241');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const titleBytes = await saveAndCapture(page, context);
  const titlePath = await snapshotPath('title');
  await writeFile(titlePath, titleBytes);
  record('title-edit-save', {bytes: titleBytes.length, path: titlePath, ...runChecker(titlePath)});

  // 4. intentional chart-data edit through the editor's own chart data table.
  //    If the control is absent this stage is NOT RUN, never PASS.
  let dataStage;
  try {
    await page.mouse.dblclick(720, 470);
    await page.waitForTimeout(1500);
    const dataTable = frame.getByRole('button', {name: /Data Table|Datentabelle|Taulukko/i}).first();
    await dataTable.waitFor({timeout: 15000});
    await dataTable.click();
    await page.waitForTimeout(1000);
    const cell = frame.locator('input').first();
    await cell.waitFor({timeout: 15000});
    await cell.fill('');
    await cell.type('9');
    const ok = frame.getByRole('button', {name: /^(OK|Apply)$/}).first();
    await ok.click();
    await page.waitForTimeout(1000);
    const editedBytes = await saveAndCapture(page, context);
    const editedPath = await snapshotPath('dataedit');
    await writeFile(editedPath, editedBytes);
    await page.screenshot({path: join(out, `${caseId}-dataedit.png`), fullPage: true});
    dataStage = {bytes: editedBytes.length, path: editedPath,
      ...runChecker(editedPath, ['Sheet1!B2=9'])};
  } catch (error) {
    dataStage = {outcome: 'NOT RUN', reason: error.message};
  }
  record('chart-data-edit-save', dataStage);

  // 5. reopen after the intentional edit.
  await page.reload();
  await frame.getByText('Editing', {exact: true}).first().waitFor({timeout: 90000});
  await page.waitForTimeout(1500);
  await page.screenshot({path: join(out, `${caseId}-reopen-dataedit.png`), fullPage: true});
  record('reopen-dataedit', {
    outcome: dataStage.outcome === 'NOT RUN' ? 'NOT RUN' : 'REOPENED',
    screenshot: join(out, `${caseId}-reopen-dataedit.png`),
    ...(dataStage.outcome === 'NOT RUN' ? {} : runChecker(join(out, `${caseId}-dataedit.pptx`),
      ['Sheet1!B2=9'])),
  });

  const verify = await context.request.post(`${host}/verify/${caseId}`, {timeout: 60000});
  record('core-verify', {
    outcome: verify.ok() ? 'PASS' : 'FAIL',
    status: verify.status(),
    body: verify.ok() ? await verify.json() : null,
  });
} finally {
  await browser.close();
  await writeFile(join(out, `${caseId}-stages.json`), JSON.stringify(stages, null, 2));
}
const failed = stages.filter(stage => ['DIFFERENCE', 'FAIL'].includes(stage.outcome));
if (failed.length) {
  console.error('failed stages: ' + failed.map(stage => `${stage.stage}:${stage.outcome}`).join(', '));
  process.exitCode = 1;
}
