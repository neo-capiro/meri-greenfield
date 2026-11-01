/** A finite Release allocation, not a provider/catalog authorization mechanism. */
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,openSync,writeSync,fsyncSync,closeSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {canonicalJson,canonicalSha256} from '../../../packages/contracts/validate.mjs';
export const MANIFEST_ENV='MERI_MODEL_QUALIFICATION_MANIFEST';
export const canonical=canonicalJson,commitment=canonicalSha256;
export const SOURCE='d8cdbca1db57e8c2f3a51a7a74f5014e6fc3f34d';
export const SOURCE_TREE='514245eca0ff473fb84c7fd089dd9e8a8f957aaf';
export const IMAGE='sha256:3b2ee09f99d75d1647c3a1206cdf16bbe7836bb52b8debc56cdd548e221e2037';
export const COORDINATOR='01a194fb-8568-7550-9854-35d9a684a44f';
export const SONNET='us.anthropic.claude-sonnet-4-6',OPUS='us.anthropic.claude-opus-4-6-v1';
export const PAIRS=Object.freeze([[SONNET,'high'],[SONNET,'max'],[OPUS,null],[OPUS,'high'],[OPUS,'max']].map(([modelId,effort],i)=>Object.freeze({id:'model-'+(i+1),selection:Object.freeze({provider:'bedrock',modelId,effort})})));
export const LIMITS=Object.freeze({cases:5,sdkTurnsPerCase:2,estimateMicroUsdPerCase:250000,aggregateSdkTurns:10,aggregateEstimateMicroUsd:1250000,caseMs:180000,batchMs:900000,cleanupMs:30000,requestMs:10000,historyReads:24,runtimeReceiptReads:60});
export const PROMPT='Reply with exactly: model qualification complete. Do not use any tools, skills, subagents, delegation, web access, or files.';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const fail=code=>{throw Object.assign(Error(code),{code});};
export function closed(v,keys){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k)))fail('QUALIFICATION_SHAPE');return v;}
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const commit=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)&&!/^0+$/.test(v);
export const BUILD_FIELDS=Object.freeze(['baseSourceCommit','baseSourceTree','baseImageDigest','operatorCommit','operatorTree','methodSha256','candidateRecipeSha256','candidateArchiveSha256','candidateImageDigest','candidateQualificationSha256']);
export const buildBinding=p=>Object.fromEntries(BUILD_FIELDS.map(k=>[k,p[k]]));
export function manifestFor(p){return {schema:'meri.model-qualification-runtime/1',coordinator:p.coordinator,scope:p.scope,notBeforeMs:p.notBeforeMs,expiresAtMs:p.expiresAtMs,controlOriginSha256:commitment(p.controlOrigin),productionOriginSha256:commitment(p.productionControlOrigin),buildBindingSha256:commitment(buildBinding(p)),methodSha256:p.methodSha256,candidateImageDigest:p.candidateImageDigest,releaseBindingSha256:p.releaseBindingSha256,candidatePolicySha256:p.candidatePolicySha256,productionPolicySha256:p.productionPolicySha256,cases:p.cases.map(c=>({id:c.id,bindingSha256:commitment(c.binding),requestId:c.requestId}))};}
export function parseRuntimeManifest(bytes,now=Date.now()){
 if(typeof bytes!=='string'||Buffer.byteLength(bytes)>1800||! /^[\x20-\x7e]+$/.test(bytes))fail('QUALIFICATION_MANIFEST_BYTES');
 const p=closed(JSON.parse(bytes),['schema','coordinator','scope','notBeforeMs','expiresAtMs','controlOriginSha256','productionOriginSha256','buildBindingSha256','methodSha256','candidateImageDigest','releaseBindingSha256','candidatePolicySha256','productionPolicySha256','cases']);
 if(canonical(p)!==bytes||p.schema!=='meri.model-qualification-runtime/1'||p.coordinator!==COORDINATOR||p.scope!=='isolated-candidate'||!['controlOriginSha256','productionOriginSha256','buildBindingSha256','methodSha256','releaseBindingSha256','candidatePolicySha256','productionPolicySha256'].every(k=>digest(p[k]))||p.controlOriginSha256===p.productionOriginSha256||p.candidatePolicySha256===p.productionPolicySha256||!/^sha256:[a-f0-9]{64}$/.test(p.candidateImageDigest??'')||p.candidateImageDigest===IMAGE)fail('QUALIFICATION_MANIFEST');
 if(![p.notBeforeMs,p.expiresAtMs,now].every(Number.isSafeInteger)||p.notBeforeMs>now||p.expiresAtMs<=now||p.expiresAtMs-p.notBeforeMs>LIMITS.batchMs)fail('QUALIFICATION_EXPIRED');
 if(!Array.isArray(p.cases)||p.cases.length!==5)fail('QUALIFICATION_CASES');
 for(const [i,c]of p.cases.entries()){closed(c,['id','bindingSha256','requestId']);if(c.id!==PAIRS[i].id||!digest(c.bindingSha256)||!uuid(c.requestId))fail('QUALIFICATION_CASE');Object.freeze(c);}
 if(new Set(p.cases.map(c=>c.bindingSha256)).size!==5||new Set(p.cases.map(c=>c.requestId)).size!==5)fail('QUALIFICATION_DUPLICATE');Object.freeze(p.cases);return Object.freeze(p);
}
export function takeRuntimeManifest(environment=process.env,now=Date.now()){
 const bytes=environment[MANIFEST_ENV];delete environment[MANIFEST_ENV];
 return {manifest:parseRuntimeManifest(bytes,now),allocationSha256:sha(bytes)};
}
/** Release preflight on the actual configured API map, not ambient process.env. */
export function assertCandidateEnvironment(environment,now=Date.now()){
 const entries=Object.entries(environment);if(entries.length>50||entries.some(([k,v])=>k.length<1||k.length>100||typeof v!=='string'||v.length>5000))fail('QUALIFICATION_ENVIRONMENT');
 const keyValueBytes=entries.reduce((n,[k,v])=>n+Buffer.byteLength(k)+Buffer.byteLength(v),0),jsonBytes=Buffer.byteLength(canonical(environment));
 if(keyValueBytes>4000||jsonBytes>4000)fail('QUALIFICATION_ENVIRONMENT_SIZE');parseRuntimeManifest(environment[MANIFEST_ENV],now);return {keyValueBytes,jsonBytes,manifestBytes:Buffer.byteLength(environment[MANIFEST_ENV])};
}
export function origin(v){let u;try{u=new URL(v);}catch{fail('QUALIFICATION_ORIGIN');}if(u.protocol!=='https:'||u.origin!==v||u.username||u.password)fail('QUALIFICATION_ORIGIN');return v;}
export function validatePlan(raw,now=Date.now()){
 const p=closed(structuredClone(raw),['schema','coordinator','scope',...BUILD_FIELDS,'notBeforeMs','expiresAtMs','controlOrigin','productionControlOrigin','releaseBindingSha256','candidatePolicySha256','productionPolicySha256','runtimeManifest','allocationSha256','candidateLogGroup','collectorSha256','cases']);
 if(p.schema!=='meri.model-qualification-driver/1'||p.coordinator!==COORDINATOR||p.scope!=='isolated-candidate'||p.baseSourceCommit!==SOURCE||p.baseSourceTree!==SOURCE_TREE||p.baseImageDigest!==IMAGE||!commit(p.operatorCommit)||!commit(p.operatorTree)||!['methodSha256','candidateRecipeSha256','candidateArchiveSha256','candidateQualificationSha256'].every(k=>digest(p[k]))||!/^sha256:[a-f0-9]{64}$/.test(p.candidateImageDigest??'')||p.candidateImageDigest===IMAGE)fail('QUALIFICATION_BINDING');
 if(![p.notBeforeMs,p.expiresAtMs,now].every(Number.isSafeInteger)||p.notBeforeMs>now||p.expiresAtMs<=now||p.expiresAtMs-p.notBeforeMs>LIMITS.batchMs)fail('QUALIFICATION_EXPIRED');
 if(origin(p.controlOrigin)===origin(p.productionControlOrigin)||!['releaseBindingSha256','candidatePolicySha256','productionPolicySha256','methodSha256'].every(k=>digest(p[k]))||p.candidatePolicySha256===p.productionPolicySha256)fail('QUALIFICATION_ISOLATION');
 if(!digest(p.collectorSha256)||typeof p.candidateLogGroup!=='string'||! /^\/aws\/bedrock-agentcore\/runtimes\/[A-Za-z0-9_-]{1,200}$/.test(p.candidateLogGroup))fail('QUALIFICATION_COLLECTOR');
 if(!Array.isArray(p.cases)||p.cases.length!==5)fail('QUALIFICATION_CASES');const requests=new Set(),runs=new Set(),conversations=new Set();
 for(const [i,c]of p.cases.entries()){
  closed(c,['id','binding','requestId','sessionCredentialFile','nativeCredentialFile','nativeReceiptFile']);
  closed(c.binding,['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence']);
  if(c.id!==PAIRS[i].id||!uuid(c.requestId)||c.binding.writerFence!==1||!['conversationId','runId','attemptId','workerId'].every(k=>uuid(c.binding[k]))||!['tenantId','actorId'].every(k=>typeof c.binding[k]==='string'&&c.binding[k].length>0&&c.binding[k].length<=128)||!['sessionCredentialFile','nativeCredentialFile','nativeReceiptFile'].every(k=>isAbsolute(c[k]??'')))fail('QUALIFICATION_CASE');
  if(requests.has(c.requestId)||runs.has(c.binding.runId)||conversations.has(c.binding.conversationId))fail('QUALIFICATION_DUPLICATE');requests.add(c.requestId);runs.add(c.binding.runId);conversations.add(c.binding.conversationId);
  if(i&&['tenantId','actorId'].some(k=>c.binding[k]!==p.cases[0].binding[k]))fail('QUALIFICATION_SUBJECT');
 }
 parseRuntimeManifest(p.runtimeManifest,now);if(canonical(manifestFor(p))!==p.runtimeManifest||p.allocationSha256!==sha(p.runtimeManifest))fail('QUALIFICATION_MANIFEST_COMMITMENT');return p;
}
export const selectionFor=id=>PAIRS.find(p=>p.id===id)?.selection??fail('QUALIFICATION_CASE');
export const requestFor=c=>({requestId:c.requestId,prompt:PROMPT,modelSelection:selectionFor(c.id)});
export function privateRead(path,max=131072){const stat=lstatSync(path);if(!isAbsolute(path)||!stat.isFile()||stat.isSymbolicLink()||stat.size>max)fail('QUALIFICATION_FILE');return readFileSync(path);}
export function readPlan(path){return validatePlan(JSON.parse(privateRead(path)));}
export function credential(path){const value=privateRead(path,8192).toString('utf8').trim();if(!/^[A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(value))fail('QUALIFICATION_CREDENTIAL');return value;}
/** Exclusive create before effects; a crashed/unknown allocation is never automatically resumed. */
export function journal(path){const fd=openSync(path,'wx',0o600);let closed=false;return {append(value){if(closed)fail('QUALIFICATION_JOURNAL_CLOSED');writeSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd);},close(){if(!closed){closed=true;closeSync(fd);}}};}
export const selectionEqual=(a,b)=>a?.provider===b.provider&&a?.modelId===b.modelId&&a?.effort===b.effort;
