/** Fixed upload child boundary: closed argument plans, host modality refusal, observation evaluation and admission.
 * Synthetic observations stand in for Linux /proc readings; one case exercises the real non-Linux refusal on this host.
 * None of this is evidence that any deployed container or image qualifies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtemp,rm,realpath} from 'node:fs/promises';
import {RENDERER_PROBE_SCHEMA,RENDERER_CHILD_ENV} from '../../../artifacts/renderer-qualification.mjs';
import {UPLOAD_SANDBOX_REQUIREMENTS,UPLOAD_ROLE_PREFIX,UPLOAD_IMAGE_PATHS,evaluateUploadSandbox,qualifyNativeUploadSandbox,
 uploadSandboxArguments,uploadScanArguments,uploadExtractArguments,runUploadSandbox} from '../native-sandbox.mjs';

const ZERO='0'.repeat(16),DIGEST='sha256:'+'a'.repeat(64),ROOT=UPLOAD_IMAGE_PATHS.tempRoot;
const sandboxed=(cwd,changes={})=>({schema:RENDERER_PROBE_SCHEMA,platform:'linux',uid:[1000,1000,1000,1000],gid:[1000,1000,1000,1000],noNewPrivs:1,
 capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:ZERO,CapBnd:ZERO,CapAmb:ZERO},rootMountOptions:'ro,relatime',interfaces:['lo'],
 cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},envNames:[...RENDERER_CHILD_ENV],cwd,home:cwd,tmpdir:cwd,
 workspace:{mode:0o700,uid:1000},credentialPathsReadable:[{path:'/run/meri/core-secret',readable:false}],...changes});

test('the fixed plans admit only host-owned programs and arguments',()=>{
 const scanArgs=uploadScanArguments({definitionsRoot:'/srv/defs',cwd:'/srv/defs/meri-upload-scan-abc123'});
 assert.deepEqual(scanArgs.slice(-1),['input.original']);
 assert.equal(scanArgs.includes('--database'),true);
 assert.equal(scanArgs.includes('--official-db-only=yes'),true,'only official signed databases are accepted');
 assert.equal(scanArgs.includes('--max-scantime=30000'),true,'the scan time bound is a product constant');
 assert.equal(scanArgs.includes('--tempdir=/srv/defs/meri-upload-scan-abc123'),true,'the only writable temp dir is the workspace');
 assert.deepEqual(uploadScanArguments({definitionsRoot:'/srv/defs',cwd:'/srv/defs/meri-upload-scan-abc123',mode:'version'}),['--version']);
 assert.equal(UPLOAD_IMAGE_PATHS.extractorPath,'/opt/meri/apps/control/uploads/native/extract.py','host and parser must agree on the extractor path');
 assert.equal(UPLOAD_IMAGE_PATHS.tempRoot,'/run/meri/upload-scratch');
 assert.equal(UPLOAD_IMAGE_PATHS.definitionsRoot,'/run/meri/upload-definitions','definitions live under the declared writable task-local volume /run/meri');
 assert.equal(UPLOAD_IMAGE_PATHS.tesseract,'/usr/bin/tesseract','the OCR engine path is the installed image path');
 assert.equal(UPLOAD_IMAGE_PATHS.pdftoppm,'/usr/bin/pdftoppm','the rasterizer path is the installed image path');
 assert.deepEqual(uploadExtractArguments({extractorPath:'/opt/meri/native/extract.py',format:'pdf'}),['/opt/meri/native/extract.py','pdf']);
 assert.deepEqual(uploadExtractArguments({extractorPath:'/opt/meri/native/extract.py',mode:'version'}),['--version']);
 for(const format of ['zip','exe','html','','TXT'])assert.throws(()=>uploadExtractArguments({extractorPath:'/opt/meri/native/extract.py',format}),{code:'UPLOAD_SANDBOX_REFUSED'});
 assert.throws(()=>uploadScanArguments({definitionsRoot:'relative',cwd:'/srv/defs/meri-upload-scan-abc123'}),{code:'UPLOAD_SANDBOX_REFUSED'});
 assert.throws(()=>uploadScanArguments({definitionsRoot:'/srv/defs',cwd:'relative'}),{code:'UPLOAD_SANDBOX_REFUSED'});
});

test('bubblewrap plan is refused for any workspace or role the fixed policy does not own',()=>{
 const probe=uploadSandboxArguments({role:'probe',cwd:ROOT+'/meri-upload-probe-abc123'});
 assert.equal(probe.includes('--unshare-all'),true);assert.equal(probe.includes('--cap-drop'),true);
 assert.equal(probe.includes(ROOT+'/meri-upload-probe-abc123'),true);
 const scan=uploadSandboxArguments({role:'scan',cwd:ROOT+'/meri-upload-scan-abc123',definitionsRoot:'/srv/defs'});
 assert.equal(scan.includes('/srv/defs'),true,'definitions root is read-only bound');
 const extract=uploadSandboxArguments({role:'extract',cwd:ROOT+'/meri-upload-extract-abc123',extractorPath:'/opt/meri/extract.py',format:'docx'});
 assert.equal(extract.includes('/opt/meri/extract.py'),true,'extractor program is read-only bound');
 const wrong=[{role:'probe',cwd:ROOT+'/meri-upload-scan-abc123'},{role:'scan',cwd:ROOT+'/meri-upload-probe-abc123',definitionsRoot:'/srv/defs'},
  {role:'extract',cwd:'/tmp/other-abc123',extractorPath:'/opt/meri/extract.py',format:'docx'},{role:'nope',cwd:ROOT+'/meri-upload-probe-abc123'},
  {role:'probe',cwd:'/srv/x/meri-upload-probe-abc123'},{role:'scan',cwd:ROOT+'/meri-upload-scan-toolong',definitionsRoot:'/srv/defs'}];
 for(const plan of wrong)assert.throws(()=>uploadSandboxArguments(plan),{code:'UPLOAD_SANDBOX_REFUSED'});
});

test('a fully observed upload child attests every shared requirement; each violation clears exactly one',()=>{
 const cwd=ROOT+'/'+UPLOAD_ROLE_PREFIX.probe+'a1b2c3';
 const clean=evaluateUploadSandbox(sandboxed(cwd),{tempRoot:ROOT});
 assert.deepEqual(clean.findings,[]);
 assert.deepEqual(UPLOAD_SANDBOX_REQUIREMENTS.filter(k=>clean.sandbox[k]!==true),[]);
 const cases=[
  [{gid:[0,0,0,0]},['nonRootUser']],
  [{interfaces:['eth1','lo']},['noNetwork','noCredentials']],
  [{rootMountOptions:'rw,relatime'},['readOnlyRootFilesystem']],
  [{noNewPrivs:0},['noNewPrivileges']],
  [{capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:'0000000000000400',CapBnd:ZERO,CapAmb:ZERO}},['dropAllCapabilities']],
  [{workspace:{mode:0o755,uid:1000}},['privateWorkspace']],
  [{cwd:ROOT+'/meri-upload-scan-a1b2c3',home:ROOT+'/meri-upload-scan-a1b2c3',tmpdir:ROOT+'/meri-upload-scan-a1b2c3'},['privateWorkspace']],
  [{cgroup:{memoryMax:'max',pidsMax:'64',cpuMax:'50000 100000'}},['boundedResources']],
  [{envNames:[...RENDERER_CHILD_ENV,'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI']},['noCredentials']],
  [{credentialPathsReadable:[{path:'/run/meri/core-secret',readable:true}]},['noCredentials']],
 ];
 for(const [changes,expected] of cases)assert.deepEqual(evaluateUploadSandbox(sandboxed(cwd,changes),{tempRoot:ROOT}).findings.map(f=>f.requirement),expected);
});

test('non-Linux and malformed observations attest nothing and never throw',()=>{
 const cwd=ROOT+'/'+UPLOAD_ROLE_PREFIX.probe+'a1b2c3';
 for(const observation of [sandboxed(cwd,{platform:'win32'}),sandboxed(cwd,{schema:'other/1'}),null,[],42,{}]){
  const {sandbox,findings}=evaluateUploadSandbox(observation,{tempRoot:ROOT});
  assert.equal(UPLOAD_SANDBOX_REQUIREMENTS.some(k=>sandbox[k]),false);assert.equal(findings.length,8);
 }
 assert.equal(evaluateUploadSandbox(sandboxed(cwd)).sandbox.privateWorkspace,false,'no trusted temp root cannot attest the workspace');
});

test('qualification admits only a complete observation from the identical runner',async()=>{
 const root=await realpath(tmpdir());
 const calls=[];
 const make=(changes)=>async(role,options)=>{calls.push({role,cwd:options.cwd});if(!options.cwd.startsWith(root))throw Error('unexpected cwd');
  return {stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd,changes))),receipt:{exitCode:0}};};
 const admitted=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:make({})});
 assert.equal(admitted.admitted,true);assert.equal(admitted.admission.role,'upload-native');assert.equal(admitted.admission.toolRootsReadOnly,true);
 assert.equal(admitted.missing.length,0);assert.equal(calls[0].role,'probe');assert.match(calls[0].cwd,/meri-upload-probe-[A-Za-z0-9]{6}$/u);
 const bad=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:make({noNewPrivs:0})});
 assert.equal(bad.admitted,false);assert.deepEqual(bad.missing,['noNewPrivileges']);
 const invalid=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:async()=>({stdout:Buffer.from('not json')})});
 assert.equal(invalid.admitted,false);assert.equal(invalid.reason,'UPLOAD_PROBE_FAILED');
 await assert.rejects(()=>qualifyNativeUploadSandbox({imageDigest:'nope',deadlineMs:Date.now()+1,tempRoot:root,run:make({})}),{code:'UPLOAD_QUALIFICATION_CONFIGURATION'});
});

test('the real runner refuses to spawn on this non-Linux host',{skip:process.platform==='linux'},async()=>{
 const cwd=await mkdtemp(join(tmpdir(),UPLOAD_ROLE_PREFIX.scan));
 try{await assert.rejects(()=>runUploadSandbox('scan',{cwd,definitionsRoot:'/srv/defs',deadlineMs:Date.now()+1000,input:Buffer.alloc(0)}),{code:'UPLOAD_SANDBOX_REFUSED'});}
 finally{await rm(cwd,{recursive:true,force:true});}
});
