/** Every bare import in first-party source resolves through a package that declares it: the nearest package.json or the
 * root package.json. Clean-checkout `npm ci` installs only declared packages, so an undeclared import works only through a
 * borrowed or hoisted install. Historical evidence under docs/ and evidence/ directories is immutable and not scanned. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,globSync,readFileSync} from 'node:fs';
import {builtinModules} from 'node:module';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../..',import.meta.url));
/** The one cross-package owner seam the lexical scanner cannot model: an anchored require, verified separately. */
const anchoredSeam={file:'apps/control/schedules/test/scheduled-dispatch-harness.mjs',owner:'apps/control/conversations',name:'@temporalio/client',version:'1.24.0'};
/** Known undeclared imports with their owner decision. The guard fails on any other import and on entries that no longer occur. */
const reviewed=[
 {owner:'apps/runtime',name:'@anthropic-ai/claude-agent-sdk',files:['apps/runtime/selected/test/sdk-types.ts'],reason:'type-only fixture of frozen evidence, checked ad hoc by tsc and by no suite'},
 {owner:'.',name:'@temporalio/client',files:[anchoredSeam.file],reason:'approved owner seam (coordinator decision 15 Oct 2026): the root-owned schedules harness resolves the client through createRequire anchored at apps/control/conversations/package.json, which declares @temporalio/client 1.24.0; no root install. The anchor is asserted below.'},
];
const builtins=new Set(builtinModules);
const specifier=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]((?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*)(?:\/[^'"\s]*)?['"]/gu;
const declared=new Map();
function manifest(dir){if(!declared.has(dir)){const j=JSON.parse(readFileSync(join(root,dir,'package.json'),'utf8'));declared.set(dir,new Set([j.name,...Object.keys({...j.dependencies,...j.devDependencies,...j.peerDependencies,...j.optionalDependencies})]));}return declared.get(dir);}
function owner(file){for(let dir=dirname(file);;dir=dirname(dir)){if(existsSync(join(root,dir,'package.json')))return dir;if(dir==='.')return '.';}}
export function undeclaredImports(){
 const files=globSync('**/*.{mjs,js,cjs,ts,mts,tsx}',{cwd:root,exclude:p=>/(^|\/)(node_modules|\.git|evidence)$/u.test(p)||p==='docs'}).filter(f=>!/(^|\/)(node_modules|evidence)\//u.test(f)&&!f.startsWith('docs/'));
 const found=new Map();
 for(const file of files){const dir=owner(file),own=manifest(dir),rootOwn=manifest('.');
  for(const [,name] of readFileSync(join(root,file),'utf8').matchAll(specifier)){if(builtins.has(name)||own.has(name)||rootOwn.has(name))continue;
   const key=dir+'\0'+name;if(!found.has(key))found.set(key,{owner:dir,name,files:new Set()});found.get(key).files.add(file);}}
 return [...found.values()];
}
test('first-party bare imports are declared by their owning package or reviewed',()=>{
 const rows=list=>list.flatMap(e=>[...e.files].map(f=>`${e.owner} ${e.name} ${f}`)).sort(),found=rows(undeclaredImports()),known=rows(reviewed);
 assert.deepEqual(found.filter(r=>!known.includes(r)),[],'undeclared import: declare it in the owning package or import it through its owner');
 assert.deepEqual(known.filter(r=>!found.includes(r)),[],'stale reviewed entry: remove it');
});
test('the schedules harness resolves the Temporal client only through its conversations owner',()=>{
 const source=readFileSync(join(root,anchoredSeam.file),'utf8'),ownerManifest=JSON.parse(readFileSync(join(root,anchoredSeam.owner,'package.json'),'utf8')),rootManifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
 assert.match(source,/\bconst require=createRequire\(new URL\('\.\.\/\.\.\/conversations\/package\.json',import\.meta\.url\)\);/u,'createRequire is anchored at the conversations package');
 assert.deepEqual([...source.matchAll(/require\('([^']+)'\)/gu)].map(m=>m[1]),[anchoredSeam.name],'the anchored require loads only the Temporal client');
 assert.doesNotMatch(source,/\b(?:from|import\s*\()\s*['"]@temporalio\//u,'no lexical (root-resolved) Temporal import');
 assert.equal(ownerManifest.dependencies?.[anchoredSeam.name],anchoredSeam.version);
 for(const field of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])assert.equal(rootManifest[field]?.[anchoredSeam.name],undefined,'no duplicate root install');
});
/** Coordinator decision of 15 Oct 2026: explicit declarations at the pins already locked in this repository; no upgrade. */
const approved=[
 {owner:'apps/control/conversations',field:'devDependencies',name:'pg',version:'8.23.1'},
 {owner:'apps/control/conversations',field:'devDependencies',name:'@temporalio/common',version:'1.24.0'},
 {owner:'apps/worker/conversation',field:'dependencies',name:'zod',version:'4.6.7'},
 {owner:'apps/worker/conversation',field:'devDependencies',name:'@modelcontextprotocol/sdk',version:'1.32.1'},
 {owner:'apps/worker/qualification',field:'dependencies',name:'zod',version:'4.6.5'},
 {owner:'.',field:'devDependencies',name:'pg',version:'8.23.1'},
 {owner:'.',field:'devDependencies',name:'jszip',version:'3.10.2'},
 {owner:'apps/artifacts/storage',field:'devDependencies',name:'pg',version:'8.23.0'},
];
test('approved declarations are exact pins that equal their owner lock entries; storage keeps its own pg pin',()=>{
 for(const {owner:dir,field,name,version} of approved){
  const manifest=JSON.parse(readFileSync(join(root,dir,'package.json'),'utf8')),lock=JSON.parse(readFileSync(join(root,dir,'package-lock.json'),'utf8'));
  assert.equal(manifest[field]?.[name],version,`${dir} ${field} ${name}`);
  assert.equal(lock.packages[''][field]?.[name],version,`${dir} lock root ${name}`);
  assert.equal(lock.packages['node_modules/'+name]?.version,version,`${dir} locked ${name}`);
 }
});
