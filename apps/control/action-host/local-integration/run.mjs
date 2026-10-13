/** Pool admission/provisioning belongs to the caller. This module never opens a driver itself. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {receiveActionResponse} from '../../../../packages/contracts/dist/action-application.mjs';
import {PostgresBudgetStore} from '../../../gateway/budget/postgres-budget-store.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {runLocalHostRecovery} from '../local/recovery.mjs';
export async function readLocalApplicationAccounting({pool,ownedRows,check=()=>{}}){
 return new PostgresBudgetStore(pool).transact(async client=>{
  await new PostgresBudgetStore(pool).lock(client);check();const rows=(await client.query('SELECT * FROM meri_qualification.tool_run_allocations WHERE run_id=$1',[ownedRows.runId])).rows;check();
  const bindings=(await client.query('SELECT * FROM meri_qualification.tool_grant_bindings WHERE grant_id=ANY($1::uuid[])',[[ownedRows.readGrantId,ownedRows.commandGrantId]])).rows;check();
  const reservations=(await client.query('SELECT * FROM meri_qualification.tool_reservations WHERE run_id=$1',[ownedRows.runId])).rows;check();
  if(rows.length!==1||rows[0].allocation_sha256!==ownedRows.allocationSha256||bindings.length!==2||bindings.some(r=>r.facts.allocationSha256!==ownedRows.allocationSha256)||reservations.length!==2||reservations.some(r=>r.state!=='SETTLED'||String(r.charged_micro_usd)!=='10')||new Set(reservations.map(r=>r.grant_id)).size!==2)throw Error('LOCAL_ACCOUNTING_REFUSED');
  return data({kind:'database-readback',runId:ownedRows.runId,allocationSha256:ownedRows.allocationSha256,allocations:1,grants:2,reservations:2,chargedMicroUsd:'20'});
 },check);
}
export async function runLocalApplication(options){
 const {caseOwner,initialPool,openFreshPool,deadlineMs=Date.now()+30000,signal}=own(options,['caseOwner','initialPool','openFreshPool'],['deadlineMs','signal']);if(!Number.isSafeInteger(deadlineMs)||deadlineMs>Date.now()+30000)throw Error('LOCAL_CONFIGURATION');if(typeof openFreshPool!=='function')throw Error('LOCAL_CONFIGURATION');let count=0;const life=createOperationLifetime({deadlineMs,now:Date.now,signal,errorFactory:c=>new Error(c)}),seen=new Set([initialPool]);
 const boundedClose=async close=>{const cleanup=createOperationLifetime({deadlineMs:Date.now()+1000,now:Date.now,errorFactory:c=>new Error(c)});try{await cleanup.run(()=>close());}finally{cleanup.close();}};
 try{
 const result=await life.run(()=>runLocalHostRecovery({mode:'synthetic-local',deadlineMs,signal:life.signal,approve:caseOwner.approve,revoke:caseOwner.revoke,stats:caseOwner.stats,receiveResponse:receiveActionResponse,
  async openHost(call){life.check();if(count++===0)return caseOwner.openHost({pool:initialPool});const acquired=own(await openFreshPool({...call,deadlineMs:Math.min(call.deadlineMs,deadlineMs),signal:life.signal}),['pool','close']);if(typeof acquired.close!=='function'||!acquired.pool||seen.has(acquired.pool))throw Error('LOCAL_POOL_OWNER');seen.add(acquired.pool);let closed=false;const close=()=>{if(closed)return;closed=true;return boundedClose(acquired.close);};try{life.check();return await caseOwner.openHost({pool:acquired.pool,closeGraph:close});}catch(error){await close();throw error;}}
 }));
 return data({kind:'local-application-recovery',receiver:'public-action-response',recovery:result,accounting:await life.run(()=>readLocalApplicationAccounting({pool:initialPool,ownedRows:caseOwner.ownedRows,check:life.check}))});
 }finally{life.close();}
}
