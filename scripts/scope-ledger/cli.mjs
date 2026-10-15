#!/usr/bin/env node
/** Final scope ledger entry point. Usage and exit codes are documented in USAGE below. */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DEFAULT_ROOT, loadSources} from './sources.mjs';
import {buildLedger} from './ledger.mjs';
import {renderGenerated, splice} from './markdown.mjs';

export const JSON_PATH = 'docs/coordination/ledgers/scope-ledger.json';
export const MARKDOWN_PATH = 'docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md';
export const USAGE = `Usage: node scripts/scope-ledger/cli.mjs (--check | --write | --help)

  --check  Regenerate in memory and compare with ${JSON_PATH} and the generated block of ${MARKDOWN_PATH}.
  --write  Regenerate and overwrite both (the Markdown outside its generated markers is kept).
  --help   Print this text.

Exit codes: 0 success/up to date, 1 committed ledger drifted, 2 usage error,
3 source or consistency error (nothing written).`;

export const renderJson = ledger => `${JSON.stringify(ledger, null, 2)}\n`;

/** Both outputs, or a thrown source/consistency error. Reads the committed Markdown for its hand-written prose. */
export function generate(root = DEFAULT_ROOT) {
  const ledger = buildLedger(loadSources(root));
  const markdownPath = resolve(root, MARKDOWN_PATH);
  if (!existsSync(markdownPath)) throw new Error(`Missing ${MARKDOWN_PATH}`);
  return {ledger, json: renderJson(ledger), markdown: splice(readFileSync(markdownPath, 'utf8'), renderGenerated(ledger))};
}

export async function runCli(argv, {root = DEFAULT_ROOT, out = console.log, err = console.error} = {}) {
  if (argv.length !== 1 || !['--check', '--write', '--help'].includes(argv[0])) { err(USAGE); return 2; }
  if (argv[0] === '--help') { out(USAGE); return 0; }
  let outputs;
  try { outputs = generate(root); }
  catch (error) { err(`Scope ledger not generated: ${error.message}`); return 3; }
  const targets = [[JSON_PATH, outputs.json], [MARKDOWN_PATH, outputs.markdown]];
  if (argv[0] === '--write') {
    for (const [path, text] of targets) writeFileSync(resolve(root, path), text);
    out(`Wrote ${JSON_PATH} and ${MARKDOWN_PATH}`); return 0;
  }
  const drifted = targets.filter(([path, text]) => !existsSync(resolve(root, path)) || readFileSync(resolve(root, path), 'utf8') !== text).map(([path]) => path);
  if (drifted.length) { err(`${drifted.join(' and ')} drifted; run --write and review the diff`); return 1; }
  out('Scope ledger is up to date'); return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = await runCli(process.argv.slice(2));
