#!/usr/bin/env node
/** General-read inventory entry point. Usage and exit codes are documented in USAGE below. */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DEFAULT_ROOT, loadSources} from './sources.mjs';
import {buildInventory} from './inventory.mjs';

export const OUTPUT_PATH = 'docs/coordination/proposals/general-reads/inventory.json';
export const USAGE = `Usage: node scripts/general-reads/cli.mjs (--check | --write | --help)

  --check  Regenerate in memory and compare with ${OUTPUT_PATH}.
  --write  Regenerate and overwrite ${OUTPUT_PATH}.
  --help   Print this text.

Exit codes: 0 success/up to date, 1 committed inventory drifted, 2 usage error,
3 source or consistency error (nothing written).`;

export const render = inventory => `${JSON.stringify(inventory, null, 2)}\n`;

export async function runCli(argv, {root = DEFAULT_ROOT, out = console.log, err = console.error} = {}) {
  if (argv.length !== 1 || !['--check', '--write', '--help'].includes(argv[0])) { err(USAGE); return 2; }
  if (argv[0] === '--help') { out(USAGE); return 0; }
  let text;
  try { text = render(buildInventory(await loadSources(root))); }
  catch (error) { err(`Inventory not generated: ${error.message}`); return 3; }
  const target = resolve(root, OUTPUT_PATH);
  if (argv[0] === '--write') { writeFileSync(target, text); out(`Wrote ${OUTPUT_PATH}`); return 0; }
  if (!existsSync(target) || readFileSync(target, 'utf8') !== text) { err(`${OUTPUT_PATH} drifted; run --write and review the diff`); return 1; }
  out(`${OUTPUT_PATH} is up to date`); return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = await runCli(process.argv.slice(2));
