#!/usr/bin/env node
// W02-18 small offline CLI: emit ONE initial read-only TestState REQUEST plan to
// stdout. Reads exactly three explicit absolute input files, writes nothing to disk,
// never overwrites and never discovers defaults/latest. Invocation-only: the modules
// it composes do no filesystem work at import time.

import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBoundedRegularFile } from './native-teststate/files.mjs';
import { BOUNDS, composeFixedBinding } from './native-teststate/binding.mjs';
import { buildRequestPlan } from './native-teststate/requests.mjs';

const FLAGS = ['--static-pins', '--graph', '--seed'];

/**
 * Parse argv into exactly three absolute file paths.
 * @returns {{ok: true, paths: {staticPins: string, graph: string, seed: string}} | {ok: false, reason: string}}
 */
export function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  if (args.length === 0) return { ok: false, reason: 'usage: --static-pins <abs> --graph <abs> --seed <abs>' };
  const seen = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('--')) return { ok: false, reason: 'unexpected positional argument' };
    if (!FLAGS.includes(token)) return { ok: false, reason: 'unknown flag' };
    if (seen[token] !== undefined) return { ok: false, reason: 'duplicate flag' };
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) return { ok: false, reason: 'flag requires an absolute path value' };
    if (!isAbsolute(value)) return { ok: false, reason: 'file paths must be absolute' };
    seen[token] = value;
    i += 1;
  }
  if (FLAGS.some((f) => seen[f] === undefined)) return { ok: false, reason: 'all three flags are required' };
  return { ok: true, paths: { staticPins: seen['--static-pins'], graph: seen['--graph'], seed: seen['--seed'] } };
}

async function loadInputs(paths) {
  const pins = readBoundedRegularFile(paths.staticPins, { maxBytes: BOUNDS.staticPins });
  if (!pins.ok) return { ok: false, reason: `--static-pins: ${pins.error.message}` };
  const graph = readBoundedRegularFile(paths.graph, { maxBytes: BOUNDS.graph });
  if (!graph.ok) return { ok: false, reason: `--graph: ${graph.error.message}` };
  const seed = readBoundedRegularFile(paths.seed, { maxBytes: BOUNDS.seed });
  if (!seed.ok) return { ok: false, reason: `--seed: ${seed.error.message}` };
  return { ok: true, staticPinsBytes: pins.bytes, graphBytes: graph.bytes, seedBytes: seed.bytes };
}

async function run(argv) {
  const parsed = parseArgs(argv);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  try {
    const inputs = await loadInputs(parsed.paths);
    if (!inputs.ok) return { ok: false, reason: inputs.reason };
    const composed = await composeFixedBinding({ staticPinsBytes: inputs.staticPinsBytes, graphBytes: inputs.graphBytes });
    if (!composed.ok) return { ok: false, reason: composed.reason };
    const built = buildRequestPlan({ binding: composed.binding, seedBytes: inputs.seedBytes });
    if (!built.ok) return { ok: false, reason: built.reason };
    return { ok: true, plan: built.plan };
  } catch {
    return { ok: false, reason: 'internal error' };
  }
}

export async function main(argv) {
  let result;
  try {
    result = await run(argv);
  } catch {
    result = { ok: false, reason: 'internal error' };
  }
  if (!result.ok) {
    process.stderr.write(`error: ${result.reason}\n`);
    return 1;
  }
  process.stdout.write(`${JSON.stringify(result.plan)}\n`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) {
  main(process.argv.slice(2))
    .then((code) => { process.exitCode = code; })
    .catch(() => { process.stderr.write('error: internal error\n'); process.exitCode = 1; });
}
