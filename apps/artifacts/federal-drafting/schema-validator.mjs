/** Bounded adapter for the pinned local Python validator; process custody stays with artifacts. */
import {mkdtemp,rm} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runArtifactProcess} from '../process.mjs';
import {textSha256,DRAFT_LIMITS} from './engine.mjs';
import {assertSchemaReceipt} from '../../../packages/contracts/federal-workbench/schema-receipt.mjs';

const program=fileURLToPath(new URL('./uslm-schema/schema_validator.py',import.meta.url));
const unavailable='DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE';
const fault=code=>Object.assign(Error(code),{code});
const inputRefusals=new Set(['SOURCE_HASH_MISMATCH','INVALID_UTF8_SCALARS','INPUT_BYTE_BOUND','INVALID_UTF8',
 'INVALID_XML_ENCODING','UNSUPPORTED_ENCODING','DTD_OR_ENTITY_FORBIDDEN','MALFORMED_XML',
 'UNSUPPORTED_ROOT_NAMESPACE_OR_PROFILE','UNSUPPORTED_PROFILE','SCHEMA_INVALID']);
const processRefusals=new Set(['ARTIFACT_CANCELLED','ARTIFACT_DEADLINE','ARTIFACT_CLEANUP_FAILED']);
const parse=bytes=>{if(!Buffer.isBuffer(bytes)||bytes.length>4096)throw fault(unavailable);
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fault(unavailable);}};

export function createFederalSchemaValidator({pythonExecutable,tempRoot}){
 if(![pythonExecutable,tempRoot].every(value=>typeof value==='string'&&isAbsolute(value)&&!value.includes('\0')))
  throw fault('ARTIFACT_CONFIGURATION');
 return Object.freeze({async validate(text,{deadlineMs,signal}={}){
  if(typeof text!=='string'||!text.length||text.includes('\0')||Buffer.from(text,'utf8').toString('utf8')!==text||Buffer.byteLength(text,'utf8')>DRAFT_LIMITS.sourceBytes)
   throw fault('DRAFT_SCHEMA_INVALID');
  if(!Number.isSafeInteger(deadlineMs))throw fault(unavailable);
  if(signal?.aborted)throw fault('ARTIFACT_CANCELLED');
  if(Date.now()>=deadlineMs)throw fault('ARTIFACT_DEADLINE');
  const sourceSha256=textSha256(text),bytes=Buffer.byteLength(text,'utf8');
  let dir;
  try{
   dir=await mkdtemp(join(tempRoot,'meri-federal-schema-'));
   let run;
   try{run=await runArtifactProcess(pythonExecutable,['-I','-B',program],{cwd:dir,
    input:Buffer.from(JSON.stringify({text,sha256:sourceSha256}),'utf8'),signal,
    deadlineMs:Math.min(deadlineMs,Date.now()+30000),maxOutput:4096});}
   catch(error){
    if(processRefusals.has(error?.code))throw fault(error.code);
    // Only a settled validator refusal is interpretable; never attach process output to product errors.
    if(error?.code==='ARTIFACT_PROCESS_FAILED'&&error.receipt?.exitCode===1){
     const result=parse(error.stdout);
     if(result&&Object.keys(result).sort().join(',')==='code,valid'&&result.valid===false&&inputRefusals.has(result.code))throw fault('DRAFT_SCHEMA_INVALID');
    }
    throw fault(unavailable);
   }
   const result=parse(run.stdout);
   try{assertSchemaReceipt(result,sourceSha256,bytes);}catch{throw fault(unavailable);}
   if(signal?.aborted)throw fault('ARTIFACT_CANCELLED');
   if(Date.now()>=deadlineMs)throw fault('ARTIFACT_DEADLINE');
   return Object.freeze(result);
  }catch(error){if(processRefusals.has(error?.code)||error?.code==='DRAFT_SCHEMA_INVALID'||error?.code===unavailable)throw error;throw fault(unavailable);}
  finally{if(dir)try{await rm(dir,{recursive:true,force:true});}catch{throw fault('ARTIFACT_CLEANUP_FAILED');}}
 }});
}
