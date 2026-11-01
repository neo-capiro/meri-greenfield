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
import {UPLOAD_CHILD_ENV} from '../native-sandbox.mjs';
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

test('the container declaration is closed: it names one image digest and nothing else',()=>{
 const absent=uploadInspectionHostConfiguration({});
 assert.deepEqual(absent.uploads.native,{enabled:false},'an absent digest declares no native inspection at all');
 assert.deepEqual(uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:'sha256:short'}).uploads.native,{enabled:false});
 const enabled=uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE,
  DEFINITIONS_ROOT:'/tmp/elsewhere',PATH:'/tmp/elsewhere',EXTRACTOR:'/tmp/nope',AWS_REGION:'us-east-1'});
 assert.deepEqual(enabled.uploads.native,{enabled:true,imageDigest:IMAGE},'no root, program, region or budget is selectable');
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
  envAllowed:true,checked:RUNTIME_CREDENTIAL_PATHS.length,readable:0});
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

test('an attested host is REALLY composed, and the real application serves its own fixed owner',async()=>{
 const tempRoot=await realpath(tmpdir()),definitionsRoot=await mkdtemp(join(tempRoot,'meri-defs-container-'));
 // The task-local definitions root this image's own volume provides. The check is given its own root so it never
 // resolves a snapshot another process published there; the empty root is exactly what a cold container starts with,
 // so the bounded startup attempt below is the real one. Nothing under the shared image path is read or written.
 const now=Date.now;
 const freshclam=[],children=[];
 // The one injected port: a fixed program port, exactly as the composition's own checks inject it. It synthesises the
 // probe observation, both tool identities, one signed snapshot publication and the two fixed inspection children.
 // No real freshclam, sigtool, ClamAV, extractor, image or corpus is executed, and none of this is qualification
 // evidence for the image: it is evidence that the JOIN carries real admissions into the real owner.
 const run=async(first,second,third)=>{
  const options=typeof second==='object'&&!Array.isArray(second)?second:(third??{});
  children.push({role:String(first),mode:options.mode??'default'});
  if(first==='freshclam'){freshclam.push({cwd:options.cwd,deadlineMs:options.deadlineMs});
   await writeFile(join(options.cwd,'database','main.cvd'),Buffer.from('fixture-main-cvd'));
   await writeFile(join(options.cwd,'database','daily.cvd'),Buffer.from('fixture-daily-cvd'));
   return {stdout:Buffer.alloc(0)};}
  if(first==='sigtool')return {stdout:Buffer.alloc(0)};
  if(first==='probe')return {stdout:Buffer.from(JSON.stringify(sandboxed(options.cwd,options.input)))};
  children.push({role:first,mode:options.mode??'default'});
  if(first==='scan')return options.mode==='version'?{stdout:Buffer.from('ClamAV 1.4.2/27450/x\n')}:{stdout:Buffer.alloc(0),receipt:{exitCode:0}};
  if(first==='extract')return options.mode==='version'?{stdout:Buffer.from('Python 3.13.16\n')}:
   {stdout:Buffer.from(JSON.stringify({status:'available',segments:[{...SEGMENT}],limitations:[]})),receipt:{exitCode:0}};
  throw Object.assign(Error('UPLOAD_SANDBOX_REFUSED'),{code:'UPLOAD_SANDBOX_REFUSED'});
 };
 const handle=await composeUploadInspectionHost({environment:{[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE},now,
  run,readFileImpl:async path=>Buffer.from('bin:'+path),scratchRoot:tempRoot,definitionsRoot,deadlineMs:now()+30000});
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
 const state=handle.host.definitionsProvisioningState();
 assert.equal(state.provisioned,true,'the cold root is answered by exactly one bounded startup publication');
 assert.equal(state.reason,null);
 assert.equal(state.attempted,true);
 assert.equal(freshclam.length,1,'the startup probe publishes exactly one snapshot through the serialized owner');
 assert.equal(handle.host.definitionsProvisioningState().provisioned,true);
 // A fresh snapshot resolves, so the fixed owner really runs its scan/extract children through the real application.
 const app=createAgentCoreApplication({execute:()=>assert.fail('the inspection purpose must never reach SDK execution'),
  inspection:createUploadInspectionApplication({inspection:handle.inspection,imageDigest:IMAGE})});
 const call=inspectionRequest({requestId:'b'.repeat(64),deadlineMs:now()+30000});
 const response=await app.handle(call.request);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.kind,'upload-inspection-result');
 assert.equal(body.requestId,'b'.repeat(64));
 assert.equal(body.scan.status,'clean','a fully examined original scans clean through the composed host');
 assert.match(body.scan.definitionsSha256,/^[a-f0-9]{64}$/u,'the receipt names the signed snapshot the child was bound to');
 assert.equal(body.extraction.status,'available');
 assert.equal(body.extraction.segments.length,1);
 assert.equal(body.provenance.expectedImageDigest,IMAGE);
 assert.equal(body.provenance.imageObserved,false);
 // The EXISTING custody receipt gate accepts what this application returned.
 const accepted=validateUploadInspection({file:body.file,scan:body.scan,extraction:body.extraction},DECLARATION,
  {fromMs:now()-60000,toMs:now()+60000});
 assert.equal(accepted.extraction.segments[0].trust,'external_untrusted');
 // Only the fixed programs of this owner were ever reached, and the fixed inspection pair ran exactly once each.
 const roles=new Set(children.map(entry=>entry.role));
 assert.deepEqual([...roles].sort(),['extract','freshclam','probe','scan','sigtool'],'no caller-supplied program is reachable');
 assert.equal(children.some(entry=>entry.role==='scan'&&entry.mode==='default'),true,'the fixed scan child really ran');
 assert.equal(children.some(entry=>entry.role==='extract'&&entry.mode==='default'),true,'the fixed extractor child really ran');
 assert.equal(children.filter(entry=>entry.mode==='version').length,4,'both tool identities are observed, never assumed');
 assert.equal(freshclam.length,1);
 // A host that is already fresh starts no second provisioning attempt, and one that is not is answered by the very
 // same serialized owner on the caller's own absolute budget (never a scan deadline).
 const idle=beginUploadNativeProvisioning({handle,configuration:uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE}),
  now,signal:undefined});
 assert.equal(idle.started,false);
 assert.equal(idle.error,null);
 assert.equal(idle.state().provisioned,true);
 const provisioningMs=uploadInspectionHostConfiguration({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE}).uploads.native;
 assert.equal(Object.hasOwn(provisioningMs,'provisionMs'),false,'the container declares no provisioning budget of its own');
 assert.equal(UPLOAD_NATIVE_DEFAULT_PROVISION_MS,120000);
 await app.close({deadlineMs:now()+5000});
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
 const compose=env=>composeUploadInspectionHost({environment:env,run,readFileImpl:async path=>Buffer.from('bin:'+path),scratchRoot:tempRoot,definitionsRoot,deadlineMs:Date.now()+30000});
 const handle=await compose(environment);
 assert.deepEqual(handle.missing,[],'the microVM-bounded sandbox is admitted and the real ports are composed');
 assert.notEqual(handle.inspection,null);
 assert.equal(handle.host.admission.sandbox.boundedResources,true);
 assert.equal(handle.host.diagnostic.boundedBy,'agentcore-microvm','the admission records the platform attestation');
 assert.deepEqual(handle.host.diagnostic.resources,{memoryMax:0,pidsMax:0,cpuMax:0},'the observed facts are not rewritten');
 assert.equal(handle.host.diagnostic.credentials.checked,RUNTIME_CREDENTIAL_PATHS.length);
 // The SAME image, shape and inventory without the verified runtime environment is still refused on boundedResources:
 // the evidence is the platform's, not a value the digest or any other variable supplies.
 const unverified=await compose({[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT]:IMAGE,AGENTCORE:'1'});
 assert.equal(unverified.inspection,null);assert.equal(unverified.reason,'UPLOAD_SANDBOX_UNQUALIFIED');
 assert.deepEqual(unverified.requirements,['boundedResources']);assert.equal(unverified.diagnostic.boundedBy,null);
});
