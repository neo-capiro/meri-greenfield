#!/usr/bin/env node
/** Assemble native-run material from the exact source of the qualified image.
 * Image qualification owns SDK/package execution. There is no launch receipt,
 * executable descriptor, injected model credential or deployment model limit.
 * Existing read installation metadata remains until the Step3 gateway replaces it. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {allocation as parseAllocation} from '../../../apps/gateway/budget/tool-budget-binding.mjs';
import {skillsDigest,generalReadInstallation} from '../../../apps/runtime/build/read-assets.mjs';
import {parseRuntimeValues,parseFeatures,capabilityProfileOf,runnerSha256AtCommit,SOURCE_ROOT} from './render-material.mjs';

export const POLICY_SCHEMA='meri.first-chat-policy.v2';
const refuse=detail=>{throw Object.assign(Error('RUNTIME_VALUES_REFUSED: '+detail),{code:'RUNTIME_VALUES_REFUSED'});};
const hex64=/^[a-f0-9]{64}$/u;
function record(value,name,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||JSON.stringify(Object.keys(value).sort())!==JSON.stringify([...keys].sort()))refuse(name+' has unexpected fields');
 return value;
}
const int=(value,name,min,max)=>{if(!Number.isSafeInteger(value)||value<min||value>max)refuse(name+' outside bounds');return value;};
export const policyRevisionOf=policy=>canonicalSha256(policy);
export function parsePolicy(policy){
 const p=record(policy,'policy',['schema','changeSet','purpose','runtime','runnerLayout','allocationSha256']);
 if(p.schema!==POLICY_SCHEMA||p.changeSet!=='ITEM0_STEP2'||p.purpose!=='meri-first-chat-preview')refuse('policy schema/changeSet/purpose');
 const r=record(p.runtime,'policy.runtime',['maxOutputBytes']);int(r.maxOutputBytes,'maxOutputBytes',1,1048576);
 const l=record(p.runnerLayout,'runnerLayout',['workspaceRoot','configParentDirectory','secureStorageDirectory']);
 for(const value of Object.values(l))if(typeof value!=='string'||!posix.isAbsolute(value)||posix.normalize(value)!==value||value==='/'||value.endsWith('/'))refuse('runner layout paths');
 if(l.workspaceRoot!=='/workspace'||l.configParentDirectory===l.secureStorageDirectory||l.configParentDirectory.startsWith(l.secureStorageDirectory+'/'))refuse('runner layout');
 if(!hex64.test(p.allocationSha256))refuse('allocationSha256');
 return p;
}
export async function parseAllocationFile(raw,policy,{sourceRoot=SOURCE_ROOT}={}){
 const a=record(raw,'allocation',['manifest','catalogSha256','scheduleRevision','operations']);
 const catalog=JSON.parse(await readFile(resolve(sourceRoot,'packages/contracts/retrieval-0.2/catalog.json'),'utf8'));
 const assets=JSON.parse(await readFile(resolve(sourceRoot,'packages/skills/assets.json'),'utf8'));
 if(a.catalogSha256!==canonicalSha256(catalog)||a.catalogSha256!==assets.catalogSha256)refuse('allocation catalog drift');
 if(a.scheduleRevision!==canonicalSha256(a.operations)||canonicalSha256(a)!==policy.allocationSha256)refuse('allocation drift');
 const run={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002'};
 const parsed=parseAllocation(JSON.stringify({run,manifest:a.manifest,manifestSha256:canonicalSha256(a.manifest),catalogSha256:a.catalogSha256,budgets:a.manifest.budgets,schedule:{revision:a.scheduleRevision,expiresAt:'2100-01-01T00:00:00.000Z',operations:a.operations}}));
 for(const {operation} of a.operations)if(!catalog.operations.some(row=>canonicalSha256(row.operation)===canonicalSha256(operation)))refuse('operation missing from catalog');
 int(parsed.budgets.maxRuntimeSeconds,'maxRuntimeSeconds',60,86400);
 int(parsed.budgets.maxOutputBytes,'maxOutputBytes',1,1048576);
 if(policy.runtime.maxOutputBytes>parsed.budgets.maxOutputBytes)refuse('runtime output exceeds allocation');
 return a;
}
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

export async function runtimeValues({allocation,policy,deployment,sourceRoot=SOURCE_ROOT}){
 const p=parsePolicy(policy),policyRevision=policyRevisionOf(p),commit=deployment?.images?.nodeRuntimeSourceCommit;
 if(!/^[a-f0-9]{40}$/u.test(commit??''))refuse('image source commit');
 // Normal source-to-image provenance; no synthetic SDK launch or option hash.
 try{
  if(execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim()!==commit)refuse('checkout differs from image source');
  execFileSync('git',['diff','--quiet',commit,'--','apps','packages','infra/product-preview'],{cwd:sourceRoot,stdio:'ignore'});
 }catch{refuse('source must be the clean image checkout');}
 const runnerSha256=runnerSha256AtCommit(commit,{sourceRoot});if(!runnerSha256)refuse('image runner source unavailable');
 const a=await parseAllocationFile(allocation,p,{sourceRoot}),skills=await skillsDigest({root:sourceRoot});
 const active=activeReadOperationsOf(deployment);
 const installation=active===null?null:await generalReadInstallation({root:sourceRoot,activeReadOperations:active});
 const runtime={schemaVersion:1,versions:{sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:skills.digest,checkpointFormat:'0.1.0'},
  preparationIntent:{configParentDirectory:p.runnerLayout.configParentDirectory,secureStorageDirectory:p.runnerLayout.secureStorageDirectory,runnerSha256},
  allocation:structuredClone(a),runtime:{maxOutputBytes:p.runtime.maxOutputBytes},qualification:{attempt:1,policyRevision},
  ...(installation===null?{}:{generalReadInstallation:installation})};
 parseRuntimeValues(runtime);
 return {runtime,policyRevision,skillsDigest:skills.digest};
}
export async function main(argv=process.argv.slice(2)){
 const [command,...rest]=argv,a={};
 try{
  for(let i=0;i<rest.length;i+=2){if(!['--out','--allocation','--policy','--deployment-inputs'].includes(rest[i])||rest[i+1]===undefined||Object.hasOwn(a,rest[i]))refuse('arguments');a[rest[i]]=rest[i+1];}
  const here=fileURLToPath(new URL('.',import.meta.url)),json=async p=>JSON.parse(await readFile(p,'utf8'));
  const policy=await json(a['--policy']??resolve(here,'policy.json'));
  if(command==='policy-revision'){parsePolicy(policy);process.stdout.write(policyRevisionOf(policy)+'\n');return 0;}
  if(command!=='assemble'||!a['--out'])refuse('use assemble --out with allocation, policy and deployment inputs');
  const {runtime,policyRevision}=await runtimeValues({policy,allocation:await json(a['--allocation']??resolve(here,'allocation.json')),deployment:await json(a['--deployment-inputs']??resolve(here,'deployment-inputs.json'))});
  await writeFile(a['--out'],JSON.stringify(runtime,null,1)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({status:'MERI_FIRST_CHAT_RUNTIME_VALUES_WRITTEN',out:resolve(a['--out']),policyRevision})+'\n');return 0;
 }catch(error){process.stderr.write('RUNTIME_VALUES_REFUSED: '+(error.code??'invalid input')+'\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
