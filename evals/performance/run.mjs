#!/usr/bin/env node
/** 10-concurrent-run performance harness over the scripted loopback application. LOCAL_FIXTURE; readiness stays UNRUN without a live probe. */
import {open,realpath} from 'node:fs/promises';import {constants} from 'node:fs';import {resolve,dirname} from 'node:path';import {pathToFileURL} from 'node:url';
import {createScriptedConversationApplication,syntheticPrincipal} from '../offline-targets/conversation-application.mjs';
import {measureAcknowledgement} from './acknowledgement.mjs';
import {measureReadiness} from './readiness.mjs';
import {buildReport,THRESHOLDS} from './report.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const principalsFor=count=>Array.from({length:count},(_,i)=>syntheticPrincipal({tenantId:'tenant-perf',actorId:`actor-perf-${i+1}`,tag:'9e4f',ordinal:i+1}));
export async function runPerformanceHarness({now=Date.now,concurrency=THRESHOLDS.concurrency,rounds=3,readinessProbe=null}={}){
 const principals=principalsFor(concurrency*rounds),target=await createScriptedConversationApplication({principals,now,ttlMs:120000});
 try{const credentials=new Map();for(const p of principals)credentials.set(p,await target.issue(p));
  const acknowledgement=await measureAcknowledgement({target,principals,credentials,concurrency,rounds});
  const readiness=await measureReadiness({probe:readinessProbe});
  return buildReport({acknowledgement,readiness,generatedAt:new Date(now()).toISOString()});
 }finally{target.close();}
}
const HELP=`Usage: node evals/performance/run.mjs --output NEWFILE [--rounds N (1-50, default 3)]
Submits ${THRESHOLDS.concurrency} concurrent requests per round, each opening a fresh conversation, against the scripted loopback application and reports nearest-rank p50/p95 UI acknowledgement beside the ${THRESHOLDS.acknowledgementP95Ms} ms threshold.
Fresh-task readiness (${THRESHOLDS.readinessP95Ms} ms threshold) is reported UNRUN: it needs the live isolated-worker probe, which this CLI never fabricates.
Exit 0: acknowledgement within threshold on the local fixture; exit 1: exceeded or failed submissions; exit 2: invalid arguments or I/O. LOCAL_FIXTURE only; no performance gate is satisfied.\n`;
async function write(path,value){const absolute=resolve(path),parent=dirname(absolute);if(await realpath(parent)!==parent)fail('PERFORMANCE_PATH_SYMLINK');
 const handle=await open(absolute,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await handle.close();}}
export async function main(args,{stdout=process.stdout,stderr=process.stderr,run=runPerformanceHarness}={}){
 if(args.length===1&&['--help','-h'].includes(args[0])){stdout.write(HELP);return 0;}
 const flags={};for(let i=0;i<args.length;i+=2){const key=args[i]?.startsWith('--')?args[i].slice(2):null;if(!['output','rounds'].includes(key)||Object.hasOwn(flags,key)||typeof args[i+1]!=='string'||!args[i+1]){stderr.write(JSON.stringify({error:'PERFORMANCE_CLI_ARGUMENTS'})+'\n');return 2;}flags[key]=args[i+1];}
 const rounds=flags.rounds===undefined?3:Number(flags.rounds);if(!flags.output||!Number.isSafeInteger(rounds)||rounds<1||rounds>50){stderr.write(JSON.stringify({error:'PERFORMANCE_CLI_ARGUMENTS'})+'\n');return 2;}
 try{const report=await run({rounds});await write(flags.output,report);
  stdout.write(JSON.stringify({schema:report.schema,label:report.label,acknowledgementP95Ms:report.acknowledgement.p95Ms,readiness:report.readiness.state,gates:report.gates})+'\n');return report.acknowledgement.withinThreshold?0:1;}
 catch(error){stderr.write(JSON.stringify({error:typeof error?.code==='string'?error.code:'PERFORMANCE_RUN_ERROR'})+'\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main(process.argv.slice(2));
