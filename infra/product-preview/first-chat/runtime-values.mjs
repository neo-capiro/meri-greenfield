#!/usr/bin/env node
/** Meri first-chat preview: assemble the `--runtime` input of render-material.mjs (runtime-values.json) from
 *  (a) the in-image measurement receipt of apps/runtime/build/first-chat-launch-measurement.mjs,
 *  (b) allocation.json (the reviewed allocation manifest, exactly runtime.allocation's shape) and
 *  (c) policy.json (the D1 envelope, runtime caps, runner layout and allocation hash),
 * and print the exact one-shot ECS measurement override. Importing this module performs no IO.
 *
 * Value definitions (each re-checked here; see the measurement module for where the runtime re-measures them):
 *  versions.skillsDigest  skillsDigest() over packages/skills; the receipt's image value must equal the source value.
 *  preparationIntent.*    receipt.launchTemplate / executable.sha256 / sdkOptions.sha256 / runner.sha256; directories from policy.runnerLayout.
 *  allocation             allocation.json verbatim, validated by apps/gateway/budget/tool-budget-binding.mjs allocation().
 *  runtime                policy.runtime {maxTurns, maxOutputBytes} (<= the allocation budgets, as prepared-candidate-config requires).
 *  qualification          {attempt: 1, policyRevision: canonicalSha256(policy.json)}.
 *
 * sdkOptionsSha256 is per run: runner-query.mjs hashes the run's real SDK options (cwd /workspace/<conversationId>,
 * CLAUDE_CONFIG_DIR <configParent>/sdk-<runId>, request-context system prompt) while prepared-run-bindings.mjs retargets only
 * workspace and authoritySha256. A static value therefore cannot match any real run; assembling one requires the explicit
 * acknowledgement flag so nobody mistakes the probe value for a working pin. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,posix} from 'node:path';
import {brotliCompressSync,brotliDecompressSync,constants as zlib} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {allocation as parseAllocation} from '../../../apps/gateway/budget/tool-budget-binding.mjs';
import {RUNNER_SDK_CA_FILE} from '../../../apps/runtime/native-authority/preparation-intent.mjs';
import {PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS} from '../../../apps/gateway/model-proxy/product-envelope.mjs';
import {RECEIPT_SCHEMA,PINNED_SDK,PINNED_CLI,WORKSPACE_ROOT,skillsDigest} from '../../../apps/runtime/build/first-chat-launch-measurement.mjs';
import {parseRuntimeValues,SOURCE_ROOT} from './render-material.mjs';

export const MEASUREMENT_MODULE='apps/runtime/build/first-chat-launch-measurement.mjs';
export const POLICY_SCHEMA='meri.first-chat-policy.v1';
const hex64=/^[a-f0-9]{64}$/u;
export const fail=(code,detail)=>{throw Object.assign(Error(detail?`${code}: ${detail}`:code),{code});};
const refuse=detail=>fail('RUNTIME_VALUES_REFUSED',detail);
function record(value,name,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value))refuse(`${name} must be an object`);
 const actual=Object.keys(value).sort(),expected=[...keys].sort();
 if(JSON.stringify(actual)!==JSON.stringify(expected))refuse(`${name} must have exactly ${expected.join(',')}`);
 return value;
}
const int=(value,name,min,max)=>{if(!Number.isSafeInteger(value)||value<min||value>max)refuse(`${name} must be an integer in ${min}..${max}`);return value;};
const path=(value,name)=>{if(typeof value!=='string'||!posix.isAbsolute(value)||posix.normalize(value)!==value||value.endsWith('/')||value==='/')refuse(`${name} must be a normalized absolute POSIX path`);return value;};

/** policyRevision := canonicalSha256(policy.json). Nothing in code prescribes another derivation: the runtime only requires 64 hex
 * (render-material, native-allocation-admission digest(), budget runs.policy_revision CHECK) and equality across scopes,
 * initial bindings, run records, grants and authoritySha256. Canonical JSON keeps it independent of whitespace/line endings. */
export const policyRevisionOf=policy=>canonicalSha256(policy);

/** The D1 envelope must equal both the proxy's compiled envelope and deployment-inputs.json's model block. */
export function parsePolicy(policy,deployment){
 const p=record(policy,'policy',['schema','changeSet','purpose','model','runtime','runnerLayout','allocationSha256']);
 if(p.schema!==POLICY_SCHEMA||p.changeSet!=='D1'||p.purpose!=='meri-first-chat-preview')refuse('policy schema/changeSet/purpose');
 const m=record(p.model,'policy.model',['profileId','modelId','pricingRevision','maxInputTokens','maxOutputTokens','perRunMaxCostMicroUSD']);
 if(m.maxInputTokens!==PRODUCT_MAX_INPUT_TOKENS||m.maxOutputTokens!==PRODUCT_MAX_OUTPUT_TOKENS)refuse('policy.model envelope differs from apps/gateway/model-proxy/product-envelope.mjs');
 for(const k of Object.keys(m))if(deployment.model[k]!==m[k])refuse(`policy.model.${k} differs from deployment-inputs model.${k}`);
 const r=record(p.runtime,'policy.runtime',['maxTurns','maxOutputBytes']);int(r.maxTurns,'policy.runtime.maxTurns',1,100);int(r.maxOutputBytes,'policy.runtime.maxOutputBytes',1,1048576);
 const l=record(p.runnerLayout,'policy.runnerLayout',['workspaceRoot','configParentDirectory','secureStorageDirectory']);
 for(const k of Object.keys(l))path(l[k],`policy.runnerLayout.${k}`);
 if(l.workspaceRoot!==WORKSPACE_ROOT)refuse(`policy.runnerLayout.workspaceRoot must be ${WORKSPACE_ROOT} (render-material DEFAULTS.workspaceRoot)`);
 if(l.configParentDirectory===l.secureStorageDirectory||l.configParentDirectory.startsWith(l.secureStorageDirectory+'/'))refuse('runner SDK directories must not nest (options.mjs)');
 if(!hex64.test(p.allocationSha256))refuse('policy.allocationSha256 must be 64 hex');
 return p;
}

/** allocation.json is runtime.allocation verbatim. It is validated by the gateway parser on a synthetic run binding. */
export async function parseAllocationFile(raw,policy,{sourceRoot=SOURCE_ROOT}={}){
 const a=record(raw,'allocation',['manifest','catalogSha256','scheduleRevision','operations']);
 const catalog=JSON.parse(await readFile(resolve(sourceRoot,'packages/contracts/retrieval-0.2/catalog.json'),'utf8'));
 const assets=JSON.parse(await readFile(resolve(sourceRoot,'packages/skills/assets.json'),'utf8'));
 if(a.catalogSha256!==canonicalSha256(catalog)||a.catalogSha256!==assets.catalogSha256)refuse('allocation.catalogSha256 is not the pinned retrieval-0.2 catalog');
 if(a.scheduleRevision!==canonicalSha256(a.operations))refuse('allocation.scheduleRevision must be canonicalSha256(operations)');
 const run={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002'};
 let parsed;try{parsed=parseAllocation(JSON.stringify({run,manifest:a.manifest,manifestSha256:canonicalSha256(a.manifest),catalogSha256:a.catalogSha256,budgets:a.manifest.budgets,
  schedule:{revision:a.scheduleRevision,expiresAt:'2100-01-01T00:00:00.000Z',operations:a.operations}}));}catch(error){refuse(`allocation parser ${error.code??error.message}`);}
 for(const {operation} of a.operations)if(!catalog.operations.some(row=>canonicalSha256(row.operation)===canonicalSha256(operation)))refuse(`operation ${operation.id}@${operation.version} is not in the catalog`);
 const b=parsed.budgets;
 int(b.maxTurns,'budgets.maxTurns',1,100);int(b.maxOutputBytes,'budgets.maxOutputBytes',1,1048576);
 // runWindowMs is 60000..86400000 and <= maxRuntimeSeconds*1000 (prepared-candidate-config, render-material).
 int(b.maxRuntimeSeconds,'budgets.maxRuntimeSeconds',60,86400);
 if(b.maxCostMicroUSD!==policy.model.perRunMaxCostMicroUSD)refuse('budgets.maxCostMicroUSD must equal the D1 per-run cap');
 if(policy.runtime.maxTurns>b.maxTurns||policy.runtime.maxOutputBytes>b.maxOutputBytes)refuse('policy.runtime exceeds the allocation budgets (prepared-candidate-config refuses)');
 if(canonicalSha256(a)!==policy.allocationSha256)refuse('policy.allocationSha256 does not match allocation.json');
 return a;
}

/** The in-image receipt, checked against the policy/deployment inputs it was taken with and the source skills digest. */
export function parseReceipt(receipt,{policy,deployment,policyRevision,sourceSkillsDigest,requireLinux=true}){
 const r=receipt;if(r?.schema!==RECEIPT_SCHEMA)refuse('receipt.schema');
 if(requireLinux&&(r.platform?.os!=='linux'||r.platform?.arch!=='x64'))refuse('receipt was not measured on linux/x64 (the CLI executable is platform-specific)');
 if(requireLinux&&r.platform?.uid!==1000)refuse('receipt was not measured as uid 1000');
 const expected={proxyUrl:deployment.origins.proxyUrl,model:deployment.model.profileId,maxTurns:policy.runtime.maxTurns,maxCostMicroUSD:deployment.model.perRunMaxCostMicroUSD,
  maxOutputBytes:policy.runtime.maxOutputBytes,configParentDirectory:policy.runnerLayout.configParentDirectory,secureStorageDirectory:policy.runnerLayout.secureStorageDirectory,policyRevision};
 for(const [k,v] of Object.entries(expected))if(r.inputs?.[k]!==v)refuse(`receipt.inputs.${k} differs from the policy/deployment value`);
 if(r.versions?.sdk!==PINNED_SDK||r.versions?.cli!==PINNED_CLI)refuse('receipt SDK/CLI versions are not the pinned pair');
 if(!hex64.test(r.executable?.sha256??'')||!hex64.test(r.runner?.sha256??'')||!hex64.test(r.sdkOptions?.sha256??''))refuse('receipt hashes must be 64 hex');
 const t=record(r.launchTemplate,'receipt.launchTemplate',['command','args','env']);
 if(t.command!==r.executable.path)refuse('launch command must be the measured executable realpath');
 if(!Array.isArray(t.args)||t.args.some(a=>typeof a!=='string')||!t.env||typeof t.env!=='object'||Object.values(t.env).some(v=>typeof v!=='string'))refuse('launchTemplate args/env');
 if(Object.hasOwn(t.env,'CLAUDE_CONFIG_DIR')||Object.hasOwn(t.env,'ANTHROPIC_AUTH_TOKEN'))refuse('launchTemplate must not carry the per-run config dir or credential');
 if(t.env.NODE_EXTRA_CA_CERTS!==RUNNER_SDK_CA_FILE||t.env.CLAUDE_SECURESTORAGE_CONFIG_DIR!==policy.runnerLayout.secureStorageDirectory)refuse('launchTemplate CA/secure storage env');
 if(t.env.ANTHROPIC_BASE_URL!==new URL(deployment.origins.proxyUrl).href)refuse('launchTemplate ANTHROPIC_BASE_URL is not the deployment proxy');
 if(!t.args.includes(`--max-turns=${policy.runtime.maxTurns}`)||!t.args.includes(`--model=${deployment.model.profileId}`))refuse('launchTemplate args do not carry the policy maxTurns/model');
 const failed=Object.entries(r.gates??{}).filter(([,v])=>v!=='PASS').map(([k])=>k);
 if(requireLinux&&(failed.length||!r.gates||Object.keys(r.gates).length<6))refuse(`receipt launch gates not all PASS: ${failed.join(',')}`);
 if(r.skills?.digest!==sourceSkillsDigest)refuse('receipt skills digest differs from the source skills digest');
 return r;
}

export function assembleRuntimeValues({receipt,allocation,policy,policyRevision,acknowledgePerRunSdkOptions=false}){
 if(receipt.sdkOptions.perRun!==false&&acknowledgePerRunSdkOptions!==true)
  fail('RUNTIME_VALUES_SDK_OPTIONS_PER_RUN','sdkOptionsSha256 is the probe run\'s value; runner-query.mjs re-hashes every real run\'s options (cwd, CLAUDE_CONFIG_DIR, request context) and will refuse SDK_OPTIONS_REFUSED. Pass --acknowledge-per-run-sdk-options to assemble anyway.');
 const runtime={schemaVersion:1,versions:{sdk:receipt.versions.sdk,cli:receipt.versions.cli,contracts:'0.1.0',skillsDigest:receipt.skills.digest,checkpointFormat:'0.1.0'},
  preparationIntent:{configParentDirectory:policy.runnerLayout.configParentDirectory,secureStorageDirectory:policy.runnerLayout.secureStorageDirectory,
   launchTemplate:structuredClone(receipt.launchTemplate),executableSha256:receipt.executable.sha256,sdkOptionsSha256:receipt.sdkOptions.sha256,runnerSha256:receipt.runner.sha256},
  allocation:structuredClone(allocation),runtime:{maxTurns:policy.runtime.maxTurns,maxOutputBytes:policy.runtime.maxOutputBytes},qualification:{attempt:1,policyRevision}};
 try{parseRuntimeValues(runtime);}catch(error){refuse(`render-material parseRuntimeValues ${error.message}`);}
 return runtime;
}

/** Full pipeline from parsed JSON values. */
export async function runtimeValues({receipt,allocation,policy,deployment,acknowledgePerRunSdkOptions=false,requireLinux=true,sourceRoot=SOURCE_ROOT}){
 const p=parsePolicy(policy,deployment),policyRevision=policyRevisionOf(policy);
 const a=await parseAllocationFile(allocation,p,{sourceRoot});
 const source=await skillsDigest({root:sourceRoot});
 const r=parseReceipt(receipt,{policy:p,deployment,policyRevision,sourceSkillsDigest:source.digest,requireLinux});
 return {runtime:assembleRuntimeValues({receipt:r,allocation:a,policy:p,policyRevision,acknowledgePerRunSdkOptions}),policyRevision,skillsDigest:source.digest};
}

/** The one-shot measurement as the bash string for the meri-product-preview-d2-migrate container (entryPoint ["/bin/bash","-c"]).
 * `exec -c` starts node with an EMPTY environment, so the family's injected Aurora/login secrets never reach it.
 * embedded: the committed module travels brotli+base64 in the override, is sha256-checked, written to /run/meri/measure (the only
 * writable path) and run against the image's /opt/meri modules; for an image that predates the module.
 * shipped: runs the module the next image contains at /opt/meri/apps/runtime/build. */
export const MEASURE_DIRECTORY='/run/meri/measure',IMAGE_ROOT='/opt/meri',NODE='/usr/local/bin/node',CONTAINER='d2-migrate';
const LOADER=`import {brotliDecompressSync} from "node:zlib";import {writeFileSync,mkdirSync} from "node:fs";import {createHash} from "node:crypto";import {join} from "node:path";import {pathToFileURL} from "node:url";
const [b64,expected,directory,...args]=process.argv.slice(1),bytes=brotliDecompressSync(Buffer.from(b64,"base64"));
if(createHash("sha256").update(bytes).digest("hex")!==expected){process.stderr.write("MEASUREMENT_MODULE_SHA256_MISMATCH\\n");process.exit(3);}
mkdirSync(directory,{recursive:true,mode:0o700});const file=join(directory,"first-chat-launch-measurement.mjs");writeFileSync(file,bytes,{mode:0o600,flag:"wx"});
const m=await import(pathToFileURL(file).href);process.exitCode=await m.main(args);`;
const quote=value=>`'${String(value).replaceAll("'","'\\''")}'`;
export function measurementArguments({policy,deployment,policyRevision,root=IMAGE_ROOT}){
 return ['--proxy-url',deployment.origins.proxyUrl,'--model',deployment.model.profileId,'--max-turns',String(policy.runtime.maxTurns),
  '--max-cost-micro-usd',String(deployment.model.perRunMaxCostMicroUSD),'--max-output-bytes',String(policy.runtime.maxOutputBytes),
  '--config-parent',policy.runnerLayout.configParentDirectory,'--secure-storage',policy.runnerLayout.secureStorageDirectory,'--policy-revision',policyRevision,'--root',root];
}
/** node argv (after the executable) of the embedded form; the bash command is exactly these, quoted. */
export function embeddedNodeArguments({moduleBytes,policy,deployment,policyRevision,root=IMAGE_ROOT,directory=MEASURE_DIRECTORY}){
 const b64=brotliCompressSync(moduleBytes,{params:{[zlib.BROTLI_PARAM_QUALITY]:11,[zlib.BROTLI_PARAM_SIZE_HINT]:moduleBytes.length}}).toString('base64'),digest=createHash('sha256').update(moduleBytes).digest('hex');
 return ['--input-type=module','-e',LOADER,b64,digest,directory,...measurementArguments({policy,deployment,policyRevision,root})];
}
export function measurementCommand({moduleBytes,policy,deployment,policyRevision,mode='embedded',root=IMAGE_ROOT,directory=MEASURE_DIRECTORY,node=NODE}){
 if(mode==='shipped')return `set -euo pipefail; cd ${quote(root)}; exec -c ${node} ${quote(MEASUREMENT_MODULE)} ${measurementArguments({policy,deployment,policyRevision,root}).map(quote).join(' ')}`;
 if(mode!=='embedded')refuse('mode must be embedded or shipped');
 return `set -euo pipefail; umask 077; exec -c ${node} ${embeddedNodeArguments({moduleBytes,policy,deployment,policyRevision,root,directory}).map(quote).join(' ')}`;
}
export function measurementOverrides(options){
 const command=measurementCommand(options),overrides={containerOverrides:[{name:CONTAINER,command:[command]}]};
 const bytes=Buffer.byteLength(JSON.stringify(overrides));if(bytes>8192)refuse(`ECS overrides are ${bytes} bytes (limit 8192)`);
 return overrides;
}
export const decodeEmbeddedModule=command=>{const m=/ '([A-Za-z0-9+/=]{100,})' '([a-f0-9]{64})' /u.exec(command);if(!m)refuse('no embedded module');return {bytes:brotliDecompressSync(Buffer.from(m[1],'base64')),sha256:m[2]};};

const USAGE=`Usage:
  node infra/product-preview/first-chat/runtime-values.mjs assemble --receipt R.json --out runtime-values.json [--allocation allocation.json]
    [--policy policy.json] [--deployment-inputs deployment-inputs.json] --acknowledge-per-run-sdk-options
  node infra/product-preview/first-chat/runtime-values.mjs measurement-override [--shipped] [--policy ...] [--deployment-inputs ...]
  node infra/product-preview/first-chat/runtime-values.mjs policy-revision [--policy policy.json]
Exit 0 written/printed; 2 arguments or values refused.`;
export async function main(argv=process.argv.slice(2)){
 const [command,...rest]=argv,a={},flags=new Set();
 for(let i=0;i<rest.length;i++){if(['--acknowledge-per-run-sdk-options','--shipped'].includes(rest[i])){flags.add(rest[i]);continue;}
  if(!rest[i].startsWith('--')||rest[i+1]===undefined){process.stderr.write(USAGE+'\n');return 2;}a[rest[i].slice(2)]=rest[++i];}
 const here=fileURLToPath(new URL('.',import.meta.url)),json=async p=>JSON.parse(await readFile(p,'utf8'));
 const policyPath=a.policy??resolve(here,'policy.json'),deploymentPath=a['deployment-inputs']??resolve(here,'deployment-inputs.json');
 try{
  const policy=await json(policyPath),deployment=await json(deploymentPath),policyRevision=policyRevisionOf(policy);
  if(command==='policy-revision'){parsePolicy(policy,deployment);process.stdout.write(policyRevision+'\n');return 0;}
  if(command==='measurement-override'){parsePolicy(policy,deployment);
   const moduleBytes=await readFile(resolve(SOURCE_ROOT,MEASUREMENT_MODULE));
   process.stdout.write(JSON.stringify(measurementOverrides({moduleBytes,policy,deployment,policyRevision,mode:flags.has('--shipped')?'shipped':'embedded'}))+'\n');return 0;}
  if(command!=='assemble'||!a.receipt||!a.out){process.stderr.write(USAGE+'\n');return 2;}
  if(!isAbsolute(resolve(a.out)))refuse('--out');
  const {runtime,policyRevision:revision}=await runtimeValues({receipt:await json(a.receipt),allocation:await json(a.allocation??resolve(here,'allocation.json')),policy,deployment,
   acknowledgePerRunSdkOptions:flags.has('--acknowledge-per-run-sdk-options')});
  await writeFile(a.out,JSON.stringify(runtime,null,1)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({status:'MERI_FIRST_CHAT_RUNTIME_VALUES_WRITTEN',out:resolve(a.out),policyRevision:revision,skillsDigest:runtime.versions.skillsDigest})+'\n');return 0;
 }catch(error){process.stderr.write((typeof error?.code==='string'&&/^RUNTIME_VALUES_/u.test(error.code)?error.message:`RUNTIME_VALUES_REFUSED: ${error?.code??error?.message}`)+'\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
