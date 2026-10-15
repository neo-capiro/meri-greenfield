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
/** Known undeclared imports with their owner decision. The guard fails on any other import and on entries that no longer occur. */
const reviewed=[
 {owner:'apps/runtime',name:'@anthropic-ai/claude-agent-sdk',files:['apps/runtime/selected/test/sdk-types.ts'],reason:'type-only fixture of frozen evidence, checked ad hoc by tsc and by no suite'},
 {owner:'apps/control/conversations',name:'pg',files:['lifecycle-hold-composition-pg','next-run-pg','prepared-execution-claim-pg','read-optional-pg','sequence-range-migration-pg','store-pg'].map(n=>`apps/control/conversations/test/${n}.test.mjs`),reason:'real-PostgreSQL test files; test dependency declaration needs lock approval'},
 {owner:'apps/control/conversations',name:'@temporalio/common',files:['apps/control/conversations/test/lifecycle-workflow.test.mjs'],reason:'locked transitively at 1.24.0; declaration needs lock approval'},
 {owner:'apps/worker/conversation',name:'zod',files:['apps/worker/conversation/skills/mcp.mjs'],reason:'SDK peer auto-installed at 4.6.7; declaration needs lock approval'},
 {owner:'apps/worker/conversation',name:'@modelcontextprotocol/sdk',files:['apps/worker/conversation/skills/test/mcp.test.mjs','apps/worker/conversation/skills/test/selected-runtime.test.mjs'],reason:'SDK peer auto-installed at 1.32.1; declaration needs lock approval'},
 {owner:'apps/worker/qualification',name:'zod',files:['apps/worker/qualification/probes/sdk-capture.mjs','apps/worker/qualification/probes/sdk-discovery-tools.test.mjs'],reason:'locked transitively at 4.6.5; declaration needs lock approval'},
 {owner:'.',name:'pg',files:['apps/gateway/test/postgres-budget-native-fixture.mjs','scripts/local-action/cli.mjs'],reason:'root-owned files with no declaring package; needs an owner decision'},
 {owner:'.',name:'jszip',files:['apps/artifacts/test/artifact-adapters-independent.test.mjs','apps/artifacts/test/artifact-execution.test.mjs'],reason:'root-owned files with no declaring package; needs an owner decision'},
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
