// Reviewer-only negative control. Never modifies the candidate source.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const directory = dirname(fileURLToPath(import.meta.url));
const originalPath = resolve(process.argv[2], 'apps/control/qualification-temporal/recovery-activities.mjs');
const raw = readFileSync(originalPath, 'utf8'), require = createRequire(originalPath);
const needle = 'function hold(uncertain = false) {';
if (raw.split(needle).length !== 2) throw new Error('MUTANT_SOURCE_SHAPE_CHANGED');
const mutated = raw.replace(needle, needle + '\n  uncertain = false; // REVIEW MUTANT: erase commit uncertainty.');
let rewrites = 0;
const runnable = mutated.replace(/from '([^']+)'/g, (whole, specifier) => {
  if (specifier.startsWith('node:')) return whole;
  const resolved = specifier.startsWith('.') ? resolve(dirname(originalPath), specifier) : require.resolve(specifier);
  rewrites++;
  return `from '${pathToFileURL(resolved).href}'`;
});
const sha = value => createHash('sha256').update(value).digest('hex');
writeFileSync(resolve(directory, 'uncertainty-mutant.runtime.mjs'), runnable);
writeFileSync(resolve(directory, 'uncertainty-mutant-source.json'), JSON.stringify({
  originalSourceSha256: sha(raw), mutantSha256: sha(runnable), originalSourceChanged: false,
  mutation: 'Force hold(uncertain) to erase uncertain classification; import URLs only rewritten to preserve exact candidate dependencies',
  importSpecifiersRebound: rewrites, nativeExecution: false,
}, null, 2) + '\n');
