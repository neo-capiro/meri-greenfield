#!/usr/bin/env node
/** Explicit local fixture entry point; importing this module does not execute it. */
import {open} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readLocalActionAdmission} from './admission.mjs';

const usage='Usage: node scripts/local-action/cli.mjs --config PRIVATE_JSON --config-sha256 SHA256 --output NEW_JSON\nExisting isolated synthetic PostgreSQL only. No install, migration, service start or paid call.\nExit codes: 0 checks passed; 1 execution/check failure; 2 usage/admission refused; 3 pg8.23.1 unavailable.\n';
const root=new URL('../../',import.meta.url);
export function passedPersistenceResult(result){
  const names=['reconnect','concurrent-claim','lost-claim-ack','lost-dispatch-ack','lost-result-ack','revoked-read'];
  const cleanup=result?.cleanup;
  return result?.schema==='meri.local-action-persistence/1'&&result.status==='PASS'&&
    result.runtimeQualified===false&&result.sourceTransport==='synthetic-in-process'&&result.databaseRestartTested===false&&
    Array.isArray(result.cases)&&result.cases.length===names.length&&
    result.cases.every((row,index)=>row.name===names[index]&&row.status==='PASS')&&
    cleanup?.acquisitionPending===false&&cleanup.freshPoolCleanupUnknown===false&&
    cleanup.unsettledOperations===0&&cleanup.ownedFreshPoolsClosed===1&&cleanup.borrowedPoolClosed===false;
}
function argumentsFor(argv){
  if(argv.length!==6)return null;
  const result={};
  for(let i=0;i<argv.length;i+=2){
    if(!['--config','--config-sha256','--output'].includes(argv[i])||Object.hasOwn(result,argv[i])||!argv[i+1]||argv[i+1].startsWith('--'))return null;
    result[argv[i]]=argv[i+1];
  }
  return result;
}
export async function main(argv){
  if(argv.length===1&&argv[0]==='--help'){process.stdout.write(usage);return 0;}
  const options=argumentsFor(argv);
  if(!options){process.stderr.write(usage);return 2;}
  let admitted;
  try{admitted=await readLocalActionAdmission({path:options['--config'],sha256:options['--config-sha256']});}
  catch{process.stderr.write('LOCAL_ACTION_ADMISSION_REQUIRED\n');return 2;}
  try{
    const require=createRequire(new URL('apps/control/qualification-sdk-fixture/state/package.json',root));
    if(require('pg/package.json').version!=='8.23.1')throw new Error('UNSUPPORTED_DRIVER');
  }catch{process.stderr.write('LOCAL_ACTION_PG_8_23_1_UNAVAILABLE\n');return 3;}
  let output,opened,result,exitCode=1;
  try{
    // Reserve a fresh private output before opening a database. Never overwrite.
    output=await open(options['--output'],'wx',0o600);
    const [{openNativePool,verifyDatabase},{runLocalActionPersistence},{createLocalActionCaseFactory},{assertTaskLookupStoredBinding}]=await Promise.all([
      import('../../apps/gateway/test/postgres-budget-native-fixture.mjs'),
      import('../../apps/control/task-lookup/local-integration/run-persistence.mjs'),
      import('../../apps/gateway/local-action/case.mjs'),
      import('../../apps/control/task-lookup/index.mjs'),
    ]);
    opened=await openNativePool(admitted.native);
    await verifyDatabase(opened.pool,admitted.native,{empty:true});
    const openFreshPool=async()=>{
      const fresh=await openNativePool(admitted.native);
      try{await verifyDatabase(fresh.pool,admitted.native);return {pool:fresh.pool,close:()=>fresh.close()};}
      catch(error){await fresh.close();throw error;}
    };
    const createCase=createLocalActionCaseFactory({mode:'synthetic-local',assertStoredBinding:assertTaskLookupStoredBinding});
    result=await runLocalActionPersistence({descriptor:admitted.descriptor,pool:opened.pool,openFreshPool,createCase});
    exitCode=passedPersistenceResult(result)?0:1;
  }catch{
    // Driver errors can contain connection data; never serialize them.
    result={status:'LOCAL_ACTION_EXECUTION_FAILED',runtimeQualified:false};
  }finally{
    if(opened){try{await opened.close();}catch{exitCode=1;result={...result,status:'LOCAL_ACTION_POOL_CLEANUP_FAILED',runtimeQualified:false};}}
    if(output){try{await output.writeFile(JSON.stringify(result,null,2)+'\n');await output.sync();}catch{exitCode=1;}finally{try{await output.close();}catch{exitCode=1;}}}
  }
  process.stdout.write(exitCode===0?'LOCAL_ACTION_CHECKS_PASSED\n':'LOCAL_ACTION_EXECUTION_FAILED\n');
  return exitCode;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main(process.argv.slice(2));
