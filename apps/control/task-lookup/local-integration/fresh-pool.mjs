/** One explicitly owned reconnect pool; late acquisition is still owned cleanup work. */
import assert from 'node:assert/strict';
import {options,method} from '../binding.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const failure=code=>Object.assign(new Error(code),{code});
export function createFreshPoolOwner({openFreshPool,originalPool,deadlineMs,signal}){
 assert.equal(typeof openFreshPool,'function');let acquired,opening=false,attempted=false,closed=false,closing,closedCount=0,cleanupUnknown=false;
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
   assert(!attempted&&!closed,'fresh pool is single acquisition');
   if(signal?.aborted||Date.now()>=deadlineMs)throw failure('DEADLINE');
   attempted=true;opening=true;
   try{
    const value=await openFreshPool();
    // Retain the safe cleanup callback before rejecting other wrapper fields.
    const close=method(value,'close');
    const port=Object.getOwnPropertyDescriptor(value,'pool');
    if(port&&Object.hasOwn(port,'value')&&port.value===originalPool)throw failure('LOCAL_BORROWED_POOL');
    acquired={pool:port&&Object.hasOwn(port,'value')?port.value:undefined,close};
    try{const checked=options(value,['pool','close']);assert(checked.pool!==null&&typeof checked.pool==='object','fresh pool port required');}
    catch(error){await closeOne();throw error;}
    if(closed||signal?.aborted||Date.now()>=deadlineMs){await closeOne();throw failure('DEADLINE');}
    return acquired.pool;
   }finally{opening=false;}
  },
  async close(){closed=true;await closeOne();},
  state(){return Object.freeze({acquisitionPending:opening,ownedFreshPoolsClosed:closedCount,freshPoolCleanupUnknown:cleanupUnknown});},
 });
}
