/** Borrowed-pool transaction discipline shared by the Objective run-start (D7-4) and reader-replay stores. It is the same
 * contract the custody adapter (postgres-custody.mjs) applies inline: one bounded READ COMMITTED transaction per call, local
 * statement/lock timeouts, a cancelled or late connect disposed (never returned to the pool), rollback only after a fully
 * settled pre-commit semantic failure, and every write whose COMMIT was sent but not provably settled and released reported
 * as ACK_UNKNOWN. Import performs no connection and nothing here ends the pool. */
import {types} from 'node:util';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';

/** `unavailable()` and `unknown()` build the caller's closed errors; `semantic` lists the codes a body may throw that keep
 * their identity (for example a conflict) when no COMMIT was sent. */
export function createObjectivePostgresTransactions({connect,now,maxRequestMs,unavailable,unknown,semantic=[]}){
 if(typeof connect!=='function'||typeof now!=='function'||types.isProxy(now)||typeof unavailable!=='function'||typeof unknown!=='function'||
    !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000||!Array.isArray(semantic))throw unavailable();
 const refuse=()=>{throw unavailable();};
 const keep=new Set([...semantic,unknown().code]);
 function lifetime(signal){
  nativeSignal(signal);let previous=now();if(!Number.isSafeInteger(previous)||previous<0)refuse();const deadlineMs=previous+maxRequestMs;
  const clock=()=>{const current=now();if(!Number.isSafeInteger(current)||current<previous)refuse();previous=current;return current;};
  return Object.freeze({...createOperationLifetime({now:clock,signal,deadlineMs,errorFactory:unavailable}),now:clock,deadlineMs});
 }
 async function transaction(life,writes,body){
  const slot={client:null,released:false,abandoned:false};let query,release,begun=false,poisoned=false,commitSent=false,commitSettled=false,committed=false,releaseFailed=false,reusable=false,failure,result;
  function dispose(error){
   if(!slot.client||slot.released)return;slot.released=true;
   try{(release??storageMethod(slot.client,'release'))(error);}catch{releaseFailed=true;
    try{Promise.resolve(storageMethod(slot.client,'end')()).catch(()=>{});}catch{/* a malformed borrowed client stays unavailable */}}
  }
  const outcomeUnknown=()=>writes&&commitSent&&(!commitSettled||committed);
  const pending=Promise.resolve().then(()=>{life.check();return connect();}).then(client=>{slot.client=client;if(slot.abandoned)dispose(unavailable());return client;});
  pending.catch(()=>{});
  async function q(text,values=[]){
   life.check();const remaining=Math.max(1,Math.ceil(life.deadlineMs-life.now()));
   try{return await life.run(async()=>{
    life.check();if(text==='COMMIT')commitSent=true;
    const answer=await query({text,values,query_timeout:remaining});
    if(!answer||!Array.isArray(answer.rows))refuse();
    if(text==='COMMIT'){commitSettled=answer.command==='COMMIT'||answer.command==='ROLLBACK';committed=answer.command==='COMMIT';if(!committed)refuse();}
    return answer;
   });}catch(error){poisoned=true;throw error;}
  }
  try{
   const client=await life.run(()=>pending);life.check();query=storageMethod(client,'query');release=storageMethod(client,'release');
   await q('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
   const timeout=String(Math.max(1,Math.ceil(life.deadlineMs-life.now())))+'ms';
   await q("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",[timeout,timeout]);
   result=await body(q);life.check();await q('COMMIT');life.check();reusable=true;
  }catch(error){
   failure=outcomeUnknown()?unknown():keep.has(error?.code)?error:unavailable();
   if(begun&&!commitSent&&!poisoned){try{life.check();await q('ROLLBACK');reusable=true;}catch{}}
  }finally{slot.abandoned=true;dispose(reusable?undefined:failure??unavailable());}
  if(failure)throw failure;
  try{if(releaseFailed)refuse();life.check();}catch{throw outcomeUnknown()?unknown():unavailable();}
  return result;
 }
 async function operation(signal,run){const life=lifetime(signal);try{return await run(life);}finally{life.close();}}
 return Object.freeze({lifetime,transaction,operation});
}

/** Shared fixed helpers over a transaction's query function. */
export const advisory=(q,key)=>q('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
export async function databaseNow(q,refuse){
 const rows=(await q('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS now_ms')).rows;
 if(!Array.isArray(rows)||rows.length!==1)refuse();const value=rows[0].now_ms;
 if(typeof value!=='string'||!/^(?:0|[1-9][0-9]*)$/u.test(value)||!Number.isSafeInteger(Number(value)))refuse();return Number(value);
}
