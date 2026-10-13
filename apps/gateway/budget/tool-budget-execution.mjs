/** Trusted application execution composition. No request may supply executable ports. */
import {createHash} from 'node:crypto';
import {createDispatchLifetime} from '../dispatch/dispatch-lifetime.mjs';
import {deny} from '../dispatch/operation-result.mjs';
import {deliveryRecord} from './tool-invocation-record.mjs';
import {allocation,invocation,assertAuthority} from './tool-budget-binding.mjs';

export function composeBudgetExecution({owner,producer,allocationJson,authority:currentAuthority,limits,now,createExecutor,requestIdentity=raw=>raw}){
 const a=allocation(allocationJson);
 if(typeof createExecutor!=='function'||typeof requestIdentity!=='function')deny('GATEWAY_CONFIGURATION');
 async function execute(requestJson,credential,trustedInvocationJson,signal,produced){
  const i=invocation(trustedInvocationJson,a);
  if(typeof credential!=='string')deny('ACCESS_DENIED');
  const credentialSha256=createHash('sha256').update(credential).digest('hex');
  const bound=produced??owner.forInvocation(trustedInvocationJson);let current,limitDeadline;
  const narrow=(publish,deadline)=>{produced?.limitDeadline(deadline);publish(deadline);};
  const verify=value=>{if(bound.deadlineMs()!==undefined&&now()>=bound.deadlineMs())deny('DEADLINE');try{assertAuthority(i,value.claims,credentialSha256);}catch{deny('ACCESS_DENIED');}return value;};
  const authority={
   async identify(call){narrow(call.limitDeadline,Date.parse(a.schedule.expiresAt));
    const value=verify(await currentAuthority.identify({...call,limitDeadline:next=>narrow(call.limitDeadline,next)}));
    if(produced)produced.limitDeadline(Math.min(value.run.deadlineMs,Date.parse(value.claims.expiresAt)));return value;},
   async check(call){limitDeadline=next=>narrow(call.limitDeadline,next);
    if(bound.deadlineMs()!==undefined)limitDeadline(bound.deadlineMs());
    // Commands have no identify phase; the same trusted schedule applies here too.
    limitDeadline(Date.parse(a.schedule.expiresAt));
    current=verify(await currentAuthority.check({...call,limitDeadline}));
    if(produced)produced.limitDeadline(current.deadlineMs);return current;},
  };
  const protect=action=>async(...args)=>{try{return await action(...args);}catch{deny('BUDGET_UNCERTAIN');}};
  const budget={
   reserve:protect(call=>bound.reserve({...call,claims:current.claims,limitDeadline:next=>{call.limitDeadline?.(next);limitDeadline(next);}})),
   settle:protect(call=>{if(produced&&call.deadlineMs!==undefined)produced.limitDeadline(call.deadlineMs);return bound.settle(call);}),
   markUncertain:protect((id,cleanup)=>bound.markUncertain(id,cleanup?()=>{
    const at=now();if(cleanup.signal?.aborted||!Number.isSafeInteger(at)||!Number.isSafeInteger(cleanup.deadlineMs)||at>=cleanup.deadlineMs)deny('DEADLINE');
   }:undefined)),
   // Available only on a trusted producer-owned invocation, never model arguments.
   ...(produced?{observe:protect(call=>bound.observe(call)),recheck:protect(call=>bound.recheck(call))}:{}),
  };
  const executor=createExecutor({authority,budget});
  return executor.execute(requestJson,credential,signal);
 }
 async function owned(requestJson,credential,deliveryJson,signal,dispatch){
  const identity=requestIdentity(requestJson),delivery=deliveryRecord(deliveryJson,identity,a);
  if(dispatch&&(typeof credential!=='string'||createHash('sha256').update(credential).digest('hex')!==delivery.context.capabilitySha256))deny('ACCESS_DENIED');
  const deadlineMs=Math.min(now()+limits.maxRequestMs,Date.parse(a.schedule.expiresAt));
  const lifetime=createDispatchLifetime({deadlineMs,now,signal});
  try{
   const prepared=await lifetime.run(signal=>producer.prepare(deliveryJson,identity,{signal,deadlineMs}));lifetime.check();
   if(!dispatch)return prepared;lifetime.limitDeadline(prepared.deadlineMs);
   const bound=producer.bind(prepared.invocationJson,deliveryJson,identity,Math.min(prepared.deadlineMs,deadlineMs));
   return await lifetime.run(signal=>execute(requestJson,credential,prepared.invocationJson,signal,bound));
  }finally{lifetime.close();}
 }
 return Object.freeze({
  bindTrustedGrant:owner.bindTrustedGrant,readInvocationOutcome:owner.readInvocationOutcome,readCompletion:owner.readCompletion,
  execute:(requestJson,credential,invocationJson,signal)=>execute(requestJson,credential,invocationJson,signal),
  prepareInvocation:(deliveryJson,requestJson,signal)=>owned(requestJson,null,deliveryJson,signal,false),
  executeOwned:(requestJson,credential,deliveryJson,signal)=>owned(requestJson,credential,deliveryJson,signal,true),
  reconcileInvocation:(deliveryJson,requestJson)=>owner.reconcileInvocation(deliveryJson,requestIdentity(requestJson)),
  async discover(){return [];},
 });
}
