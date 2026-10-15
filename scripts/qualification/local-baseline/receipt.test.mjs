/** Portable receipts end to end over a synthetic two-test checkout (outside the repository); no repository suite is run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseSpecOutput} from './receipt.mjs';
import {outsideRepository,parseArguments,run} from './run-suites.mjs';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const definitions={schema:'meri.local-baseline-suites.v1',suites:[{name:'synthetic',cwd:'pkg',files:['test/*.test.mjs'],knownHostRequirements:['none']}]};
function fixture(t){
 const base=mkdtempSync(join(tmpdir(),'meri-receipt-'));t.after(()=>rmSync(base,{recursive:true,force:true}));
 const repo=join(base,'repo'),out=join(base,'receipts');mkdirSync(join(repo,'pkg/test'),{recursive:true});
 writeFileSync(join(repo,'pkg/test/a.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';\ntest('keeps working',()=>{});\ntest('breaks visibly',()=>{assert.equal(1,2,'synthetic first error line');});\n");
 return {repo,out};
}
const options=(repo,out,extra=[])=>({...parseArguments(['--out',out,'--repo',repo,'--allow-root','--no-subreaper',...extra])});

test('each suite gets a receipt with exact command, cwd, Node, UID, selectors, counts, failing names with first error lines and output hashes',t=>{
 const {repo,out}=fixture(t),commit='a'.repeat(40);
 const report=run(options(repo,out,['--source-commit',commit]),{definitions});
 assert.deepEqual(report.totals,{suites:1,passedSuites:0,tests:2,pass:1,fail:1});
 const receipt=JSON.parse(readFileSync(join(out,'receipts/synthetic.json'),'utf8'));
 assert.equal(receipt.schema,'meri.local-baseline-suite-receipt.v1');
 assert.equal(receipt.invocation.argv[0],process.execPath);assert.ok(receipt.invocation.argv.includes('--test'));assert.equal(receipt.invocation.argv.at(-1),'test/a.test.mjs');
 assert.equal(receipt.invocation.cwd,join(repo,'pkg'));assert.equal(receipt.invocation.cwdRelative,'pkg');
 assert.equal(receipt.host.node,process.version);assert.equal(receipt.host.uid,process.getuid());assert.equal(receipt.host.gid,process.getgid());
 assert.deepEqual(receipt.selectors.files,['test/a.test.mjs']);assert.equal(receipt.selectors.environment.MERI_REVIEW_SOURCE_ROOT,repo);assert.equal(receipt.selectors.namePattern,null);
 assert.equal(receipt.source.head,null,'an export without .git records no head');assert.equal(receipt.source.declaredSourceCommit,commit);assert.equal(receipt.source.declaredSourceCommitVerified,false);
 assert.equal(receipt.outcome.exitCode,1);assert.equal(receipt.outcome.counts.pass,1);assert.equal(receipt.outcome.counts.fail,1);
 assert.equal(receipt.outcome.failures.length,1);assert.equal(receipt.outcome.failures[0].name,'breaks visibly');assert.match(receipt.outcome.failures[0].detail,/synthetic first error line/u);
 for(const stream of ['stdout','stderr'])assert.equal(receipt.outputs[stream].sha256,sha256(readFileSync(join(out,receipt.outputs[stream].path))));
 assert.deepEqual(receipt.suite.knownHostRequirements,['none']);
 const sums=readFileSync(join(out,'SHA256SUMS'),'utf8').trim().split('\n').map(line=>line.split('  '));
 assert.deepEqual(sums.map(([,path])=>path).sort(),['RESULTS.json','receipts/synthetic.json','synthetic.stderr.txt','synthetic.stdout.txt']);
 for(const [hash,path] of sums)assert.equal(hash,sha256(readFileSync(join(out,path))),path);
 assert.equal(existsSync(join(repo,'receipts')),false,'nothing is written into the checkout');
});

test('a targeted rerun records its name selector and runs only the matching test',t=>{
 const {repo,out}=fixture(t);
 const report=run(options(repo,out,['--only','synthetic','--name-pattern','^breaks visibly$']),{definitions});
 const receipt=JSON.parse(readFileSync(join(out,'receipts/synthetic.json'),'utf8'));
 assert.equal(receipt.selectors.namePattern,'^breaks visibly$');assert.deepEqual(receipt.selectors.only,['synthetic']);
 assert.ok(receipt.invocation.argv.includes('--test-name-pattern=^breaks visibly$'));
 assert.equal(receipt.outcome.counts.pass,0);assert.equal(receipt.outcome.counts.fail,1);assert.equal(report.totals.fail,1);
});

test('receipts inside the checkout under test are refused before any suite runs',t=>{
 const {repo}=fixture(t);
 assert.throws(()=>run(options(repo,join(repo,'out')),{definitions}),{code:'USAGE',message:/outside the checkout/u});
 assert.throws(()=>run(options(repo,repo),{definitions}),{code:'USAGE'});
 assert.equal(existsSync(join(repo,'out')),false);
 assert.equal(outsideRepository('/a/b-c','/a/b'),true);assert.equal(outsideRepository('/a/b/c','/a/b'),false);
});

test('name patterns refuse npm suites; source commits must be full SHAs',t=>{
 const {repo,out}=fixture(t);
 assert.throws(()=>run(options(repo,out,['--name-pattern','x']),{definitions:{...definitions,suites:[{name:'n',kind:'npm',script:'check'}]}}),/node-test suites only/u);
 assert.throws(()=>parseArguments(['--out','/x','--source-commit','abc']),/full 40-hex/u);
 assert.throws(()=>parseArguments(['--out','/x','--name-pattern','(']),/invalid --name-pattern/u);
});

test('npm scripts running several node --test processes: summaries are summed and every failing section is read',()=>{
 const run1=['✔ a (1ms)','✖ b (1ms)','ℹ tests 2','ℹ pass 1','ℹ fail 1','','✖ failing tests:','','test at a.test.mjs:1:1','✖ b (1ms)','  Error: first','    at x'];
 const run2=['✖ c (1ms)','✔ d (1ms)','ℹ tests 3','ℹ pass 2','ℹ fail 1','','✖ failing tests:','','test at c.test.mjs:2:1','✖ c (1ms)','  AssertionError: second'];
 const out=parseSpecOutput([...run1,...run2].join('\n'));
 assert.deepEqual(out.counts,{tests:5,pass:3,fail:2});
 assert.deepEqual(out.failures,[{name:'b',detail:'Error: first'},{name:'c',detail:'AssertionError: second'}],'progress lines of a later run are not failures');
});
