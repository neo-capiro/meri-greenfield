import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {posix} from 'node:path';

const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('package.json',root)));
const included=path=>manifest.files.some(entry=>path===entry||path.startsWith(entry+'/'));

test('native public entry points retain their complete relative source dependency closure in the package',()=>{
 const pending=['native-bootstrap','native-lifecycle','native-observer'].map(name=>manifest.exports['./'+name].default.slice(2)),seen=new Set();
 while(pending.length){
  const path=pending.pop();if(seen.has(path))continue;seen.add(path);
  assert.ok(!path.startsWith('../')&&existsSync(new URL(path,root)),`missing source ${path}`);
  assert.ok(included(path),`package files omit native dependency ${path}`);
  const source=readFileSync(new URL(path,root),'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/gu)){
   pending.push(posix.normalize(posix.join(posix.dirname(path),match[1])));
  }
 }
 assert.ok(seen.has('native-tls-kernel.mjs'));
 assert.ok(seen.has('retrieval-0.2/operation-contracts.mjs'));
 assert.ok(included('meri.schema.json'),'validator schema must ship with the source validators');
});
