// Public source dependency preparation only. Importing this helper performs no IO.
import {readFileSync, realpathSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const OWNERS = Object.freeze({
  ROOT: '.', RUNTIME: 'apps/runtime', CONVERSATION: 'apps/worker/conversation',
  CONTROL_CONVERSATIONS: 'apps/control/conversations', QUALIFICATION: 'apps/worker/qualification',
  ARTIFACT_STORAGE: 'apps/artifacts/storage',
});
const fields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const inside = (root, path) => {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
};
const declaration = (manifest, name) => fields.map(key => manifest?.[key]?.[name]).find(value => typeof value === 'string');
const refused = reason => ({schemaVersion: 1, status: 'REFUSED', reason});

export function classifyImportError(error, sourceDirectory) {
  const category = error?.code === 'ERR_MODULE_NOT_FOUND' ? 'ESM_MODULE_MISSING' :
    error?.code === 'MODULE_NOT_FOUND' ? 'CJS_MODULE_MISSING' : null;
  if (!category) {
    return refused(error?.code === 'ERR_DLOPEN_FAILED' ? 'NATIVE_IMPORT_FAILURE' :
      ['ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_PACKAGE_IMPORT_NOT_DEFINED'].includes(error?.code) ? 'PACKAGE_EXPORTS_REFUSED' :
      error instanceof SyntaxError ? 'IMPORT_SYNTAX_REFUSED' : 'IMPORT_OTHER_REFUSED');
  }
  const message = typeof error.message === 'string' ? error.message : '';
  const match = category === 'ESM_MODULE_MISSING' ? /^Cannot find package '([^']+)' imported from ([^\r\n]+)$/u.exec(message) :
    /^Cannot find module '([^']+)'(?:\r?\n|$)/u.exec(message);
  if (!match) return refused('MISSING_PACKAGE_UNATTRIBUTED');
  const specifier = match[1];
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:\/[^\s\\:]*)?$/u.test(specifier) || specifier.startsWith('.')) {
    return refused('MISSING_PACKAGE_UNATTRIBUTED');
  }
  const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  const importerText = category === 'ESM_MODULE_MISSING' ? match[2] : error.requireStack?.[0];
  if (typeof importerText !== 'string' || /[\x00-\x1f]/u.test(importerText)) return refused('IMPORTER_UNVERIFIED');
  let source, importer;
  try {
    source = realpathSync(resolve(sourceDirectory));
    const nativePath = importerText.startsWith('file:') ? fileURLToPath(importerText) : importerText;
    if (!isAbsolute(nativePath)) return refused('IMPORTER_UNVERIFIED');
    importer = realpathSync(nativePath);
    if (!inside(source, importer)) return refused('IMPORTER_OUTSIDE_SOURCE');
  } catch { return refused('IMPORTER_UNVERIFIED'); }

  const owners = Object.entries(OWNERS).sort((a, b) => b[1].length - a[1].length);
  for (const [owner, prefix] of owners) {
    const ownerDirectory = resolve(source, prefix);
    if (!inside(ownerDirectory, importer)) continue;
    const rel = relative(ownerDirectory, importer).split(sep).join('/');
    let manifest, lock;
    try {
      if (realpathSync(ownerDirectory) !== ownerDirectory) return refused('OWNER_PATH_UNVERIFIED');
      manifest = json(resolve(ownerDirectory, 'package.json'));
      lock = json(resolve(ownerDirectory, 'package-lock.json'));
      if (lock.lockfileVersion !== 3 || !lock.packages?.['']) return refused('OWNER_LOCK_UNVERIFIED');
    } catch { return refused('OWNER_LOCK_UNVERIFIED'); }
    // Installed transitive modules belong only to their enclosing, explicit lock owner.
    if (rel.startsWith('node_modules/')) {
      let directory = dirname(importer);
      while (inside(ownerDirectory, directory)) {
        const key = relative(ownerDirectory, directory).split(sep).join('/');
        if (lock.packages[key]) {
          if (declaration(lock.packages[key], packageName) !== undefined) {
            return {schemaVersion: 1, status: 'MISSING', category, owner, package: packageName};
          }
          return refused('TRANSITIVE_PACKAGE_UNDECLARED');
        }
        directory = dirname(directory);
      }
      return refused('TRANSITIVE_OWNER_UNMAPPED');
    }
    const declared = declaration(manifest, packageName);
    if (declared === undefined) continue;
    if (declaration(lock.packages[''], packageName) !== declared) return refused('OWNER_LOCK_UNVERIFIED');
    return {schemaVersion: 1, status: 'MISSING', category, owner, package: packageName};
  }
  return refused('MISSING_OWNER_UNMAPPED');
}

export async function probe(sourceDirectory) {
  try {
    const source = realpathSync(resolve(sourceDirectory));
    // argv[1] remains this helper, so neither canonical CLI entry guard can match.
    await import(pathToFileURL(resolve(source, 'infra/product-preview/first-chat/render-material.mjs')).href);
    await import(pathToFileURL(resolve(source, 'infra/product-preview/first-chat/stage3-deploy.mjs')).href);
    return {schemaVersion: 1, status: 'READY'};
  } catch (error) { return classifyImportError(error, sourceDirectory); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let result;
  try {
    result = process.argv.length === 4 && process.argv[2] === '--source' && process.versions.node.startsWith('24.') ?
      await probe(process.argv[3]) : refused('PROBE_ARGUMENTS_REFUSED');
  } catch { result = refused('PROBE_INTERNAL_REFUSED'); }
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'READY' ? 0 : 1;
}
