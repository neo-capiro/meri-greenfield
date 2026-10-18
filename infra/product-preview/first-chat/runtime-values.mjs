#!/usr/bin/env node
/** Meri first-chat preview: assemble the `--runtime` input of render-material.mjs (runtime-values.json) from
 *  (a) the in-image measurement receipt of apps/runtime/build/first-chat-launch-measurement.mjs,
 *  (b) allocation.json (the reviewed allocation manifest, exactly runtime.allocation's shape) and
 *  (c) policy.json (the D1 envelope, runtime caps, runner layout and allocation hash),
 * and print the exact one-shot ECS measurement override. Importing this module performs no IO.
 *
 * Value definitions (each re-checked here; see the measurement module for where the runtime re-measures them):
 *  versions.skillsDigest  skillsDigest() over packages/skills; the receipt's image value must equal the source value.
 *  preparationIntent.*    receipt.launchTemplate / executable.sha256 / sdkOptions.sha256 (run-invariant template, equal to the source
 *                         template) / runner.sha256; directories from policy.runnerLayout.
 *  allocation             allocation.json verbatim, validated by apps/gateway/budget/tool-budget-binding.mjs allocation().
 *  runtime                policy.runtime {maxTurns, maxOutputBytes} (<= the allocation budgets, as prepared-candidate-config requires).
 *  qualification          {attempt: 1, policyRevision: canonicalSha256(policy.json)}.
 *  generalReadInstallation  receipt.generalReadInstallation {measurement, measurementSha256} (P2, installation-issuer.mjs): an enabled
 *                         installation names its reviewed activeOperations in deployment features. The in-image measurement of exactly
 *                         those operations must equal the SAME function run on this source tree. The separate generalReadInventory
 *                         proves the full desired 76-row source inventory without claiming all rows are active. A receipt from a
 *                         module that predates P2 assembles only while installation is disabled (render refuses to enable it).
 *
 * preparationIntent.sdkOptionsSha256 is the run-invariant SDK option template hash (apps/runtime/native-authority/sdk-option-template.mjs).
 * runner-query.mjs reduces every run's options to that template after verifying the per-run values (cwd = the intent workspace,
 * CLAUDE_CONFIG_DIR = <configParent>/sdk-<runId>, request-context scopes = the intent's authoritySha256 scopes), so the one
 * configured value is valid for the static candidate and for every dynamic run prepared-run-bindings.mjs retargets. The receipt
 * must prove it: two probe runs give the same hash (sdkOptions.runInvariant) and the runnerSdkOptions gate passed for both.
 *
 * G3 (one SDK-options pin): when deployment-inputs `features.capabilityPlatform` resolves to a capability profile, every run's options
 * carry that profile's SDK capabilities, so the measurement must project them too. The profile travels to the in-image module as
 * --capability-profile <base64url JSON> (too large for the embedded form inside the 8192-byte override: use --shipped), the receipt must
 * report inputs.capabilityProfileSha256, and the assembled runtime values carry it for render-material to pin against the rendered
 * platform. Without the feature every argument, input and assembled byte is unchanged. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,posix} from 'node:path';
import {brotliCompressSync,brotliDecompressSync,constants as zlib} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {allocation as parseAllocation} from '../../../apps/gateway/budget/tool-budget-binding.mjs';
import {RUNNER_SDK_CA_FILE} from '../../../apps/runtime/native-authority/preparation-intent.mjs';
import {SDK_OPTIONS_TEMPLATE_SCHEMA} from '../../../apps/runtime/native-authority/sdk-option-template.mjs';
import {PRODUCT_MAX_INPUT_TOKENS,PRODUCT_MAX_OUTPUT_TOKENS} from '../../../apps/gateway/model-proxy/product-envelope.mjs';
import {RECEIPT_SCHEMA,PINNED_SDK,PINNED_CLI,WORKSPACE_ROOT,skillsDigest,probeTemplateSha256,generalReadInstallation} from '../../../apps/runtime/build/first-chat-launch-measurement.mjs';
import {parseRuntimeValues,parseFeatures,capabilityProfileOf,SOURCE_ROOT} from './render-material.mjs';

export const MEASUREMENT_MODULE='apps/runtime/build/first-chat-launch-measurement.mjs';
export const POLICY_SCHEMA='meri.first-chat-policy.v1';
/** Every launch gate first-chat-launch-measurement.mjs reports; all must PASS on the image (linux/x64, uid 1000). */
export const RECEIPT_GATES=Object.freeze(['compileNativePreparationIntent','matchPreparedDescriptor','commandIsRealpath','executable','runnerCaTrust','secureStorage','runnerSdkOptions']);
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

/** The capability profile the deployment's features make every run resolve to (G3), or null. */
export function measuredCapabilityProfile(deployment){
 let features;try{features=parseFeatures(deployment?.features,{secrets:deployment?.secrets,checkpoint:deployment?.checkpoint});}catch(error){refuse(`deployment features ${error.message}`);}
 return capabilityProfileOf(features?.capabilityPlatform);
}
/** Explicit reviewed active P2 set. A disabled installation may retain an inventory-only legacy measurement. */
export function activeReadOperationsOf(deployment){
 let features;try{features=parseFeatures(deployment?.features,{secrets:deployment?.secrets,checkpoint:deployment?.checkpoint});}catch(error){refuse(`deployment features ${error.message}`);}
 const installation=features?.reads?.installation;
 if(installation?.enabled!==true)return null;
 if(!Array.isArray(installation.activeOperations)||!installation.activeOperations.length)refuse('enabled reads installation needs reviewed activeOperations');
 const profile=capabilityProfileOf(features?.capabilityPlatform)?.profile;
 if(profile?.generalReads===true&&canonicalSha256(profile.activeReadOperations)!==canonicalSha256(installation.activeOperations))
  refuse('capability profile active read operations differ from reviewed reads installation activeOperations');
 return structuredClone(installation.activeOperations);
}
/** The measurement inputs the receipt must have been taken with (and the source template is recomputed with). */
export const measurementInputs=({policy,deployment,policyRevision})=>{const capability=measuredCapabilityProfile(deployment),activeReadOperations=activeReadOperationsOf(deployment);
 return {proxyUrl:deployment.origins.proxyUrl,model:deployment.model.profileId,maxTurns:policy.runtime.maxTurns,
 maxCostMicroUSD:deployment.model.perRunMaxCostMicroUSD,maxOutputBytes:policy.runtime.maxOutputBytes,configParentDirectory:policy.runnerLayout.configParentDirectory,
 secureStorageDirectory:policy.runnerLayout.secureStorageDirectory,policyRevision,...(capability?{capabilityProfileSha256:capability.profileSha256}:{}),
 ...(activeReadOperations===null?{}:{activeReadOperationsSha256:canonicalSha256(activeReadOperations)})};};
/** --capability-profile value: the exact profile JSON, base64url (one shell-safe word). */
export const encodeCapabilityProfile=profile=>Buffer.from(JSON.stringify(profile),'utf8').toString('base64url');
/** The in-image receipt, checked against the policy/deployment inputs it was taken with and the source skills digest. */
export function parseReceipt(receipt,{policy,deployment,policyRevision,sourceSkillsDigest,sourceSdkOptionsSha256,sourceInstallation=null,sourceInventory=null,requireLinux=true}){
 const r=receipt;if(r?.schema!==RECEIPT_SCHEMA)refuse('receipt.schema');
 if(requireLinux&&(r.platform?.os!=='linux'||r.platform?.arch!=='x64'))refuse('receipt was not measured on linux/x64 (the CLI executable is platform-specific)');
 if(requireLinux&&r.platform?.uid!==1000)refuse('receipt was not measured as uid 1000');
 const expected=measurementInputs({policy,deployment,policyRevision});
 for(const [k,v] of Object.entries(expected))if(r.inputs?.[k]!==v)refuse(`receipt.inputs.${k} differs from the policy/deployment value`);
 const active=activeReadOperationsOf(deployment);
 if(Object.hasOwn(r.inputs??{},'activeReadOperationsSha256')!==(active!==null))refuse('receipt active read operations mode differs from reviewed deployment features');
 if(r.versions?.sdk!==PINNED_SDK||r.versions?.cli!==PINNED_CLI)refuse('receipt SDK/CLI versions are not the pinned pair');
 if(!hex64.test(r.executable?.sha256??'')||!hex64.test(r.runner?.sha256??'')||!hex64.test(r.sdkOptions?.sha256??''))refuse('receipt hashes must be 64 hex');
 // The pin must be the run-invariant template: two probe runs with different conversation/run ids hash equal and the real
 // runner-query gate admitted both. A per-run value would be refused SDK_OPTIONS_REFUSED by every real run.
 if(r.sdkOptions.schema!==SDK_OPTIONS_TEMPLATE_SCHEMA||r.sdkOptions.runInvariant!==true||r.sdkOptions.secondProbeSha256!==r.sdkOptions.sha256)refuse('receipt sdkOptions is not the run-invariant SDK option template');
 if(r.gates?.runnerSdkOptions!=='PASS')refuse('receipt runnerSdkOptions gate did not PASS');
 // The template is platform-independent (per-run paths are placeholders), so the source options code must reproduce it exactly.
 if(r.sdkOptions.sha256!==sourceSdkOptionsSha256)refuse('receipt sdkOptions template differs from the source options template for the same inputs');
 const t=record(r.launchTemplate,'receipt.launchTemplate',['command','args','env']);
 if(t.command!==r.executable.path)refuse('launch command must be the measured executable realpath');
 if(!Array.isArray(t.args)||t.args.some(a=>typeof a!=='string')||!t.env||typeof t.env!=='object'||Object.values(t.env).some(v=>typeof v!=='string'))refuse('launchTemplate args/env');
 if(Object.hasOwn(t.env,'CLAUDE_CONFIG_DIR')||Object.hasOwn(t.env,'ANTHROPIC_AUTH_TOKEN'))refuse('launchTemplate must not carry the per-run config dir or credential');
 if(t.env.NODE_EXTRA_CA_CERTS!==RUNNER_SDK_CA_FILE||t.env.CLAUDE_SECURESTORAGE_CONFIG_DIR!==policy.runnerLayout.secureStorageDirectory)refuse('launchTemplate CA/secure storage env');
 if(t.env.ANTHROPIC_BASE_URL!==new URL(deployment.origins.proxyUrl).href)refuse('launchTemplate ANTHROPIC_BASE_URL is not the deployment proxy');
 if(!t.args.includes(`--max-turns=${policy.runtime.maxTurns}`)||!t.args.includes(`--model=${deployment.model.profileId}`))refuse('launchTemplate args do not carry the policy maxTurns/model');
 const failed=RECEIPT_GATES.filter(k=>r.gates?.[k]!=='PASS');
 if(JSON.stringify(Object.keys(r.gates??{}).sort())!==JSON.stringify([...RECEIPT_GATES].sort()))refuse('receipt launch gates are not exactly the measured set');
 if(requireLinux&&failed.length)refuse(`receipt launch gates not all PASS: ${failed.join(',')}`);
 if(r.skills?.digest!==sourceSkillsDigest)refuse('receipt skills digest differs from the source skills digest');
 // P2: the installation measurement is checked like the SDK options pin: internally consistent and reproduced by this source tree.
 if(r.generalReadInstallation!==undefined){
  const g=record(r.generalReadInstallation,'receipt.generalReadInstallation',['measurement','measurementSha256']);
  if(!hex64.test(g.measurementSha256)||canonicalSha256(g.measurement)!==g.measurementSha256)refuse('receipt generalReadInstallation.measurementSha256 is not the canonical sha256 of its measurement');
  if(sourceInstallation===null||g.measurementSha256!==sourceInstallation.measurementSha256)refuse('receipt generalReadInstallation differs from the source general-read installation measurement (handler source, descriptor or catalog drift since the image was measured)');
 }
 if(active!==null){
  if(r.generalReadInstallation===undefined)refuse('enabled reads installation has no active P2 measurement');
  const measured=r.generalReadInstallation.measurement.operations.map(row=>row.operation),ordered=ops=>ops.map(op=>`${op.id}@${op.version}`).sort();
  if(JSON.stringify(ordered(measured))!==JSON.stringify(ordered(active)))refuse('receipt active P2 operation refs differ from reviewed deployment features');
  const inventory=record(r.generalReadInventory,'receipt.generalReadInventory',['measurement','measurementSha256']);
  if(!hex64.test(inventory.measurementSha256)||canonicalSha256(inventory.measurement)!==inventory.measurementSha256)refuse('receipt generalReadInventory.measurementSha256 is not the canonical sha256 of its measurement');
  if(sourceInventory===null||inventory.measurementSha256!==sourceInventory.measurementSha256)refuse('receipt full general-read inventory differs from the source tree');
 }else if(r.generalReadInventory!==undefined)refuse('receipt carries an active P2 inventory without reviewed active operations');
 return r;
}

export function assembleRuntimeValues({receipt,allocation,policy,policyRevision,capabilityProfileSha256=null}){
 const installation=receipt.generalReadInstallation===undefined?null:{measurement:structuredClone(receipt.generalReadInstallation.measurement),measurementSha256:receipt.generalReadInstallation.measurementSha256};
 const runtime={schemaVersion:1,versions:{sdk:receipt.versions.sdk,cli:receipt.versions.cli,contracts:'0.1.0',skillsDigest:receipt.skills.digest,checkpointFormat:'0.1.0'},
  preparationIntent:{configParentDirectory:policy.runnerLayout.configParentDirectory,secureStorageDirectory:policy.runnerLayout.secureStorageDirectory,
   launchTemplate:structuredClone(receipt.launchTemplate),executableSha256:receipt.executable.sha256,sdkOptionsSha256:receipt.sdkOptions.sha256,runnerSha256:receipt.runner.sha256},
  allocation:structuredClone(allocation),runtime:{maxTurns:policy.runtime.maxTurns,maxOutputBytes:policy.runtime.maxOutputBytes},qualification:{attempt:1,policyRevision},
  ...(capabilityProfileSha256===null?{}:{capabilityProfileSha256}),...(installation===null?{}:{generalReadInstallation:installation})};
 try{parseRuntimeValues(runtime);}catch(error){refuse(`render-material parseRuntimeValues ${error.message}`);}
 return runtime;
}

/** Full pipeline from parsed JSON values. */
export async function runtimeValues({receipt,allocation,policy,deployment,requireLinux=true,sourceRoot=SOURCE_ROOT}){
 const p=parsePolicy(policy,deployment),policyRevision=policyRevisionOf(policy);
 const a=await parseAllocationFile(allocation,p,{sourceRoot});
 const source=await skillsDigest({root:sourceRoot});
 const capability=measuredCapabilityProfile(deployment);
 // The source template is recomputed with the same profile the image was asked to project (a module without profile support
 // ignores it, so its template then differs from a profile receipt and the assembly refuses).
 const sourceSdkOptionsSha256=await probeTemplateSha256({...measurementInputs({policy:p,deployment,policyRevision}),...(capability?{capabilityProfile:capability.profile}:{})},{root:sourceRoot});
 // A profile that enables anything changes the projected options; an unchanged template means the source module cannot project it.
 if(capability&&sourceSdkOptionsSha256===await probeTemplateSha256(measurementInputs({policy:p,deployment:{...deployment,features:undefined},policyRevision}),{root:sourceRoot}))
  refuse(`${MEASUREMENT_MODULE} does not project capability profiles (G3 runtime change pending): no measurement can pin capability profile ${capability.profileSha256}`);
 // P2: the same in-image function on this source tree; a receipt that carries the measurement must reproduce it exactly.
 const activeReadOperations=activeReadOperationsOf(deployment);
 const [sourceInstallation,sourceInventory]=await Promise.all([
  generalReadInstallation({root:sourceRoot,...(activeReadOperations===null?{}:{activeReadOperations})}),
  activeReadOperations===null?null:generalReadInstallation({root:sourceRoot})]);
 const r=parseReceipt(receipt,{policy:p,deployment,policyRevision,sourceSkillsDigest:source.digest,sourceSdkOptionsSha256,sourceInstallation,sourceInventory,requireLinux});
 return {runtime:assembleRuntimeValues({receipt:r,allocation:a,policy:p,policyRevision,capabilityProfileSha256:capability?.profileSha256??null}),policyRevision,skillsDigest:source.digest,
  generalReadInstallationSha256:r.generalReadInstallation?.measurementSha256??null};
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
 const capability=measuredCapabilityProfile(deployment),activeReadOperations=activeReadOperationsOf(deployment);
 return ['--proxy-url',deployment.origins.proxyUrl,'--model',deployment.model.profileId,'--max-turns',String(policy.runtime.maxTurns),
  '--max-cost-micro-usd',String(deployment.model.perRunMaxCostMicroUSD),'--max-output-bytes',String(policy.runtime.maxOutputBytes),
  '--config-parent',policy.runnerLayout.configParentDirectory,'--secure-storage',policy.runnerLayout.secureStorageDirectory,'--policy-revision',policyRevision,
  ...(capability?['--capability-profile',encodeCapabilityProfile(capability.profile)]:[]),
  ...(activeReadOperations===null?[]:['--active-read-operations',Buffer.from(JSON.stringify(activeReadOperations),'utf8').toString('base64url')]),'--root',root];
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
 const bytes=Buffer.byteLength(JSON.stringify(overrides));if(bytes>8192)refuse(`ECS overrides are ${bytes} bytes (limit 8192)${options.mode==='shipped'?'':'; use --shipped'}`);
 return overrides;
}
export const decodeEmbeddedModule=command=>{const m=/ '([A-Za-z0-9+/=]{100,})' '([a-f0-9]{64})' /u.exec(command);if(!m)refuse('no embedded module');return {bytes:brotliDecompressSync(Buffer.from(m[1],'base64')),sha256:m[2]};};

const USAGE=`Usage:
  node infra/product-preview/first-chat/runtime-values.mjs assemble --receipt R.json --out runtime-values.json [--allocation allocation.json]
    [--policy policy.json] [--deployment-inputs deployment-inputs.json]
  node infra/product-preview/first-chat/runtime-values.mjs measurement-override [--shipped] [--policy ...] [--deployment-inputs ...]
  node infra/product-preview/first-chat/runtime-values.mjs policy-revision [--policy policy.json]
Exit 0 written/printed; 2 arguments or values refused.`;
export async function main(argv=process.argv.slice(2)){
 const [command,...rest]=argv,a={},flags=new Set();
 for(let i=0;i<rest.length;i++){if(rest[i]==='--shipped'){flags.add(rest[i]);continue;}
  if(!['--receipt','--out','--allocation','--policy','--deployment-inputs'].includes(rest[i])||rest[i+1]===undefined){process.stderr.write(USAGE+'\n');return 2;}a[rest[i].slice(2)]=rest[++i];}
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
  const {runtime,policyRevision:revision}=await runtimeValues({receipt:await json(a.receipt),allocation:await json(a.allocation??resolve(here,'allocation.json')),policy,deployment});
  await writeFile(a.out,JSON.stringify(runtime,null,1)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({status:'MERI_FIRST_CHAT_RUNTIME_VALUES_WRITTEN',out:resolve(a.out),policyRevision:revision,skillsDigest:runtime.versions.skillsDigest,generalReadInstallationSha256:runtime.generalReadInstallation?.measurementSha256??null})+'\n');return 0;
 }catch(error){process.stderr.write((typeof error?.code==='string'&&/^RUNTIME_VALUES_/u.test(error.code)?error.message:`RUNTIME_VALUES_REFUSED: ${error?.code??error?.message}`)+'\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
