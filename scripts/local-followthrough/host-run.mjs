#!/usr/bin/env node
/** Explicit retained-state host recovery; no services or fixtures imported until --run. */
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function main(args=process.argv.slice(2),write=value=>process.stdout.write(value)){
 if(args.length===1&&args[0]==='--help'){write('Usage: node scripts/local-followthrough/host-run.mjs --run | --help\n--run reconstructs three host/service graphs over retained synthetic SQL state and actual loopback HTTP. No native database/provider. Exit0 success/help; exit1 run failure; exit2 invalid arguments.\n');return 0;}
 if(args.length!==1||args[0]!=='--run'){write('LOCAL_ARGUMENTS_REFUSED\n');return 2;}
 const root=fileURLToPath(new URL('../../',import.meta.url)),previous=process.env.MERI_REVIEW_SOURCE_ROOT;let fixture,result,failed=false;
 try{
  if(previous!==undefined&&resolve(previous)!==resolve(root))throw Error('LOCAL_HOST_CONFIGURATION');process.env.MERI_REVIEW_SOURCE_ROOT=root;
  const [{createLocalActionHostFixture},{runLocalHostRecovery}]=await Promise.all([import('../../apps/control/action-host/local/fixture.mjs'),import('../../apps/control/action-host/local/recovery.mjs')]);
  fixture=await createLocalActionHostFixture({mode:'synthetic-local'});
  result=await runLocalHostRecovery({mode:fixture.mode,openHost:fixture.openHost,approve:fixture.approve,revoke:fixture.revoke,stats:fixture.stats});
 }catch{failed=true;}
 finally{fixture?.close();if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}
 write(JSON.stringify({status:failed?'FAIL':'PASS',mode:'synthetic-local',nativeDatabase:false,productionActivated:false,...(result?{result}:{}),fixtureClosed:fixture?.stats().closed??true})+'\n');return failed?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
