/** One explicitly owned reconnect pool; late acquisition is still owned cleanup work. */
import assert from 'node:assert/strict';
import {options} from '../binding.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const failure=code=>Object.assign(new Error(code),{code});
export function createFreshPoolOwner({openFreshPool,originalPool,deadlineMs,signal}){
 assert.equal(typeof openFreshPool,'function');let acquired,opening=false,closed=false,closing,closedCount=0,cleanupUnknown=false;
 async function closeOne(){
  if(!acquired)return;
  if(closing)return closing;
  closing=(async()=>{
   const l=createOperationLifetime({deadlineMs:Date.now()+5000,now:Date.now,errorFactory:failure});
   try{await l.run(()=>acquired.close());closedCount++;}catch{cleanupUnknown=true;}finally{if(l.close().unsettledOperations)cleanupUnknown=true;}
  })();return closing;
 }
 return Object.freeze({
  async acquire(){
   assert(!opening&&!acquired&&!closed,'fresh pool is single acquisition');opening=true;
   try{
    const value=await openFreshPool();
    // An owned wrapper must expose close even when the other returned port is invalid.
    acquired=options(value,['pool','close']);assert.equal(typeof acquired.close,'function');
    if(acquired.pool===originalPool){acquired=null;throw failure('LOCAL_BORROWED_POOL');}
    if(closed||signal?.aborted||Date.now()>=deadlineMs){await closeOne();throw failure('DEADLINE');}
    return acquired.pool;
   }finally{opening=false;}
  },
  async close(){closed=true;await closeOne();},
  state(){return Object.freeze({acquisitionPending:opening,ownedFreshPoolsClosed:closedCount,freshPoolCleanupUnknown:cleanupUnknown});},
 });
}
