#!/usr/bin/env node
/** Explicit one-shot synthetic flow over real loopback HTTP. */
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function main(args=process.argv.slice(2),write=value=>process.stdout.write(value)){
 if(args.length===1&&args[0]==='--help'){write('Usage: node scripts/local-followthrough/http-run.mjs --run | --help\n--run executes the synthetic flow over 127.0.0.1:ephemeral, closes within 30s; no real database/source.\n');return 0;}
 if(args.length!==1||args[0]!=='--run'){write('LOCAL_ARGUMENTS_REFUSED\n');return 2;}
 const root=fileURLToPath(new URL('../../',import.meta.url)),previous=process.env.MERI_REVIEW_SOURCE_ROOT;let demo,server,result,failed=false;
 try{
  if(previous!==undefined&&resolve(previous)!==resolve(root))throw Error('LOCAL_CONFIGURATION');process.env.MERI_REVIEW_SOURCE_ROOT=root;
  const [{createLocalActionDemo},{runLocalActionFlow},{listenActionApplication}]=await Promise.all([import('../../apps/control/action-application/local/demo.mjs'),import('../../apps/control/action-application/local/flow.mjs'),import('../../apps/control/action-application/node-http.mjs')]);
  demo=await createLocalActionDemo({mode:'synthetic-local',ttlMs:20000});server=await listenActionApplication({app:demo.app,host:'127.0.0.1',port:0,lifetimeMs:25000});
  const app={async handle(request){const path=new URL(request.url).pathname;return fetch(new Request(server.origin+path,request),{redirect:'error'});}};
  result=await runLocalActionFlow({...demo,app});
 }catch{failed=true;}
 finally{await server?.close();demo?.close();if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}
 write(JSON.stringify({status:failed?'FAIL':'PASS',mode:'synthetic-local',transport:'loopback-http',nativeDatabase:false,productionActivated:false,...(result?{stats:result.stats}:{}),cleanup:{http:server?.status()??null,demoClosed:demo?.stats().closed??true}})+'\n');return failed?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
