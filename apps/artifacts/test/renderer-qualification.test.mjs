/** Renderer qualification owner: observation -> requirement flags -> admission -> port. Synthetic observations stand in for
 * Linux /proc and cgroup readings; one case runs the real probe child through the real spawn path on this host. None of this
 * is evidence that any deployed container qualifies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join,relative,sep} from 'node:path';
import {realpath,stat,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {runArtifactProcess} from '../process.mjs';
import {RENDERER_SANDBOX_REQUIREMENTS,admittedConverter} from '../renderer.mjs';
import {evaluateRendererSandbox,parseLibreOfficeVersion,qualifyLibreOfficeRenderer,RENDERER_PROBE_PATH,RENDERER_PROBE_SCHEMA,RENDERER_CHILD_ENV} from '../renderer-qualification.mjs';

const ROOT='/srv/meri/render',CWD=ROOT+'/meri-renderer-probe-a1b2c3',ZERO='0'.repeat(16),DIGEST='sha256:'+'a'.repeat(64);
/** A converter child that satisfies every requirement (separate no-network task, read-only root, no role, cgroup limits). */
const sandboxed=(changes={})=>({schema:RENDERER_PROBE_SCHEMA,platform:'linux',uid:[10002,10002,10002,10002],gid:[10002,10002,10002,10002],noNewPrivs:1,
 capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:ZERO,CapBnd:ZERO,CapAmb:ZERO},rootMountOptions:'ro,relatime',interfaces:['lo'],
 cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000 100000'},envNames:[...RENDERER_CHILD_ENV],cwd:CWD,home:CWD,tmpdir:CWD,
 workspace:{mode:0o700,uid:10002},credentialPathsReadable:[{path:'/run/secrets/meri-download-link-key',readable:false}],...changes});
const falseOnly=(observation,expected)=>{
 const {sandbox,findings}=evaluateRendererSandbox(observation,{tempRoot:ROOT});
 assert.deepEqual(RENDERER_SANDBOX_REQUIREMENTS.filter(k=>sandbox[k]!==true),expected);
 assert.deepEqual(findings.map(f=>f.requirement),expected);
 for(const k of RENDERER_SANDBOX_REQUIREMENTS)assert.equal(typeof sandbox[k],'boolean');
};

test('a fully sandboxed converter child attests all eight requirements',()=>{falseOnly(sandboxed(),[]);});

test('each observed violation clears exactly the requirement it disproves',()=>{
 const cases=[
  [{gid:[0,0,0,0]},['nonRootUser']],
  [{uid:[10002,0,10002,10002]},['nonRootUser','privateWorkspace']],
  [{interfaces:['eth1','lo']},['noNetwork','noCredentials']],
  [{interfaces:[]},['noNetwork','noCredentials']],
  [{rootMountOptions:'rw,relatime'},['readOnlyRootFilesystem']],
  [{rootMountOptions:null},['readOnlyRootFilesystem']],
  [{noNewPrivs:0},['noNewPrivileges']],
  [{capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:'0000000000000400',CapBnd:ZERO,CapAmb:ZERO}},['dropAllCapabilities']],
  [{capabilities:{CapInh:ZERO,CapPrm:ZERO,CapEff:ZERO,CapBnd:'00000000a80425fb',CapAmb:ZERO}},[]],
  [{cwd:'/tmp/meri-renderer-probe-x',home:'/tmp/meri-renderer-probe-x',tmpdir:'/tmp/meri-renderer-probe-x'},['privateWorkspace']],
  [{cwd:ROOT+'/other',home:ROOT+'/other',tmpdir:ROOT+'/other'},['privateWorkspace']],
  [{home:'/home/meri'},['privateWorkspace']],
  [{workspace:{mode:0o755,uid:10002}},['privateWorkspace']],
  [{workspace:{mode:0o700,uid:10001}},['privateWorkspace']],
  [{cgroup:{memoryMax:'max',pidsMax:'64',cpuMax:'50000 100000'}},['boundedResources']],
  [{cgroup:{memoryMax:'1073741824',pidsMax:'max',cpuMax:'50000 100000'}},['boundedResources']],
  [{cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'max 100000'}},['boundedResources']],
  [{cgroup:{memoryMax:'9223372036854771712',pidsMax:'64',cpuMax:'50000'}},['boundedResources']],
  [{cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'-1'}},['boundedResources']],
  [{cgroup:{memoryMax:'1073741824',pidsMax:'64',cpuMax:'50000'}},[]],
  [{envNames:[...RENDERER_CHILD_ENV,'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI']},['noCredentials']],
  [{credentialPathsReadable:[{path:'/run/secrets/meri-download-link-key',readable:true}]},['noCredentials']],
  [{credentialPathsReadable:null},['noCredentials']],
 ];
 for(const [changes,expected] of cases)falseOnly(sandboxed(changes),expected);
});

test('non-Linux, wrong-schema and malformed observations attest nothing and never throw',()=>{
 for(const observation of [sandboxed({platform:'win32'}),sandboxed({schema:'other/1'})]){
  const {sandbox,findings}=evaluateRendererSandbox(observation,{tempRoot:ROOT});
  assert.equal(RENDERER_SANDBOX_REQUIREMENTS.some(k=>sandbox[k]),false);assert.equal(findings.length,8);assert.equal(findings.every(f=>f.reason==='NOT_LINUX'),true);
 }
 for(const observation of [null,undefined,[],'linux',42,{},{schema:RENDERER_PROBE_SCHEMA,platform:'linux',capabilities:null,cgroup:'x',workspace:[]}]){
  const {sandbox}=evaluateRendererSandbox(observation,{tempRoot:ROOT});assert.equal(RENDERER_SANDBOX_REQUIREMENTS.some(k=>sandbox[k]),false);
 }
 assert.equal(evaluateRendererSandbox(sandboxed()).sandbox.privateWorkspace,false,'no trusted temp root: the workspace cannot be attested');
});

test('only a LibreOffice version line yields a renderer version',()=>{
 assert.equal(parseLibreOfficeVersion('LibreOffice 24.2.7.2 420(Build:2)\n'),'24.2.7.2');
 assert.equal(parseLibreOfficeVersion('LibreOffice 7.6.4.1 e19e193f88cd6c0525a17fb7a176ed8e6a3e2aa1'),'7.6.4.1');
 for(const out of ['v24.19.0','','OpenOffice 4.1','LibreOffice  x','LibreOffice 7.6\u0000'])assert.equal(parseLibreOfficeVersion(out),null);
});

async function scripted(observe,{version='LibreOffice 24.2.7.2 420(Build:2)\n'}={}){
 const root=await realpath(tmpdir()),calls=[];
 const run=async(executable,args,options)=>{calls.push({executable,args,cwd:options.cwd,input:options.input.toString('utf8'),mode:(await stat(options.cwd)).isDirectory()});
  if(args[0]==='--version'){if(version instanceof Error)throw version;return {stdout:Buffer.from(version),receipt:{exitCode:0}};}
  const out=observe(options.cwd,root);if(out instanceof Error)throw out;return {stdout:Buffer.from(typeof out==='string'?out:JSON.stringify(out)),receipt:{exitCode:0}};};
 const base={executable:'/opt/libreoffice/program/soffice',nodeExecutable:'/usr/local/bin/node',tempRoot:root,imageDigest:DIGEST,qualificationId:'renderer-q-1',credentialPaths:['/run/secrets/meri-download-link-key'],deadlineMs:Date.now()+30000,run};
 return {root,calls,base};
}
const atCwd=changes=>cwd=>sandboxed({cwd,home:cwd,tmpdir:cwd,...changes});

test('an observed sandbox issues an admission the port accepts; probes run in owned workspaces that are removed',async()=>{
 const {calls,base,root}=await scripted(atCwd());
 const r=await qualifyLibreOfficeRenderer(base);
 assert.equal(r.port.state,'available');assert.equal(admittedConverter(r.port),r.port);
 assert.deepEqual(r.admission,{rendererId:'libreoffice',rendererVersion:'24.2.7.2',executable:base.executable,imageDigest:DIGEST,qualificationId:'renderer-q-1',sandbox:Object.fromEntries(RENDERER_SANDBOX_REQUIREMENTS.map(k=>[k,true]))});
 assert.equal(r.receipt.state,'available');assert.match(r.receipt.observationSha256,/^[a-f0-9]{64}$/u);
 assert.deepEqual(calls.map(c=>[c.executable,c.args]),[[base.executable,['--version']],[base.nodeExecutable,[RENDERER_PROBE_PATH]]]);
 assert.deepEqual(JSON.parse(calls[1].input),{credentialPaths:base.credentialPaths});
 for(const call of calls){assert.equal(call.mode,true);assert.equal(join(call.cwd,'..'),root);await assert.rejects(stat(call.cwd),{code:'ENOENT'});}
});

test('the qualified port preserves the exact child runner for its later conversion and cleans its workspace',async()=>{
 const {base}=await scripted(atCwd()),probeRun=base.run,calls=[],bytes=Buffer.from('%PDF-1.7\nsynthetic runner proof\n%%EOF');
 base.run=async(executable,args,options)=>{calls.push({executable,args,cwd:options.cwd});
  if(args.includes('--convert-to')){await writeFile(join(options.cwd,'out','input.pdf'),bytes);return {receipt:{exitCode:0,sandboxQualified:false}};}
  return probeRun(executable,args,options);
 };
 const qualified=await qualifyLibreOfficeRenderer(base),result=await qualified.port.transform({bytes:Buffer.from('synthetic DOCX'),format:'docx',target:'pdf',deadlineMs:Date.now()+1000,maxBytes:1024});
 assert.deepEqual(result.bytes,bytes);assert.equal(result.receipt.imageDigest,DIGEST);assert.equal(calls.length,3);assert.ok(calls[2].args.includes('--convert-to'));
 for(const call of calls)await assert.rejects(stat(call.cwd),{code:'ENOENT'});
});

test('a converter child of the control task (network, writable root, credentials reachable) stays unavailable and names why',async()=>{
 const control=atCwd({interfaces:['eth1','lo'],rootMountOptions:'rw,relatime',noNewPrivs:0,cgroup:{memoryMax:'2147483648',pidsMax:'max',cpuMax:'max 100000'},
  credentialPathsReadable:[{path:'/run/secrets/meri-download-link-key',readable:true}]});
 const {base}=await scripted(control),r=await qualifyLibreOfficeRenderer(base);
 assert.equal(r.port.state,'unavailable');assert.equal(r.port.reason,'RENDERER_SANDBOX_UNQUALIFIED');assert.equal(admittedConverter(r.port),null);
 assert.deepEqual([...r.port.missingRequirements],['noNetwork','readOnlyRootFilesystem','noNewPrivileges','boundedResources','noCredentials']);
 assert.deepEqual(r.receipt.missingRequirements,[...r.port.missingRequirements]);
 await assert.rejects(r.port.transform({bytes:Buffer.from('x'),format:'docx',target:'pdf'}),{code:'ARTIFACT_RENDERER_UNAVAILABLE'});
});

test('version or probe failures leave the renderer unadmitted with a closed failure code',async()=>{
 const cases=[[{version:'v24.19.0'},atCwd(),'RENDERER_VERSION_UNAVAILABLE'],[{version:Object.assign(Error('x'),{code:'ARTIFACT_PROCESS_FAILED'})},atCwd(),'RENDERER_VERSION_UNAVAILABLE'],
  [{},()=>Object.assign(Error('x'),{code:'ARTIFACT_PROCESS_FAILED'}),'RENDERER_PROBE_FAILED'],[{},()=>'{not json','RENDERER_PROBE_INVALID'],[{},()=>' '.repeat(65537),'RENDERER_PROBE_INVALID']];
 for(const [options,observe,failure] of cases){
  const {base}=await scripted(observe,options),r=await qualifyLibreOfficeRenderer(base);
  assert.equal(r.port.state,'unavailable');assert.equal(r.port.reason,'RENDERER_NOT_ADMITTED');assert.equal(r.admission,null);assert.equal(r.receipt.failure,failure);
 }
});

test('only trusted absolute configuration is accepted',async()=>{
 const {base}=await scripted(atCwd());
 for(const changes of [{executable:'soffice'},{nodeExecutable:'node'},{tempRoot:'tmp'},{imageDigest:'sha256:abc'},{imageDigest:undefined},{qualificationId:''},{qualificationId:'a b'},
  {credentialPaths:['relative/key']},{credentialPaths:'/run/secrets/k'},{deadlineMs:undefined},{run:'runArtifactProcess'}])
  await assert.rejects(qualifyLibreOfficeRenderer({...base,...changes}),{code:'RENDERER_QUALIFICATION_CONFIGURATION'});
 await assert.rejects(qualifyLibreOfficeRenderer(null),{code:'RENDERER_QUALIFICATION_CONFIGURATION'});
});

test('an inventory directory is readable only when it exposes more than the chain down to the child workspace',
 {skip:process.platform==='win32'?'directory-listing semantics are judged on the Linux sandbox host':false},async()=>{
 // bubblewrap materialises the bound workspace's ancestors inside the child's root, so an inventory root above the
 // workspace is always traversable; the probe must judge a directory by its content, not by whether it opens.
 const root=await mkdtemp(join(await realpath(tmpdir()),'meri-probe-chain-')),at=(...p)=>join(root,...p);
 const cwd=at('material','scratch','meri-renderer-probe-abc123');
 const paths=[at('material'),at('material','scratch'),cwd,at('empty'),at('other'),at('other','key'),at('absent')];
 const observe=async()=>Object.fromEntries(JSON.parse((await runArtifactProcess(process.execPath,[RENDERER_PROBE_PATH],
  {cwd,input:Buffer.from(JSON.stringify({credentialPaths:paths})),deadlineMs:Date.now()+30000})).stdout.toString('utf8'))
  .credentialPathsReadable.map(c=>[relative(root,c.path).split(sep).join('/'),c.readable]));
 try{
  await mkdir(cwd,{recursive:true});await mkdir(at('empty'));await mkdir(at('other'));await writeFile(at('other','key'),'');
  assert.deepEqual(await observe(),{material:false,'material/scratch':false,'material/scratch/meri-renderer-probe-abc123':true,
   empty:true,other:true,'other/key':true,absent:false},
   'an empty ancestor chain is unreadable; the workspace itself, any other existing directory and any file are readable');
  await writeFile(at('material','control.json'),'{}');
  assert.deepEqual((await observe()).material,true,'content beside the chain makes the ancestor readable');
  await rm(at('material','control.json'));await mkdir(at('material','scratch','meri-renderer-probe-other'));
  const sibling=await observe();
  assert.deepEqual([sibling.material,sibling['material/scratch']],[true,true],'a sibling workspace is content beyond the bound chain at every level above it');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('the real probe child runs through the real spawn path and reports this host (attests nothing off Linux)',async()=>{
 const root=await realpath(tmpdir()),cwd=await mkdtemp(join(root,'meri-renderer-probe-'));
 try{
  const run=await runArtifactProcess(process.execPath,[RENDERER_PROBE_PATH],{cwd,input:Buffer.from(JSON.stringify({credentialPaths:[RENDERER_PROBE_PATH]})),deadlineMs:Date.now()+30000});
  const o=JSON.parse(run.stdout.toString('utf8'));
  assert.equal(o.schema,RENDERER_PROBE_SCHEMA);assert.equal(o.platform,process.platform);
  // On Linux the probe sees exactly the fixed child environment process.mjs sets (names only); Windows itself injects
  // profile variables (USERPROFILE, TEMP, ...), which is one more reason nothing is attested off Linux.
  if(process.platform==='linux')assert.deepEqual(o.envNames,[...RENDERER_CHILD_ENV]);else for(const name of RENDERER_CHILD_ENV)assert.ok(o.envNames.includes(name),name);
  assert.deepEqual(o.credentialPathsReadable,[{path:RENDERER_PROBE_PATH,readable:true}]);
  const {sandbox}=evaluateRendererSandbox(o,{tempRoot:root});
  assert.equal(sandbox.noCredentials,false,'a readable credential path is never attested');
  if(process.platform!=='linux')assert.equal(RENDERER_SANDBOX_REQUIREMENTS.some(k=>sandbox[k]),false);
  else{assert.equal(Array.isArray(o.interfaces),true);assert.equal(typeof o.rootMountOptions,'string');}
 }finally{await rm(cwd,{recursive:true,force:true});}
});

const soffice=process.env.MERI_ARTIFACT_SOFFICE;
test('real LibreOffice version and probe on this host (opt-in MERI_ARTIFACT_SOFFICE; not deployment evidence)',{skip:!soffice&&'MERI_ARTIFACT_SOFFICE not set'},async()=>{
 const r=await qualifyLibreOfficeRenderer({executable:soffice,nodeExecutable:process.execPath,tempRoot:await realpath(tmpdir()),imageDigest:DIGEST,qualificationId:'local-host-not-qualification',deadlineMs:Date.now()+60000});
 assert.notEqual(r.admission,null,r.receipt.failure);assert.match(r.admission.rendererVersion,/^[0-9]/u);
 if(process.platform!=='linux')assert.equal(r.port.state,'unavailable');
});

test('the renderer gate composes on the same platform attestation: the AgentCore microVM shape needs the evidence, a finite cgroup does not',async()=>{
 const platform={runtime:'agentcore'};
 const microvm={memoryMax:'max',pidsMax:'max',cpuMax:'max 100000',levels:1,mountRootIsRoot:true,membershipResolved:true,identityChanged:false,source:'cgroup2'};
 const attested=evaluateRendererSandbox(sandboxed({cgroup:microvm}),{tempRoot:ROOT,platform});
 assert.deepEqual(attested.findings,[]);assert.equal(attested.boundedBy,'agentcore-microvm');
 const unattested=evaluateRendererSandbox(sandboxed({cgroup:microvm}),{tempRoot:ROOT});
 assert.deepEqual(unattested.findings.map(f=>f.requirement),['boundedResources']);assert.equal(unattested.boundedBy,null);
 for(const changes of [{levels:2},{mountRootIsRoot:false},{source:'v1-fallback',membershipResolved:false},{identityChanged:true},{memoryMax:null}])
  assert.equal(evaluateRendererSandbox(sandboxed({cgroup:{...microvm,...changes}}),{tempRoot:ROOT,platform}).sandbox.boundedResources,false,JSON.stringify(changes));
 assert.equal(evaluateRendererSandbox(sandboxed(),{tempRoot:ROOT,platform}).boundedBy,'cgroup');
 assert.equal(evaluateRendererSandbox(sandboxed(),{tempRoot:ROOT}).boundedBy,'cgroup');
 assert.equal(evaluateRendererSandbox(sandboxed({platform:'win32',cgroup:microvm}),{tempRoot:ROOT,platform}).boundedBy,null,'a non-Linux observation attests nothing');
 // Through the real qualifier the attestation reaches the admission and is recorded on the receipt; without the
 // evidence the same scripted container stays unavailable and names boundedResources.
 const {base}=await scripted(atCwd({cgroup:microvm}));
 const admitted=await qualifyLibreOfficeRenderer({...base,platform});
 assert.equal(admitted.port.state,'available');assert.equal(admitted.admission.sandbox.boundedResources,true);assert.equal(admitted.receipt.boundedBy,'agentcore-microvm');
 const refused=await qualifyLibreOfficeRenderer(base);
 assert.equal(refused.port.state,'unavailable');assert.deepEqual([...refused.port.missingRequirements],['boundedResources']);assert.equal(refused.receipt.boundedBy,null);
 await assert.rejects(qualifyLibreOfficeRenderer({...base,platform:'agentcore'}),{code:'RENDERER_QUALIFICATION_CONFIGURATION'});
});
