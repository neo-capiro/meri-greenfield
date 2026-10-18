#!/usr/bin/env node
/** One-shot, measurement-only receipt of the Meri-owned first-chat launch values, taken INSIDE the Node runtime image
 * (Linux x64, uid 1000, read-only root). No network, no AWS, no process spawn, no file write: the pinned Agent SDK is
 * interrupted at its spawn hook exactly like scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.mjs.
 *
 * Every application module is loaded from --root (default: the image root this file sits in), so the same bytes also run
 * from a copy written to /run/meri by the node -e fallback for an image that predates this file.
 *
 * Receipt (one JSON line on stdout):
 *  executable  realpath + sha256 of the CLI the SDK launches (= preparationIntent.executableSha256; session-launcher.mjs re-hashes it).
 *  launchTemplate  descriptor minus CLAUDE_CONFIG_DIR, ANTHROPIC_AUTH_TOKEN (launchTemplateArgs); one for both probes.
 *  sdkOptions  sdk-option-template.mjs run-invariant template hash (= preparationIntent.sdkOptionsSha256, checked by runner-query.mjs);
 *              two probe runs must hash equal (runInvariant) and pass the real runner-query gate (runnerSdkOptions).
 *              G3: --capability-profile (base64url CapabilityPolicy JSON) adds its parts (capabilities/measured-options.mjs).
 *  runner      measureProductRunner (ecs-prepared-task-proof.mjs), the same function cli.mjs and the ECS proof run.
 *  skills      skillsDigest over the image's verified skill assets (see skillsDigest below).
 *  generalReadInstallation  P2 measurement (installation-issuer.mjs measureGeneralReadInstallation) over the explicitly reviewed active
 *              operations, when supplied; the render pins its measurementSha256 and ships the measurement bytes.
 *  generalReadInventory  the full installable read inventory, separately measured when an active subset is supplied.
 * Exit 0 receipt printed (gate outcomes inside), 2 usage, 3 measurement refused. */
import {createHash} from 'node:crypto';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {posix,resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const RECEIPT_SCHEMA='meri.first-chat-launch-measurement.v2';
export const SKILLS_DIGEST_SCHEMA='meri.skills-digest.v1';
export const WORKSPACE_ROOT='/workspace';
/** The only SDK/CLI pair options.mjs and launch-configuration.mjs admit. */
export const PINNED_SDK='0.3.295',PINNED_CLI='2.1.295';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const refuse=detail=>{throw Object.assign(Error('MEASUREMENT_REFUSED: '+detail),{code:'MEASUREMENT_REFUSED'});};
const load=(root,path)=>import(pathToFileURL(join(root,...path.split('/'))).href);
/** Fixed synthetic probe identities: the receipt never carries a real tenant, actor or client. */
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const PROBES=Object.freeze([
 Object.freeze({tenantId:'meri-measurement-tenant',actorId:'meri-measurement-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1}),
 Object.freeze({tenantId:'meri-measurement-tenant',actorId:'meri-measurement-actor',conversationId:id(11),runId:id(12),attemptId:id(13),workerId:id(14),writerFence:1})]);
export const PROBE_CLIENT_ID=id(5),PROBE_CREDENTIAL='meri-measurement-synthetic-credential';
/** Credential-shaped names the measurement task definition may inject (the D2 migrate family carries Aurora/login secrets). */
export const SCRUBBED_ENVIRONMENT=/^(PG|AWS_|ANTHROPIC_|CLAUDE|MERI_D2_|GOOGLE_|GCP_|AZURE_|OPENAI_|TEMPORAL_)|^DATABASE_URL$/u;
export function scrubEnvironment(environment=process.env){for(const name of Object.keys(environment))if(SCRUBBED_ENVIRONMENT.test(name))delete environment[name];}

/** skillsDigest := canonicalSha256({schema:'meri.skills-digest.v1', catalogSha256, skills: listSkills()}) after selectSkill re-verified
 * every listed asset (packages/skills/index.mjs). versions.skillsDigest is an equality-only pin nothing re-derives, so this definition is
 * the source of truth; the same function runs on source (generator) and in the image (receipt). */
export async function skillsDigest({root}){
 const skills=await load(root,'packages/skills/index.mjs'),{canonicalSha256}=await load(root,'packages/contracts/validate.mjs');
 const assets=JSON.parse(readFileSync(join(root,'packages','skills','assets.json'),'utf8')),listed=skills.listSkills();
 for(const {skillId,skillVersion} of listed)skills.selectSkill(skillId,skillVersion);
 return {digest:canonicalSha256({schema:SKILLS_DIGEST_SCHEMA,catalogSha256:assets.catalogSha256,skills:listed}),catalogSha256:assets.catalogSha256,count:listed.length};
}
/** The full inventory remains the canonical desired scope. An explicit active set selects only exact canonical refs for P2; it never
 * accepts a caller-supplied family, descriptor hash, or source hash. An omitted set preserves the historical full measurement. */
export async function generalReadInstallation({root,activeReadOperations}){
 const [issuer,runtime,validation]=await Promise.all([load(root,'apps/gateway/general-reads/installation-issuer.mjs'),load(root,'apps/runtime/native-authority/general-read-installation/runtime.mjs'),load(root,'packages/contracts/validate.mjs')]);
 const rows=runtime.installationReadOperations(),inventory=await issuer.measureGeneralReadInstallation({catalogJson:readFileSync(join(root,'packages','contracts','retrieval-0.2','catalog.json'),'utf8'),operations:rows});
 if(activeReadOperations===undefined)return inventory;
 if(!Array.isArray(activeReadOperations)||activeReadOperations.length<1||activeReadOperations.length>rows.length)refuse('active read operations must be a nonempty subset of the installable inventory');
 const canonical=new Set(rows.map(row=>`${row.operation.id}@${row.operation.version}`)),selected=new Set();
 for(const op of activeReadOperations){
  if(op===null||typeof op!=='object'||Array.isArray(op)||Object.getPrototypeOf(op)!==Object.prototype||
   Object.keys(op).sort().join(',')!=='id,version'||typeof op.id!=='string'||typeof op.version!=='string')refuse('active read operation is not an exact OperationRef');
  const key=`${op.id}@${op.version}`;if(!canonical.has(key)||selected.has(key))refuse('active read operation is unknown or duplicated');selected.add(key);
 }
 const measurement={...inventory.measurement,operations:inventory.measurement.operations.filter(row=>selected.has(`${row.operation.id}@${row.operation.version}`))};
 if(measurement.operations.length!==selected.size)refuse('active read installation omits a selected operation');
 return {measurement,measurementSha256:validation.canonicalSha256(measurement)};
}

function inputs(raw){
 const v={...raw};
 for(const k of ['proxyUrl','model','configParentDirectory','secureStorageDirectory'])if(typeof v[k]!=='string'||!v[k])refuse(`--${k} required`);
 for(const k of ['maxTurns','maxCostMicroUSD','maxOutputBytes'])if(!Number.isSafeInteger(v[k])||v[k]<1)refuse(`--${k} must be a positive integer`);
 for(const k of ['configParentDirectory','secureStorageDirectory'])if(!posix.isAbsolute(v[k])||posix.normalize(v[k])!==v[k]||v[k].endsWith('/'))refuse(`${k} must be a normalized absolute POSIX path`);
 if(v.policyRevision!==undefined&&!/^[a-f0-9]{64}$/u.test(v.policyRevision))refuse('policyRevision must be 64 hex');
 return v;
}
/** The product option set of a first chat with no skill, browser or objective: exactly what apps/worker/conversation/activity.mjs hands
 * to query() through conversation-runner.mjs prepareRuntime on the remote path, with (G3) the capability profile's parts or none. */
async function productOptions(m,v,binding){
 const runtime={binding,versions:{sdk:PINNED_SDK,cli:PINNED_CLI},cwd:posix.join(WORKSPACE_ROOT,binding.conversationId),proxyUrl:v.proxyUrl,proxyCredential:PROBE_CREDENTIAL,model:v.model,
  sessionStore:{async load(){},async append(){},async listSubkeys(){}},deadlineMs:1,maxTurns:v.maxTurns,maxCostMicroUSD:v.maxCostMicroUSD,maxOutputBytes:v.maxOutputBytes,
  sdkConfigDirectory:m.sdkConfigDirectory(v.configParentDirectory,binding.runId),sdkSecureStorageDirectory:v.secureStorageDirectory,sdkCaFile:m.RUNNER_SDK_CA_FILE};
 const policyRevision=v.policyRevision??'0'.repeat(64),scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:PROBE_CLIENT_ID,policyRevision}];
 const {options,close}=await m.projectRunOptions(runtime,{profile:v.capabilityProfile,scopes,skillPluginDirectory:m.sdkSkillPluginDirectory(v.configParentDirectory),newId:()=>id(99)});
 options.systemPrompt+=m.requestContextSuffix({window:undefined,scopes,skill:undefined});
 // Per-run facts as control issues them (render-material.mjs, prepared-run-bindings.mjs retargetPreparation).
 const authoritySha256=m.authorityDigest({scopes,selectedClientId:PROBE_CLIENT_ID,policyRevision});
 const run=m.sdkOptionsRun({workspace:runtime.cwd,configParentDirectory:v.configParentDirectory,authoritySha256},binding);
 return {options,runtime,scopes,authoritySha256,run,close};
}
const MODULES=['apps/worker/conversation/capabilities/measured-options.mjs','apps/runtime/native-authority/sdk-option-template.mjs','apps/runtime/native-authority/preparation-intent.mjs'];
const modules=async root=>Object.assign({},...await Promise.all(MODULES.map(path=>load(root,path))));
/** A probe run's SDK options and per-run facts (to replay runner-query.mjs); close() releases its MCP servers. */
export async function probeRun(raw,{root,binding=PROBES[0]}){const {options,run,close}=await productOptions(await modules(root),inputs(raw),binding);return {options,run,close};}
export const probeOptions=async(raw,context)=>(await probeRun(raw,context)).options;
/** The template hash of the product options under `root` (the generator recomputes it on source). */
export async function probeTemplateSha256(raw,{root,binding=PROBES[0]}){const m=await modules(root),p=await productOptions(m,inputs(raw),binding);try{return m.sdkOptionsTemplateSha256(p.options,p.run);}finally{await p.close();}}
const gate=fn=>{try{fn();return 'PASS';}catch(error){return 'FAIL: '+(error?.code??error?.message??String(error));}};

export async function measureFirstChatLaunch(raw,{root=resolve(fileURLToPath(new URL('../../../',import.meta.url)))}={}){
 const v=inputs(raw);
 if(v.capabilityProfile?.generalReads===true){
  if(v.activeReadOperations===undefined)refuse('active read operations required for a general-read capability profile');
  const {canonicalSha256}=await load(root,'packages/contracts/validate.mjs');
  if(!Array.isArray(v.capabilityProfile.activeReadOperations)||canonicalSha256(v.capabilityProfile.activeReadOperations)!==canonicalSha256(v.activeReadOperations))
   refuse('active read operations differ from the capability profile');
 }
 const inventory=await generalReadInstallation({root}),installation=v.activeReadOperations===undefined?inventory:await generalReadInstallation({root,activeReadOperations:v.activeReadOperations});
 const m={...await modules(root),...await load(root,'apps/runtime/native-authority/runner-query.mjs')};
 const {measureProductRunner}=await load(root,'apps/runtime/native-authority/ecs-prepared-task-proof.mjs');
 const sdkDirectory=join(root,'apps','worker','conversation','node_modules','@anthropic-ai','claude-agent-sdk');
 const sdkVersion=JSON.parse(readFileSync(join(sdkDirectory,'package.json'),'utf8')).version;
 const {query}=await import(pathToFileURL(join(sdkDirectory,'sdk.mjs')).href);
 const probes=[];try{for(const binding of PROBES)probes.push(await productOptions(m,v,binding));
 const [first,second]=probes;
 const {descriptor,env}=captureDescriptor(query,first),{descriptor:secondDescriptor,env:secondEnv}=captureDescriptor(query,second);
 const template=(d,e,p)=>({command:d.command,args:m.launchTemplateArgs(d.args,p.runtime.cwd),env:e});
 const launchTemplate=template(descriptor,env,first),launchTemplateRunInvariant=JSON.stringify(launchTemplate)===JSON.stringify(template(secondDescriptor,secondEnv,second));
 const command=realpathSync(descriptor.command),stat=statSync(command),bytes=readFileSync(command);
 const optionsSha256=[first,second].map(p=>m.sdkOptionsTemplateSha256(p.options,p.run));
 const platformPackage=dirname(command),cliPackage=JSON.parse(readFileSync(join(platformPackage,'package.json'),'utf8'));
 const runner=await measureProductRunner({root});
 const skills=await skillsDigest({root});
 // The launch gates the runtime applies to this template, run on a probe intent (Linux paths; fails off-Linux by design).
 const intent={workspace:first.runtime.cwd,configParentDirectory:v.configParentDirectory,secureStorageDirectory:v.secureStorageDirectory,launchTemplate,
  executableSha256:sha(bytes),imageSha256:'0'.repeat(64),runnerSha256:runner.runnerSha256,sdkOptionsSha256:optionsSha256[0],authoritySha256:first.authoritySha256};
 // runner-query.mjs as the remote worker builds it, for both probe runs.
 const runnerGate=p=>{const query=m.createPreparedRunnerQuery({sdkOptions:{sdkOptionsSha256:optionsSha256[0],run:p.run},processClientFactory:()=>({}),prepare:()=>{throw Error('not reached');}});
  if(typeof query({prompt:'measurement',options:p.options})?.[Symbol.asyncIterator]!=='function')throw Error('runner query refused');};
 const gates={compileNativePreparationIntent:gate(()=>m.compileNativePreparationIntent(intent)),
  matchPreparedDescriptor:gate(()=>{m.matchPreparedDescriptor(descriptor,intent,PROBE_CREDENTIAL);m.matchPreparedDescriptor(secondDescriptor,{...intent,workspace:second.runtime.cwd,authoritySha256:second.authoritySha256},PROBE_CREDENTIAL);}),
  commandIsRealpath:command===descriptor.command?'PASS':'FAIL: launch command is not its realpath (session-launcher refuses NATIVE_LAUNCH_EXECUTABLE)',
  executable:stat.isFile()&&(stat.mode&0o111)!==0&&stat.size>0&&stat.size<=268435456?'PASS':'FAIL: not an executable regular file within 256 MiB',
  runnerCaTrust:env.NODE_EXTRA_CA_CERTS===m.RUNNER_SDK_CA_FILE?'PASS':'FAIL: template does not trust the pinned runner CA',
  secureStorage:env.CLAUDE_SECURESTORAGE_CONFIG_DIR===v.secureStorageDirectory?'PASS':'FAIL: CLAUDE_SECURESTORAGE_CONFIG_DIR differs',
  runnerSdkOptions:gate(()=>{runnerGate(first);runnerGate(second);})};
 return {schema:RECEIPT_SCHEMA,platform:{os:process.platform,arch:process.arch,node:process.version,uid:process.getuid?.()??null},
  inputs:{proxyUrl:v.proxyUrl,model:v.model,maxTurns:v.maxTurns,maxCostMicroUSD:v.maxCostMicroUSD,maxOutputBytes:v.maxOutputBytes,
   configParentDirectory:v.configParentDirectory,secureStorageDirectory:v.secureStorageDirectory,policyRevision:v.policyRevision??null,
   capabilityProfileSha256:v.capabilityProfile===undefined?null:m.capabilityProfileSha256(v.capabilityProfile),
   ...(v.activeReadOperations===undefined?{}:{activeReadOperationsSha256:(await load(root,'packages/contracts/validate.mjs')).canonicalSha256(v.activeReadOperations)})},
  // The CLI is not executed: its pinned version is evidenced by the VERSION marker compiled into the measured binary.
  versions:{sdk:sdkVersion,cli:bytes.includes(Buffer.from(`VERSION:"${PINNED_CLI}"`))?PINNED_CLI:null,platformPackage:{name:cliPackage.name,version:cliPackage.version}},
  executable:{path:command,sha256:sha(bytes),bytes:bytes.length},launchTemplate,launchTemplateRunInvariant,
  sdkOptions:{schema:m.SDK_OPTIONS_TEMPLATE_SCHEMA,sha256:optionsSha256[0],secondProbeSha256:optionsSha256[1],runInvariant:optionsSha256[0]===optionsSha256[1],
   probes:[first,second].map((p,n)=>({binding:PROBES[n],clientId:PROBE_CLIENT_ID,workspace:p.run.workspace,sdkConfigDirectory:p.run.configDirectory,authoritySha256:p.authoritySha256,scopes:p.scopes,window:null,skill:null}))},
  runner:{path:runner.path,sha256:runner.runnerSha256,bytes:runner.bytes},skills,generalReadInstallation:{measurement:installation.measurement,measurementSha256:installation.measurementSha256},
  ...(v.activeReadOperations===undefined?{}:{generalReadInventory:{measurement:inventory.measurement,measurementSha256:inventory.measurementSha256}}),gates,
  module:{sha256:sha(readFileSync(fileURLToPath(import.meta.url)))},
  scope:'Measurement only: no process spawned, no network or AWS call, no file written; probe identities and credential are synthetic.'};
 }finally{for(const p of probes)await p.close();}
}
function captureDescriptor(query,probe){
 let descriptor=null;
 try{query({prompt:'measurement',options:{...probe.options,spawnClaudeCodeProcess(request){descriptor={command:request.command,args:[...request.args],cwd:request.cwd,env:{...request.env}};throw Error('DESCRIPTOR_CAPTURED_NO_SPAWN');}}});}catch{}
 if(!descriptor)refuse('the SDK did not call the spawn hook');
 const {CLAUDE_CONFIG_DIR:configDirectory,ANTHROPIC_AUTH_TOKEN:credential,...env}=descriptor.env;
 if(configDirectory!==probe.runtime.sdkConfigDirectory||credential!==PROBE_CREDENTIAL||descriptor.cwd!==probe.runtime.cwd)refuse('descriptor does not carry the probe directories/credential');
 if(Object.values(env).some(value=>typeof value!=='string'))refuse('descriptor env carries a non-string value');
 return {descriptor,env};
}

const USAGE=`Usage: node apps/runtime/build/first-chat-launch-measurement.mjs --proxy-url URL --model PROFILE --max-turns N --max-cost-micro-usd N
  --max-output-bytes N --config-parent DIR --secure-storage DIR [--policy-revision HEX64] [--capability-profile B64URL-JSON]
  [--active-read-operations B64URL-JSON] [--root /opt/meri]
Exit0 receipt printed; exit2 usage; exit3 measurement refused.\n`;
const FLAGS={'--proxy-url':'proxyUrl','--model':'model','--max-turns':'maxTurns','--max-cost-micro-usd':'maxCostMicroUSD','--max-output-bytes':'maxOutputBytes',
 '--config-parent':'configParentDirectory','--secure-storage':'secureStorageDirectory','--policy-revision':'policyRevision','--capability-profile':'capabilityProfile','--active-read-operations':'activeReadOperations','--root':'root'};
export async function main(argv=process.argv.slice(2)){
 if(argv.includes('--help')){process.stdout.write(USAGE);return 0;}
 const v={};for(let i=0;i<argv.length;i+=2){const key=FLAGS[argv[i]];if(!key||argv[i+1]===undefined||Object.hasOwn(v,key)){process.stderr.write(USAGE);return 2;}v[key]=argv[i+1];}
 for(const k of ['maxTurns','maxCostMicroUSD','maxOutputBytes'])if(v[k]!==undefined)v[k]=Number(v[k]);
 for(const field of ['capabilityProfile','activeReadOperations'])if(v[field]!==undefined)try{
  const encoded=v[field],bytes=Buffer.from(encoded,'base64url');
  if(!/^[A-Za-z0-9_-]{1,131072}$/u.test(encoded)||bytes.length>65536||bytes.toString('base64url')!==encoded)throw Error();
  v[field]=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(JSON.stringify(v[field])!==bytes.toString('utf8'))throw Error();
 }catch{process.stderr.write(USAGE);return 2;}
 const {root,...rest}=v;scrubEnvironment();
 try{const receipt=await measureFirstChatLaunch(rest,root===undefined?{}:{root:resolve(root)});process.stdout.write(JSON.stringify(receipt)+'\n');return 0;}
 catch(error){process.stderr.write((error?.code==='MEASUREMENT_REFUSED'?error.message:'MEASUREMENT_REFUSED: '+(error?.code??error?.message??'unknown'))+'\n');return error?.code==='MEASUREMENT_REFUSED'&&/required|must be/u.test(error.message)?2:3;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
