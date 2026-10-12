// Read-only exact Git/source and AST comparison. Does not import runtime probes.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const ts=require('/workspace/meri-g1-durable-budget-20261012/packages/contracts/node_modules/typescript/lib/typescript.js');
const root=process.argv[2], candidate=process.argv[3], base='14be9fc614568a74133b89f2b229e50c9b030322';
const output=path.dirname(fileURLToPath(import.meta.url));
if(!root||!candidate)throw Error('explicit source root and candidate required');
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:20*1024*1024});
const before=p=>git('show',`${base}:${p}`).toString();
const after=p=>git('show',`${candidate}:${p}`).toString();
const sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[];function check(name,value){checks.push({name,passed:!!value});if(!value)throw Error(name);}
check('exact candidate HEAD',git('rev-parse','HEAD').toString().trim()===candidate);
check('clean source worktree',git('status','--porcelain').length===0);
const changes=git('diff','--name-status',base,candidate).toString().trim().split('\n').filter(Boolean).map(x=>x.split('\t'));
const allowedExisting=new Set(['apps/worker/qualification/probes/runtime.mjs','apps/worker/qualification/probes/browser.mjs','apps/worker/qualification/probes/office-export.mjs','apps/worker/qualification/probes/office-export.test.mjs','apps/worker/qualification/README.md','scripts/qualification/worker_context.py','scripts/qualification/worker_context_test.py']);
const allowedNew=new Set(['apps/worker/qualification/probes/owned-probe-child.mjs','apps/worker/qualification/probes/owned-probe-child.test.mjs','apps/worker/qualification/probes/browser-lifetime.mjs','apps/worker/qualification/probes/browser-lifetime.test.mjs','docs/coordination/reports/MERI-SANDBOX-LIFECYCLE-20261012.md','docs/coordination/tasks/MERI-SANDBOX-LIFECYCLE-20261012.md']);
check('only allocated source and author evidence paths change',changes.every(([s,p])=>(s==='M'&&allowedExisting.has(p))||(s==='A'&&(allowedNew.has(p)||p.startsWith('docs/qualification/candidates/sandbox-lifecycle-20261012/author/')))));
const parse=(s,p='file.mjs')=>ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
function testFacts(s){const ast=parse(s);const assertions=[],names=[];function visit(n){if(ts.isCallExpression(n)){const f=n.expression.getText(ast);if(f==='assert'||f.startsWith('assert.'))assertions.push(n.getText(ast));if(f==='test'&&n.arguments[0])names.push(n.arguments[0].getText(ast));}ts.forEachChild(n,visit);}visit(ast);return {assertions,names};}
const testPath='apps/worker/qualification/probes/office-export.test.mjs';
const oldFacts=testFacts(before(testPath)),newFacts=testFacts(after(testPath));
check('all original Office assertion expressions byte-exact and ordered',JSON.stringify(oldFacts.assertions)===JSON.stringify(newFacts.assertions));
check('all original Office test names exact and ordered',JSON.stringify(oldFacts.names)===JSON.stringify(newFacts.names));
const unchangedFunctions={
 'apps/worker/qualification/probes/office-export.mjs':new Set(['main','runArtifactsChild','defaultGroupKill','defaultProbeGroup','streamRecords','writeBounded']),
 'apps/worker/qualification/probes/browser.mjs':new Set(['main','startFixtureServer']),
 'apps/worker/qualification/probes/runtime.mjs':new Set(['main','runProbeScript','classifyChildResult']),
};
let functions=0;
for(const [p,allowed] of Object.entries(unchangedFunctions)){
 const original=parse(before(p),p),updated=parse(after(p),p);
 const fresh=new Map(updated.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n.getText(updated)]));
 for(const node of original.statements.filter(ts.isFunctionDeclaration))if(!allowed.has(node.name.text)){
  check(`original function exact: ${p}:${node.name.text}`,fresh.get(node.name.text)===node.getText(original));functions++;
 }
}
const protectedPaths=git('ls-tree','-r','--name-only',base).toString().trim().split('\n').filter(p=>p.startsWith('packages/contracts/')||p.endsWith('package-lock.json')||p.endsWith('package.json')||p==='apps/worker/qualification/component-pins.json'||p==='apps/worker/qualification/requirements.lock.txt'||p==='apps/worker/qualification/Dockerfile'||p==='apps/worker/qualification/probes/artifacts.mjs'||p==='apps/worker/qualification/probes/artifacts.py'||p==='apps/worker/qualification/probes/static.test.mjs'||p==='apps/worker/qualification/probes/office-reconstruct.mjs');
for(const p of protectedPaths)check(`protected original exact: ${p}`,before(p)===after(p));
const contextTest='scripts/qualification/worker_context_test.py';
check('context test has exactly three intended cardinality changes',after(contextTest).split(', 57)').length===4&&after(contextTest).replaceAll(', 57)',', 53)')===before(contextTest));
const context='scripts/qualification/worker_context.py';
const additions='    "probes/owned-probe-child.mjs", "probes/owned-probe-child.test.mjs",\n    "probes/browser-lifetime.mjs", "probes/browser-lifetime.test.mjs",\n';
check('finite context list adds exactly four allocated files and no other bytes',after(context).includes(additions)&&after(context).replace(additions,'')===before(context));
const files=changes.filter(([,p])=>p.startsWith('apps/')||p.startsWith('scripts/')).map(([,p])=>{const b=git('show',`${candidate}:${p}`);check(`worktree matches Git: ${p}`,Buffer.compare(b,fs.readFileSync(path.join(root,p)))===0);return{path:p,bytes:b.length,sha256:sha(b)};});
const patch=git('diff','--binary',base,candidate,'--','apps/','scripts/');fs.writeFileSync(path.join(output,'exact-source.patch'),patch);
const receipt={base,candidate,tree:git('rev-parse',`${candidate}^{tree}`).toString().trim(),sourcePatchSha256:sha(patch),typescriptParserVersion:ts.version,checks,protectedFiles:protectedPaths.length,unchangedFunctions:functions,originalOfficeAssertions:oldFacts.assertions.length,originalOfficeTests:oldFacts.names.length,files,allPassed:true};
fs.writeFileSync(path.join(output,'final-preservation.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({candidate,tree:receipt.tree,checks:checks.length,protectedFiles:protectedPaths.length,unchangedFunctions:functions,originalOfficeAssertions:oldFacts.assertions.length,originalOfficeTests:oldFacts.names.length,sourcePatchSha256:receipt.sourcePatchSha256}));
