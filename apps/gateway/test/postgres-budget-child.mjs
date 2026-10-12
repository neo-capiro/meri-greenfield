// Fixed native-test child. Importing is inert; no shell, server or provider.
import { pathToFileURL } from 'node:url';
import { parseNativeAdmission, openNativePool, verifyDatabase, active } from './postgres-budget-native-fixture.mjs';

export async function runChild() {
  const admission=parseNativeAdmission({...process.env});
  if(process.env.MERI_BUDGET_PG_CHILD_RUN!=='reserve' || !process.connected || typeof process.send!=='function')
    throw Error('BUDGET_CHILD_ADMISSION_REQUIRED');
  const owner=await openNativePool(admission);
  let timer;
  try {
    await verifyDatabase(owner.pool,admission);
    const message=await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>reject(Error('CHILD_INPUT_TIMEOUT')),Math.min(10000,admission.workDeadlineMs-Date.now()));
      process.once('message',resolve);process.send({kind:'ready'});
    });
    clearTimeout(timer);active(admission);
    if(!message || JSON.stringify(message).length>65536 || Object.keys(message).sort().join(',')!=='allocationJson,invocationJson,reserve')
      throw Error('CHILD_INPUT_REFUSED');
    const {createPostgresToolBudget}=await import('../budget/postgres-tool-budget.mjs');
    const bound=createPostgresToolBudget({pool:owner.pool,allocationJson:message.allocationJson}).forInvocation(message.invocationJson);
    try {
      await bound.reserve(message.reserve);
      process.send({kind:'result',outcome:'reserved'});
    } catch(error) {
      if(error?.constructor?.name!=='BudgetStateDenied')throw error;
      process.send({kind:'result',outcome:'denied'});
    }
  } finally {clearTimeout(timer);await owner.close();if(process.connected)process.disconnect();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  runChild().catch(()=>{process.stderr.write('BUDGET_NATIVE_CHILD_FAILED\n');process.exitCode=1;if(process.connected)process.disconnect();});
}
