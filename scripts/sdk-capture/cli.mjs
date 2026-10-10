// CLI argument handling, constant diagnostics and public runCli composition for
// the SDK raw-capture decoder.
//
// runCli performs no work on import and writes nothing unless invoked with
// --out. Unknown-argument diagnostics are constant (rejected arguments are
// never reflected). Depends on protocol, filesystem, capture-validation and
// artifacts; it is never imported by those modules (no cycles).

import { errMsg } from './protocol.mjs';
import { readCaptureFile } from './filesystem.mjs';
import { validateCapture } from './capture-validation.mjs';
import { writeCapture } from './artifacts.mjs';

export function parseArgs(argv) {
  const args = { input: null, out: null, error: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--input') args.input = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('--input=')) args.input = a.slice('--input='.length);
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
    else args.error = 'unexpected argument';
  }
  return args;
}

/** CLI entry. Returns an exit code; performs no work on import. */
export function runCli(argv = process.argv.slice(2), { readFile = (p) => readCaptureFile(p), log = (m) => process.stdout.write(m + '\n') } = {}) {
  const args = parseArgs(argv);
  if (args.error) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: [args.error] })); return 2; }
  if (!args.input) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: ['--input is required'] })); return 2; }
  let loaded;
  try { loaded = readFile(args.input); } catch (error) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: [`cannot read input: ${errMsg(error)}`] })); return 1; }
  const text = typeof loaded === 'string' ? loaded : loaded.text;
  const rawBuffer = typeof loaded === 'string' ? undefined : loaded.buffer;
  const result = validateCapture(text, rawBuffer === undefined ? {} : { rawBuffer });
  if (!result.ok) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: result.reasons.slice(0, 12), wroteAny: false })); return 1; }
  if (!args.out) {
    log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: true, checked: true, captureId: result.report.captureId, inputSha256: result.report.inputSha256, framingSha256: result.report.framingSha256, wroteAny: false }));
    return 0;
  }
  const written = writeCapture(result, args.out);
  if (!written.ok) { log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: false, reasons: written.reasons.slice(0, 12), wroteAny: false })); return 1; }
  log(JSON.stringify({ probe: 'sdk-capture-reconstruct', ok: true, written: written.files.length, dest: written.dest, inputSha256: result.report.inputSha256, reportSha256: written.reportSha256 }));
  return 0;
}