/** Reads and decodes the scope ledger's declared sources. Offline, no writes, inert on import. */
import {readFileSync, readdirSync, existsSync, lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseScopeLedger} from '../general-reads/sources.mjs';
import {decodeCoverageCsv} from './coverage-csv.mjs';
import {loadSourceExposure} from './source-exposure.mjs';

export const DEFAULT_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const SOURCE_PATHS = Object.freeze({
  inventory: 'docs/coordination/proposals/general-reads/inventory.json',
  coverage: 'docs/coordination/ledgers/TOOL-COVERAGE-96.csv',
  scope: 'docs/CAPABILITY-SCOPE.md',
  routes: 'scripts/general-reads/product-routes.json',
  ownerExclusion: 'scripts/scope-ledger/owner-exclusion.json',
  gates: 'scripts/scope-ledger/gates.json',
  productCapabilities: 'scripts/scope-ledger/product-capabilities.json',
  ownershipGraph: 'scripts/scope-ledger/ownership-graph.json',
});

/** The audit publication's integrity table (README "Supplied-file integrity") for the copied CSV. */
export const COVERAGE_ORIGIN = Object.freeze({
  ref: 'origin/dot/meri-comprehensive-audit-20261015',
  commit: '82a015083f1965851ffddbc05d4f181bb90ecac2',
  path: 'docs/coordination/audits/meri-comprehensive-20261015/TOOL-COVERAGE-96.csv',
  bytes: 25248,
  sha256: '42dc47fb19a326bb2ed0b45c03f293ea27478a004e29916741aabeecb38977a1',
});

/** Directories scanned for files that name an excluded tool, and the text extensions read. */
export const REFERENCE_SCAN = Object.freeze({roots: ['apps', 'packages', 'scripts'],
  extensions: ['.mjs', '.js', '.cjs', '.ts', '.tsx', '.py', '.sql', '.json', '.sh', '.yaml', '.yml', '.toml']});

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw Object.assign(new Error(message), {code: 'SCOPE_LEDGER_SOURCE'}); };

function readFile(root, path) {
  const absolute = resolve(root, path);
  if (relative(root, absolute).startsWith('..')) fail(`Path escapes root: ${path}`);
  if (!existsSync(absolute)) fail(`Missing source: ${path}`);
  const bytes = readFileSync(absolute);
  return {path, bytes, text: bytes.toString('utf8'), sha256: sha256(bytes)};
}
function readJson(root, path) {
  const file = readFile(root, path);
  try { return {...file, json: JSON.parse(file.text)}; } catch { fail(`Invalid JSON: ${path}`); }
}

/** Rows of the "Required new product capabilities outside the legacy registry" table: capability and planned owner. */
export function parseRequiredCapabilities(text) {
  const start = text.indexOf('## Required new product capabilities outside the legacy registry');
  if (start < 0) fail('Required-capability section not found');
  const end = text.indexOf('\n## ', start + 3);
  const rows = [];
  for (const line of text.slice(start, end < 0 ? undefined : end).split('\n')) {
    const cells = line.split('|').map(cell => cell.trim());
    if (cells.length !== 5 || cells[1] === 'Required capability' || /^-+$/.test(cells[1])) continue;
    rows.push({capability: cells[1], plannedOwner: cells[2], acceptance: cells[3]});
  }
  if (!rows.length) fail('Required-capability table is empty');
  return rows;
}

/** Files under the scan roots whose text names any of `names` as a whole identifier. Symlinks and node_modules are skipped. */
export function scanReferences(root, names) {
  const pattern = new RegExp(`\\b(${names.join('|')})\\b`, 'g'), found = [];
  const walk = dir => {
    for (const entry of readdirSync(resolve(root, dir), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${dir}/${entry.name}`;
      if (entry.name === 'node_modules' || lstatSync(resolve(root, path)).isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(path);
      else if (REFERENCE_SCAN.extensions.some(ext => entry.name.endsWith(ext))) {
        const tools = [...new Set([...readFileSync(resolve(root, path), 'utf8').matchAll(pattern)].map(m => m[1]))].sort();
        if (tools.length) found.push({path, tools});
      }
    }
  };
  for (const dir of REFERENCE_SCAN.roots) walk(dir);
  return found;
}

export function loadSources(root = DEFAULT_ROOT) {
  const inventory = readJson(root, SOURCE_PATHS.inventory);
  const coverage = readFile(root, SOURCE_PATHS.coverage);
  if (coverage.bytes.length !== COVERAGE_ORIGIN.bytes || coverage.sha256 !== COVERAGE_ORIGIN.sha256)
    fail(`${SOURCE_PATHS.coverage} differs from the audit-published bytes/SHA-256`);
  const scope = readFile(root, SOURCE_PATHS.scope);
  const routes = readJson(root, SOURCE_PATHS.routes);
  const ownerExclusion = readJson(root, SOURCE_PATHS.ownerExclusion);
  const gates = readJson(root, SOURCE_PATHS.gates);
  const productCapabilities = readJson(root, SOURCE_PATHS.productCapabilities);
  const ownershipGraph = readJson(root, SOURCE_PATHS.ownershipGraph);
  const excludedNames = ownerExclusion.json.groups.flatMap(group => group.tools);
  return {
    sourceExposure: loadSourceExposure(root),
    inventory: inventory.json,
    coverage: decodeCoverageCsv(coverage.text),
    coverageOrigin: COVERAGE_ORIGIN,
    scopeRows: parseScopeLedger(scope.text),
    requiredCapabilities: parseRequiredCapabilities(scope.text),
    routes: routes.json.routes,
    ownerExclusion: ownerExclusion.json,
    gates: gates.json.gates,
    productCapabilities: productCapabilities.json.capabilities,
    ownershipGraph: ownershipGraph.json,
    references: scanReferences(root, excludedNames),
    referenceScan: `${REFERENCE_SCAN.roots.map(r => `${r}/`).join(', ')} (${REFERENCE_SCAN.extensions.join(' ')}; node_modules and symlinks skipped)`,
    provenance: Object.fromEntries([inventory, coverage, scope, routes, ownerExclusion, gates, productCapabilities, ownershipGraph]
      .map(file => [file.path, file.sha256])),
    exists: path => existsSync(resolve(root, path)),
  };
}
