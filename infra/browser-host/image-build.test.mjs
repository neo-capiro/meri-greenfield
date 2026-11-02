import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const python=process.env.MERI_IMAGE_BUILD_TEST_PYTHON??(process.platform==='win32'?'python':'python3');
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
const script=readFileSync(new URL('./image-build.sh',import.meta.url),'utf8');
function run(command,args,env={},timeout=15000){return spawnSync(command,args,{cwd:root,encoding:'utf8',timeout,env:{...process.env,...env},maxBuffer:4*1024**2});}

test('shell help is inert, the syntax is valid, and missing or foreign configuration refuses before any effect',()=>{
  const help=run(bash,['infra/browser-host/image-build.sh','--help']);
  assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/browser-<commit>-<32 hex>/);assert.match(help.stdout,/No model, database or deployment calls/);
  assert.equal(run(bash,['-n','infra/browser-host/image-build.sh']).status,0);
  assert.equal(run(bash,['infra/browser-host/image-build.sh','extra']).status,2);
  // On a non-aarch64 or non-Linux host the platform guard refuses first; on the build host the environment guards do.
  assert.equal(run(bash,['infra/browser-host/image-build.sh']).status,2);
  const commit='a'.repeat(40);
  const env={SOURCE_COMMIT:commit,SOURCE_MANIFEST_SHA256:'b'.repeat(64),SOURCE_VERSION:'v1',CODEBUILD_SOURCE_VERSION:'v1',SOURCE_MANIFEST_KEY:'inputs/m.json',SOURCE_MANIFEST_VERSION:'v2'};
  for(const tag of [`product-${commit}-${'c'.repeat(32)}`,`browser-${'f'.repeat(40)}-${'c'.repeat(32)}`,`browser-${commit}-${'c'.repeat(31)}`,`browser-${commit}-${'C'.repeat(32)}`])
    assert.equal(run(bash,['infra/browser-host/image-build.sh'],{...env,IMAGE_TAG:tag}).status,2,tag);
});

test('the script is bound to the browser host repository, Dockerfile and tag shape, never the product runtime ones',()=>{
  assert.match(script,/repository=meri-greenfield\/browser-host\n/);
  assert.match(script,/dockerfile=apps\/runtime\/Dockerfile\.browser-host/);
  assert.match(script,/\^browser-\$\{SOURCE_COMMIT\}-\[a-f0-9\]\{32\}\$/);
  assert.doesNotMatch(script,/qualification-worker|apps\/runtime\/Dockerfile\n|runtime-packages\.lock|clamav|init_probe/);
  assert.match(script,/docker build --platform linux\/arm64/);
  assert.equal((script.match(/docker build /gu)??[]).length,1,'one build only');
});

test('the build verifies the sealed source and refuses a missing lockfile by name before building',()=>{
  assert.match(script,/image-build-source\.py verify-tree --directory "\$PWD" --manifest "\$scratch\/members\.json" --commit "\$SOURCE_COMMIT" --manifest-sha256 "\$SOURCE_MANIFEST_SHA256"/);
  assert.ok(script.indexOf('verify-tree')<script.indexOf('docker build '));
  assert.ok(script.indexOf('browser-host-service/image/package-lock.json')<script.indexOf('docker build '));
});

test('every probe runs without network, capabilities or new privileges and nothing is mounted',()=>{
  const common=/common=\(docker run --rm --name "\$probe" --platform linux\/arm64 --read-only --network none --cap-drop ALL --security-opt no-new-privileges/.exec(script);
  assert.ok(common);
  assert.doesNotMatch(script,/--privileged|--volume|\s-v\s|--mount|--env-file|--network host/);
  assert.match(script,/--entrypoint sha256sum[^\n]*meri-host-launcher[^\n]*meri-host-relay-launcher[^\n]*protected-bootstrap\.mjs/);
  assert.match(script,/-perm \/6000/);assert.match(script,/NATIVE_PROTECTED_BOOTSTRAP_REFUSED/);
});

test('the image is pushed only after the probes and hashes, and the result needs a complete scan with 0 HIGH/CRITICAL',()=>{
  assert.ok(script.indexOf('hashes.json')<script.indexOf('docker push'));
  assert.ok(script.indexOf('docker push')<script.indexOf('image-scan-complete'));
  assert.match(script,/"\$helper" result --scan/);
  assert.match(script,/imageTagMutability'\]=='IMMUTABLE'/);
  assert.match(script,/DOCKER_CONFIG="\$scratch\/auth"/,'registry credentials live in scratch and are removed');
  assert.doesNotMatch(script,/^[^#\n]*echo[^\n]*password|set -x/mu);
});

test('checked-in buildspec uses one standard command and retains evidence after failure',()=>{
  const spec=readFileSync(new URL('./image-buildspec.yml',import.meta.url),'utf8');
  assert.match(spec,/version: 0\.2/);assert.match(spec,/on-failure: CONTINUE/);
  assert.doesNotMatch(spec,/on-failure: (?:ABORT|RETRY)|\|\| true|exit 0|s3 (?:cp|sync)/);
  assert.match(spec,/- timeout --signal=TERM --kill-after=90s 40m bash infra\/browser-host\/image-build\.sh/);
  assert.match(spec,/finally:\n\s+- test -f image-evidence\/cleanup\.json/);
  assert.match(spec,/base-directory: image-evidence/);
  assert.doesNotMatch(spec,/secret|parameter-store|reports:/);
});

test('offline evidence readers: hashes, inspection, digest and scan result',()=>{
  const result=run(python,['-I','-B','-S',fileURLToPath(new URL('./test_image_evidence.py',import.meta.url))],{},60000);
  process.stdout.write(result.stdout);process.stdout.write(result.stderr);
  assert.equal(result.signal,null);assert.equal(result.status,0,result.error??result.stderr);
});

test('the exported image installs exactly the locked Wolfi closure, staged by URL and sha256 beside the retained signed index',async()=>{
  const {createHash}=await import('node:crypto');
  const lock=JSON.parse(readFileSync(new URL('./browser-host-packages.lock.json',import.meta.url),'utf8'));
  const dockerfile=readFileSync(new URL('../../apps/runtime/Dockerfile.browser-host',import.meta.url),'utf8');
  const index=readFileSync(new URL(`../../${lock.retainedSignedIndex}`,import.meta.url));
  assert.equal(createHash('sha256').update(index).digest('hex'),lock.packageIndexSha256);
  assert.match(lock.retainedSignedIndex,new RegExp(`^infra/product-preview/native-apk-index/aarch64-APKINDEX-${lock.packageIndexSha256}\.tar\.gz$`));
  assert.ok(dockerfile.includes(`COPY ${lock.retainedSignedIndex} /tmp/meri-browser-host-repo/aarch64/APKINDEX.tar.gz`));
  assert.ok(dockerfile.includes(`ARG HOST_IMAGE=${lock.hostImageUri}`));
  const staged=[...dockerfile.matchAll(/^ADD --checksum=sha256:([0-9a-f]{64}) (\S+) \/tmp\/meri-browser-host-repo\/aarch64\/(\S+)$/gmu)].map(m=>({sha256:m[1],source:m[2],file:m[3]}));
  assert.deepEqual(staged,lock.systemPackages.map(p=>({sha256:p.sha256,source:p.source,file:`${p.name}-${p.version}.apk`})));
  const install=dockerfile.slice(dockerfile.indexOf('--repositories-file /dev/null --update-cache'),dockerfile.indexOf('apk info -v | sort'));
  assert.deepEqual(install.match(/[A-Za-z0-9.+_-]+=[A-Za-z0-9.+_~-]+/gu),lock.systemPackages.map(p=>`${p.name}=${p.version}`));
  assert.ok(!/apt-get|dpkg/u.test(dockerfile.slice(dockerfile.indexOf('AS host-repo-1'))),'no Debian package step after the build stage');
});
