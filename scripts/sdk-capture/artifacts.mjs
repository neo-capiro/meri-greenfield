// Exclusive artifact construction, write, readback verification and scoped
// failure cleanup for the SDK raw-capture decoder.
//
// writeCapture builds the in-memory artifact set (all-before-write), refuses a
// changed validated transcript, writes into a NEW exclusive directory with
// allow-listed filenames, independently re-reads/re-hashes every written file,
// and on any failure removes ONLY the just-created owned directory. Depends on
// the protocol and filesystem modules; performs no filesystem work on import.

import { join } from 'node:path';

import { MAX_INPUT_BYTES, sha256Hex, canonical, errMsg } from './protocol.mjs';
import { checkDestination, realIo, pathedContained } from './filesystem.mjs';

/** Build the in-memory artifact set (all-before-write). */
export function buildArtifacts(result) {
  const artifacts = [{ name: 'capture-transcript.ndjson', data: result.inputBuffer }];
  for (const request of result.requests) {
    artifacts.push({ name: `request-${request.index}.raw`, data: request.rawBytes });
    artifacts.push({ name: `request-${request.index}.body`, data: request.decompressedBytes });
  }
  return artifacts;
}

/** Write validated artifacts into a NEW exclusive directory; any failure removes it. */
export function writeCapture(result, outDir, io = realIo) {
  const fs = io.fs;
  if (!result || result.ok !== true) return { ok: false, reasons: result ? result.reasons : ['no validated capture'] };
  if (!Buffer.isBuffer(result.inputBuffer) || result.inputBuffer.length > MAX_INPUT_BYTES || sha256Hex(result.inputBuffer) !== result.report?.inputSha256) {
    return { ok: false, reasons: ['validated transcript bytes changed'] };
  }
  const dest = checkDestination(outDir, io);
  if (!dest.ok) return { ok: false, reasons: dest.reasons };
  const payload = buildArtifacts(result);
  const fileFacts = payload.map((a) => ({ name: a.name, bytes: a.data.length, sha256: sha256Hex(a.data) }));
  const report = { ...result.report, artifacts: fileFacts.map((f) => ({ ...f, file: f.name })) };
  const reportData = Buffer.from(canonical(report) + '\n', 'utf8');

  let created = false;
  const reasons = [];
  try {
    fs.mkdirSync(dest.abs); // exclusive: throws EEXIST if present
    created = true;
    for (const artifact of payload) {
      const full = join(dest.abs, artifact.name);
      if (!pathedContained(dest.abs, full)) { reasons.push(`${artifact.name} escapes the destination`); throw new Error('containment violation'); }
      fs.writeFileSync(full, artifact.data, { flag: 'wx' });
    }
    const reportPath = join(dest.abs, 'capture-report.json');
    if (!pathedContained(dest.abs, reportPath)) { reasons.push('capture-report.json escapes the destination'); throw new Error('containment violation'); }
    fs.writeFileSync(reportPath, reportData, { flag: 'wx' });
    // Independently recompute every written file's size + SHA256.
    const written = [];
    for (const artifact of [...payload, { name: 'capture-report.json', data: reportData }]) {
      const full = join(dest.abs, artifact.name);
      const reread = fs.readFileSync(full);
      const expected = fileFacts.find((f) => f.name === artifact.name) || { bytes: reportData.length, sha256: sha256Hex(reportData) };
      if (reread.length !== expected.bytes || sha256Hex(reread) !== expected.sha256) throw new Error(`artifact verification failed for ${artifact.name}`);
      written.push({ file: artifact.name, bytes: reread.length, sha256: sha256Hex(reread) });
    }
    return { ok: true, reasons: [], dest: dest.abs, files: written, reportSha256: sha256Hex(reportData), reportBytes: reportData.length, transcriptSha256: result.report.inputSha256 };
  } catch (error) {
    let cleaned = false;
    if (created) {
      try { fs.rmSync(dest.abs, { recursive: true, force: true }); cleaned = !fs.existsSync(dest.abs); } catch { /* uncertainty retained */ }
    }
    const base = error && error.code === 'EEXIST' ? [`destination already exists: ${dest.abs}`] : [...reasons, `write failed: ${errMsg(error)}`];
    return { ok: false, reasons: [...base, ...(!cleaned ? ['partial output cleanup unconfirmed'] : [])], cleaned };
  }
}