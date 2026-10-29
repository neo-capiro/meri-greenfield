/** Upload native-host composition: fail-closed `missing` reporting and the real caller join that yields the two ports
 * A5's createUploadInspection consumes. The sandbox probe, tool observation and file reads are injected fixed ports; a
 * mocked admission is not evidence that any control host satisfies the namespace/image prerequisite. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {realpath,mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {RENDERER_PROBE_SCHEMA} from '../../../artifacts/renderer-qualification.mjs';
import {UPLOAD_CHILD_ENV} from '../native-sandbox.mjs';
import {composeUploadNativeHost} from '../composition.mjs';

const ZERO='0'.repeat(16),DIGEST='sha256:'+'f'.repeat(64);
const sandboxed=cwd=>({schema:RENDERER_PROBE_SCHEMA,platform:'linux',uid:[1000,1000,1000,1000],gid:[1000,1000,1000,1000],noNewPrivs:1,
 capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:ZERO,CapBnd:ZERO,CapAmb:ZERO},rootMountOptions:'ro,relatime',interfaces:['lo'],
 cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},envNames:[...UPLOAD_CHILD_ENV],cwd,home:cwd,tmpdir:cwd,
 workspace:{mode:0o700,uid:1000},credentialPathsReadable:[{path:'/run/meri/core-secret',readable:false}]});
const configuration=(native)=>({uploads:{native}});
const declarations={enabled:true,imageDigest:DIGEST,definitionsRoot:'/srv/meri-definitions',extractorPath:'/opt/meri/extract.py'};

test('composition reports every unmet prerequisite and never issues a port it cannot back',async()=>{
 assert.deepEqual((await composeUploadNativeHost({configuration:configuration({enabled:false})})).missing,['uploads.native.enabled']);
 assert.equal((await composeUploadNativeHost({configuration:configuration({...declarations,imageDigest:'nope'})})).scanner,null);
 assert.deepEqual((await composeUploadNativeHost({configuration:configuration({...declarations,imageDigest:'nope'})})).missing,['uploads.native.imageDigest']);
 assert.deepEqual((await composeUploadNativeHost({configuration:configuration({enabled:true,imageDigest:DIGEST})})).missing,['uploads.native.sandbox'],'undeclared roots fall back to the fixed image paths; only the unobserved sandbox is missing');
 const disabled=await composeUploadNativeHost({configuration:configuration({enabled:false})});
 assert.equal(disabled.scanner,null);assert.equal(disabled.extractor,null);assert.equal(disabled.admission,null);
});

test('a host that cannot attest the sandbox or observe its tools yields null ports with the exact gap',async()=>{
 const tempRoot=await realpath(tmpdir());
 const unadmitted=await composeUploadNativeHost({configuration:configuration(declarations),tempRoot,
  run:async(role,options)=>({stdout:Buffer.from(JSON.stringify({...sandboxed(options.cwd),noNewPrivs:0})),receipt:{exitCode:0}})});
 assert.deepEqual(unadmitted.missing,['uploads.native.sandbox']);assert.equal(unadmitted.scanner,null);
 assert.equal(unadmitted.reason,'UPLOAD_SANDBOX_UNQUALIFIED');assert.deepEqual(unadmitted.requirements,['noNewPrivileges']);
 assert.deepEqual(unadmitted.diagnostic.resources,{memoryMax:1073741824,pidsMax:64,cpuMax:50000});
 assert.deepEqual(unadmitted.diagnostic.credentials,{networkIsolated:true,envCount:UPLOAD_CHILD_ENV.length,allowedCount:UPLOAD_CHILD_ENV.length,envAllowed:true,checked:1,readable:0});
 assert.deepEqual(unadmitted.diagnostic.cgroupHost,{resolved:false,levels:0,mountRootIsRoot:false},'a synthetic runner carries no host hierarchy observation');
 const noTools=await composeUploadNativeHost({configuration:configuration(declarations),tempRoot,
  run:async(role,options)=>role==='probe'?{stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd))),receipt:{exitCode:0}}:Promise.reject(Object.assign(Error('x'),{code:'UPLOAD_SANDBOX_REFUSED'}))});
 assert.deepEqual(noTools.missing,['uploads.native.tools']);assert.equal(noTools.scanner,null);
});

test('a missing scratch root is reported as the workspace failure, not a generic sandbox gap',async()=>{
 const tempRoot=join(tmpdir(),'meri-missing-'+Date.now());
 const host=await composeUploadNativeHost({configuration:configuration(declarations),tempRoot,
  run:async()=>assert.fail('no probe runs after the workspace cannot be created')});
 assert.deepEqual(host.missing,['uploads.native.sandbox']);assert.equal(host.reason,'ENOENT');
 assert.equal(host.scanner,null);assert.equal(host.requirements,undefined);
});

test('an observed host yields the scanner/extractor join A5 binds into createUploadInspection',async()=>{
 const tempRoot=await realpath(tmpdir()),now=Date.now;
 const run=async(role,options)=>{
  if(role==='probe')return {stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd))),receipt:{exitCode:0}};
  if(role==='scan')return {stdout:Buffer.from('ClamAV 1.4.2/27450/x\n'),receipt:{exitCode:0}};
  return {stdout:Buffer.from('Python 3.13.16\n'),receipt:{exitCode:0}};
 };
 const readFileImpl=async path=>Buffer.from('bin:'+path);
 const host=await composeUploadNativeHost({configuration:configuration(declarations),tempRoot,now,run,readFileImpl,deadlineMs:now()+30000});
 assert.deepEqual(host.missing,[]);
 assert.equal(typeof host.scanner.scan,'function');assert.equal(typeof host.extractor.extract,'function');
 assert.equal(typeof host.definitions.snapshot,'function');
 assert.equal(host.admission.role,'upload-native');assert.equal(host.describe().scanner.version,'1.4.2');
 assert.equal(host.describe().extractor.version,'3.13.16');assert.equal(host.describe().toolRootsReadOnly,true);
});

test('a non-fresh definitions root is provisioned by ONE serialized owner, not once per scan',async()=>{
 // A definitions root that is never fresh (published snapshots are immediately over age here) is what a long-lived
 // CONTROL host looks like after max age: the startup probe and then every scan observe it. One serialized refresh
 // owner must answer all of them, so the fixed freshclam program runs exactly twice (startup, then once for the pair)
 // instead of once per observer. The injected port below is the only thing that synthesises bytes: no real freshclam,
 // sigtool, image or corpus is exercised, and none of this is qualification evidence.
 const tempRoot=await realpath(tmpdir());
 let ticks=0;const base=Date.parse('2026-10-28T00:00:00Z'),now=()=>base+(ticks+=10);
 const freshclam=[];
 const run=async(first,second,third)=>{
  const options=typeof second==='object'&&!Array.isArray(second)?second:(third??{});
  if(first==='freshclam'){
   freshclam.push(options.cwd);
   // Hold the refresh open so two concurrent scans certainly overlap, so they must share this one attempt. The refresh
   // deliberately fails (it stages nothing): the definitions root stays permanently unavailable, which is exactly the
   // long-lived stale-host condition, and every observer really does observe the same non-fresh state.
   await new Promise(resolve=>setTimeout(resolve,25));
   throw Object.assign(new Error('UPLOAD_DEFINITIONS_REFRESH_FAILED'),{code:'UPLOAD_DEFINITIONS_REFRESH_FAILED'});
  }
  if(first==='sigtool')return {stdout:Buffer.alloc(0)};
  if(first==='probe')return {stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd)))};
  if(first==='extract')return {stdout:Buffer.from('Python 3.13.16\n')};
  return {stdout:Buffer.from('ClamAV 1.4.2/27450/x\n')};
 };
 const definitionsRoot=await mkdtemp(join(tempRoot,'meri-defs-serialized-'));
 const host=await composeUploadNativeHost({configuration:configuration({...declarations,definitionsRoot}),
  tempRoot,now,run,readFileImpl:async path=>Buffer.from('bin:'+path),deadlineMs:now()+30000});
 assert.deepEqual(host.missing,[]);
 const bytes=Buffer.from('payload'),file={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,format:'txt'};
 const scan=()=>host.scanner.scan({file,bytes,limits:{originalBytes:1e7},deadlineMs:now()+30000});
 const [left,right]=await Promise.all([scan(),scan()]);
 assert.equal(left.status,'unavailable');assert.equal(right.status,'unavailable');
 assert.equal(left.reason,'UPLOAD_DEFINITIONS_UNAVAILABLE','a failed refresh leaves scans fail-closed, never clean');
 assert.equal(freshclam.length,2,'startup plus exactly one shared refresh for two concurrent scans of a non-fresh root');
 assert.equal(host.definitionsProvisioningState().attempted,true);
 assert.equal(host.definitionsProvisioningState().provisioned,false);
 assert.equal(host.definitionsProvisioningState().reason,'UPLOAD_DEFINITIONS_REFRESH_FAILED');
});

test('the host owner can drive the SAME bounded refresh owner on its own lifecycle budget (S1 join)',async()=>{
 // `provisionDefinitions` is the identical serialized closure the scans use: it starts no timer, no daemon and no second
 // provisioning path, and it is given the caller's absolute deadline instead of a scan's. The freshclam port below
 // writes fixture database bytes into the staging directory; no real freshclam, sigtool, image or corpus is exercised,
 // and none of this is qualification evidence for the unmeasured full-CVD provisioning duration.
 const tempRoot=await realpath(tmpdir());
 let ticks=0;const base=Date.parse('2026-10-28T00:00:00Z'),now=()=>base+(ticks+=10);
 const freshclam=[];
 const run=async(first,second,third)=>{
  const options=typeof second==='object'&&!Array.isArray(second)?second:(third??{});
  if(first==='freshclam'){
   freshclam.push({cwd:options.cwd,deadlineMs:options.deadlineMs});
   // The publication requires the full required database set (main + daily), so the fixture writes both.
   await writeFile(join(options.cwd,'database','main.cvd'),Buffer.from('fixture-main-cvd'));
   await writeFile(join(options.cwd,'database','daily.cvd'),Buffer.from('fixture-daily-cvd'));
   return {stdout:Buffer.alloc(0)};
  }
  if(first==='sigtool')return {stdout:Buffer.alloc(0)};
  if(first==='probe')return {stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd)))};
  if(first==='extract')return {stdout:Buffer.from('Python 3.13.16\n')};
  // The scan child reports its own exit receipt: an unclassifiable exit is unavailable, so a clean scan needs exitCode 0.
  return {stdout:Buffer.from('ClamAV 1.4.2/27450/x\n'),receipt:{exitCode:0}};
 };
 const definitionsRoot=await mkdtemp(join(tempRoot,'meri-defs-lifecycle-'));
 const host=await composeUploadNativeHost({configuration:configuration({...declarations,definitionsRoot}),
  tempRoot,now,run,readFileImpl:async path=>Buffer.from('bin:'+path),deadlineMs:now()+30000});
 assert.deepEqual(host.missing,[]);
 assert.equal(typeof host.provisionDefinitions,'function','the host owner gets a bounded provisioning handle');
 const before=host.definitionsProvisioningState();
 assert.equal(before.attempted,true,'the startup probe makes the first bounded attempt');
 assert.equal(before.provisioned,true,'a non-fresh root was provisioned during startup');
 const deadline=now()+120000;
 const state=await host.provisionDefinitions({deadlineMs:deadline});
 assert.equal(state.provisioned,true,'the host owner can provision outside any scan');
 assert.equal(state.storageFault,null,'a measured in-bound root is not a storage fault');
 assert.equal(state.disposition.storage.proven,true);
 assert.equal(freshclam.at(-1).deadlineMs,deadline,'it runs on the budget the owner passed, never on a scan deadline');
 // With a real snapshot published, a scan resolves it instead of staying unavailable: staleness is answered, not fatal.
 const bytes=Buffer.from('payload'),file={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,format:'txt'};
 const receipt=await host.scanner.scan({file,bytes,limits:{originalBytes:1e7},deadlineMs:now()+30000});
 assert.equal(receipt.status,'clean','a fresh snapshot makes the scan available again');
 assert.equal(typeof receipt.definitionsSha256,'string');
});
