// Opt-in synthetic Office generation/render probe (probe:artifacts).
//
// NEVER run by `npm test`. Generates native DOCX/XLSX (via probes/artifacts.py)
// and a native two-slide PPTX (via the adopted pptxgenjs 4.0.1), inspects the
// actual OOXML/ZIP structures, then (unless rendering is explicitly disabled)
// exports all three formats to separate PDFs, renders page PNGs, inspects
// PDF/text, and recalculates a COPY of the XLSX with LibreOffice to assert
// A4=6 after reopen. Missing converters/fonts fail the required live probe;
// rendering that cannot run is a live gate.
//
// Live output/profiles default under /workspace; the authoring host keeps
// scratch under .runtime. Originals, revisions, rendered PDFs/PNGs, hashes and
// failures are all preserved. pdfjs-dist 6.4.299 is referenced as the adopted
// preview candidate only; no new viewer is implemented here.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
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

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', timeout: opts.timeout || 180000, maxBuffer: 32 * 1024 * 1024 });
}

/** Run a python subcommand and require exit 0 AND a parseable ok:true verdict. */
function runPython(args) {
  const res = run(pythonBin, [join(HERE, 'artifacts.py'), ...args]);
  const parsed = parseStructuredOutput(res.stdout);
  const ok = res.status === 0 && parsed.ok && parsed.value && parsed.value.ok === true;
  return { ok, status: res.status, stderr: (res.stderr || '').slice(0, 300), parsed: parsed.value };
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

function convertToPdf(soffice, profileUri, srcFile, dstDir) {
  mkdirSync(dstDir, { recursive: true });
  const res = run(soffice, ['--headless', `-env:UserInstallation=${profileUri}`, '--convert-to', 'pdf', '--outdir', dstDir, srcFile], { timeout: 120000 });
  const pdf = join(dstDir, `${basename(srcFile).replace(/\.(docx|xlsx|pptx)$/, '')}.pdf`);
  return { exit: res.status, pdfPath: existsSync(pdf) ? pdf : null };
}

function recalcXlsx(soffice, profileUri, srcXlsx, renderDir) {
  const dir = join(renderDir, 'recalc');
  mkdirSync(dir, { recursive: true });
  const copy = join(dir, 'qualification-copy.xlsx');
  copyFileSync(srcXlsx, copy);
  run(soffice, ['--headless', `-env:UserInstallation=${profileUri}`, '--convert-to', 'xlsx', '--outdir', dir, copy], { timeout: 120000 });
  const check = runPython(['xlsxrecalc', copy]);
  return { ok: check.ok, reopened: check.parsed && check.parsed.results ? check.parsed.results[0].reopened : null, status: check.status };
}

async function main() {
  const reasons = [];
  const evidencePaths = [];
  let ok = false;
  const runDir = join(OUTPUT_ROOT, `probe-${randomUUID()}`);
  const nativeDir = join(runDir, 'native');
  const renderDir = join(runDir, 'render');
  try {
    mkdirSync(nativeDir, { recursive: true });
    mkdirSync(renderDir, { recursive: true });
    evidencePaths.push(runDir);

    const gen = runPython(['generate', nativeDir]);
    if (!gen.ok) reasons.push(`python native generation failed (status ${gen.status}): ${gen.stderr}`);
    const docx = join(nativeDir, 'qualification.docx');
    const xlsx = join(nativeDir, 'qualification.xlsx');

    let pptxFile = null;
    let pptxOk = false;
    try {
      pptxFile = await generatePptx(nativeDir);
      pptxOk = runPython(['inspect', pptxFile]).ok;
      if (!pptxOk) reasons.push('PPTX structure missing expected slide/notes parts');
    } catch (error) {
      reasons.push(`PPTX generation failed: ${String(error && error.message ? error.message : error).slice(0, 200)}`);
    }
    const nativeOk = gen.ok && pptxOk;

    const renderRequired = RENDER_MODE !== '0' && RENDER_MODE !== 'off';
    const soffice = which('soffice') || which('libreoffice');
    const pdftoppm = which('pdftoppm');
    let render = { status: 'skipped', detail: 'render disabled by MERI_ARTIFACTS_RENDER' };
    if (renderRequired) {
      if (!soffice || !pdftoppm) {
        render = { status: 'fail', detail: `missing converter/render tools: soffice=${soffice}, pdftoppm=${pdftoppm}` };
        reasons.push(render.detail);
      } else {
        try {
          const profileUri = pathToFileURL(join(renderDir, 'lo-profile')).href;
          const pdfs = {};
          for (const [name, file] of [['docx', docx], ['xlsx', xlsx], ['pptx', pptxFile]]) {
            const dst = join(renderDir, name);
            const conv = convertToPdf(soffice, profileUri, file, dst);
            const entry = { exit: conv.exit, pdf: conv.pdfPath, pages: null, pngCount: 0 };
            if (conv.pdfPath) {
              run(pdftoppm, ['-png', '-r', '96', conv.pdfPath, join(dst, 'page')]);
              const pp = runPython(['pdf', conv.pdfPath]);
              entry.pages = pp.parsed && pp.parsed.results ? pp.parsed.results[0].pageCount : null;
              entry.pngCount = readdirSync(dst).filter((f) => f.endsWith('.png')).length;
            }
            pdfs[name] = entry;
          }
          const recalc = recalcXlsx(soffice, profileUri, xlsx, renderDir);
          const allPdfs = ['docx', 'xlsx', 'pptx'].every((k) => pdfs[k].pdf && pdfs[k].pages >= 1);
          const allPngs = ['docx', 'xlsx', 'pptx'].every((k) => pdfs[k].pngCount >= 1);
          render = { status: allPdfs && allPngs && recalc.ok ? 'pass' : 'fail', pdfs, recalc };
          if (render.status !== 'pass') reasons.push('LibreOffice/poppler render or XLSX recalculation did not complete cleanly');
        } catch (error) {
          render = { status: 'fail', detail: `render error: ${String(error && error.message ? error.message : error).slice(0, 200)}` };
          reasons.push(render.detail);
        }
      }
    }

    ok = nativeOk && (!renderRequired || render.status === 'pass');
    process.stdout.write(JSON.stringify({
      probe: 'artifacts',
      ok,
      native: { status: nativeOk ? 'pass' : 'fail', python: gen.parsed, pptxFile, pptxOk },
      render,
      renderRequired,
      pdfPreviewCandidate: 'pdfjs-dist 6.4.299 (adopted preview candidate; no viewer implemented)',
      reasons,
      evidencePaths,
    }, null, 2) + '\n');
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
