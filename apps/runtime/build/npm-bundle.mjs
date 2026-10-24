/** Verify the one upstream package replacement in the otherwise unchanged npm bundle. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const lock=JSON.parse(fs.readFileSync(new URL('../../../infra/product-preview/runtime-packages.lock.json',import.meta.url)));
const replacement='node_modules/undici';
const json=file=>JSON.parse(fs.readFileSync(file));
function inventory(directory,omitReplacement=false) {
  const rows=[];
  function visit(relative='') {
    for(const entry of fs.readdirSync(path.join(directory,relative),{withFileTypes:true})) {
      const name=relative?`${relative}/${entry.name}`:entry.name;
      if(omitReplacement&&name===replacement)continue;
      assert(!entry.isSymbolicLink(),'NPM_BUNDLE_LINK_REFUSED');
      if(entry.isDirectory())visit(name);
      else {
        assert(entry.isFile(),'NPM_BUNDLE_TYPE_REFUSED');
        rows.push([name,createHash('sha256').update(fs.readFileSync(path.join(directory,name))).digest('hex')]);
      }
    }
  }
  visit();return rows.sort(([a],[b])=>a.localeCompare(b));
}
export function verifyNpmResolution(installed) {
  installed=path.resolve(installed);
  assert.equal(json(path.join(installed,'package.json')).version,lock.npm.version);
  const owner=path.join(installed,'node_modules/node-gyp/package.json');
  const require=createRequire(owner);
  const manifest=require.resolve('undici/package.json');
  assert.equal(fs.realpathSync(manifest),fs.realpathSync(path.join(installed,replacement,'package.json')));
  assert.equal(json(manifest).version,lock.npm.bundledUndici.version);
  assert(require('semver').satisfies(json(manifest).version,json(owner).dependencies.undici));
  assert.equal(typeof require('undici').fetch,'function');
}
export function compareNpmBundle(upstream,installed,upstreamUndici) {
  assert.equal(json(path.join(upstream,'package.json')).version,lock.npm.version);
  assert.equal(json(path.join(upstream,replacement,'package.json')).version,lock.npm.bundledUndici.replaces);
  assert.deepEqual(inventory(installed,true),inventory(upstream,true),'NPM_UNRELATED_BUNDLE_CHANGE');
  assert.deepEqual(inventory(path.join(installed,replacement)),inventory(upstreamUndici),'NPM_REPLACEMENT_BYTES');
  return {unchangedFiles:inventory(upstream,true).length,replacementFiles:inventory(upstreamUndici).length};
}
export function verifyNpmBundle(upstream,installed,upstreamUndici) {
  const result=compareNpmBundle(upstream,installed,upstreamUndici);
  verifyNpmResolution(installed);return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length,5);
  console.log(JSON.stringify(verifyNpmBundle(...process.argv.slice(2))));
}
