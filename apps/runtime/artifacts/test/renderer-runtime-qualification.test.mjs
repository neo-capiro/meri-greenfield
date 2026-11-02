/** The AgentCore renderer purpose's own qualifier and its runtime log. Only the native child runner is scripted; the real
 * qualification owner evaluates what a bubblewrap child on the AgentCore microVM reports. No process, cloud or model. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';import {realpath} from 'node:fs/promises';import {createHash} from 'node:crypto';
import * as actual from '../../../artifacts/renderer-qualification.mjs';
import {createRunnerTlsCertificateFixture} from '../../native-authority/test/runner-tls-fixture.mjs';
const forwarded=[];
mock.module('../../../artifacts/renderer-qualification.mjs',{namedExports:{...actual,qualifyLibreOfficeRenderer:async options=>{forwarded.push(options);return actual.qualifyLibreOfficeRenderer({...options,tempRoot:await realpath(tmpdir()),run:scriptedRun});}}});
const {qualifyRuntimeRenderer,runRendererSandbox,RENDERER_IMAGE_PATHS}=await import('../renderer-sandbox.mjs');
const {createRuntimeRendererApplication,RENDERER_AVAILABLE_EVENT,RENDERER_UNAVAILABLE_EVENT}=await import('../renderer-http.mjs');
const {RUNTIME_CREDENTIAL_PATHS}=await import('../../credential-inventory.mjs');
const {rendererSessionId}=await import('../renderer-contract.mjs');

const imageDigest='sha256:'+'d'.repeat(64),ZERO='0'.repeat(16);
let observation;
/** What a bwrap child on the AgentCore microVM reports: every restriction observed, the single unlimited root cgroup,
 * and the `PWD` bwrap sets. Version is the image's LibreOffice. */
const microvmChild=cwd=>({schema:actual.RENDERER_PROBE_SCHEMA,platform:'linux',uid:[1000,1000,1000,1000],gid:[1000,1000,1000,1000],noNewPrivs:1,
 capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:ZERO,CapBnd:ZERO,CapAmb:ZERO},rootMountOptions:'ro,nosuid,nodev,relatime',interfaces:['lo'],
 cgroup:{memoryMax:'max',pidsMax:'max',cpuMax:'max 100000',levels:1,mountRootIsRoot:true,membershipResolved:true,identityChanged:false,source:'cgroup2'},
 envNames:[...actual.BWRAP_CHILD_ENV].sort(),cwd,home:cwd,tmpdir:cwd,workspace:{mode:0o700,uid:1000},inputValid:true,
 credentialPathsReadable:RUNTIME_CREDENTIAL_PATHS.map(path=>({path,readable:false}))});
async function scriptedRun(executable,args,options){
 if(args[0]==='--version')return {stdout:Buffer.from('LibreOffice 26.8.2.2 synthetic\n'),receipt:{exitCode:0}};
 return {stdout:Buffer.from(JSON.stringify(observation(options.cwd))),receipt:{exitCode:0}};
}
const agentcore={runtime:'agentcore'};
/** The verified AgentCore runtime environment the entrypoint checks before serving (control origin, pinned CA, region). */
function agentcoreEnvironment(t){
 const certificates=createRunnerTlsCertificateFixture(t);
 return {MERI_CONTROL_ORIGIN:'https://control.synthetic.invalid',MERI_CONTROL_CA_BASE64:certificates.ca.toString('base64'),
  MERI_CONTROL_CA_SHA256:createHash('sha256').update(certificates.ca).digest('hex'),AWS_REGION:'us-east-1'};
}

test('the runtime qualifier hands the qualification owner the bwrap runner and the bwrap child allowlist',async()=>{
 forwarded.length=0;observation=microvmChild;
 await qualifyRuntimeRenderer({imageDigest,deadlineMs:Date.now()+30000,environment:{}});
 const [options]=forwarded;
 assert.equal(options.run,runRendererSandbox);assert.equal(options.childEnv,actual.BWRAP_CHILD_ENV);
 assert.equal(options.executable,RENDERER_IMAGE_PATHS.executable);assert.deepEqual(options.credentialPaths,[...RUNTIME_CREDENTIAL_PATHS]);
 assert.equal(options.platform,null,'no verified AgentCore environment, no platform attestation');
});

test('the microVM child bwrap reports qualifies; the same child judged on the plain list is the v34 refusal',async t=>{
 observation=microvmChild;forwarded.length=0;
 const fixed=await qualifyRuntimeRenderer({imageDigest,deadlineMs:Date.now()+30000,environment:agentcoreEnvironment(t)});
 assert.deepEqual(forwarded[0].platform,agentcore);
 assert.equal(fixed.port.state,'available');assert.equal(fixed.receipt.boundedBy,'agentcore-microvm');
 const v34=await actual.qualifyLibreOfficeRenderer({...RENDERER_IMAGE_PATHS,tempRoot:await realpath(tmpdir()),imageDigest,qualificationId:'q',
  deadlineMs:Date.now()+30000,credentialPaths:[...RUNTIME_CREDENTIAL_PATHS],run:scriptedRun,platform:agentcore});
 assert.equal(v34.port.reason,'RENDERER_SANDBOX_UNQUALIFIED');assert.deepEqual([...v34.port.missingRequirements],['noCredentials']);
});

const request=(input)=>new Request('http://runtime.invalid/invocations',{method:'POST',
 headers:{'content-type':'application/json','x-amzn-bedrock-agentcore-runtime-session-id':rendererSessionId(input.requestId)},body:JSON.stringify(input)});
const qualifyInput=()=>({kind:'artifact-renderer',action:'qualify',requestId:'e'.repeat(64),imageDigest,deadlineMs:Date.now()+30000});
async function session(qualify){
 const events=[],app=createRuntimeRendererApplication({imageDigest,qualify,report:event=>events.push(event)});
 const response=await app.handle(request(qualifyInput()));await app.close({deadlineMs:Date.now()+1000});return {status:response.status,events};
}

test('a qualified session writes one available event naming the version and the bounding layer',async t=>{
 observation=microvmChild;const environment=agentcoreEnvironment(t);
 const {status,events}=await session(({deadlineMs,signal})=>qualifyRuntimeRenderer({imageDigest,deadlineMs,signal,environment}));
 assert.equal(status,200);assert.deepEqual(events,[{event:RENDERER_AVAILABLE_EVENT,rendererVersion:'26.8.2.2',boundedBy:'agentcore-microvm'}]);
});

test('every refused qualification names its failing step in one content-free event',async t=>{
 const withEnv=extra=>cwd=>({...microvmChild(cwd),envNames:[...actual.BWRAP_CHILD_ENV,...extra]}),environment=agentcoreEnvironment(t);
 // Unqualified sandbox: the reason and the exact missing requirement, never the variable name or a path.
 observation=withEnv(['AWS_SESSION_TOKEN']);
 const unqualified=await session(()=>qualifyRuntimeRenderer({imageDigest,deadlineMs:Date.now()+30000,environment}));
 assert.equal(unqualified.status,503);
 assert.deepEqual(unqualified.events,[{event:RENDERER_UNAVAILABLE_EVENT,stage:'qualify',reason:'RENDERER_SANDBOX_UNQUALIFIED',failure:null,
  missing:['noCredentials'],boundedBy:'agentcore-microvm',imageMatches:true,processes:[{exitCode:0,signal:null,spawnError:null,failure:null,settlement:null,stderrBytes:null},
   {exitCode:0,signal:null,spawnError:null,failure:null,settlement:null,stderrBytes:null}]}]);
 assert.equal(JSON.stringify(unqualified.events).includes('AWS_SESSION_TOKEN'),false);
 // A child that never ran (the bwrap setup shape): the closed failure code and the process outcome.
 const setup=Object.assign(Error('x'),{code:'ARTIFACT_PROCESS_FAILED',stderr:Buffer.from('bwrap: synthetic'),receipt:{exitCode:1,signal:null,settlement:'closed',spawnError:null,stderrBytes:16,stdoutSha256:'f'.repeat(64)}});
 const version=await session(()=>actual.qualifyLibreOfficeRenderer({...RENDERER_IMAGE_PATHS,tempRoot:tmpdir(),imageDigest,qualificationId:'q',deadlineMs:Date.now()+30000,run:async()=>{throw setup;}}));
 assert.deepEqual(version.events,[{event:RENDERER_UNAVAILABLE_EVENT,stage:'qualify',reason:'RENDERER_NOT_ADMITTED',failure:'RENDERER_VERSION_UNAVAILABLE',missing:[],boundedBy:null,imageMatches:null,
  processes:[{exitCode:1,signal:null,spawnError:null,failure:'ARTIFACT_PROCESS_FAILED',settlement:'closed',stderrBytes:16}]}]);
 assert.equal(JSON.stringify(version.events).includes('bwrap'),false,'no child output text');
 // The qualifier itself throws (an unwritable temp root, a bad configuration): the code, nothing else.
 const thrown=await session(async()=>{throw Object.assign(Error('/tmp/secret-path'),{code:'EACCES'});});
 assert.deepEqual(thrown.events,[{event:RENDERER_UNAVAILABLE_EVENT,stage:'qualify',code:'EACCES',processes:[]}]);
 const opaque=await session(async()=>{throw Error('no code');});
 assert.deepEqual(opaque.events,[{event:RENDERER_UNAVAILABLE_EVENT,stage:'qualify',code:'RENDERER_FAULT',processes:[]}]);
});

test('a conversion failure after qualification names the transform stage and its child outcome',async t=>{
 observation=microvmChild;const environment=agentcoreEnvironment(t);
 const failing=Object.assign(Error('x'),{code:'ARTIFACT_DEADLINE',receipt:{exitCode:null,signal:'SIGKILL',settlement:'closed',spawnError:null,stderrBytes:0}});
 const qualify=async({deadlineMs,signal})=>{const q=await qualifyRuntimeRenderer({imageDigest,deadlineMs,signal,environment});return {...q,port:{...q.port,transform:async()=>{throw failing;}}};};
 const events=[],app=createRuntimeRendererApplication({imageDigest,qualify,report:event=>events.push(event)}),bytes=Buffer.from('synthetic docx');
 const input={kind:'artifact-renderer',action:'transform',requestId:'f'.repeat(64),imageDigest,deadlineMs:Date.now()+30000,bytesBase64:bytes.toString('base64'),
  inputSha256:createHash('sha256').update(bytes).digest('hex'),format:'docx',target:'pdf',maxBytes:1024};
 assert.equal((await app.handle(request(input))).status,503);await app.close({deadlineMs:Date.now()+1000});
 assert.deepEqual(events.map(e=>e.event),[RENDERER_AVAILABLE_EVENT,RENDERER_UNAVAILABLE_EVENT]);
 assert.deepEqual(events[1],{event:RENDERER_UNAVAILABLE_EVENT,stage:'transform',code:'ARTIFACT_DEADLINE',
  processes:[{exitCode:null,signal:'SIGKILL',spawnError:null,failure:'ARTIFACT_DEADLINE',settlement:'closed',stderrBytes:0}]});
});
