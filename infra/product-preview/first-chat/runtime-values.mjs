#!/usr/bin/env node
/** Assemble source-bound SDK versions and explicit execution/output policy. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {skillsDigest} from '../../../apps/runtime/build/read-assets.mjs';
import {parseRuntimeValues,SOURCE_ROOT} from './render-material.mjs';
import {assertModelCatalog,MODEL_EFFORTS} from '../../../packages/contracts/model-selection.mjs';

export const POLICY_SCHEMA='meri.first-chat-policy.v3';
const refuse=detail=>{throw Object.assign(Error('RUNTIME_VALUES_REFUSED: '+detail),{code:'RUNTIME_VALUES_REFUSED'});};
const hex64=/^[a-f0-9]{64}$/u;
function record(value,name,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||JSON.stringify(Object.keys(value).sort())!==JSON.stringify([...keys].sort()))refuse(name+' has unexpected fields');
 return value;
}
const int=(value,name,min,max)=>{if(!Number.isSafeInteger(value)||value<min||value>max)refuse(name+' outside bounds');return value;};
export const policyRevisionOf=policy=>canonicalSha256(policy);
/** Catalog rows awaiting qualification that cannot yet appear in the served catalog, because the served row for the
 * same provider/model is already available with a narrower effort list (one served row per provider/model). Each entry
 * is a complete catalog row with `available:false` and a reason; Release flips it by moving its efforts onto the served
 * row (or the whole row into `models`) after qualification. Nothing here is served, selectable or persisted. */
function parsePendingModels(pending,served){
 if(pending===undefined)return [];
 if(!Array.isArray(pending)||pending.length>128)refuse('policy.pendingModels must be a list');
 const seen=new Set();
 for(const row of pending){
  const r=record(row,'policy.pendingModels[]',['provider','modelId','label','efforts','available','unavailableReason']);
  // The row shape is the catalog row shape: validate it as a one-row catalog (temporarily available so the catalog
  // validator's own default-row rule applies), then require the pending row itself to be unavailable with a reason.
  try{assertModelCatalog({defaultSelection:{provider:r.provider,modelId:r.modelId,effort:r.efforts[0]},models:[{...r,available:true,unavailableReason:null}]});}catch{refuse('policy.pendingModels[] is not a catalog row');}
  if(r.available!==false||!['provider_unconfigured','model_unqualified'].includes(r.unavailableReason))refuse('policy.pendingModels[] must be unavailable with a reason');
  const current=served.models.find(m=>m.provider===r.provider&&m.modelId===r.modelId);
  for(const effort of r.efforts){
   if(effort!==null&&!MODEL_EFFORTS.includes(effort))refuse('policy.pendingModels[] effort');
   const key=`${r.provider}\0${r.modelId}\0${effort}`;if(seen.has(key)||current?.efforts.includes(effort))refuse('policy.pendingModels[] duplicates a served or pending effort');seen.add(key);
  }
 }
 return pending;
}
export function parsePolicy(policy){
 const p=record(policy,'policy',Object.hasOwn(policy??{},'pendingModels')?['schema','changeSet','purpose','runtime','models','pendingModels']:['schema','changeSet','purpose','runtime','models']);
 assertModelCatalog(p.models);parsePendingModels(p.pendingModels,p.models);
 if(p.schema!==POLICY_SCHEMA||p.changeSet!=='AGENTCORE_RUNTIME_V1'||p.purpose!=='meri-first-chat-preview')refuse('policy schema/changeSet/purpose');
 const r=record(p.runtime,'policy.runtime',['runWindowMs','maxOutputBytes']);int(r.runWindowMs,'runWindowMs',60000,28800000);int(r.maxOutputBytes,'maxOutputBytes',1,1048576);return p;
}

export async function runtimeValues({policy,deployment,sourceRoot=SOURCE_ROOT}){
 const p=parsePolicy(policy),policyRevision=policyRevisionOf(p),commit=deployment?.images?.nodeRuntimeSourceCommit;
 if(!/^[a-f0-9]{40}$/u.test(commit??''))refuse('image source commit');
 // Normal source-to-image provenance; no synthetic SDK launch or option hash.
 try{
  if(execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim()!==commit)refuse('checkout differs from image source');
  execFileSync('git',['diff','--quiet',commit,'--','apps','packages','infra/product-preview'],{cwd:sourceRoot,stdio:'ignore'});
 }catch{refuse('source must be the clean image checkout');}
 const skills=await skillsDigest({root:sourceRoot});
 const runtime={schemaVersion:2,versions:{sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:skills.digest,checkpointFormat:'0.1.0'},runtime:{...p.runtime},policyRevision,models:structuredClone(p.models)};
 parseRuntimeValues(runtime);
 return {runtime,policyRevision,skillsDigest:skills.digest};
}
export async function main(argv=process.argv.slice(2)){
 const [command,...rest]=argv,a={};
 try{
  for(let i=0;i<rest.length;i+=2){if(!['--out','--policy','--deployment-inputs'].includes(rest[i])||rest[i+1]===undefined||Object.hasOwn(a,rest[i]))refuse('arguments');a[rest[i]]=rest[i+1];}
  const here=fileURLToPath(new URL('.',import.meta.url)),json=async p=>JSON.parse(await readFile(p,'utf8'));
  const policy=await json(a['--policy']??resolve(here,'policy.json'));
  if(command==='policy-revision'){parsePolicy(policy);process.stdout.write(policyRevisionOf(policy)+'\n');return 0;}
  if(command!=='assemble'||!a['--out'])refuse('use assemble --out with policy and deployment inputs');
  const {runtime,policyRevision}=await runtimeValues({policy,deployment:await json(a['--deployment-inputs']??resolve(here,'deployment-inputs.json'))});
  await writeFile(a['--out'],JSON.stringify(runtime,null,1)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({status:'MERI_FIRST_CHAT_RUNTIME_VALUES_WRITTEN',out:resolve(a['--out']),policyRevision})+'\n');return 0;
 }catch(error){process.stderr.write('RUNTIME_VALUES_REFUSED: '+(error.code??'invalid input')+'\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
