#!/usr/bin/env node
/** Local JSON evaluation only; no corpus/source/provider acquisition. */
import {open,lstat,realpath} from 'node:fs/promises';import {constants} from 'node:fs';import {resolve,dirname} from 'node:path';import {pathToFileURL} from 'node:url';
import {freezeCorpus,verifyCorpus,runnerCases} from './corpus.mjs';import {scoreObservations} from './score.mjs';import {hash,digest,error} from './contracts.mjs';
const HELP=`Usage:
  node evals/task-lookup/cli.mjs freeze --input FILE --approval-sha256 SHA --output NEWFILE
  node evals/task-lookup/cli.mjs runner --corpus FILE --corpus-sha256 SHA --split development|calibration|held-out --output NEWFILE
  node evals/task-lookup/cli.mjs score --corpus FILE --corpus-sha256 SHA --observations FILE --output NEWFILE
Pins are canonical JSON SHA256; corpus pin is frozen.corpusSha256. Files <=16MiB, regular and local, no symlink parents, output exclusive mode0600.
Exit0: accepted freeze/runner or all supplied cases satisfied; exit1: score has failed/missing/skipped/ineligible/foreign cases or empty cohort; exit2: invalid input/I/O.
No acquisition, authority authentication, runtime execution or release-gate acceptance occurs.\n`;
async function ordinary(path){const absolute=resolve(path);if(await realpath(absolute)!==absolute)error('EVAL_PATH_SYMLINK');return absolute;}
async function read(path){const absolute=await ordinary(path),f=await open(absolute,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=await f.stat();if(!s.isFile()||s.size>16*1024*1024)error('EVAL_FILE_BOUND');const bytes=await f.readFile();if(bytes.length>16*1024*1024)error('EVAL_FILE_BOUND');return JSON.parse(bytes.toString('utf8'));}finally{await f.close();}}
async function write(path,value){const absolute=resolve(path);await ordinary(dirname(absolute));const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');if(bytes.length>16*1024*1024)error('EVAL_FILE_BOUND');const f=await open(absolute,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(bytes);}finally{await f.close();}}
export async function main(args,{stdout=process.stdout,stderr=process.stderr}={}){
 if(args.length===1&&['--help','-h'].includes(args[0])){stdout.write(HELP);return 0;}
 try{
  const [command,...rest]=args,expected={freeze:['input','approval-sha256','output'],runner:['corpus','corpus-sha256','split','output'],score:['corpus','corpus-sha256','observations','output']}[command];if(!expected||rest.length!==expected.length*2)error('EVAL_CLI_ARGUMENTS');
  const flags={};for(let i=0;i<rest.length;i+=2){const key=rest[i].slice(2);if(!rest[i].startsWith('--')||!expected.includes(key)||Object.hasOwn(flags,key)||typeof rest[i+1]!=='string'||!rest[i+1])error('EVAL_CLI_ARGUMENTS');flags[key]=rest[i+1];}
  let result,exit=0;
  if(command==='freeze')result=freezeCorpus(await read(flags.input),{approvalSha256:flags['approval-sha256']});
  else {digest(flags['corpus-sha256']);const frozen=verifyCorpus(await read(flags.corpus));if(frozen.corpusSha256!==flags['corpus-sha256'])error('EVAL_EXTERNAL_CORPUS_PIN');
   if(command==='runner')result=runnerCases(frozen,{split:flags.split});else{result=scoreObservations(frozen,await read(flags.observations));if(!result.observationSetValid||!result.counts.total||result.counts.passed!==result.counts.total)exit=1;}}
  await write(flags.output,result);stdout.write(JSON.stringify({schema:result.schema,sha256:hash(result),counts:result.counts??null,qualification:'UNQUALIFIED'})+'\n');return exit;
 }catch(e){stderr.write(JSON.stringify({error:typeof e.code==='string'?e.code:'EVAL_INPUT_ERROR'})+'\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main(process.argv.slice(2));
