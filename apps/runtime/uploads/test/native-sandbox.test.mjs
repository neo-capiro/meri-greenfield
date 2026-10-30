/** Fixed upload child boundary: closed argument plans, host modality refusal, observation evaluation and admission.
 * Synthetic observations stand in for Linux /proc readings; one case exercises the real non-Linux refusal on this host.
 * None of this is evidence that any deployed container or image qualifies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtemp,rm,realpath} from 'node:fs/promises';
import {RENDERER_PROBE_SCHEMA,RENDERER_CHILD_ENV} from '../../../artifacts/renderer-qualification.mjs';
import {UPLOAD_SANDBOX_REQUIREMENTS,UPLOAD_ROLE_PREFIX,UPLOAD_IMAGE_PATHS,UPLOAD_CHILD_ENV,evaluateUploadSandbox,qualifyNativeUploadSandbox,
 resolveEffectiveCgroup,combineCgroupBounds,parseCgroupPath,parseCgroupMountRoot,readHostCgroup,
 uploadSandboxArguments,uploadScanArguments,uploadExtractArguments,runUploadSandbox} from '../native-sandbox.mjs';
import {observeProbeCgroup,CGROUP_MOUNT} from '../../../artifacts/renderer-probe-observation.mjs';

const ZERO='0'.repeat(16),DIGEST='sha256:'+'a'.repeat(64),ROOT=UPLOAD_IMAGE_PATHS.tempRoot;
const sandboxed=(cwd,changes={})=>({schema:RENDERER_PROBE_SCHEMA,platform:'linux',uid:[1000,1000,1000,1000],gid:[1000,1000,1000,1000],noNewPrivs:1,
 capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:ZERO,CapBnd:ZERO,CapAmb:ZERO},rootMountOptions:'ro,relatime',interfaces:['lo'],
 cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},envNames:[...UPLOAD_CHILD_ENV],cwd,home:cwd,tmpdir:cwd,
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
  [{envNames:[...UPLOAD_CHILD_ENV,'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI']},['noCredentials']],
  [{credentialPathsReadable:[{path:'/run/meri/core-secret',readable:true}]},['noCredentials']],
 ];
 for(const [changes,expected] of cases)assert.deepEqual(evaluateUploadSandbox(sandboxed(cwd,changes),{tempRoot:ROOT}).findings.map(f=>f.requirement),expected);
});

test('the unqualified diagnostic carries numeric cgroup bounds and fixed credential predicates only',()=>{
 const cwd=ROOT+'/'+UPLOAD_ROLE_PREFIX.probe+'a1b2c3';
 const observation=sandboxed(cwd,{cgroup:{memoryMax:'max',pidsMax:'64',cpuMax:'50000 100000'},
  envNames:[...UPLOAD_CHILD_ENV,'AWS_REGION'],
  credentialPathsReadable:[{path:'/run/meri/core-secret',readable:true},{path:'/run/meri/other',readable:false}]});
 const {diagnostic}=evaluateUploadSandbox(observation,{tempRoot:ROOT});
 assert.deepEqual(diagnostic.resources,{memoryMax:0,pidsMax:64,cpuMax:50000});
 assert.deepEqual(diagnostic.credentials,{networkIsolated:true,envCount:UPLOAD_CHILD_ENV.length+1,allowedCount:UPLOAD_CHILD_ENV.length,envAllowed:false,checked:2,readable:1});
 // A present-but-unlimited cgroup entry (0) is distinguishable from an absent one (null), which is what the event needs.
 const absent=evaluateUploadSandbox(sandboxed(cwd,{cgroup:{}}),{tempRoot:ROOT}).diagnostic;
 assert.deepEqual(absent.resources,{memoryMax:null,pidsMax:null,cpuMax:null});
 const unlimited=evaluateUploadSandbox(sandboxed(cwd,{cgroup:{memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'}}),{tempRoot:ROOT}).diagnostic;
 assert.deepEqual(unlimited.resources,{memoryMax:0,pidsMax:0,cpuMax:0});
 const text=JSON.stringify(diagnostic);
 assert.equal(text.includes('/run/meri'),false,'no credential path is emitted');
 assert.equal(text.includes('AWS_REGION'),false,'no environment name is emitted');
});

test('the upload allowlist admits the PWD that bwrap always sets, and nothing else',()=>{
 const cwd=ROOT+'/'+UPLOAD_ROLE_PREFIX.probe+'a1b2c3';
 // bubblewrap sets PWD before exec (bubblewrap.c xsetenv("PWD", new_cwd, 1)), so the real child reports one name the
 // renderer's direct-spawn allowlist does not contain. That is the concrete noCredentials failure this corrects.
 const bwrapChild={...sandboxed(cwd),envNames:[...RENDERER_CHILD_ENV,'PWD']};
 const attests=evaluateUploadSandbox(bwrapChild,{tempRoot:ROOT});
 assert.equal(attests.sandbox.noCredentials,true,'PWD is the attested workspace path, not a credential');
 assert.deepEqual(attests.findings,[]);
 assert.deepEqual([...UPLOAD_CHILD_ENV],[...RENDERER_CHILD_ENV,'PWD']);
 // Any name outside the reviewed allowlist still fails, so this is not a general environment widening.
 const extra=evaluateUploadSandbox({...bwrapChild,envNames:[...RENDERER_CHILD_ENV,'PWD','AWS_SESSION_TOKEN']},{tempRoot:ROOT});
 assert.equal(extra.sandbox.noCredentials,false);
 assert.deepEqual(extra.findings.map(f=>f.requirement),['noCredentials']);
});

test('the effective cgroup resolver walks the visible hierarchy and never promotes a missing, zero or malformed node',()=>{
 const root='/sys/fs/cgroup';
 const read=map=>path=>map[path]??null;
 const base={
  [root+'/cgroup.controllers']:'',
  [root+'/memory.max']:'max',[root+'/pids.max']:'max',[root+'/cpu.max']:'max 100000',
  [root+'/a/cgroup.controllers']:'',
  [root+'/a/memory.max']:'1073741824',[root+'/a/pids.max']:'64',[root+'/a/cpu.max']:'50000 100000'
 };
 const child=resolveEffectiveCgroup({cgroupPath:'/a',mountRoot:'/',read:read(base)});
 assert.equal(child.levels,2);assert.equal(child.mountRootIsRoot,true);
 assert.deepEqual({memoryMax:child.memoryMax,pidsMax:child.pidsMax,cpuMax:child.cpuMax},
  {memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},'root max with a finite child resolves to the child');
 // A finite ancestor bounds a `max` leaf: the inherited parent bound is the effective limit.
 const inherited={...base,[root+'/a/memory.max']:'max',[root+'/a/pids.max']:'max',[root+'/a/cpu.max']:'max 100000',
  [root+'/memory.max']:'536870912',[root+'/pids.max']:'32',[root+'/cpu.max']:'25000 100000'};
 const parent=resolveEffectiveCgroup({cgroupPath:'/a',mountRoot:'/',read:read(inherited)});
 assert.deepEqual({memoryMax:parent.memoryMax,pidsMax:parent.pidsMax,cpuMax:parent.cpuMax},
  {memoryMax:'536870912',pidsMax:'32',cpuMax:'25000 100000'});
 // The tighter of the parent and child wins when both are finite.
 assert.equal(resolveEffectiveCgroup({cgroupPath:'/a',mountRoot:'/',read:read({...base,[root+'/memory.max']:'536870912'})}).memoryMax,'536870912');
 // All-max stays present-but-unlimited; a literal zero stays the strictest failing value; malformed text is not a bound.
 assert.equal(resolveEffectiveCgroup({cgroupPath:'/a',mountRoot:'/',read:read({...base,[root+'/a/memory.max']:'max'})}).memoryMax,'max');
 assert.equal(resolveEffectiveCgroup({cgroupPath:'/a',mountRoot:'/',read:read({...base,[root+'/a/pids.max']:'0'})}).pidsMax,'0');
 assert.equal(resolveEffectiveCgroup({cgroupPath:'/a',mountRoot:'/',read:read({...base,[root+'/a/memory.max']:'garbage'})}).memoryMax,'max');
 // A stale/unrelated path must not inherit an ancestor; traversal is refused.
 assert.equal(resolveEffectiveCgroup({cgroupPath:'/missing',mountRoot:'/',read:read(base)}),null);
 assert.equal(resolveEffectiveCgroup({cgroupPath:'/a/../b',mountRoot:'/',read:read(base)}),null);
 // Only the unified 0:: line is a v2 path; mountinfo field 4 is the mountpoint and field 3 the cgroup root.
 assert.equal(parseCgroupPath('0::/a/b\n'),'/a/b');
 assert.equal(parseCgroupPath('4:memory:/x\n0::/\n'),'/');
 assert.equal(parseCgroupPath('0::/a/../b\n'),null);
 assert.equal(parseCgroupPath('1:name=systemd:/x\n'),null);
 assert.equal(parseCgroupMountRoot('36 35 98:0 / /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n'),'/');
 assert.equal(parseCgroupMountRoot('36 35 98:0 /system.slice/x /sys/fs/cgroup ro - cgroup2 cgroup2 ro\n'),'/system.slice/x');
 assert.equal(parseCgroupMountRoot('36 35 98:0 / /sys rw - sysfs sysfs rw\n'),null);
});

test('a whitespace-bearing cgroup path is preserved and cannot read the non-whitespace sibling',()=>{
 const mount='/sys/fs/cgroup';
 const parsed=parseCgroupPath('0::/a/b \n');
 assert.equal(parsed,'/a/b ','the record terminator is removed; the path space is preserved');
 const map={
  [mount+'/cgroup.controllers']:'',[mount+'/memory.max']:'max',[mount+'/pids.max']:'max',[mount+'/cpu.max']:'max 100000',
  [mount+'/b/cgroup.controllers']:'',[mount+'/b/memory.max']:'1073741824',[mount+'/b/pids.max']:'64',[mount+'/b/cpu.max']:'50000 100000',
  [mount+'/b /cgroup.controllers']:'',[mount+'/b /memory.max']:'max',[mount+'/b /pids.max']:'max',[mount+'/b /cpu.max']:'max 100000'
 };
 const resolved=resolveEffectiveCgroup({cgroupPath:parsed,mountRoot:'/a',read:path=>map[path]??null});
 assert.equal(resolved.memoryMax,'max','the space-suffixed member must not select the finite /b sibling');
 assert.equal(resolved.pidsMax,'max');assert.equal(resolved.cpuMax,'max 100000');
});

test('a raw CR-bearing cgroup path is rejected and cannot alias the non-CR sibling',()=>{
 const parsed=parseCgroupPath('0::/a/b\r\n');
 assert.equal(parsed,null,'a raw CR is a path byte under LF records and must fail closed');
 const mount='/sys/fs/cgroup';
 const map={
  [mount+'/cgroup.controllers']:'',[mount+'/memory.max']:'max',[mount+'/pids.max']:'max',[mount+'/cpu.max']:'max 100000',
  [mount+'/b/cgroup.controllers']:'',[mount+'/b/memory.max']:'1073741824',[mount+'/b/pids.max']:'64',[mount+'/b/cpu.max']:'50000 100000',
  [mount+'/b\r/cgroup.controllers']:'',[mount+'/b\r/memory.max']:'max',[mount+'/b\r/pids.max']:'max',[mount+'/b\r/cpu.max']:'max 100000'
 };
 const resolved=resolveEffectiveCgroup({cgroupPath:'/a/b\r',mountRoot:'/a',read:path=>map[path]??null});
 assert.equal(resolved.memoryMax,'max','a CR-bearing member must not read the finite /b sibling');
 assert.equal(resolved.pidsMax,'max');assert.equal(resolved.cpuMax,'max 100000');
});

test('host inherited bounds fill only a present-but-unlimited child observation',()=>{
 const host={memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'};
 assert.deepEqual(combineCgroupBounds({memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'},host),host,'a max child view is bounded by the finite host ancestor');
 assert.deepEqual(combineCgroupBounds({memoryMax:'2147483648',pidsMax:'128',cpuMax:'100000 100000'},host),
  {memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},'the tighter finite value wins');
 assert.deepEqual(combineCgroupBounds({memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'},
  {memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'}),{memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'});
 assert.deepEqual(combineCgroupBounds({memoryMax:null,pidsMax:null,cpuMax:null},host),
  {memoryMax:null,pidsMax:null,cpuMax:null},'a missing child observation is never rescued by a host value');
 assert.deepEqual(combineCgroupBounds({memoryMax:'0',pidsMax:'64',cpuMax:'50000 100000'},host),
  {memoryMax:'0',pidsMax:'64',cpuMax:'50000 100000'},'a literal zero remains the strictest failing value');
});

test('a host-observed inherited bound qualifies a max child view; no host or a max host does not',async()=>{
 const root=await realpath(tmpdir());
 const run=async(role,options)=>({stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd,
  {cgroup:{memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'}}))),receipt:{exitCode:0}});
 const admitted=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run,
  hostCgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000',levels:2,mountRootIsRoot:true}});
 assert.equal(admitted.admitted,true);assert.equal(admitted.admission.sandbox.boundedResources,true);
 assert.deepEqual(admitted.diagnostic.resources,{memoryMax:1073741824,pidsMax:64,cpuMax:50000});
 const noHost=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run,hostCgroup:null});
 assert.equal(noHost.admitted,false);assert.deepEqual(noHost.missing,['boundedResources']);
 assert.deepEqual(noHost.diagnostic.cgroupHost,{resolved:false,levels:0,mountRootIsRoot:false});
 assert.deepEqual(noHost.diagnostic.resources,{memoryMax:0,pidsMax:0,cpuMax:0});
 const hostMax=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run,
  hostCgroup:{memoryMax:'max',pidsMax:'max',cpuMax:'max 100000',levels:1,mountRootIsRoot:true}});
 assert.equal(hostMax.admitted,false);assert.deepEqual(hostMax.missing,['boundedResources']);
 assert.deepEqual(hostMax.diagnostic.cgroupHost,{resolved:true,levels:1,mountRootIsRoot:true});
});

test('a subtree-rooted cgroup2 mount maps membership relative to its root and rejects unrelated branches',()=>{
 const mount='/sys/fs/cgroup';
 const read=map=>path=>map[path]??null;
 const subtree={
  [mount+'/cgroup.controllers']:'',[mount+'/memory.max']:'max',[mount+'/pids.max']:'max',[mount+'/cpu.max']:'max 100000',
  [mount+'/b/cgroup.controllers']:'',[mount+'/b/memory.max']:'1073741824',[mount+'/b/pids.max']:'64',[mount+'/b/cpu.max']:'50000 100000',
  [mount+'/a/b/cgroup.controllers']:'',[mount+'/a/b/memory.max']:'2147483648',[mount+'/a/b/pids.max']:'128',[mount+'/a/b/cpu.max']:'100000 100000'
 };
 const mapped=resolveEffectiveCgroup({cgroupPath:'/a/b',mountRoot:'/a',read:read(subtree)});
 assert.equal(mapped.levels,2);assert.equal(mapped.mountRootIsRoot,false);
 assert.deepEqual({memoryMax:mapped.memoryMax,pidsMax:mapped.pidsMax,cpuMax:mapped.cpuMax},
  {memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},'membership /a/b under root /a reads mount/b, not mount/a/b');
 const unrelated={...subtree,[mount+'/b/memory.max']:'max',[mount+'/b/pids.max']:'max',[mount+'/b/cpu.max']:'max 100000'};
 const refused=resolveEffectiveCgroup({cgroupPath:'/a/b',mountRoot:'/a',read:read(unrelated)});
 assert.equal(refused.memoryMax,'max','the finite /a/b branch is not an ancestor of the process');
 assert.equal(refused.pidsMax,'max');assert.equal(refused.cpuMax,'max 100000');
 assert.equal(resolveEffectiveCgroup({cgroupPath:'/x',mountRoot:'/a',read:read(subtree)}),null,'membership outside the visible root is unresolved');
 assert.equal(parseCgroupMountRoot('36 35 0:30 /a /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n'),'/a');
 assert.equal(parseCgroupMountRoot('36 35 0:30 / /sys/fs/cgroup rw - tmpfs tmpfs rw\n'),null);
 assert.equal(parseCgroupMountRoot('36 35 0:30 /\\041 /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n'),null);
 assert.equal(parseCgroupMountRoot('36 35 0:30 /a /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n36 35 0:31 / /sys/fs/cgroup rw - tmpfs tmpfs rw\n'),null,'the topmost selected mount must be cgroup2');
});

test('malformed or v1 controller records are never rescued by a finite host tuple',()=>{
 const cwd=ROOT+'/'+UPLOAD_ROLE_PREFIX.probe+'a1b2c3';
 const host={memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'};
 const malformed=[
  {memoryMax:'-1',pidsMax:'-1',cpuMax:'max nonsense'},
  {memoryMax:'max',pidsMax:'max',cpuMax:'max'},
  {memoryMax:'max',pidsMax:'max',cpuMax:'max 0'},
  {memoryMax:'max',pidsMax:'max',cpuMax:'10000 0'},
  {memoryMax:'max',pidsMax:'max',cpuMax:'10000 500'},
  {memoryMax:null,pidsMax:null,cpuMax:null},
  {memoryMax:'0',pidsMax:'0',cpuMax:'0 100000'}
 ];
 for(const probe of malformed){
  const combined=combineCgroupBounds(probe,host);
  const evaluation=evaluateUploadSandbox(sandboxed(cwd,{cgroup:combined}),{tempRoot:ROOT});
  assert.deepEqual(evaluation.findings.map(f=>f.requirement),['boundedResources'],JSON.stringify(probe));
 }
 const valid=combineCgroupBounds({memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'},host);
 assert.deepEqual(valid,host);
 assert.deepEqual(evaluateUploadSandbox(sandboxed(cwd,{cgroup:valid}),{tempRoot:ROOT}).findings,[]);
 const root='/sys/fs/cgroup';
 const invalid={[root+'/cgroup.controllers']:'',[root+'/memory.max']:'-1',[root+'/pids.max']:'-1',[root+'/cpu.max']:'-1 100000'};
 const resolved=resolveEffectiveCgroup({cgroupPath:'/',mountRoot:'/',read:path=>invalid[path]??null});
 assert.deepEqual({memoryMax:resolved.memoryMax,pidsMax:resolved.pidsMax,cpuMax:resolved.cpuMax},
  {memoryMax:null,pidsMax:null,cpuMax:null});
});

test('CPU bounds compare quota/period ratios and keep the original two-field record',()=>{
 const root='/sys/fs/cgroup';
 const read=map=>path=>map[path]??null;
 const base={
  [root+'/cgroup.controllers']:'',[root+'/memory.max']:'max',[root+'/pids.max']:'max',[root+'/cpu.max']:'20000 100000',
  [root+'/a/cgroup.controllers']:'',[root+'/a/memory.max']:'max',[root+'/a/pids.max']:'max',[root+'/a/cpu.max']:'10000 10000'
 };
 const resolved=resolveEffectiveCgroup({cgroupPath:'/a',mountRoot:'/',read:read(base)});
 assert.equal(resolved.cpuMax,'20000 100000','0.2 CPU at the parent is tighter than 1.0 CPU at the child');
 assert.equal(combineCgroupBounds({memoryMax:'max',pidsMax:'max',cpuMax:'10000 10000'},
  {memoryMax:'1073741824',pidsMax:'64',cpuMax:'20000 100000'}).cpuMax,'20000 100000');
 assert.equal(combineCgroupBounds({memoryMax:'max',pidsMax:'max',cpuMax:'20000 100000'},
  {memoryMax:'1073741824',pidsMax:'64',cpuMax:'10000 10000'}).cpuMax,'20000 100000');
});

test('the host witness refuses a changed membership or cgroup2 mount identity across the read interval',async()=>{
 const mountA='36 35 0:30 /a /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n';
 const mountB='36 35 0:31 /a /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n';
 const files={
  '/sys/fs/cgroup/cgroup.controllers':'',
  '/sys/fs/cgroup/memory.max':'max','/sys/fs/cgroup/pids.max':'max','/sys/fs/cgroup/cpu.max':'max 100000',
  '/sys/fs/cgroup/b/cgroup.controllers':'',
  '/sys/fs/cgroup/b/memory.max':'1073741824','/sys/fs/cgroup/b/pids.max':'64','/sys/fs/cgroup/b/cpu.max':'50000 100000'
 };
 const sequence=values=>{const counts=new Map();return async path=>{const n=counts.get(path)??0;counts.set(path,n+1);
  const value=values[path];if(Array.isArray(value))return value[Math.min(n,value.length-1)]??null;return typeof value==='string'?value:null;};};
 const stable=await readHostCgroup({platform:'linux',readText:sequence({...files,
  '/proc/self/cgroup':['0::/a/b\n','0::/a/b\n'],'/proc/self/mountinfo':[mountA,mountA]})});
 assert.equal(stable.levels,2);assert.equal(stable.memoryMax,'1073741824');assert.equal(stable.mountRootIsRoot,false);
 const moved=await readHostCgroup({platform:'linux',readText:sequence({...files,
  '/proc/self/cgroup':['0::/a/b\n','0::/a/c\n'],'/proc/self/mountinfo':[mountA,mountA]})});
 assert.equal(moved,null,'a membership change between the probe and the witness is refused');
 const remounted=await readHostCgroup({platform:'linux',readText:sequence({...files,
  '/proc/self/cgroup':['0::/a/b\n','0::/a/b\n'],'/proc/self/mountinfo':[mountA,mountB]})});
 assert.equal(remounted,null,'a mount identity change is refused');
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
 assert.equal(bad.admitted,false);assert.deepEqual(bad.missing,['noNewPrivileges']);assert.equal(bad.reason,'UPLOAD_SANDBOX_UNQUALIFIED');
 const invalid=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:async()=>({stdout:Buffer.from('not json')})});
 assert.equal(invalid.admitted,false);assert.equal(invalid.reason,'UPLOAD_PROBE_FAILED');
 const refused=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,
  run:async()=>Promise.reject(Object.assign(Error('refused'),{code:'UPLOAD_SANDBOX_REFUSED'}))});
 assert.equal(refused.admitted,false);assert.equal(refused.reason,'UPLOAD_SANDBOX_REFUSED');assert.equal(refused.missing.length,8);
 await assert.rejects(()=>qualifyNativeUploadSandbox({imageDigest:'nope',deadlineMs:Date.now()+1,tempRoot:root,run:make({})}),{code:'UPLOAD_QUALIFICATION_CONFIGURATION'});
});

test('the native measurement clamps its deadline, passes the output cap and binds exact credential paths',async()=>{
 const root=await realpath(tmpdir());
 const calls=[];
 const observation=changes=>Buffer.from(JSON.stringify(sandboxed(ROOT+'/'+UPLOAD_ROLE_PREFIX.probe+'a1b2c3',changes)));
 const make=(changes,options)=>async(role,opts)=>{calls.push({role,opts,options});return {stdout:observation(changes),receipt:{exitCode:0}};};
 const start=Date.now();
 await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:start+600000,tempRoot:root,run:make({})});
 assert.equal(calls[0].opts.maxOutput,65536,'the observation cap reaches the process owner before accumulation');
 assert.ok(calls[0].opts.deadlineMs<=Date.now()+30000,'a far deadline is clamped to 30 seconds');
 assert.ok(calls[0].opts.deadlineMs>=start+29000,'the clamp is the 30-second measurement bound, not a shorter one');
 const tighter=Date.now()+5000;
 await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:tighter,tempRoot:root,run:make({})});
 assert.ok(calls[1].opts.deadlineMs<=tighter+50,'a tighter incoming deadline stays tighter');
 // Exact binding: the observation must report the same ordered paths, and a mismatch is refused, not evaluated.
 const bound={credentialPaths:['/run/meri/core-secret']};
 const boundRun=async()=>({stdout:observation({}),receipt:{exitCode:0}});
 const mismatch=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:boundRun,...bound});
 assert.equal(mismatch.admitted,false);assert.equal(mismatch.reason,'UPLOAD_PROBE_BINDING_MISMATCH');
 const matched=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,...bound,
  run:async()=>({stdout:observation({credentialPathsReadable:[{path:'/run/meri/core-secret',readable:false}],inputValid:true}),receipt:{exitCode:0}})});
 assert.equal(matched.reason,'UPLOAD_SANDBOX_UNQUALIFIED','binding matches; unrelated admission flags still decide');
 const truncated=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,...bound,
  run:async()=>({stdout:Buffer.from('{"schema":"meri-renderer-sandbox-observation/1"}'),receipt:{exitCode:0}})});
 assert.equal(truncated.admitted,false);assert.equal(truncated.reason,'UPLOAD_PROBE_BINDING_MISMATCH');
 // A process failure settles honestly with a bounded, content-free summary.
 const failed=await qualifyNativeUploadSandbox({imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,
  run:async()=>{throw Object.assign(Error('cleanup'),{code:'ARTIFACT_CLEANUP_FAILED',receipt:{exitCode:null,signal:'SIGKILL',
   spawnError:null,stdoutBytes:12,stdoutRetainedBytes:12,stdoutEnded:false,stderrEnded:true,streamErrors:[],groupKillAttempted:true,groupAbsent:false,settlement:'timeout'}});}});
 assert.equal(failed.admitted,false);assert.equal(failed.reason,'ARTIFACT_CLEANUP_FAILED');
 assert.deepEqual({groupKillAttempted:failed.process.groupKillAttempted,groupAbsent:failed.process.groupAbsent,settlement:failed.process.settlement},
  {groupKillAttempted:true,groupAbsent:false,settlement:'timeout'});
 const text=JSON.stringify(failed);assert.equal(text.includes('cleanup'),false,'no raw error text is emitted');
});

test('the qualifier keeps identity/mapping refusals and exposes the allowlisted child projection',async()=>{
 const root=await realpath(tmpdir()),bound={credentialPaths:['/run/meri/core-secret']};
 const limits={MaxFileSize:{soft:{kind:'max'},hard:{kind:'malformed'}},MaxOpenFiles:null,
  MaxProcesses:{soft:{kind:'finite',value:64},hard:{kind:'unsupported'}}};
 const make=cg=>async(role,{cwd,input})=>({stdout:Buffer.from(JSON.stringify(sandboxed(cwd,{cgroup:cg,inputValid:true,processLimits:limits,
  credentialPathsReadable:JSON.parse(input.toString()).credentialPaths.map(path=>({path,readable:false}))}))),receipt:{exitCode:0}});
 const host={memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000',levels:2,mountRootIsRoot:true};
 const changed={memoryMax:null,pidsMax:null,cpuMax:null,levels:0,mountRootIsRoot:false,membershipResolved:false,identityChanged:true,source:'identity-changed'};
 const refused=await qualifyNativeUploadSandbox({...bound,imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:make(changed),hostCgroup:host});
 assert.equal(refused.admitted,false);assert.equal(refused.reason,'UPLOAD_SANDBOX_UNQUALIFIED');
 assert.equal(refused.evaluation.sandbox.boundedResources,false);
 assert.deepEqual(refused.diagnostic.resources,{memoryMax:null,pidsMax:null,cpuMax:null},'a finite host cannot rescue a changed identity');
 assert.deepEqual(refused.observation.cgroup,{source:'identity-changed',membershipResolved:false,identityChanged:true,levels:0,mountRootIsRoot:false});
 assert.deepEqual(refused.observation.processLimits,limits);
 assert.ok(Object.isFrozen(refused.observation));
 const mapped={...changed,identityChanged:false,source:'mapping-failed'};
 const failed=await qualifyNativeUploadSandbox({...bound,imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:make(mapped),hostCgroup:host});
 assert.equal(failed.admitted,false);assert.equal(failed.evaluation.sandbox.boundedResources,false);
 assert.deepEqual(failed.diagnostic.resources,{memoryMax:null,pidsMax:null,cpuMax:null},'a finite host cannot rescue a failed mapping');
 assert.equal(failed.observation.cgroup.source,'mapping-failed');assert.equal(failed.observation.cgroup.identityChanged,false);
 const v1={memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000',levels:0,mountRootIsRoot:false,membershipResolved:false,identityChanged:false,source:'v1-fallback'};
 const stableV1=await qualifyNativeUploadSandbox({...bound,imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:make(v1)});
 assert.equal(stableV1.admitted,true);assert.equal(stableV1.evaluation.sandbox.boundedResources,true,'stable v1 fallback stays valid');
 assert.equal(stableV1.observation.cgroup.source,'v1-fallback');assert.equal(stableV1.observation.cgroup.identityChanged,false);
 assert.ok(stableV1.diagnostic,'success carries its resource diagnostic');
 const v2={memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000',levels:2,mountRootIsRoot:true,membershipResolved:true,identityChanged:false,source:'cgroup2'};
 const stableV2=await qualifyNativeUploadSandbox({...bound,imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,run:make(v2),hostCgroup:host});
 assert.equal(stableV2.admitted,true);assert.equal(stableV2.observation.cgroup.membershipResolved,true);
 assert.equal(stableV2.observation.cgroup.source,'cgroup2');
 const mount='36 35 0:30 / /sys/fs/cgroup rw - cgroup2 cgroup2 rw\n';
 const rootFiles={[CGROUP_MOUNT+'/cgroup.controllers']:'',[CGROUP_MOUNT+'/memory.max']:'1073741824',
  [CGROUP_MOUNT+'/pids.max']:'64',[CGROUP_MOUNT+'/cpu.max']:'50000 100000'};
 const view=self=>observeProbeCgroup({read:path=>path==='/proc/self/cgroup'?self:
  (path==='/proc/self/mountinfo'?mount:(rootFiles[path]??null))});
 for(const [label,self] of [['unreadable',null],['empty',''],['raw-CR-unified','0::/b\r\n'],
  ['malformed-v1','1:memory:relative\n'],['ambiguous-unified','0::/b\n0::/c\n'],
  ['contradictory-v1','1:memory:/a\n1:memory:/b\n'],['cross-hierarchy-v1','1:memory:/a\n2:memory:/b\n']]){
  const refused=await qualifyNativeUploadSandbox({...bound,imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,
   run:make(view(self)),hostCgroup:host});
  assert.equal(refused.admitted,false,`${label} must not be admitted`);
  assert.equal(refused.evaluation.sandbox.boundedResources,false,`${label} cannot use finite root/host values`);
  assert.deepEqual(refused.diagnostic.resources,{memoryMax:null,pidsMax:null,cpuMax:null});
  assert.ok(['unknown','mapping-failed'].includes(refused.observation.cgroup.source),`${label} keeps an honest marker`);
 }
 let self='1:memory:/a\n',changedDuringValues=false;
 const during=observeProbeCgroup({read:path=>{
  if(path==='/proc/self/cgroup')return self;
  if(path==='/proc/self/mountinfo')return mount;
  if(path===CGROUP_MOUNT+'/memory.max'){self='1:memory:/b\n';changedDuringValues=true;}
  return rootFiles[path]??null;
 }});
 const raced=await qualifyNativeUploadSandbox({...bound,imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,
  run:make(during),hostCgroup:host});
 assert.equal(changedDuringValues,true);assert.equal(raced.admitted,false,'a v1 change during fallback reads must not be admitted');
 assert.equal(raced.evaluation.sandbox.boundedResources,false);
 assert.deepEqual(raced.diagnostic.resources,{memoryMax:null,pidsMax:null,cpuMax:null});
 assert.equal(raced.observation.cgroup.source,'identity-changed');
 const arbitrary=await qualifyNativeUploadSandbox({...bound,imageDigest:DIGEST,deadlineMs:Date.now()+30000,tempRoot:root,
  run:make({...v2,source:'/fixture/not-a-source-kind'}),hostCgroup:host});
 assert.equal(arbitrary.observation.cgroup.source,null,'an arbitrary source label is not echoed');
 assert.equal(JSON.stringify(arbitrary).includes('/fixture/credential'),false,'no credential path is echoed');
});

test('the real runner refuses to spawn on this non-Linux host',{skip:process.platform==='linux'},async()=>{
 const cwd=await mkdtemp(join(tmpdir(),UPLOAD_ROLE_PREFIX.scan));
 try{await assert.rejects(()=>runUploadSandbox('scan',{cwd,definitionsRoot:'/srv/defs',deadlineMs:Date.now()+1000,input:Buffer.alloc(0)}),{code:'UPLOAD_SANDBOX_REFUSED'});}
 finally{await rm(cwd,{recursive:true,force:true});}
});
