/** Worker-side canonical host authority adapter: local execution read on the allocator's supplied client, then the
 * bounded Control-owned external authority phase. It returns the exact existing writer callback shape. */
import {createExecutionCurrentnessReader} from '../control/conversations/execution-currentness.mjs';
import {rowRun} from '../control/conversations/boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fault=code=>{throw Object.assign(Error(code),{code});};
const activeRun=state=>['queued','starting','running'].includes(state);
const activePhase=phase=>['launching','started'].includes(phase);
const clientFor=execution=>{const scopes=execution?.scopes;
 if(!Array.isArray(scopes))fault('NATIVE_WORKER_AUTHORITY_REFUSED');
 const priv=scopes.length===1&&scopes[0].kind==='private-user'&&scopes[0].resourceId===execution.binding?.actorId;
 const client=scopes.find(scope=>scope.kind==='client');
 if(!priv&&!client)fault('NATIVE_WORKER_AUTHORITY_REFUSED');
 return priv?null:client.resourceId;
};
export function createNativeWorkerAuthority({pool,remote,now=Date.now,policySha256,maxFreshMs=30000}={}){
 if(typeof pool?.connect!=='function'||typeof remote!=='function'||typeof now!=='function'||typeof policySha256!=='string'||!/^[a-f0-9]{64}$/u.test(policySha256))fault('NATIVE_WORKER_AUTHORITY_CONFIGURATION');
 const reader=createExecutionCurrentnessReader({rowRun,now});
 async function exchange(client,{binding,allocation,originalBinding,signal,deadlineMs,leaseDeadlineMs}={}){
  const nowMs=now();
  try{validateShape('RunBinding',binding);}catch{fault('NATIVE_WORKER_AUTHORITY_REFUSED');}
  if(!Number.isSafeInteger(deadlineMs)&&!Number.isSafeInteger(leaseDeadlineMs))fault('NATIVE_WORKER_AUTHORITY_REFUSED');
  if(Number.isSafeInteger(deadlineMs)&&deadlineMs<=nowMs)fault('NATIVE_WORKER_AUTHORITY_REFUSED');
  if(Number.isSafeInteger(leaseDeadlineMs)&&leaseDeadlineMs<=nowMs)fault('NATIVE_WORKER_AUTHORITY_REFUSED');
  if(originalBinding!==undefined&&hash(originalBinding)!==hash(binding))fault('NATIVE_WORKER_AUTHORITY_REFUSED');
  const life=createOperationLifetime({deadlineMs:Math.min(...[deadlineMs,leaseDeadlineMs,nowMs+maxFreshMs].filter(Number.isSafeInteger)),now,signal,
   errorFactory:code=>Object.assign(Error(code),{code:code==='DEADLINE'?'NATIVE_WORKER_AUTHORITY_DEADLINE':
    code==='CANCELLED'?'NATIVE_WORKER_AUTHORITY_CANCELLED':'NATIVE_WORKER_AUTHORITY_REFUSED'})});
  try{
   const execution=await life.run(s=>reader.readCurrentOnClient(client,{binding,signal:s,deadlineMs:life.deadline()}));
   life.check();
   if(!execution||hash(execution.binding)!==hash(binding)||!activeRun(execution.run?.state)||!activePhase(execution.executionPhase)||
    !Number.isSafeInteger(execution.deadlineMs)||execution.deadlineMs<=now())fault('NATIVE_WORKER_AUTHORITY_REFUSED');
   const selectedClientId=clientFor(execution);
   const authority=await life.run(s=>remote({binding,selectedClientId,expectedPolicySha256:policySha256,
    deadlineMs:life.deadline(),signal:s}));
   life.check();
   let checked;try{checked=own(data(authority),['binding','selectedClientId','policySha256','currentUntilMs']);}catch{fault('NATIVE_WORKER_AUTHORITY_REFUSED');}
   if(hash(checked.binding)!==hash(binding)||checked.selectedClientId!==selectedClientId||
    checked.policySha256!==policySha256||!Number.isSafeInteger(checked.currentUntilMs)||
    checked.currentUntilMs<=now())fault('NATIVE_WORKER_AUTHORITY_REFUSED');
   const currentUntilMs=Math.min(checked.currentUntilMs,life.deadline(),execution.deadlineMs,
    ...(Number.isSafeInteger(allocation?.leaseDeadlineMs)?[allocation.leaseDeadlineMs]:[]));
   life.check();
   if(!Number.isSafeInteger(currentUntilMs)||currentUntilMs<=now())fault('NATIVE_WORKER_AUTHORITY_REFUSED');
   if(allocation!==undefined)return Object.freeze({currentUntilMs,allocation,binding});
   return Object.freeze({binding,selectedClientId,policySha256,currentUntilMs,executionDeadlineMs:execution.deadlineMs});
  }finally{life.close();}
 }
 return Object.freeze({
  async verifyInTransaction(client,value){return exchange(client,value);},
  async preflight({binding,signal,deadlineMs}){let client,connecting,tainted;const nowMs=now();
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,nowMs+maxFreshMs),now,signal,
    errorFactory:code=>Object.assign(Error(code),{code:code==='DEADLINE'?'NATIVE_WORKER_AUTHORITY_DEADLINE':
     code==='CANCELLED'?'NATIVE_WORKER_AUTHORITY_CANCELLED':'NATIVE_WORKER_AUTHORITY_REFUSED'})});
   let begun=false;
   try{
    connecting=pool.connect();
    const pending=Promise.resolve(connecting).then(value=>{
     if(life.signal.aborted){try{value.release();}catch{}throw life.signal.reason;}
     return value;
    });
    client=await life.run(()=>pending);
    await life.run(()=>client.query('BEGIN'));begun=true;
    await life.run(()=>client.query('SELECT meri_host_control.lock_conversation_admission($1,$2)',[binding.tenantId,binding.conversationId]));
    const current=await exchange(client,{binding,signal:life.signal,deadlineMs:life.deadline()});
    await life.run(()=>client.query('COMMIT'));begun=false;return current;
   }catch(error){
    tainted=error;
    if(client&&begun){
     // Cleanup owns its OWN bounded lifetime: the caller's aborted lifetime cannot time out a rollback, and a
     // noncooperative ROLLBACK may not hold this operation open. Uncertainty stays explicit and the original
     // failure is preserved as the rejection reason.
     let cleaned=false;
     try{
      const cleanup=createOperationLifetime({now,deadlineMs:now()+1000,
       errorFactory:code=>Object.assign(Error('NATIVE_WORKER_AUTHORITY_CLEANUP'),{code:'NATIVE_WORKER_AUTHORITY_CLEANUP',cause:code})});
      try{await cleanup.run(()=>client.query('ROLLBACK'));cleaned=true;}
      finally{cleanup.close();}
     }catch(cleanupError){tainted=Object.assign(error,{cleanupUnknown:true,cause:cleanupError});}
     if(!cleaned)tainted=tainted??error;
    }
    throw error;
   }finally{
    const unsettled=life.close();
    if(client){const error=tainted??(unsettled.unsettledOperations>0?Error('NATIVE_WORKER_AUTHORITY_CLEANUP'):undefined);
     try{client.release(error);}catch{}}
   }
  }
 });
}
