import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { SOURCE_FILES, exactSources, sourceObject, sourceManifestBytes, sha256 } from './js/asset-sources.mjs';
import { ASSET_VERIFIER } from './js/asset-verifier.mjs';
import { buildUserDataPayload, PINS } from './app.mjs';

const INFRA = dirname(fileURLToPath(import.meta.url));
const REPO = join(INFRA,'../..');
const PYTHON = process.env.MERI_TEST_PYTHON || 'python3';
const PATHS = ['bootstrap.sh','host-evidence.py','host_evidence/__init__.py','host_evidence/admission.py','host_evidence/browser_capture.py','host_evidence/classification.py','host_evidence/cli.py','host_evidence/collection.py','host_evidence/config.py','host_evidence/evidence_io.py','host_evidence/export_protocol.py','host_evidence/poll.py','host_evidence/source_binding.py','seccomp.json'];
const sources = exactSources();
const expected = Object.fromEntries(sources.map(s=>[s.target,{bytes:s.bytes.length,sha256:sha256(s.bytes)}]));
const temp = mkdtempSync(join(REPO,'.task-inputs/CODEX-G1-BROWSER-js-'));
const verifier = join(temp,'verifier.py');
writeFileSync(verifier,ASSET_VERIFIER,{flag:'wx'});
let fixtureCount=0;
function fixture() {
  const root=join(temp,'install-'+(++fixtureCount));mkdirSync(join(root,'host_evidence'),{recursive:true});
  for(const s of sources)copyFileSync(join(INFRA,s.name),join(root,s.target));
  return root;
}
// Explicit fake uid/modes/chmod for Windows. All file bytes, reads, FD/path
// identity, tree membership and exclusive manifest creation remain REAL fixtures.
// No real /opt access, chmod, Docker, chown or host operation is performed.
const WRAPPER = String.raw`import os,runpy,stat,sys,types
old_lstat,old_fstat=os.lstat,os.fstat
root=sys.argv[2]
def view(s):
 d={k:getattr(s,k) for k in ('st_dev','st_ino','st_nlink','st_size','st_mtime_ns','st_ctime_ns')}
 d['st_ctime_ns']=getattr(s,'st_birthtime_ns',s.st_ctime_ns) if os.name=='nt' else s.st_ctime_ns
 d['st_uid']=0;d['st_mode']=stat.S_IFMT(s.st_mode)|(0o700 if stat.S_ISDIR(s.st_mode) else 0o600)
 return types.SimpleNamespace(**d)
def listed(p,*a,**k):
 if str(p) in ('/','/opt'):return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o755,st_uid=0)
 return view(old_lstat(p,*a,**k))
os.lstat=listed;os.fstat=lambda *a,**k:view(old_fstat(*a,**k));os.chmod=lambda *a,**k:None
if not hasattr(os,'O_NOFOLLOW'):os.O_NOFOLLOW=0
script=sys.argv[1];sys.argv=[script,root,sys.argv[3]]
runpy.run_path(script,run_name='__main__')`;
function verify(root) { return spawnSync(PYTHON,['-I','-B','-c',WRAPPER,verifier,root,JSON.stringify(expected)],{encoding:'utf8',timeout:10000}); }

test('fourteen literal raw sources and independent canonical source DATA',()=>{
  assert.deepEqual(SOURCE_FILES.map(x=>x.target),PATHS);
  assert.equal(sources.length,14);
  const obj=sourceObject(sources),bytes=sourceManifestBytes(sources);
  assert.equal(obj.schema,'meri-browser-source/2');assert.deepEqual(obj.assets.map(x=>x.path),PATHS);
  assert.deepEqual(JSON.parse(bytes),obj);assert.ok(bytes.length<=32768);
  assert.equal(bytes.toString(),JSON.stringify({assets:obj.assets,schema:'meri-browser-source/2'})+'\n');
  assert.deepEqual(Object.keys(obj).sort(),['assets','schema']);
  assert.equal(obj.assets[13].sha256,PINS.seccompDerivedSha256);
  assert.throws(()=>sourceObject(sources.slice(0,3)),/fourteen/);
});

test('v2 payload contains all paths, exact DATA metadata and isolated Python invocations',()=>{
  const payload=buildUserDataPayload('b0ae553a-a4c1-44c8-93b4-45afc6ed0139',PINS.image.split('@')[0]+'@sha256:'+'a'.repeat(64));
  assert.deepEqual(gunzipSync(payload.compressed),payload.raw);
  assert.equal(payload.base64,payload.compressed.toString('base64'));
  assert.equal(payload.metadata.sourceManifestCoverage,true);
  assert.deepEqual(payload.metadata.source,sourceObject(sources));
  assert.equal(payload.metadata.sourceManifest.sha256,sha256(sourceManifestBytes(sources)));
  assert.equal(payload.metadata.sourceManifest.bytes,sourceManifestBytes(sources).length);
  assert.equal((payload.text.match(/bounded 30 docker --config .* cp /g)||[]).length,14);
  for(const path of PATHS)assert.ok(payload.text.includes('$ASSET_ID:/meri-host-assets/'+path),path);
  assert.ok(payload.text.indexOf('mkdir --mode=0700 -- "$HOST_DIR/host_evidence"')<payload.text.indexOf(' cp '));
  for(const text of [payload.text,readFileSync(join(INFRA,'bootstrap.sh'),'utf8')])
    for(const line of text.split('\n').filter(x=>/\bpython3\b/.test(x)&&!x.startsWith('for command')))
      assert.match(line,/python3 -I -B/);
  assert.ok(payload.compressed.length<=16384);
});

test('actual finite verifier generates DATA exclusively from fourteen real fixture payloads',()=>{
  const root=fixture();const r=verify(root);assert.equal(r.status,0,r.stderr);
  assert.deepEqual(readFileSync(join(root,'source-manifest.v2.json')),sourceManifestBytes(sources));
  assert.deepEqual(readdirSync(root).sort(),['bootstrap.sh','host-evidence.py','host_evidence','seccomp.json','source-manifest.v2.json']);
  const repeated=verify(root);assert.notEqual(repeated.status,0,'existing DATA must refuse, not overwrite');
});

test('actual finite verifier refuses each missing or drifted payload and extra members',()=>{
  for(const path of PATHS) {
    for(const kind of ['missing','drift']) {
      const root=fixture(),p=join(root,path);
      if(kind==='missing')rmSync(p);else {const raw=readFileSync(p);raw[Math.floor(raw.length/2)]^=1;writeFileSync(p,raw);}
      const r=verify(root);assert.notEqual(r.status,0,path+':'+kind);assert.equal(existsSync(join(root,'source-manifest.v2.json')),false);
    }
  }
  for(const extra of ['extra','host_evidence/config.pyc']) {
    const root=fixture();writeFileSync(join(root,extra),'x');assert.notEqual(verify(root).status,0);
  }
});

test('support recipe and build protocol cover fourteen assets and refuse legacy build inputs',()=>{
  const dockerfile=readFileSync(join(REPO,'infra/qualification/host-assets.Dockerfile'),'utf8');
  const copies=dockerfile.split('\n').filter(l=>l.startsWith('COPY '));assert.equal(copies.length,14);
  assert.deepEqual(copies.map(l=>l.split(' /meri-host-assets/')[1]),PATHS);
  assert.ok(!copies.some(l=>l.includes('source-manifest')));
  assert.ok(!/^(RUN|ADD|CMD|ENTRYPOINT) /m.test(dockerfile));
  const script=JSON.parse(readFileSync(join(REPO,'infra/qualification/host-assets.buildspec.json'),'utf8')).phases.build.commands[0];
  assert.ok(script.includes("expected['schema']=='meri-host-assets-build-input/2'"));
  assert.ok(script.includes("len(expected['sourceFiles'])==14"));
  assert.ok(script.includes("'fourteenFixedFilesByteCompared':True"));
  assert.ok(script.indexOf('Owned credential purge')<script.indexOf('aws s3api put-object'));
  assert.ok(!/docker .* (start|run|exec)\b/.test(script));
  for(const line of script.split('\n').filter(l=>/\bpython3\b/.test(l)))assert.match(line,/python3 -I -B/);
});


test('actual packaging source preflight rejects old closure and real payload drift before any cloud step',()=>{
  const script=JSON.parse(readFileSync(join(REPO,'infra/qualification/host-assets.buildspec.json'),'utf8')).phases.build.commands[0];
  const preflight=script.split("<<'__SOURCE__'\n")[1].split('\n__SOURCE__')[0];
  const code=join(temp,'preflight.py');writeFileSync(code,preflight,{flag:'wx'});
  const owners=['infra/browser-qualification/app.mjs','infra/browser-qualification/js/asset-loader.mjs','infra/browser-qualification/js/asset-sources.mjs','infra/browser-qualification/js/asset-verifier.mjs','infra/browser-qualification/js/cli.mjs','infra/browser-qualification/js/config.mjs','infra/browser-qualification/js/legacy-classifier.mjs','infra/browser-qualification/js/stack.mjs','infra/browser-qualification/js/user-data.mjs','infra/browser-qualification/component-pins.json'];
  const record=path=>{const raw=readFileSync(join(REPO,path));return {path,bytes:raw.length,sha256:sha256(raw)};};
  const input={schema:'meri-host-assets-build-input/2',sourceCommit:'1'.repeat(40),
    sourceFiles:SOURCE_FILES.map(({name,target})=>({...record('infra/browser-qualification/'+name),assetPath:target})),
    ownerFiles:owners.map(record),dockerfile:record('infra/qualification/host-assets.Dockerfile'),
    buildspec:record('infra/qualification/host-assets.buildspec.json'),builderAuthority:record('infra/qualification/app.mjs')};
  const archive=join(temp,'archive');mkdirSync(archive);
  for(const row of [...input.sourceFiles,...input.ownerFiles,input.dockerfile,input.buildspec,input.builderAuthority]){
    const p=join(archive,row.path);mkdirSync(dirname(p),{recursive:true});copyFileSync(join(REPO,row.path),p);
  }
  const execute=(value)=>spawnSync(PYTHON,['-I','-B',code],{cwd:archive,encoding:'utf8',timeout:10000,
    env:{...process.env,SOURCE_COMMIT:input.sourceCommit,ASSET_EXPECTED_B64:Buffer.from(JSON.stringify(value)).toString('base64')}});
  const good=execute(input);assert.equal(good.status,0,good.stderr);rmSync(join(archive,'host-assets-expected.json'));
  const old=structuredClone(input);old.sourceFiles=old.sourceFiles.slice(0,3);assert.notEqual(execute(old).status,0);
  for(const row of input.sourceFiles){
    const p=join(archive,row.path),raw=readFileSync(p),bad=Buffer.from(raw);bad[0]^=1;writeFileSync(p,bad);
    assert.notEqual(execute(input).status,0,row.path);assert.equal(existsSync(join(archive,'host-assets-expected.json')),false);writeFileSync(p,raw);
  }
});
// Fixtures are finite. Captured suite output survives in the supervisor envelope;
// individual temp trees are not a retained native-provenance inventory.
test.after(()=>rmSync(temp,{recursive:true,force:true}));
