import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const python=process.env.MERI_IMAGE_BUILD_TEST_PYTHON??(process.platform==='win32'?'python':'python3');
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const source=fileURLToPath(new URL('./image-build-source.py',import.meta.url));
function run(command,args,timeout=15000){return spawnSync(command,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:4*1024**2});}

test('standard shell help and Python import/help are inert; missing configuration refuses',()=>{
  const help=run(bash,['infra/product-preview/image-build.sh','--help']);
  assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/No model, database or deployment calls/);
  const syntax=run(bash,['-n','infra/product-preview/image-build.sh']);assert.equal(syntax.status,0,syntax.stderr);
  assert.equal(run(python,['-I','-B','-S',source,'--help']).status,0);
  assert.equal(run(python,['-I','-B','-S',source]).status,2);
  const imported=run(python,['-I','-B','-S','-c',`import importlib.util\ns=importlib.util.spec_from_file_location('source',${JSON.stringify(source)})\nm=importlib.util.module_from_spec(s);s.loader.exec_module(m)`]);
  assert.equal(imported.status,0,imported.stderr);assert.equal(imported.stdout+imported.stderr,'');
});

test('checked-in buildspec uses one standard command and retains evidence after failure',()=>{
  const spec=readFileSync(new URL('./image-buildspec.yml',import.meta.url),'utf8');
  assert.match(spec,/version: 0\.2/);assert.match(spec,/on-failure: CONTINUE/);
  assert.doesNotMatch(spec,/on-failure: (?:ABORT|RETRY)|\|\| true|exit 0|s3 (?:cp|sync)/);
  assert.match(spec,/- timeout --signal=TERM --kill-after=90s 25m bash infra\/product-preview\/image-build\.sh/);
  assert.match(spec,/finally:\n\s+- test -f image-evidence\/cleanup\.json/);
  assert.match(spec,/base-directory: image-evidence/);
  assert.doesNotMatch(spec,/secret|parameter-store|reports:/);
});

for(const file of ['test_image_build_linux_checks.py','test_image_build_diagnostics.py','test_image_build_scan.py']){
  test(`offline source/standard build behavior: ${file}`,()=>{
    const result=run(python,['-I','-B','-S',fileURLToPath(new URL(file,import.meta.url))],180000);
    // Preserve unittest counts, subtest failures and the explicit Windows RLIMIT skip.
    process.stdout.write(result.stdout);process.stdout.write(result.stderr);
    assert.equal(result.signal,null);assert.equal(result.status,0,`${file}: ${result.error??result.stderr}`);
  });
}
