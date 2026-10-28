/** The CONTROL-native upload lifecycle seam: the closed server declaration, the opt-in mount, and the ONE bounded
 * provisioning attempt.
 *
 * The sandbox probe and tool-observation ports below are fixed fixtures. An admitted probe is NOT evidence that any
 * control host satisfies the namespace/image prerequisite, no real bwrap, freshclam, sigtool, image or corpus is
 * exercised, and the full-CVD provisioning duration is not measured here. Host/platform qualification stays separate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {realpath,mkdtemp} from 'node:fs/promises';
import {RENDERER_PROBE_SCHEMA,RENDERER_CHILD_ENV} from '../../../artifacts/renderer-qualification.mjs';
import {validateConfiguration} from '../../config.mjs';
import {compileUploadNativeConfiguration,mountUploadNativeControl,beginUploadNativeProvisioning,
 UPLOAD_NATIVE_PROVISIONABLE,UPLOAD_NATIVE_DEFAULT_PROVISION_MS} from '../control-lifecycle.mjs';

const ZERO='0'.repeat(16),DIGEST='sha256:'+'f'.repeat(64);
const sandboxed=cwd=>({schema:RENDERER_PROBE_SCHEMA,platform:'linux',uid:[1000,1000,1000,1000],gid:[1000,1000,1000,1000],noNewPrivs:1,
 capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:ZERO,CapBnd:ZERO,CapAmb:ZERO},rootMountOptions:'ro,relatime',interfaces:['lo'],
 cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},envNames:[...RENDERER_CHILD_ENV],cwd,home:cwd,tmpdir:cwd,
 workspace:{mode:0o700,uid:1000},credentialPathsReadable:[{path:'/run/meri/core-secret',readable:false}]});

test('the uploads.native declaration is closed, control-only, and asserts nothing about a host',async()=>{
 const {agentcoreControlFixture}=await import('../../test/agentcore-fixture.mjs');
 const control=agentcoreControlFixture().configuration,enabled={uploads:{native:{enabled:true,imageDigest:DIGEST}}};
 assert.deepEqual(compileUploadNativeConfiguration({uploads:{native:{enabled:false}}}),{enabled:false});
 const compiled=compileUploadNativeConfiguration(enabled);
 assert.equal(compiled.enabled,true);assert.equal(compiled.provisionMs,UPLOAD_NATIVE_DEFAULT_PROVISION_MS);
 assert.equal(compiled.definitionsRoot,'/run/meri/upload-definitions');
 assert.equal(compiled.extractorPath,'/opt/meri/apps/control/uploads/native/extract.py');
 assert.doesNotThrow(()=>validateConfiguration(control,'control'),'absent means no native inspection at all');
 assert.doesNotThrow(()=>validateConfiguration({...control,...enabled},'control'));
 // The declaration is refused as a whole on any stray key, a non-boolean opt-in, a malformed digest, a relative
 // override root, or a budget outside its bound. Compiling never observes the image, the tools or the definitions root.
 for(const invalid of [{uploads:{native:{enabled:true}}},{uploads:{native:{enabled:'yes',imageDigest:DIGEST}}},
  {uploads:{native:{enabled:false,imageDigest:DIGEST}}},{uploads:{native:{enabled:true,imageDigest:'sha256:'+'f'.repeat(63)}}},
  {uploads:{native:{enabled:true,imageDigest:'md5:'+'f'.repeat(32)}}},
  {uploads:{native:{enabled:true,imageDigest:DIGEST,definitionsRoot:'relative/root'}}},
  {uploads:{native:{enabled:true,imageDigest:DIGEST,extractorPath:'/opt/meri/../../../etc/passwd'}}},
  {uploads:{native:{enabled:true,imageDigest:DIGEST,provisionMs:999}}},
  {uploads:{native:{enabled:true,imageDigest:DIGEST,provisionMs:300001}}},
  {uploads:{native:{enabled:true,imageDigest:DIGEST,maxDefinitionsAgeMs:0}}},
  {uploads:{native:{enabled:true,imageDigest:DIGEST,unknown:1}}},
  {uploads:{native:{enabled:true,imageDigest:DIGEST},other:1}}])
  assert.throws(()=>compileUploadNativeConfiguration(invalid),{code:'UPLOAD_NATIVE_CONFIGURATION'},JSON.stringify(invalid));
 assert.throws(()=>validateConfiguration({...control,...enabled},'temporal-worker'),'the declaration is control-only');
});

test('the mount is opt-in: absent, disabled or unattested yields an honest unavailable handle',async()=>{
 const absent=await mountUploadNativeControl({configuration:{}});
 assert.equal(absent.inspection,null);assert.deepEqual(absent.missing,['uploads.native.enabled']);
 assert.equal(absent.host,null);assert.equal(absent.provisionDefinitions,null);
 const disabled=await mountUploadNativeControl({configuration:{uploads:{native:{enabled:false}}},run:async()=>assert.fail('a disabled declaration never probes')});
 assert.equal(disabled.inspection,null);assert.deepEqual(disabled.missing,['uploads.native.enabled']);
 // Enabled, but THIS host cannot attest the sandbox: the real qualification runs and refuses, so CONTROL keeps the
 // uploads family honestly unavailable. This is the current host's observed state, never a claim of availability.
 const unattested=await mountUploadNativeControl({configuration:{uploads:{native:{enabled:true,imageDigest:DIGEST}}}});
 assert.equal(unattested.inspection,null);
 assert.ok(unattested.missing.length>0);assert.equal(typeof unattested.missing[0],'string');
});

test('an attested host mounts the real inspection and the ONE lifecycle attempt is bounded and never a repair',async()=>{
 const tempRoot=await realpath(tmpdir());
 const base=Date.parse('2026-10-28T00:00:00Z'),now=()=>base;
 const freshclam=[];
 const run=async(first,second,third)=>{
  const options=typeof second==='object'&&!Array.isArray(second)?second:(third??{});
  if(first==='freshclam'){
   freshclam.push({deadlineMs:options.deadlineMs,cwd:options.cwd});
   // The mount budget cannot fit a full signed-CVD download, so the fixture runs out of time exactly as freshclam does.
   throw Object.assign(new Error('UPLOAD_DEFINITIONS_EXPIRED'),{code:'UPLOAD_DEFINITIONS_EXPIRED'});
  }
  if(first==='sigtool')return {stdout:Buffer.alloc(0)};
  if(first==='probe')return {stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd)))};
  if(first==='extract')return {stdout:Buffer.from('Python 3.13.16\n')};
  return {stdout:Buffer.from('ClamAV 1.4.2/27450/x\n'),receipt:{exitCode:0}};
 };
 const definitionsRoot=await mkdtemp(join(tempRoot,'meri-defs-control-'));
 const configuration={uploads:{native:{enabled:true,imageDigest:DIGEST,definitionsRoot,scratchRoot:tempRoot}}};
 const mountDeadline=now()+10000;
 const handle=await mountUploadNativeControl({configuration,now,deadlineMs:mountDeadline,run,readFileImpl:async path=>Buffer.from('bin:'+path)});
 assert.deepEqual(handle.missing,[]);
 assert.equal(typeof handle.inspection.inspect,'function','A5 createUploadInspection is bound to the host ports');
 assert.equal(typeof handle.provisionDefinitions,'function');
 assert.equal(handle.host.definitionsProvisioningState().attempted,true,'the mount probe makes the first bounded attempt');
 assert.equal(handle.host.definitionsProvisioningState().provisioned,false);
 assert.equal(freshclam.length,1);
 // A freshness condition (the mount budget expired) is answerable by ONE further attempt on its own deadline.
 const provisioning=beginUploadNativeProvisioning({handle,configuration,now,signal:undefined});
 assert.equal(provisioning.started,true);
 assert.equal(provisioning.error,null);
 await provisioning.completion;
 assert.equal(freshclam.length,2,'exactly one further attempt: no retry, no loop, no timer');
 assert.equal(freshclam[0].deadlineMs,mountDeadline,'the probe ran on the mount budget');
 assert.equal(freshclam[1].deadlineMs,base+UPLOAD_NATIVE_DEFAULT_PROVISION_MS,'the attempt runs on its own declared absolute deadline, not the mount budget');
 assert.equal(typeof provisioning.state().reason,'string');
});

test('integrity and teardown conditions are never re-provisioned as though they were merely stale',async()=>{
 const configuration={},now=Date.now;
 const handleFor=reason=>{let calls=0;return {calls:()=>calls,inspection:{},
  host:{definitionsProvisioningState:()=>({provisioned:false,reason})},
  provisionDefinitions:async()=>{calls+=1;return {provisioned:true};}};};
 for(const reason of ['UPLOAD_DEFINITIONS_CORRUPT','UPLOAD_DEFINITIONS_UNVERIFIED','UPLOAD_DEFINITIONS_CANCELLED',
  'UPLOAD_DEFINITIONS_CONFIGURATION','UPLOAD_DEFINITIONS_SCHEMA'])
  assert.ok(!UPLOAD_NATIVE_PROVISIONABLE.includes(reason),`${reason} must never authorise a fresh fetch`);
 for(const reason of ['UPLOAD_DEFINITIONS_CORRUPT','UPLOAD_DEFINITIONS_UNVERIFIED','UPLOAD_DEFINITIONS_CANCELLED']){
  const handle=handleFor(reason),result=beginUploadNativeProvisioning({handle,configuration,now});
  assert.equal(result.started,false,reason);
  assert.equal(result.error,`UPLOAD_NATIVE_NOT_PROVISIONABLE:${reason}`);
  await result.completion;
  assert.equal(handle.calls(),0,'no child is run for a non-freshness condition');
 }
 // A fresh root, an unavailable handle and a backing-free host all need no attempt at all.
 for(const reason of ['UPLOAD_DEFINITIONS_UNAVAILABLE','UPLOAD_DEFINITIONS_STALE','UPLOAD_DEFINITIONS_REFRESH_FAILED'])
  assert.equal(beginUploadNativeProvisioning({handle:handleFor(reason),configuration,now}).started,true,reason);
 assert.equal(beginUploadNativeProvisioning({handle:{inspection:{},host:{definitionsProvisioningState:()=>({provisioned:true,reason:null})},provisionDefinitions:async()=>{throw Error('never');}},configuration,now}).started,false,'a fresh snapshot needs no attempt');
 assert.equal(beginUploadNativeProvisioning({handle:null,configuration,now}).started,false);
 assert.equal(beginUploadNativeProvisioning({handle:{inspection:null,host:null,provisionDefinitions:null},configuration,now}).error,'UPLOAD_NATIVE_UNAVAILABLE');
 assert.equal(beginUploadNativeProvisioning({configuration,now}).started,false);
 // A healthy REMOTE mount is not an unavailable host: the runtime provisions its own snapshot, so CONTROL has nothing
 // to attempt and must report no fault. Its state names the remote case instead of looking broken to an operator.
 const remote=await mountUploadNativeControl({configuration:{uploads:{native:{enabled:true,agentcore:{imageDigest:DIGEST}}},
  agentcore:{runtimeArn:'arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/meri_synthetic',qualifier:'preview'}}});
 assert.equal(remote.inspection!==null,true);
 const remoteIdle=beginUploadNativeProvisioning({handle:remote,configuration,now});
 assert.equal(remoteIdle.started,false);
 assert.equal(remoteIdle.error,null,'a healthy remote mount carries no provisioning fault');
 assert.deepEqual(remoteIdle.state(),{provisioned:false,reason:null,remote:true});
});

test('closing CONTROL aborts the attempt through the runtime fence and nothing rejects',async()=>{
 const controller=new AbortController(),seen=[];
 const handle={inspection:{},host:{definitionsProvisioningState:()=>({provisioned:false,reason:'UPLOAD_DEFINITIONS_UNAVAILABLE'})},
  provisionDefinitions:async({signal,deadlineMs})=>{
   seen.push({signal,deadlineMs,aborted:signal?.aborted});
   await new Promise(resolve=>setTimeout(resolve,5));
   if(signal?.aborted)throw Object.assign(Error('UPLOAD_DEFINITIONS_CANCELLED'),{code:'UPLOAD_DEFINITIONS_CANCELLED'});
   return {provisioned:true};
  }};
 const provisioning=beginUploadNativeProvisioning({handle,configuration:{},now:Date.now,signal:controller.signal});
 assert.equal(provisioning.started,true);
 controller.abort();
 await provisioning.completion;
 assert.equal(seen.length,1);
 assert.equal(seen[0].signal,controller.signal,'the attempt runs under the runtime fence signal');
 assert.equal(seen[0].aborted,true,'closing CONTROL is visible to the attempt before it proceeds');
});

test('no request-shaped value mounts native execution: the seam reads only the trusted declaration',async()=>{
 const request={body:{uploads:{native:{enabled:true,imageDigest:DIGEST}}},
  uploadsInspection:{inspect:async()=>({status:'clean'})},uploads:{native:{enabled:true,imageDigest:DIGEST}}};
 const noDeclaration=await mountUploadNativeControl({configuration:{request},run:async()=>assert.fail('a request body never starts a sandbox probe')});
 assert.equal(noDeclaration.inspection,null);assert.deepEqual(noDeclaration.missing,['uploads.native.enabled']);
 const disabled=await mountUploadNativeControl({configuration:{uploads:{native:{enabled:false}},request},run:async()=>assert.fail('a request never overrides the declaration')});
 assert.equal(disabled.inspection,null);
 // The only enablement is the trusted JSON declaration; the request-shaped keys above are inert at every step.
 assert.equal(compileUploadNativeConfiguration({uploads:{native:{enabled:false}}}).enabled,false);
});
