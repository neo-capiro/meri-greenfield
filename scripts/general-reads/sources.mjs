/** Reads and decodes the inventory's declared sources. No network, no writes, inert on import. */
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const DEFAULT_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

export const SOURCE_PATHS = Object.freeze({
  catalog: 'packages/contracts/retrieval-0.2/catalog.json',
  scope: 'docs/CAPABILITY-SCOPE.md',
  skillAssets: 'packages/skills/assets.json',
  skillOriginalsDir: 'packages/skills/originals',
  adapters: 'scripts/general-reads/adapters.json',
  routes: 'scripts/general-reads/product-routes.json',
  dispatchContext: 'apps/gateway/dispatch/operation-context.mjs',
  skillServer: 'apps/worker/conversation/skills/mcp.mjs',
  contractResolver: 'packages/contracts/retrieval-0.2/validate.mjs',
});

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw Object.assign(new Error(message), {code: 'INVENTORY_SOURCE'}); };

function readFile(root, path) {
  const absolute = resolve(root, path);
  if (relative(root, absolute).startsWith('..')) fail(`Path escapes root: ${path}`);
  if (!existsSync(absolute)) fail(`Missing source: ${path}`);
  const bytes = readFileSync(absolute);
  return {path, bytes, text: bytes.toString('utf8'), sha256: sha256(bytes)};
}
const readJson = (root, path) => {
  const file = readFile(root, path);
  try { return {...file, json: JSON.parse(file.text)}; } catch { fail(`Invalid JSON: ${path}`); }
};

/** Registry rows of the scope ledger: `| id | read; meri; full_chat | proposed selected | ... |`. */
export function parseScopeLedger(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const cells = line.split('|').map(cell => cell.trim());
    if (cells.length < 8 || !/^[a-z][a-z0-9_]*$/.test(cells[1])) continue;
    const meta = /^(read|write); ([a-z_]+); ([a-z_, ]+)$/.exec(cells[2]);
    const proposal = /^proposed (selected|deferred)$/.exec(cells[3]);
    if (!meta || !proposal) continue;
    rows.push({id: cells[1], readOnly: meta[1] === 'read', backend: meta[2],
      surfaces: meta[3].split(',').map(s => s.trim()), disposition: proposal[1], owner: cells[4], fixtureKey: cells[5]});
  }
  return rows;
}

/** Profiles accepted by the gateway read dispatcher (first `[...].includes(profile)` literal). */
export function parseDispatchProfiles(text) {
  const match = /if \(profile === undefined\) return;\s*if \(!\[([^\]]+)\]\.includes\(profile\)\)/.exec(text);
  if (!match) fail('Gateway dispatch profile list not found');
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

/** Skills the worker's original-read server and runtime currently admit. */
export function parseAdmittedSkills(text) {
  const match = /if\(!\[((?:'quick_skill\.[a-z_]+',?)+)\]\.includes\(original\.pin\.skillId\)/.exec(text);
  if (!match) fail('Admitted skill list not found in skill server');
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

/** Model-visible text that could steer Meri toward a tool: contract validators, adapters and skill prose. */
function listScannedTextPaths(root, skillProsePaths) {
  const paths = [];
  const walk = dir => {
    for (const entry of readdirSync(resolve(root, dir), {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== 'test') walk(path); }
      else if (entry.name.endsWith('.mjs')) paths.push(path);
    }
  };
  walk('packages/contracts/retrieval-0.2');
  walk('apps/gateway/sources');
  return [...paths, ...skillProsePaths];
}

function listOriginalManifestPaths(root) {
  const base = resolve(root, SOURCE_PATHS.skillOriginalsDir), paths = [];
  for (const skill of readdirSync(base).sort())
    for (const version of readdirSync(resolve(base, skill)).sort()) {
      const path = `${SOURCE_PATHS.skillOriginalsDir}/${skill}/${version}/manifest.json`;
      if (existsSync(resolve(root, path))) paths.push(path);
    }
  return paths;
}

export async function loadSources(root = DEFAULT_ROOT) {
  const catalog = readJson(root, SOURCE_PATHS.catalog);
  const scope = readFile(root, SOURCE_PATHS.scope);
  const assets = readJson(root, SOURCE_PATHS.skillAssets);
  const adapters = readJson(root, SOURCE_PATHS.adapters);
  const routes = readJson(root, SOURCE_PATHS.routes);
  const dispatch = readFile(root, SOURCE_PATHS.dispatchContext);
  const skillServer = readFile(root, SOURCE_PATHS.skillServer);
  const skills = assets.json.assets.map(asset => {
    const path = relative(root, resolve(root, 'packages/skills', asset.manifestPath));
    const manifest = readJson(root, path);
    return {skillId: asset.skillId, skillVersion: asset.skillVersion, manifestPath: path, sha256: manifest.sha256,
      operations: manifest.json.allowedOperations.map(op => `${op.id}@${op.version}`)};
  });
  const prosePaths = assets.json.assets.map(asset => relative(root, resolve(root, 'packages/skills', asset.prosePath)));
  const scannedTexts = listScannedTextPaths(root, prosePaths).map(path => ({path, text: readFile(root, path).text}));
  const {resolveOperationContract} = await import(pathToFileURL(resolve(root, SOURCE_PATHS.contractResolver)).href);
  const bindings = new Map(catalog.json.operations.map(row => {
    const binding = resolveOperationContract(row.operation).binding;
    return [row.operation.id, {group: binding.group, dispatchProfile: binding.dispatchProfile ?? null,
      contextKeys: binding.contextKeys ? [...binding.contextKeys] : null, action: binding.action ?? null,
      supersededBy: binding.supersededBy ?? null}];
  }));
  return {
    catalog: catalog.json, scopeRows: parseScopeLedger(scope.text), skills,
    originalManifestPaths: listOriginalManifestPaths(root),
    adapters: adapters.json, routes: routes.json, bindings, scannedTexts,
    dispatchProfiles: parseDispatchProfiles(dispatch.text),
    admittedSkills: parseAdmittedSkills(skillServer.text),
    provenance: Object.fromEntries([catalog, scope, assets, adapters, routes, dispatch, skillServer]
      .map(file => [file.path, file.sha256]).concat(skills.map(s => [s.manifestPath, s.sha256]))),
    readSourceText: path => readFile(root, path).text,
    exists: path => existsSync(resolve(root, path)),
  };
}
