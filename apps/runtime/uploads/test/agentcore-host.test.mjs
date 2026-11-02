/** The container-side join this purpose's startup actually runs: the accepted composition owner over the fixed native
 * sandbox, the signed-definition store and the observed tool identities, feeding the REAL purpose-locked application.
 *
 * The first check is the production default: no injected runner and no injected paths, exactly as the entrypoint calls
 * it, on a host that is not the attested Linux sandbox. The second injects the same narrow `run`/`readFileImpl` ports
 * the composition's own checks use, so the composition is REAL (probe admission, tool observation, one signed snapshot
 * publication, one fixed scanner invocation, one fixed extractor invocation) while no real sandbox, image, tool or
 * corpus is exercised. Neither check is qualification evidence for the image; that remains Release-only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {realpath,mkdtemp,writeFile} from 'node:fs/promises';
import {RENDERER_PROBE_SCHEMA} from '../../../artifacts/renderer-qualification.mjs';
import {UPLOAD_CHILD_ENV,UPLOAD_DEFINITIONS_ROOT,UPLOAD_BAKED_DEFINITIONS_ROOT,UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS} from '../native-sandbox.mjs';
import {createSignedDefinitionUpdater} from '../native-definitions.mjs';
import {RUNTIME_CREDENTIAL_PATHS} from '../../credential-inventory.mjs';
import {validateUploadInspection} from '../../../control/uploads/extraction.mjs';
import {uploadHash,UPLOAD_MIME} from '../../../control/uploads/policy.mjs';
import {AGENTCORE_SESSION_HEADER} from '../../agentcore-contract.mjs';
import {createAgentCoreApplication} from '../../agentcore-http.mjs';
import {createUploadInspectionApplication,composeUploadInspectionHost,uploadInspectionHostConfiguration,
 UPLOAD_INSPECTION_IMAGE_ENVIRONMENT} from '../agentcore-http.mjs';
import {uploadInspectionSessionId} from '../agentcore-contract.mjs';
import {beginUploadNativeProvisioning,UPLOAD_NATIVE_DEFAULT_PROVISION_MS} from '../control-lifecycle.mjs';
import {agentcoreRuntimePlatform} from '../../agentcore-platform.mjs';
import {createRunnerTlsCertificateFixture} from '../../native-authority/test/runner-tls-fixture.mjs';
import {createHash} from 'node:crypto';
/** The live AgentCore container's cgroup view: one unlimited root cgroup v2. */
const MICROVM=Object.freeze({memoryMax:'max',pidsMax:'max',cpuMax:'max 100000',levels:1,mountRootIsRoot:true,membershipResolved:true,identityChanged:false,source:'cgroup2'});
/** The AgentCore runtime environment the entrypoint verifies before serving: the only platform evidence admitted. */
function agentcoreRuntimeEnvironment(t){
 const certificates=createRunnerTlsCertificateFixture(t);
 return {MERI_CONTROL_ORIGIN:'https://control.synthetic.invalid',MERI_CONTROL_CA_BASE64:certificates.ca.toString('base64'),
  MERI_CONTROL_CA_SHA256:createHash('sha256').update(certificates.ca).digest('hex'),AWS_REGION:'us-east-1'};
}

const IMAGE='sha256:'+'e'.repeat(64),ZERO='0'.repeat(16);
const BYTES=Buffer.from('wave5 container-side inspection fixture\n','utf8');
const DECLARATION=Object.freeze({filename:'note.txt',mimeType:UPLOAD_MIME.txt,bytes:BYTES.length,sha256:uploadHash(BYTES)});
const SEGMENT=Object.freeze({ordinal:0,text:'fixture text',method:'native',confidence:null,
 location:Object.freeze({page:null,slide:null,sheet:null,rowStart:null,rowEnd:null})});
/** The probe's observation for the inventory the host actually handed it (the qualifier binds the two exactly). */
const requested=input=>JSON.parse(Buffer.from(input??'{}').toString('utf8')).credentialPaths??[];
const sandboxed=(cwd,input)=>({schema:RENDERER_PROBE_SCHEMA,platform:'linux',uid:[1000,1000,1000,1000],gid:[1000,1000,1000,1000],noNewPrivs:1,
 capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:ZERO,CapBnd:ZERO,CapAmb:ZERO},rootMountOptions:'ro,relatime',interfaces:['lo'],
 cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},envNames:[...UPLOAD_CHILD_ENV],cwd,home:cwd,tmpdir:cwd,
 workspace:{mode:0o700,uid:1000},inputValid:true,credentialPathsReadable:requested(input).map(path=>({path,readable:false}))});
/** The real purpose's one request, built exactly as the transport builds it. */
const inspectionRequest=({requestId,imageDigest=IMAGE,declaration=DECLARATION,bytes=BYTES,deadlineMs})=>{
 const session=uploadInspectionSessionId(requestId);
 return {session,request:new Request('http://runtime.invalid/invocations',{method:'POST',headers:{'content-type':'application/json',
  [AGENTCORE_SESSION_HEADER]:session},body:JSON.stringify({kind:'upload-inspection',requestId,imageDigest,declaration,
  bytesBase64:bytes.toString('base64'),inputSha256:uploadHash(bytes),deadlineMs})})};
};

test('the container declaration is closed: one image digest from the environment, the baked root and its age as fixed image facts',()=>{
 const absent=uploadInspectionHostConfiguration({});
 assert.deepEqual(absent.uploads.native,{enabled:false},'an absent digest declares no native inspection at all');
 assert.deepEqual(uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:'sha256:short'}).uploads.native,{enabled:false});
 const enabled=uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE,
  DEFINITIONS_ROOT:'/tmp/elsewhere',MERI_UPLOAD_DEFINITIONS_ROOT:'/tmp/elsewhere',PATH:'/tmp/elsewhere',EXTRACTOR:'/tmp/nope',AWS_REGION:'us-east-1'});
 assert.deepEqual(enabled.uploads.native,{enabled:true,imageDigest:IMAGE,definitionsRoot:UPLOAD_BAKED_DEFINITIONS_ROOT,
  maxDefinitionsAgeMs:UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS},'no root, program, region or budget is selectable from the environment');
 assert.equal(UPLOAD_BAKED_DEFINITIONS_ROOT.startsWith('/opt/meri/'),true,'the baked root is an image path, never the task-local volume');
 assert.notEqual(UPLOAD_BAKED_DEFINITIONS_ROOT,UPLOAD_DEFINITIONS_ROOT);
});

test('the REAL default startup path on an unattested host yields no port, and the purpose answers 503',async()=>{
 // No run, no paths, no scratch root: exactly what the entrypoint passes. This host is not the attested Linux sandbox,
 // so the composition must fail closed rather than offer a scanner it cannot back.
 const handle=await composeUploadInspectionHost({environment:{[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE}});
 assert.equal(handle.inspection,null);
 assert.equal(handle.host?.scanner??null,null);
 assert.equal(handle.missing.includes('uploads.native.sandbox'),true);
 assert.equal(typeof handle.reason,'string');assert.ok(handle.reason.length>0,'the qualification reason reaches the startup event');
 assert.equal(handle.provisionDefinitions,null,'an uncomposed host has no provisioning handle');
 const app=createUploadInspectionApplication({inspection:handle.inspection,imageDigest:IMAGE});
 const call=inspectionRequest({requestId:'a'.repeat(64),deadlineMs:Date.now()+30000});
 const response=await app.handle(call.request);
 assert.equal(response.status,503);
 assert.equal((await response.json()).error.code,'UPLOAD_INSPECTION_UNAVAILABLE');
 await app.close({deadlineMs:Date.now()+5000});
});

test('the unqualified startup handle carries the bounded numeric and credential diagnostic',async()=>{
 const tempRoot=await realpath(tmpdir());
 const probes=[];
 const handle=await composeUploadInspectionHost({environment:{[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE},scratchRoot:tempRoot,
  run:async(role,options)=>{probes.push(requested(options.input));
   return {stdout:Buffer.from(JSON.stringify({...sandboxed(options.cwd,options.input),noNewPrivs:0,
    cgroup:{memoryMax:'max',pidsMax:'64',cpuMax:'max 100000'}})),receipt:{exitCode:0}};}});
 assert.equal(handle.inspection,null);assert.equal(handle.reason,'UPLOAD_SANDBOX_UNQUALIFIED');
 assert.deepEqual(handle.diagnostic.resources,{memoryMax:0,pidsMax:64,cpuMax:0});
 assert.equal(handle.diagnostic.credentials.envAllowed,true);
 assert.equal(handle.diagnostic.credentials.allowedCount,UPLOAD_CHILD_ENV.length);
 // The container-side join hands the probe this image's protected-path inventory, and the probe proved none readable:
 // `noCredentials` is attested, so only the two observed gaps remain.
 assert.deepEqual(probes,[[...RUNTIME_CREDENTIAL_PATHS]],'exactly one probe, bound to the image inventory');
 assert.deepEqual(handle.diagnostic.credentials,{networkIsolated:true,envCount:UPLOAD_CHILD_ENV.length,allowedCount:UPLOAD_CHILD_ENV.length,
  envAllowed:true,checked:RUNTIME_CREDENTIAL_PATHS.length,readable:0,readablePaths:[]});
 assert.deepEqual(handle.requirements,['noNewPrivileges','boundedResources']);
});

test('the live AgentCore startup shape: an unlimited root cgroup leaves boundedResources as the ONLY unmet requirement',async()=>{
 // The deployed container reported requirements ['boundedResources','noCredentials'] with credentials {checked:0,
 // readable:0}: the sandbox itself was isolated, but the join had handed the probe NO inventory, which the qualifier
 // rightly refuses to attest. With the image inventory the credential requirement is met on that same observation,
 // and the event names only the host's actual gap (every cgroup bound reads `max`).
 const tempRoot=await realpath(tmpdir());
 const handle=await composeUploadInspectionHost({environment:{[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE},scratchRoot:tempRoot,
  run:async(role,options)=>({stdout:Buffer.from(JSON.stringify({...sandboxed(options.cwd,options.input),
   cgroup:{memoryMax:'max',pidsMax:'max',cpuMax:'max 100000'}})),receipt:{exitCode:0}})});
 assert.equal(handle.inspection,null);assert.equal(handle.reason,'UPLOAD_SANDBOX_UNQUALIFIED');
 assert.deepEqual(handle.requirements,['boundedResources']);
 assert.deepEqual(handle.diagnostic.resources,{memoryMax:0,pidsMax:0,cpuMax:0});
 assert.equal(handle.diagnostic.credentials.checked,RUNTIME_CREDENTIAL_PATHS.length);
 assert.equal(handle.diagnostic.credentials.readable,0);
 const app=createUploadInspectionApplication({inspection:handle.inspection,imageDigest:IMAGE});
 const response=await app.handle(inspectionRequest({requestId:'c'.repeat(64),deadlineMs:Date.now()+30000}).request);
 assert.equal(response.status,503,'an unbounded host still never serves a scan');
 await app.close({deadlineMs:Date.now()+5000});
});

/** The fixed definition programs as the composition's checks inject them: `freshclam` publishes two containers (only
 * ever at BUILD time here), `sigtool` verifies anything. `calls` records which program ran, so a check can prove that
 * a running container never fetched. */
const definitionPrograms=calls=>async(program,args,options={})=>{
 calls.push(program);
 if(program==='freshclam'){await writeFile(join(options.cwd,'database','main.cvd'),Buffer.from('fixture-main-cvd'));
  await writeFile(join(options.cwd,'database','daily.cvd'),Buffer.from('fixture-daily-cvd'));return {stdout:Buffer.alloc(0)};}
 if(program==='sigtool')return {stdout:Buffer.alloc(0)};
 throw Object.assign(Error('UPLOAD_DEFINITIONS_PROGRAM_REFUSED'),{code:'UPLOAD_DEFINITIONS_PROGRAM_REFUSED'});
};
/** The fixed inspection children through the sandbox port: the probe observation, both tool identities, one scan and
 * one extraction. Never a definition program: those have their own port above. */
const inspectionChildren=children=>async(role,options={})=>{
 children.push({role,mode:options.mode??'default'});
 if(role==='probe')return {stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd,options.input)))};
 if(role==='scan')return options.mode==='version'?{stdout:Buffer.from('ClamAV 1.4.2/27450/x\n')}:{stdout:Buffer.alloc(0),receipt:{exitCode:0}};
 if(role==='extract')return options.mode==='version'?{stdout:Buffer.from('Python 3.13.16\n')}:
  {stdout:Buffer.from(JSON.stringify({status:'available',segments:[{...SEGMENT}],limitations:[]})),receipt:{exitCode:0}};
 throw Object.assign(Error('UPLOAD_SANDBOX_REFUSED'),{code:'UPLOAD_SANDBOX_REFUSED'});
};
/** What `apps/runtime/Dockerfile` does once per image: publish the signed snapshot into the baked root. */
const bake=async(definitionsRoot,{now=Date.now}={})=>{
 const published=await createSignedDefinitionUpdater({root:definitionsRoot,run:definitionPrograms([]),now}).provision({deadlineMs:now()+30000});
 return published.sha256;
};
const composeBaked=({definitionsRoot,tempRoot,now=Date.now,definitionCalls=[],children=[],environment={[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE}})=>
 composeUploadInspectionHost({environment,now,run:inspectionChildren(children),definitionsRun:definitionPrograms(definitionCalls),
  readFileImpl:async path=>Buffer.from('bin:'+path),scratchRoot:tempRoot,definitionsRoot,deadlineMs:now()+30000});

test('an attested host serves the snapshot BAKED into its image, pinned: no download at startup, none inside a scan',async()=>{
 const tempRoot=await realpath(tmpdir()),definitionsRoot=await mkdtemp(join(tempRoot,'meri-defs-baked-'));
 const now=Date.now,definitionCalls=[],children=[];
 const baked=await bake(definitionsRoot,{now});
 const handle=await composeBaked({definitionsRoot,tempRoot,now,definitionCalls,children});
 assert.deepEqual(handle.missing,[],'an attested host reports no unmet declaration');
 assert.notEqual(handle.inspection,null,'the real ports are passed to the inspection application');
 assert.equal(typeof handle.inspection.inspect,'function');
 // The admissions are OBSERVED ones, and the image digest stays a DECLARED expectation in both directions.
 const describe=handle.host.describe();
 assert.equal(describe.scanner.version,'1.4.2');
 assert.equal(describe.extractor.version,'3.13.16');
 assert.equal(describe.toolRootsReadOnly,true);
 assert.equal(describe.expectedImageDigest,IMAGE);
 assert.equal(describe.imageObserved,false,'a declared digest is never reported as an observed one');
 assert.equal(handle.host.admission.imageDigest,IMAGE,'the admission carries the expectation this purpose was built for');
 // The startup probe resolved the baked snapshot and reports WHICH one; nothing was provisioned by this container.
 const state=handle.host.definitionsProvisioningState();
 assert.equal(state.pinned,true,'the image snapshot is served through a pinned store');
 assert.equal(state.reason,null);
 assert.equal(state.provisioned,false,'a pinned host never provisions');
 assert.equal(state.snapshot.sha256,baked,'the startup event can name the baked snapshot');
 assert.equal(typeof state.snapshot.publishedAt,'string');
 assert.deepEqual(definitionCalls.filter(program=>program==='freshclam'),[],'the running container never runs freshclam');
 assert.ok(definitionCalls.includes('sigtool'),'the baked containers are still re-verified against the publisher signature on resolve');
 // The fixed owner really runs its scan/extract children through the real application, bound to the baked snapshot.
 const app=createAgentCoreApplication({execute:()=>assert.fail('the inspection purpose must never reach SDK execution'),
  inspection:createUploadInspectionApplication({inspection:handle.inspection,imageDigest:IMAGE})});
 const call=inspectionRequest({requestId:'b'.repeat(64),deadlineMs:now()+30000});
 const response=await app.handle(call.request);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.kind,'upload-inspection-result');
 assert.equal(body.requestId,'b'.repeat(64));
 assert.equal(body.scan.status,'clean','a fully examined original scans clean through the composed host');
 assert.equal(body.scan.definitionsSha256,baked,'the receipt names the baked snapshot the child was bound to');
 assert.equal(body.extraction.status,'available');
 assert.equal(body.extraction.segments.length,1);
 assert.equal(body.provenance.expectedImageDigest,IMAGE);
 assert.equal(body.provenance.imageObserved,false);
 // The EXISTING custody receipt gate accepts what this application returned.
 const accepted=validateUploadInspection({file:body.file,scan:body.scan,extraction:body.extraction},DECLARATION,
  {fromMs:now()-60000,toMs:now()+60000});
 assert.equal(accepted.extraction.segments[0].trust,'external_untrusted');
 // Only the fixed programs of this owner were ever reached, and the fixed inspection pair ran exactly once each.
 assert.deepEqual([...new Set(children.map(entry=>entry.role))].sort(),['extract','probe','scan'],'no caller-supplied program is reachable');
 assert.equal(children.filter(entry=>entry.role==='scan'&&entry.mode==='default').length,1,'the fixed scan child really ran, once');
 assert.equal(children.filter(entry=>entry.role==='extract'&&entry.mode==='default').length,1,'the fixed extractor child really ran, once');
 assert.equal(children.filter(entry=>entry.mode==='version').length,2,'both tool identities are observed, never assumed');
 assert.deepEqual(definitionCalls.filter(program=>program==='freshclam'),[],'and the scan itself fetched nothing either');
 // The lifecycle owner has nothing to provision on a pinned host: it stays idle with no fault.
 const idle=beginUploadNativeProvisioning({handle,configuration:uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE}),now,signal:undefined});
 assert.equal(idle.started,false);
 assert.equal(idle.error,null);
 const declared=uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE}).uploads.native;
 assert.equal(Object.hasOwn(declared,'provisionMs'),false,'the container declares no provisioning budget of its own');
 assert.equal(UPLOAD_NATIVE_DEFAULT_PROVISION_MS,120000);
 await app.close({deadlineMs:now()+5000});
});

test('runtime v33 reproduced: an image root with NO baked snapshot composes, never fetches, and every scan is honestly UPLOAD_DEFINITIONS_UNAVAILABLE',async()=>{
 // This is the live 2 November shape: the host attested its sandbox and tools, the control plane dispatched the
 // inspection, and the receipt that landed in custody said scan unavailable / UPLOAD_DEFINITIONS_UNAVAILABLE. The
 // pinned store makes that outcome immediate and content-free instead of a doomed download racing the deadline.
 const tempRoot=await realpath(tmpdir()),definitionsRoot=await mkdtemp(join(tempRoot,'meri-defs-empty-'));
 const now=Date.now,definitionCalls=[];
 const handle=await composeBaked({definitionsRoot,tempRoot,now,definitionCalls});
 assert.deepEqual(handle.missing,[],'the sandbox and tools are attested; the definitions are a per-scan verdict');
 const state=handle.host.definitionsProvisioningState();
 assert.equal(state.pinned,true);assert.equal(state.reason,'UPLOAD_DEFINITIONS_UNAVAILABLE');assert.equal(state.snapshot,null);
 assert.deepEqual(definitionCalls,[],'nothing is downloaded or verified on an empty pinned root');
 const idle=beginUploadNativeProvisioning({handle,configuration:uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE}),now,signal:undefined});
 // The lifecycle owner would start an attempt for an UNAVAILABLE root, but on a pinned host that attempt is a no-op.
 await idle.completion;
 assert.deepEqual(definitionCalls,[],'a pinned host cannot be provisioned at runtime');
 const app=createUploadInspectionApplication({inspection:handle.inspection,imageDigest:IMAGE});
 const response=await app.handle(inspectionRequest({requestId:'d'.repeat(64),deadlineMs:now()+30000}).request);
 assert.equal(response.status,200,'the verdict is a settled receipt, not a transport fault to retry');
 const body=await response.json();
 assert.equal(body.scan.status,'unavailable');
 assert.equal(body.scan.reason,'UPLOAD_DEFINITIONS_UNAVAILABLE');
 assert.equal(body.extraction.status,'unavailable','nothing is extracted from an unscanned original');
 assert.deepEqual(definitionCalls,[],'the scan did not try to fetch either');
 await app.close({deadlineMs:now()+5000});
});

test('a baked snapshot older than its image age bound is UPLOAD_DEFINITIONS_STALE, never refreshed in the session',async()=>{
 const tempRoot=await realpath(tmpdir()),definitionsRoot=await mkdtemp(join(tempRoot,'meri-defs-stale-'));
 const definitionCalls=[];
 const builtAt=Date.now()-UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS-60000;
 await bake(definitionsRoot,{now:()=>builtAt});
 const handle=await composeBaked({definitionsRoot,tempRoot,definitionCalls});
 assert.equal(handle.host.definitionsProvisioningState().reason,'UPLOAD_DEFINITIONS_STALE');
 const app=createUploadInspectionApplication({inspection:handle.inspection,imageDigest:IMAGE});
 const response=await app.handle(inspectionRequest({requestId:'e'.repeat(64),deadlineMs:Date.now()+30000}).request);
 const body=await response.json();
 assert.equal(body.scan.status,'unavailable');assert.equal(body.scan.reason,'UPLOAD_DEFINITIONS_STALE');
 assert.deepEqual(definitionCalls.filter(program=>program==='freshclam'),[],'the remedy is a rebuilt image, not a fetch');
 await app.close({deadlineMs:Date.now()+5000});
});

test('the platform evidence is the verified AgentCore runtime environment, never a flag',t=>{
 const environment=agentcoreRuntimeEnvironment(t);
 assert.deepEqual(agentcoreRuntimePlatform(environment),{runtime:'agentcore'});
 for(const patch of [{MERI_CONTROL_ORIGIN:undefined},{MERI_CONTROL_CA_SHA256:'a'.repeat(64)},{AWS_REGION:'eu-west-1'},{MERI_CONTROL_CA_BASE64:'bm90IGEgY2VydA=='}])
  assert.equal(agentcoreRuntimePlatform({...environment,...patch}),null,JSON.stringify(Object.keys(patch)));
 assert.equal(agentcoreRuntimePlatform({}),null);assert.equal(agentcoreRuntimePlatform({AGENTCORE:'1',MERI_PLATFORM:'agentcore'}),null);
});

test('on the AgentCore microVM the join attests boundedResources from the verified environment plus the observed root cgroup',async t=>{
 const tempRoot=await realpath(tmpdir()),definitionsRoot=await mkdtemp(join(tempRoot,'meri-defs-microvm-'));
 const environment={...agentcoreRuntimeEnvironment(t),[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE};
 const run=async(first,second,third)=>{
  const options=typeof second==='object'&&!Array.isArray(second)?second:(third??{});
  if(first==='freshclam'){await writeFile(join(options.cwd,'database','main.cvd'),Buffer.from('fixture-main-cvd'));
   await writeFile(join(options.cwd,'database','daily.cvd'),Buffer.from('fixture-daily-cvd'));return {stdout:Buffer.alloc(0)};}
  if(first==='sigtool')return {stdout:Buffer.alloc(0)};
  if(first==='probe')return {stdout:Buffer.from(JSON.stringify({...sandboxed(options.cwd,options.input),cgroup:{...MICROVM}}))};
  if(first==='scan')return options.mode==='version'?{stdout:Buffer.from('ClamAV 1.4.2/27450/x\n')}:{stdout:Buffer.alloc(0),receipt:{exitCode:0}};
  if(first==='extract')return options.mode==='version'?{stdout:Buffer.from('Python 3.13.16\n')}:
   {stdout:Buffer.from(JSON.stringify({status:'available',segments:[{...SEGMENT}],limitations:[]})),receipt:{exitCode:0}};
  throw Object.assign(Error('UPLOAD_SANDBOX_REFUSED'),{code:'UPLOAD_SANDBOX_REFUSED'});
 };
 // `hostCgroup` is the host-side read (`readHostCgroup`) this non-Linux check cannot perform: the live container's
 // resolved hierarchy, one unlimited root. It is the same narrow fixture port the composition's own checks inject.
 const hostCgroup={memoryMax:'max',pidsMax:'max',cpuMax:'max 100000',levels:1,mountRootIsRoot:true};
 const compose=(env,host=hostCgroup)=>composeUploadInspectionHost({environment:env,run,readFileImpl:async path=>Buffer.from('bin:'+path),scratchRoot:tempRoot,definitionsRoot,deadlineMs:Date.now()+30000,
  ...(host===undefined?{}:{hostCgroup:host})});
 const handle=await compose(environment);
 assert.deepEqual(handle.missing,[],'the microVM-bounded sandbox is admitted and the real ports are composed');
 assert.notEqual(handle.inspection,null);
 assert.equal(handle.host.admission.sandbox.boundedResources,true);
 assert.equal(handle.host.diagnostic.boundedBy,'agentcore-microvm','the admission records the platform attestation');
 assert.deepEqual(handle.host.diagnostic.resources,{memoryMax:0,pidsMax:0,cpuMax:0},'the observed facts are not rewritten');
 assert.deepEqual(handle.host.diagnostic.cgroupHost,{resolved:true,levels:1,mountRootIsRoot:true});
 assert.equal(handle.host.diagnostic.credentials.checked,RUNTIME_CREDENTIAL_PATHS.length);
 // Without a resolved host hierarchy the child's namespaced view (always one unlimited root under bwrap) is not
 // evidence of the microVM shape, so the verified environment alone attests nothing.
 const unresolved=await compose(environment,null);
 assert.equal(unresolved.inspection,null);assert.deepEqual(unresolved.requirements,['boundedResources']);
 assert.equal(unresolved.diagnostic.boundedBy,null);assert.equal(unresolved.diagnostic.cgroupHost.resolved,false);
 // The SAME image, shape and inventory without the verified runtime environment is still refused on boundedResources:
 // the evidence is the platform's, not a value the digest or any other variable supplies.
 const unverified=await compose({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE,AGENTCORE:'1'});
 assert.equal(unverified.inspection,null);assert.equal(unverified.reason,'UPLOAD_SANDBOX_UNQUALIFIED');
 assert.deepEqual(unverified.requirements,['boundedResources']);assert.equal(unverified.diagnostic.boundedBy,null);
});
