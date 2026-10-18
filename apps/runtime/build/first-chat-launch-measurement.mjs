#!/usr/bin/env node
/** One-shot, measurement-only receipt of the Meri-owned first-chat launch values, taken INSIDE the Node runtime image
 * (Linux x64, uid 1000, read-only root). No network, no AWS, no process spawn, no file write: the pinned Agent SDK is
 * interrupted at its spawn hook exactly like scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.mjs.
 *
 * Every application module is loaded from --root (default: the image root this file sits in), so the same bytes also run
 * from a copy written to /run/meri by the node -e fallback for an image that predates this file.
 *
 * Receipt (one JSON line on stdout):
 *  executable  realpath + sha256 of the CLI the SDK launches (session-launcher.mjs verifyNativeLaunchPaths re-hashes it
 *              against preparationIntent.executableSha256 before every spawn and refuses NATIVE_LAUNCH_EXECUTABLE).
 *  launchTemplate  descriptor {command,args,env} minus CLAUDE_CONFIG_DIR and ANTHROPIC_AUTH_TOKEN, the exact value
 *              preparation-intent.mjs matchPreparedDescriptor hashes against (canonicalSha256 equality).
 *  sdkOptions  sdk-option-template.mjs run-invariant template hash (= preparationIntent.sdkOptionsSha256, checked by runner-query.mjs);
 *              two probe runs must hash equal (runInvariant) and pass the real runner-query gate (runnerSdkOptions).
 *  runner      measureProductRunner (ecs-prepared-task-proof.mjs), the same function cli.mjs and the ECS proof run.
 *  skills      skillsDigest over the image's verified skill assets (see skillsDigest below).
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

/** skillsDigest := canonicalSha256({schema:'meri.skills-digest.v1', catalogSha256, skills: listSkills()}) after every listed asset
 * has been loaded through selectSkill, which re-verifies manifest/prose bytes and the catalog pin (packages/skills/index.mjs).
 * The runtime treats versions.skillsDigest as an equality-only pin (RuntimeVersions pattern ^[a-f0-9]{64}$, compared by
 * canonicalSha256(versions) between configuration, run records and the runner); nothing re-derives it, so this definition is the
 * source of truth and the same function runs on source (generator) and in the image (receipt). */
export async function skillsDigest({root}){
 const skills=await load(root,'packages/skills/index.mjs'),{canonicalSha256}=await load(root,'packages/contracts/validate.mjs');
 const assets=JSON.parse(readFileSync(join(root,'packages','skills','assets.json'),'utf8')),listed=skills.listSkills();
 for(const {skillId,skillVersion} of listed)skills.selectSkill(skillId,skillVersion);
 return {digest:canonicalSha256({schema:SKILLS_DIGEST_SCHEMA,catalogSha256:assets.catalogSha256,skills:listed}),catalogSha256:assets.catalogSha256,count:listed.length};
}

function inputs(raw){
 const v={...raw};
 for(const k of ['proxyUrl','model','configParentDirectory','secureStorageDirectory'])if(typeof v[k]!=='string'||!v[k])refuse(`--${k} required`);
 for(const k of ['maxTurns','maxCostMicroUSD','maxOutputBytes'])if(!Number.isSafeInteger(v[k])||v[k]<1)refuse(`--${k} must be a positive integer`);
 for(const k of ['configParentDirectory','secureStorageDirectory'])if(!posix.isAbsolute(v[k])||posix.normalize(v[k])!==v[k]||v[k].endsWith('/'))refuse(`${k} must be a normalized absolute POSIX path`);
 if(v.policyRevision!==undefined&&!/^[a-f0-9]{64}$/u.test(v.policyRevision))refuse('policyRevision must be 64 hex');
 return v;
}
/** The product option set of a first chat with no skill, capability policy, reads, intents, browser or objective: exactly what
 * apps/worker/conversation/activity.mjs hands to query() through conversation-runner.mjs prepareRuntime on the remote path. */
function productOptions(m,v,binding){
 const runtime={binding,versions:{sdk:PINNED_SDK,cli:PINNED_CLI},cwd:posix.join(WORKSPACE_ROOT,binding.conversationId),proxyUrl:v.proxyUrl,proxyCredential:PROBE_CREDENTIAL,model:v.model,
  sessionStore:{async load(){},async append(){},async listSubkeys(){}},deadlineMs:1,maxTurns:v.maxTurns,maxCostMicroUSD:v.maxCostMicroUSD,maxOutputBytes:v.maxOutputBytes,
  sdkConfigDirectory:m.sdkConfigDirectory(v.configParentDirectory,binding.runId),sdkSecureStorageDirectory:v.secureStorageDirectory,sdkCaFile:m.RUNNER_SDK_CA_FILE};
 const options=m.buildConversationOptions(runtime,new AbortController()),policyRevision=v.policyRevision??'0'.repeat(64);
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:PROBE_CLIENT_ID,policyRevision}];
 options.systemPrompt+=m.requestContextSuffix({window:undefined,scopes,skill:undefined});
 // Per-run facts as control issues them (render-material.mjs, prepared-run-bindings.mjs retargetPreparation).
 const authoritySha256=m.authorityDigest({scopes,selectedClientId:PROBE_CLIENT_ID,policyRevision});
 const run=m.sdkOptionsRun({workspace:runtime.cwd,configParentDirectory:v.configParentDirectory,authoritySha256},binding);
 return {options,runtime,scopes,authoritySha256,run};
}
const MODULES=['apps/worker/conversation/options.mjs','apps/runtime/native-authority/sdk-option-template.mjs','apps/runtime/native-authority/preparation-intent.mjs'];
const modules=async root=>Object.assign({},...await Promise.all(MODULES.map(path=>load(root,path))));
/** A probe run's SDK options and per-run facts (to replay runner-query.mjs). */
export async function probeRun(raw,{root,binding=PROBES[0]}){const {options,run}=productOptions(await modules(root),inputs(raw),binding);return {options,run};}
export const probeOptions=async(raw,context)=>(await probeRun(raw,context)).options;
/** The template hash of the product options under `root` (the generator recomputes it on source). */
export async function probeTemplateSha256(raw,{root,binding=PROBES[0]}){const m=await modules(root),p=productOptions(m,inputs(raw),binding);return m.sdkOptionsTemplateSha256(p.options,p.run);}
const gate=fn=>{try{fn();return 'PASS';}catch(error){return 'FAIL: '+(error?.code??error?.message??String(error));}};

export async function measureFirstChatLaunch(raw,{root=resolve(fileURLToPath(new URL('../../../',import.meta.url)))}={}){
 const v=inputs(raw);
 const m={...await modules(root),...await load(root,'apps/runtime/native-authority/runner-query.mjs')};
 const {measureProductRunner}=await load(root,'apps/runtime/native-authority/ecs-prepared-task-proof.mjs');
 const sdkDirectory=join(root,'apps','worker','conversation','node_modules','@anthropic-ai','claude-agent-sdk');
 const sdkVersion=JSON.parse(readFileSync(join(sdkDirectory,'package.json'),'utf8')).version;
 const {query}=await import(pathToFileURL(join(sdkDirectory,'sdk.mjs')).href);
 const [first,second]=PROBES.map(binding=>productOptions(m,v,binding));
 let descriptor=null;
 try{query({prompt:'measurement',options:{...first.options,spawnClaudeCodeProcess(request){descriptor={command:request.command,args:[...request.args],cwd:request.cwd,env:{...request.env}};throw Error('DESCRIPTOR_CAPTURED_NO_SPAWN');}}});}catch{}
 if(!descriptor)refuse('the SDK did not call the spawn hook');
 const {CLAUDE_CONFIG_DIR:configDirectory,ANTHROPIC_AUTH_TOKEN:credential,...env}=descriptor.env;
 if(configDirectory!==first.runtime.sdkConfigDirectory||credential!==PROBE_CREDENTIAL||descriptor.cwd!==first.runtime.cwd)refuse('descriptor does not carry the probe directories/credential');
 if(Object.values(env).some(value=>typeof value!=='string'))refuse('descriptor env carries a non-string value');
 const command=realpathSync(descriptor.command),stat=statSync(command),bytes=readFileSync(command);
 const launchTemplate={command:descriptor.command,args:descriptor.args,env};
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
  matchPreparedDescriptor:gate(()=>m.matchPreparedDescriptor({command:descriptor.command,args:descriptor.args,cwd:descriptor.cwd,env:descriptor.env},intent,PROBE_CREDENTIAL)),
  commandIsRealpath:command===descriptor.command?'PASS':'FAIL: launch command is not its realpath (session-launcher refuses NATIVE_LAUNCH_EXECUTABLE)',
  executable:stat.isFile()&&(stat.mode&0o111)!==0&&stat.size>0&&stat.size<=268435456?'PASS':'FAIL: not an executable regular file within 256 MiB',
  runnerCaTrust:env.NODE_EXTRA_CA_CERTS===m.RUNNER_SDK_CA_FILE?'PASS':'FAIL: template does not trust the pinned runner CA',
  secureStorage:env.CLAUDE_SECURESTORAGE_CONFIG_DIR===v.secureStorageDirectory?'PASS':'FAIL: CLAUDE_SECURESTORAGE_CONFIG_DIR differs',
  runnerSdkOptions:gate(()=>{runnerGate(first);runnerGate(second);})};
 return {schema:RECEIPT_SCHEMA,platform:{os:process.platform,arch:process.arch,node:process.version,uid:process.getuid?.()??null},
  inputs:{proxyUrl:v.proxyUrl,model:v.model,maxTurns:v.maxTurns,maxCostMicroUSD:v.maxCostMicroUSD,maxOutputBytes:v.maxOutputBytes,
   configParentDirectory:v.configParentDirectory,secureStorageDirectory:v.secureStorageDirectory,policyRevision:v.policyRevision??null},
  // The CLI is not executed: its pinned version is evidenced by the VERSION marker compiled into the measured binary.
  versions:{sdk:sdkVersion,cli:bytes.includes(Buffer.from(`VERSION:"${PINNED_CLI}"`))?PINNED_CLI:null,platformPackage:{name:cliPackage.name,version:cliPackage.version}},
  executable:{path:command,sha256:sha(bytes),bytes:bytes.length},launchTemplate,
  sdkOptions:{schema:m.SDK_OPTIONS_TEMPLATE_SCHEMA,sha256:optionsSha256[0],secondProbeSha256:optionsSha256[1],runInvariant:optionsSha256[0]===optionsSha256[1],
   probes:[first,second].map((p,n)=>({binding:PROBES[n],clientId:PROBE_CLIENT_ID,workspace:p.run.workspace,sdkConfigDirectory:p.run.configDirectory,authoritySha256:p.authoritySha256,scopes:p.scopes,window:null,skill:null}))},
  runner:{path:runner.path,sha256:runner.runnerSha256,bytes:runner.bytes},skills,gates,
  module:{sha256:sha(readFileSync(fileURLToPath(import.meta.url)))},
  scope:'Measurement only: no process spawned, no network or AWS call, no file written; probe identities and credential are synthetic.'};
}

const USAGE=`Usage: node apps/runtime/build/first-chat-launch-measurement.mjs --proxy-url URL --model PROFILE --max-turns N --max-cost-micro-usd N
  --max-output-bytes N --config-parent DIR --secure-storage DIR [--policy-revision HEX64] [--root /opt/meri]
Exit0 receipt printed; exit2 usage; exit3 measurement refused.\n`;
const FLAGS={'--proxy-url':'proxyUrl','--model':'model','--max-turns':'maxTurns','--max-cost-micro-usd':'maxCostMicroUSD','--max-output-bytes':'maxOutputBytes',
 '--config-parent':'configParentDirectory','--secure-storage':'secureStorageDirectory','--policy-revision':'policyRevision','--root':'root'};
export async function main(argv=process.argv.slice(2)){
 if(argv.includes('--help')){process.stdout.write(USAGE);return 0;}
 const v={};for(let i=0;i<argv.length;i+=2){const key=FLAGS[argv[i]];if(!key||argv[i+1]===undefined||Object.hasOwn(v,key)){process.stderr.write(USAGE);return 2;}v[key]=argv[i+1];}
 for(const k of ['maxTurns','maxCostMicroUSD','maxOutputBytes'])if(v[k]!==undefined)v[k]=Number(v[k]);
 const {root,...rest}=v;scrubEnvironment();
 try{const receipt=await measureFirstChatLaunch(rest,root===undefined?{}:{root:resolve(root)});process.stdout.write(JSON.stringify(receipt)+'\n');return 0;}
 catch(error){process.stderr.write((error?.code==='MEASUREMENT_REFUSED'?error.message:'MEASUREMENT_REFUSED: '+(error?.code??error?.message??'unknown'))+'\n');return error?.code==='MEASUREMENT_REFUSED'&&/required|must be/u.test(error.message)?2:3;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
