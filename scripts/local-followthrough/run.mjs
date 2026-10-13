#!/usr/bin/env node
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function main(args=process.argv.slice(2),write=value=>process.stdout.write(value)){
 if(args.length===1&&args[0]==='--help'){write('Usage: node scripts/local-followthrough/run.mjs --run | --help\n--run executes a bounded synthetic Request/Response workflow; no listener or real database.\n');return 0;}
 if(args.length!==1||args[0]!=='--run'){write('LOCAL_ARGUMENTS_REFUSED\n');return 2;}
 let demo;const root=fileURLToPath(new URL('../../',import.meta.url)),previous=process.env.MERI_REVIEW_SOURCE_ROOT;
 try{
  if(previous!==undefined&&resolve(previous)!==resolve(root))throw new Error('LOCAL_CONFIGURATION');
  process.env.MERI_REVIEW_SOURCE_ROOT=root;
  const {createLocalActionDemo}=await import('../../apps/control/action-application/local/demo.mjs');
  const {runLocalActionFlow}=await import('../../apps/control/action-application/local/flow.mjs');
  demo=await createLocalActionDemo({mode:'synthetic-local',ttlMs:10000});
  const result=await runLocalActionFlow(demo);demo.close();write(JSON.stringify({...result,cleanup:demo.stats()})+'\n');return 0;
 }catch{write(JSON.stringify({status:'FAIL',code:'LOCAL_FLOW_REFUSED',nativeDatabase:false,productionActivated:false})+'\n');return 1;}
 finally{demo?.close();if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
