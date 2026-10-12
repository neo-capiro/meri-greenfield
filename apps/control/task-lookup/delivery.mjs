import {types} from 'node:util';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {data,keys,options,method,deny,code,uuid,prepare,readContext,event,observation,authBinding,authReceipt,receipt,retained,delivery,canonicalSha256} from './binding.mjs';
export function createTaskLookupDelivery(configuration){
 const {gateway,store,authorize,clock=Date.now}=options(configuration,['gateway','store','authorize'],['clock']);
 if(typeof authorize!=='function'||typeof clock!=='function')deny('LOOKUP_CONFIGURATION');
 const execute=method(gateway,'executeOwned'),claim=method(store,'claim'),markDispatching=method(store,'markDispatching'),complete=method(store,'complete'),recordError=method(store,'recordError'),readStored=method(store,'read');
 function lifetime(deadlineMs,signal){if(signal!==undefined&&(types.isProxy(signal)||!(signal instanceof AbortSignal)))deny('LOOKUP_DATA');return createOperationLifetime({deadlineMs,now:clock,signal,errorFactory:c=>Object.assign(new Error(c),{code:c})});}
 async function authority(l,phase,b){const a=await l.run(signal=>authorize({phase,binding:b,signal,limitDeadline:l.limitDeadline}));l.limitDeadline(authReceipt(a,b).expiresAtMs);}
 async function lookup(value){
  let l,b,started,claimed=false,journalAttempted=false,dispatching=false,stored=false;
  try{
   const {request,context,credential,signal}=options(value,['request','context','credential'],['signal']);
   b=prepare(request,context,clock());if(typeof credential!=='string')deny('LOOKUP_DATA');l=lifetime(b.context.deadlineMs,signal);
   const auth=hash=>authBinding(b,b.context.binding,b.context.scopes,b.context.resultReference,hash);
   await authority(l,'before_claim',auth(null));started=event(b,'tool.started',clock());
   journalAttempted=true;receipt(await l.run(()=>claim(b,started,l.check)),b,'CLAIMED');claimed=true;
   await authority(l,'before_dispatch',auth(null));receipt(await l.run(()=>markDispatching(b,l.check)),b,'DISPATCHING');dispatching=true;
   const raw=await l.run(signal=>execute(JSON.stringify(b.request),credential,b.context.deliveryJson,signal));
   const result=observation(raw,b),hash=canonicalSha256(result);await authority(l,'before_store',auth(hash));
   const record=data({binding:b,observation:result,resultSha256:hash,events:[started,event(b,'tool.completed',clock(),b.context.resultReference)]});
   receipt(await l.run(()=>complete(b,record,l.check)),b,'RESULT');stored=true;
   await authority(l,'before_release',auth(hash));l.check();return delivery(record);
  }catch(error){
   const safe=['DEADLINE','CANCELLED','ACCESS_DENIED','LOOKUP_REPLAY'].includes(code(error))?code(error):'LOOKUP_UNAVAILABLE';
   let events; // Never publish after revocation/cancellation, or infer a run terminal state.
   if(l&&claimed&&!stored&&!['DEADLINE','CANCELLED','ACCESS_DENIED'].includes(safe))try{
    const failed=event(b,'run.error',clock());receipt(await l.run(()=>recordError(b,failed,l.check)),b,'ERROR');
    await authority(l,'before_error_release',authBinding(b,b.context.binding,b.context.scopes,b.context.resultReference,null));events=data([started,failed]);
   }catch{}
   throw Object.assign(new Error(safe),{code:safe,outcome:stored?'RESULT_NOT_RELEASED':journalAttempted?'UNKNOWN':'NOT_DISPATCHED',...(events?{events}:{})});
  }finally{l?.close();}
 }
 async function read(value){
  let l;try{
   const {resultReference,context,signal}=options(value,['resultReference','context'],['signal']);
   uuid(resultReference);const c=readContext(context,clock());l=lifetime(c.deadlineMs,signal);
   await authority(l,'before_read',authBinding(null,c.currentBinding,c.scopes,resultReference,null));
   const record=retained(await l.run(()=>readStored({tenantId:c.currentBinding.tenantId,resultReference},l.check)));
   if(record.binding.context.binding.tenantId!==c.currentBinding.tenantId||record.binding.context.resultReference!==resultReference)deny('ACCESS_DENIED');
   await authority(l,'before_release',authBinding(record.binding,c.currentBinding,c.scopes,resultReference,record.resultSha256));l.check();return delivery(record,true);
  }catch(error){const safe=['DEADLINE','CANCELLED','ACCESS_DENIED'].includes(code(error))?code(error):'LOOKUP_UNAVAILABLE';throw Object.assign(new Error(safe),{code:safe,outcome:'NOT_DISPATCHED'});}finally{l?.close();}
 }
 return Object.freeze({lookup,read});
}
