// Opt-in synthetic Office generation/render probe (probe:artifacts).
//
// NEVER run by `npm test`. Generates native DOCX/XLSX (via probes/artifacts.py)
// and a native two-slide PPTX (via the adopted pptxgenjs 4.0.1), inspects the
// OOXML/ZIP structures, then exports all three formats to separate PDFs, renders
// page PNGs, inspects PDF/text, and recalculates a COPY of the XLSX in a
// distinct output directory with LibreOffice to assert A4=6 after reopen.
//
// Every subprocess result keeps authoritative status/signal/error, and every
// nested ok is propagated. Disabling rendering (MERI_ARTIFACTS_RENDER=off) is a
// visible NOT-PASSED result, never a required-qualification pass. Live
// output/profiles default under /workspace; authoring host uses .runtime.
// pdfjs-dist 6.4.299 is referenced as the adopted preview candidate only.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, basename } from 'node:path';

import { parseStructuredOutput } from './runtime.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IS_LINUX = process.platform === 'linux';
const DEFAULT_OUTPUT_ROOT = IS_LINUX ? '/workspace/qualification-artifacts' : join(HERE, '..', '.runtime', 'artifacts');
const OUTPUT_ROOT = process.env.MERI_ARTIFACTS_OUTPUT_DIR || DEFAULT_OUTPUT_ROOT;
const RENDER_MODE = process.env.MERI_ARTIFACTS_RENDER || 'required';
const pythonBin = process.env.MERI_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

/** Locate a command on PATH without mutating anything. */
export function which(cmd) {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  if (probe.status === 0 && (probe.stdout || '').trim()) return (probe.stdout || '').trim().split(/\r?\n/)[0];
  return null;
}

/** Authoritative subprocess classification: nonzero status, signal or error fail. */
export function classifySubprocess({ status, signal, error } = {}) {
  if (error) return { ok: false, detail: `spawn error: ${String(error.message || error).slice(0, 160)}` };
  if (signal) return { ok: false, detail: `killed by signal ${signal}` };
  if (status !== 0) return { ok: false, detail: `exit status ${status}` };
  return { ok: true, detail: 'exit 0' };
}

/** Pure native-generation decision. */
export function decideNative({ gen, pptxOk } = {}) {
  const reasons = [];
  if (!gen || gen.status !== 0 || !gen.parsed || gen.parsed.ok !== true) reasons.push(`python native generation failed (status ${gen && gen.status})`);
  if (!pptxOk) reasons.push('PPTX structure missing expected slide/notes parts');
  return { status: reasons.length === 0 ? 'pass' : 'fail', reasons };
}

/** Pure XLSX recalculation decision: distinct output file, successful conversion, A4=6. */
export function decideRecalc({ convert, newFile, a4 } = {}) {
  const reasons = [];
  const cls = classifySubprocess(convert || {});
  if (!cls.ok) reasons.push(`recalc conversion failed: ${cls.detail}`);
  if (!newFile) reasons.push('recalc produced no NEW file in the distinct output directory');
  if (a4 !== 6) reasons.push(`recalculated A4 is ${JSON.stringify(a4)}, expected 6`);
  return { status: reasons.length === 0 ? 'pass' : 'fail', reasons, a4 };
}

/** Pure render decision over per-format facts and the recalc fact. */
export function decideRender({ disabled, soffice, pdftoppm, pdfs, recalc } = {}) {
  if (disabled) return { status: 'fail', reasons: ['rendering disabled by MERI_ARTIFACTS_RENDER; required qualification render was NOT passed'] };
  const reasons = [];
  if (!soffice) reasons.push('LibreOffice (soffice) not found');
  if (!pdftoppm) reasons.push('pdftoppm not found');
  for (const name of ['docx', 'xlsx', 'pptx']) {
    const f = pdfs && pdfs[name] ? pdfs[name] : {};
    if (!f.convertOk) reasons.push(`${name}: PDF conversion failed (${f.convertDetail || 'no result'})`);
    if (!f.pdfExists) reasons.push(`${name}: PDF file missing`);
    if (!f.pdftoppmOk) reasons.push(`${name}: PNG rendering failed (${f.pngDetail || 'no result'})`);
    if (!(f.pngCount >= 1)) reasons.push(`${name}: no page PNG produced`);
    if (!f.pdfInspectOk) reasons.push(`${name}: PDF inspection failed (${f.inspectDetail || 'no result'})`);
    if (!(f.pages >= 1)) reasons.push(`${name}: PDF page count unavailable`);
  }
  if (!recalc || recalc.status !== 'pass') reasons.push('XLSX recalculation did not pass');
  return { status: reasons.length === 0 ? 'pass' : 'fail', reasons };
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', timeout: opts.timeout || 180000, maxBuffer: 32 * 1024 * 1024 });
}

/** Run a python subcommand; require exit 0 AND a parseable ok:true verdict. */
function runPython(args) {
  const res = run(pythonBin, [join(HERE, 'artifacts.py'), ...args]);
  const parsed = parseStructuredOutput(res.stdout);
  const ok = res.status === 0 && !res.signal && parsed.ok && parsed.value && parsed.value.ok === true;
  return { ok, status: res.status, signal: res.signal, stderr: (res.stderr || '').slice(0, 300), parsed: parsed.value };
}

async function generatePptx(outdir) {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  const s1 = pptx.addSlide();
  s1.addText('Meri qualification — slide one', { x: 0.5, y: 0.5, fontSize: 24 });
  s1.addTable([[{ text: 'role' }, { text: 'path' }], [{ text: 'worker' }, { text: '/workspace' }]], { x: 0.5, y: 1.5, w: 6 });
  s1.addNotes('notes for slide one');
  const s2 = pptx.addSlide();
  s2.addText('Meri qualification — slide two', { x: 0.5, y: 0.5, fontSize: 24 });
  s2.addNotes('notes for slide two');
  const file = join(outdir, 'qualification.pptx');
  await pptx.writeFile({ fileName: file });
  return file;
}

function convert(soffice, profileUri, srcFile, dstDir, toPdf = true) {
  mkdirSync(dstDir, { recursive: true });
  const args = ['--headless', `-env:UserInstallation=${profileUri}`, '--convert-to', toPdf ? 'pdf' : 'xlsx', '--outdir', dstDir, srcFile];
  const res = run(soffice, args, { timeout: 120000 });
  const cls = classifySubprocess(res);
  return { ...cls, status: res.status, signal: res.signal, stdout: (res.stdout || '').slice(0, 200), stderr: (res.stderr || '').slice(0, 200) };
}

async function main() {
  const evidencePaths = [];
  const runDir = join(OUTPUT_ROOT, `probe-${randomUUID()}`);
  const nativeDir = join(runDir, 'native');
  const renderDir = join(runDir, 'render');
  const disabled = RENDER_MODE === '0' || RENDER_MODE === 'off';
  try {
    mkdirSync(nativeDir, { recursive: true });
    mkdirSync(renderDir, { recursive: true });
    evidencePaths.push(runDir);

    const gen = runPython(['generate', nativeDir]);
    const docx = join(nativeDir, 'qualification.docx');
    const xlsx = join(nativeDir, 'qualification.xlsx');
    let pptxFile = null;
    let pptxOk = false;
    try {
      pptxFile = await generatePptx(nativeDir);
      pptxOk = runPython(['inspect', pptxFile]).ok;
    } catch { pptxOk = false; }
    const native = decideNative({ gen, pptxOk });

    const soffice = which('soffice') || which('libreoffice');
    const pdftoppm = which('pdftoppm');
    const pdfs = {};
    let recalc = { status: 'fail', reasons: ['recalc not attempted'] };
    if (!disabled && soffice && pdftoppm) {
      const profileUri = pathToFileURL(join(renderDir, 'lo-profile')).href;
      for (const [name, file] of [['docx', docx], ['xlsx', xlsx], ['pptx', pptxFile]]) {
        const dst = join(renderDir, name);
        const conv = convert(soffice, profileUri, file, dst, true);
        const pdfPath = join(dst, `${basename(file).replace(/\.(docx|xlsx|pptx)$/, '')}.pdf`);
        const entry = { convertOk: conv.ok, convertDetail: conv.detail, pdfExists: existsSync(pdfPath), pdftoppmOk: false, pngDetail: null, pngCount: 0, pdfInspectOk: false, inspectDetail: null, pages: null };
        if (entry.pdfExists) {
          const png = run(pdftoppm, ['-png', '-r', '96', pdfPath, join(dst, 'page')]);
          const pngCls = classifySubprocess(png);
          entry.pdftoppmOk = pngCls.ok;
          entry.pngDetail = pngCls.detail;
          entry.pngCount = readdirSync(dst).filter((f) => f.endsWith('.png')).length;
          const insp = runPython(['pdf', pdfPath]);
          entry.pdfInspectOk = insp.ok;
          entry.inspectDetail = insp.ok ? 'ok' : `python pdf status ${insp.status}`;
          entry.pages = insp.ok && insp.parsed && insp.parsed.results ? insp.parsed.results[0].pageCount : null;
        }
        pdfs[name] = entry;
      }
      // Recalculate a COPY of the XLSX in a DISTINCT output directory.
      const recalcIn = join(renderDir, 'recalc-in');
      const recalcOut = join(renderDir, 'recalc-out');
      mkdirSync(recalcIn, { recursive: true });
      mkdirSync(recalcOut, { recursive: true });
      const copy = join(recalcIn, 'qualification-copy.xlsx');
      copyFileSync(xlsx, copy);
      const conv = convert(soffice, profileUri, copy, recalcOut, false);
      const newFile = join(recalcOut, 'qualification-copy.xlsx');
      const newFileExists = existsSync(newFile) && statSync(newFile).mtimeMs >= statSync(copy).mtimeMs - 1;
      let a4 = null;
      if (conv.ok && newFileExists) {
        const check = runPython(['xlsxrecalc', newFile]);
        if (check.ok && check.parsed && check.parsed.results) a4 = check.parsed.results[0].reopened.a4CachedValueAfterRecalc;
      }
      recalc = decideRecalc({ convert: conv, newFile: newFileExists, a4 });
    } else if (!disabled) {
      recalc = { status: 'fail', reasons: ['LibreOffice/poppler unavailable; recalc not attempted'] };
    }
    const render = decideRender({ disabled, soffice, pdftoppm, pdfs, recalc });

    const ok = native.status === 'pass' && render.status === 'pass';
    const payload = {
      probe: 'artifacts',
      ok,
      native,
      render,
      renderRequired: true,
      recalc,
      pdfPreviewCandidate: 'pdfjs-dist 6.4.299 (adopted preview candidate; no viewer implemented)',
      reasons: [...native.reasons, ...render.reasons],
      evidencePaths,
    };
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.exit(ok ? 0 : 1);
  } catch (error) {
    process.stdout.write(JSON.stringify({ probe: 'artifacts', ok: false, reasons: [String(error).slice(0, 300)], evidencePaths }, null, 2) + '\n');
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((error) => {
    process.stdout.write(JSON.stringify({ probe: 'artifacts', ok: false, reasons: [String(error).slice(0, 300)] }, null, 2) + '\n');
    process.exit(1);
  });
}
