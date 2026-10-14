/** Runner parsing and refusal behavior; no suite is executed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseArguments,parseSpecOutput,scrubbedEnvironment} from './run-suites.mjs';
const script=fileURLToPath(new URL('./run-suites.mjs',import.meta.url));

test('spec summary counts and failing names with first error line are parsed',()=>{
 const text=['✔ fine (1ms)','✖ broken (2.5ms)','ℹ tests 2','ℹ suites 0','ℹ pass 1','ℹ fail 1','ℹ cancelled 0','ℹ skipped 0','ℹ todo 0','ℹ duration_ms 12.5','','✖ failing tests:','','test at x.test.mjs:3:1','✖ broken (2.5ms)','  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:','    code: \'ERR_ASSERTION\'','  }',''].join('\n');
 const out=parseSpecOutput(text);
 assert.deepEqual(out.counts,{tests:2,suites:0,pass:1,fail:1,cancelled:0,skipped:0,todo:0});
 assert.deepEqual(out.failures,[{name:'broken',detail:'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:'}]);
});
test('file-level failures without timing and crashes without a summary are retained',()=>{
 const out=parseSpecOutput('✖ failing tests:\n\ntest at a.test.mjs:1:1\n✖ a.test.mjs (50ms)\n  \'test failed\'\n');
 assert.deepEqual(out.counts,{});assert.deepEqual(out.failures,[{name:'a.test.mjs',detail:"'test failed'"}]);
 assert.deepEqual(parseSpecOutput('node:internal/modules ... ERR_MODULE_NOT_FOUND'),{counts:{},failures:[]});
});
test('ambient credentials and host overrides are scrubbed; canonical fixture selectors are supplied, never overridden',()=>{
 const env=scrubbedEnvironment({PATH:'/bin',AWS_ACCESS_KEY_ID:'x',ANTHROPIC_BASE_URL:'y',CLAUDE_CODE_SESSION_ID:'z',CLAUDE_PID:'1',CCR_SESSION_PROFILE:'s',NODE_EXTRA_CA_CERTS:'/c',NODE_OPTIONS:'--x',DATABASE_URL:'d',PGPASSWORD:'p',HTTPS_PROXY:'h',GH_TOKEN:'t',GITHUB_TOKEN:'t',CLOUDSDK_AUTH_ACCESS_TOKEN:'t',GIT_CONFIG_KEY_0:'k',SOME_SERVICE_TOKEN:'t',MY_API_KEY:'k',MERI_INSPECTION_TEST_DATABASE:'custom',HOME:'/home/u'},'/repo');
 assert.deepEqual(Object.keys(env).sort(),['HOME','MERI_INSPECTION_TEST_DATABASE','MERI_INSPECTION_TEST_SOCKET','MERI_PREPARED_LAUNCH_DATABASE','MERI_REVIEW_SOURCE_ROOT','PATH']);
 assert.equal(env.MERI_REVIEW_SOURCE_ROOT,'/repo');assert.equal(env.MERI_INSPECTION_TEST_DATABASE,'custom');assert.equal(env.MERI_INSPECTION_TEST_SOCKET,'/tmp/meri-prepared-kickoff-pg-20261014/socket');
 const scratch=scrubbedEnvironment({MERI_PIPELINE_ARTIFACT_ROOT:'/keep',MERI_SOFFICE:'/my/soffice'},'/repo',{scratchRoot:'/out/scratch',python3:'/usr/bin/python3',soffice:'/usr/bin/soffice'});
 assert.equal(scratch.MERI_PIPELINE_ARTIFACT_ROOT,'/keep');assert.equal(scratch.MERI_ASSOCIATION_ARTIFACT_ROOT,'/out/scratch/meri_association_artifact_root');assert.equal(scratch.MERI_DOCUMENT_PYTHON,'/usr/bin/python3');assert.equal(scratch.MERI_PYTHON,'/usr/bin/python3');assert.equal(scratch.MERI_SOFFICE,'/my/soffice');
});
test('arguments: --out is required, unknown flags and names refuse, help is available',()=>{
 assert.throws(()=>parseArguments([]),/--out is required/u);
 assert.throws(()=>parseArguments(['--out','/x','--bogus']),/unknown argument/u);
 assert.deepEqual(parseArguments(['--help']),{help:true});
 const o=parseArguments(['--out','/x','--only','a,b','--allow-root','--no-subreaper']);
 assert.equal(o.out,'/x');assert.deepEqual([...o.only],['a','b']);assert.equal(o.allowRoot,true);assert.equal(o.subreaper,false);
});
test('CLI help exits 0 and missing --out exits 2 before any suite runs',()=>{
 assert.match(execFileSync(process.execPath,[script,'--help'],{encoding:'utf8'}),/^Usage: node scripts\/qualification\/local-baseline\/run-suites\.mjs --out DIR/u);
 let status;try{execFileSync(process.execPath,[script],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch(error){status=error.status;}
 assert.equal(status,2);
});
