// Opt-in synthetic Office generation/render probe (probe:artifacts).
//
// NEVER run by `npm test`. Generates native DOCX/XLSX (via probes/artifacts.py)
// and a native two-slide PPTX (via the adopted pptxgenjs 4.0.1), inspects the
// OOXML/ZIP structures, then exports all three formats to separate PDFs, renders
// page PNGs, inspects PDF/text, and recalculates a COPY of the XLSX in a
// distinct output directory with LibreOffice.
//
// Observed values are preserved SEPARATELY from verdicts: every child keeps its
// authoritative status/signal/error/parse status and bounded stdout/stderr, and
// per-format convert/PDF/page/PNG facts and the recalc observed value are
// emitted even on failure, so a wrong value or a failed command never collapses
// into a plausible null/pass. Disabling rendering is a visible NOT-PASSED result.
// Live output/profiles default under /workspace; the authoring host uses
// .runtime. pdfjs-dist 6.4.299 is referenced as the adopted preview candidate.

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
  if (!gen || gen.status !== 0 || !gen.parseOk || !gen.parsed || gen.parsed.ok !== true) reasons.push(`python native generation failed (status ${gen && gen.status}, parseOk ${gen && gen.parseOk})`);
  if (!pptxOk) reasons.push('PPTX structure missing expected slide/notes parts');
  return { status: reasons.length === 0 ? 'pass' : 'fail', reasons };
}

/**
 * Pure XLSX recalculation decision. Requires a successful conversion, a NEW
 * file, a successful INSPECTION child (authoritative status/signal/error/
 * parseOk/nestedOk), and OBSERVED original inputs [1,2,3], a retained
 * `=SUM(A1:A3)` formula and a NUMERIC cached value of 6. Good-looking observed
 * facts from a failed child (exit 1, signal, spawn error, parse failure, nested
 * ok false) can NEVER produce a pass; a constant 6 with no formula, a wrong
 * value or a missing inspection also fail.
 */
export function decideRecalc({ convert, newFile, observed, inspect } = {}) {
  const reasons = [];
  const cls = classifySubprocess(convert || {});
  if (!cls.ok) reasons.push(`recalc conversion failed: ${cls.detail}`);
  if (!newFile) reasons.push('recalc produced no NEW file in the distinct output directory');
  if (!inspect) reasons.push('recalc inspection child facts missing');
  else {
    if (inspect.error) reasons.push(`recalc inspection spawn error: ${String(inspect.error).slice(0, 160)}`);
    if (inspect.signal) reasons.push(`recalc inspection killed by signal ${inspect.signal}`);
    if (inspect.status !== 0) reasons.push(`recalc inspection exit status ${inspect.status}`);
    if (inspect.parseOk !== true) reasons.push(`recalc inspection parse failed: ${String(inspect.parseError || 'unparseable stdout').slice(0, 160)}`);
    if (inspect.nestedOk !== true) reasons.push('recalc inspection nested ok was not true');
  }
  const o = observed || {};
  if (!o.inspected) {
    reasons.push('recalc inspection did not complete (no observed value)');
  } else {
    if (JSON.stringify(o.inputs) !== JSON.stringify([1, 2, 3])) reasons.push(`recalc inputs ${JSON.stringify(o.inputs)} != [1,2,3]`);
    if (o.formula !== '=SUM(A1:A3)') reasons.push(`recalc lost or changed the SUM formula (${JSON.stringify(o.formula)})`);
    if (typeof o.cachedValue !== 'number' || o.cachedValue !== 6) reasons.push(`recalc cached A4 ${JSON.stringify(o.cachedValue)} (${o.cachedType}) is not the numeric value 6`);
  }
  return { status: reasons.length === 0 ? 'pass' : 'fail', reasons, observed: o };
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

/** Run a python subcommand and return RICH facts (never collapse to a bare ok). */
function runPython(args) {
  const res = run(pythonBin, [join(HERE, 'artifacts.py'), ...args]);
  const parsed = parseStructuredOutput(res.stdout);
  const parseOk = parsed.ok && parsed.value && parsed.value.ok === true;
  return {
    ok: res.status === 0 && !res.signal && parseOk,
    status: res.status,
    signal: res.signal,
    error: res.error ? String(res.error.message || res.error).slice(0, 200) : null,
    parseOk: parsed.ok,
    parseError: parsed.ok ? null : parsed.error,
    stdout: (res.stdout || '').slice(-2000),
    stderr: (res.stderr || '').slice(0, 500),
    parsed: parsed.value,
  };
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
  return { ...cls, status: res.status, signal: res.signal, error: res.error ? String(res.error.message || res.error).slice(0, 160) : null, stdout: (res.stdout || '').slice(0, 300), stderr: (res.stderr || '').slice(0, 300) };
}

async function main() {
  const evidencePaths = [];
  // Keep accumulated observations even if a later generation/conversion throws.
  const partial = { nativeFacts: {}, renderFacts: {}, recalc: null };
  const runDir = join(OUTPUT_ROOT, `probe-${randomUUID()}`);
  const nativeDir = join(runDir, 'native');
  const renderDir = join(runDir, 'render');
  const disabled = RENDER_MODE === '0' || RENDER_MODE === 'off';
  try {
    mkdirSync(nativeDir, { recursive: true });
    mkdirSync(renderDir, { recursive: true });
    evidencePaths.push(runDir);

    const gen = runPython(['generate', nativeDir]);
    partial.nativeFacts.generate = gen;
    const docx = join(nativeDir, 'qualification.docx');
    const xlsx = join(nativeDir, 'qualification.xlsx');
    let pptxFile = null;
    let pptxOk = false;
    let pptxInspect = null;
    try {
      pptxFile = await generatePptx(nativeDir);
      pptxInspect = runPython(['inspect', pptxFile]);
      pptxOk = pptxInspect.ok;
    } catch (error) {
      pptxInspect = { ok: false, error: String(error && error.message ? error.message : error).slice(0, 200) };
    }
    const native = decideNative({ gen, pptxOk });
    partial.nativeFacts.pptx = pptxInspect;
    partial.native = native;

    const soffice = which('soffice') || which('libreoffice');
    const pdftoppm = which('pdftoppm');
    const pdfs = partial.renderFacts;
    let recalc = { status: 'fail', reasons: ['recalc not attempted'], observed: null };
    if (!disabled && soffice && pdftoppm) {
      const profileUri = pathToFileURL(join(renderDir, 'lo-profile')).href;
      for (const [name, file] of [['docx', docx], ['xlsx', xlsx], ['pptx', pptxFile]]) {
        if (!file || !existsSync(file)) {
          pdfs[name] = { convertOk: false, convertDetail: 'native input unavailable', pdfExists: false, pngCount: 0 };
          continue;
        }
        const dst = join(renderDir, name);
        const conv = convert(soffice, profileUri, file, dst, true);
        const pdfPath = join(dst, `${basename(file).replace(/\.(docx|xlsx|pptx)$/, '')}.pdf`);
        const entry = { convertOk: conv.ok, convertDetail: conv.detail, convertStatus: conv.status, convertSignal: conv.signal, convertStderr: conv.stderr, pdfExists: existsSync(pdfPath), pdfPath: existsSync(pdfPath) ? pdfPath : null, pdftoppmOk: false, pngDetail: null, pngStatus: null, pngCount: 0, pdfInspectOk: false, inspectDetail: null, pages: null };
        entry.convert = conv;
        pdfs[name] = entry;
        if (entry.pdfExists) {
          const png = run(pdftoppm, ['-png', '-r', '96', pdfPath, join(dst, 'page')]);
          const pngCls = classifySubprocess(png);
          entry.pdftoppmOk = pngCls.ok;
          entry.pngDetail = pngCls.detail;
          entry.pngStatus = png.status;
          entry.pngChild = { status: png.status, signal: png.signal, error: png.error ? String(png.error.message || png.error).slice(0, 200) : null, stdout: (png.stdout || '').slice(0, 500), stderr: (png.stderr || '').slice(0, 500) };
          entry.pngCount = readdirSync(dst).filter((f) => f.endsWith('.png')).length;
          const insp = runPython(['pdf', pdfPath]);
          entry.pdfInspection = insp;
          entry.pdfInspectOk = insp.ok;
          entry.inspectDetail = insp.ok ? 'ok' : `python pdf status ${insp.status} signal ${insp.signal} parseOk ${insp.parseOk}`;
          entry.pages = insp.parsed && insp.parsed.results ? insp.parsed.results[0].pageCount : null;
          entry.pdfInspectStatus = insp.status;
          entry.pdfInspectStderr = insp.stderr;
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
      let observed = null;
      let recalcChild = null;
      let inspect = null;
      if (conv.ok && newFileExists) {
        recalcChild = runPython(['xlsxrecalc', newFile]);
        observed = recalcChild.parsed && recalcChild.parsed.results ? recalcChild.parsed.results[0].observed : { inspected: false };
        if (!observed) observed = { inspected: false };
        inspect = {
          status: recalcChild.status,
          signal: recalcChild.signal,
          error: recalcChild.error,
          parseOk: recalcChild.parseOk,
          parseError: recalcChild.parseError,
          nestedOk: recalcChild.parsed ? recalcChild.parsed.ok : false,
        };
      }
      recalc = decideRecalc({ convert: conv, newFile: newFileExists, observed, inspect });
      recalc.child = recalcChild;
      recalc.convert = conv;
      recalc.observedA4 = observed ? observed.cachedValue : null;
      recalc.file = newFileExists ? newFile : null;
    } else if (!disabled) {
      recalc = { status: 'fail', reasons: ['LibreOffice/poppler unavailable; recalc not attempted'], observed: null };
    }
    const render = decideRender({ disabled, soffice, pdftoppm, pdfs, recalc });
    partial.recalc = recalc;

    const ok = native.status === 'pass' && render.status === 'pass';
    const payload = {
      probe: 'artifacts',
      ok,
      native,
      nativeFacts: { generate: gen, pptx: pptxInspect },
      render,
      renderRequired: true,
      renderFacts: pdfs,
      recalc,
      tools: { soffice, pdftoppm },
      pdfPreviewCandidate: 'pdfjs-dist 6.4.299 (adopted preview candidate; no viewer implemented)',
      reasons: [...native.reasons, ...render.reasons],
      evidencePaths,
    };
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.exit(ok ? 0 : 1);
  } catch (error) {
    process.stdout.write(JSON.stringify({ probe: 'artifacts', ok: false, ...partial, reasons: [String(error).slice(0, 300)], evidencePaths }, null, 2) + '\n');
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
