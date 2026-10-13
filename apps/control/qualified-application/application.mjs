/** Executable owned-fixture assembly; no database, process, listener or model I/O on import. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateQualificationGrantSet} from '../../gateway/index.mjs';
import {admittedHostConfiguration} from '../admitted-runs/mount-core.mjs';
import {createQualificationActionHost} from './mount.mjs';
import {createQualificationLifecycleBridge,validateQualificationLifecycleConfiguration} from './lifecycle-bridge.mjs';
import {prepareOwnedApplicationSchema,verifyOwnedApplicationSchema} from './schema.mjs';

export function createQualificationApplication(configuration){
 const c=own(configuration,['hostConfiguration','source','lifecycleConfiguration','fixture','originalDeadlineMs','now']);
 const host=admittedHostConfiguration(c.hostConfiguration),admission=own(host.admission,['pool','allocationJson','grantFactsJsons']);
 const grants=validateQualificationGrantSet({allocationJson:admission.allocationJson,grantFactsJsons:admission.grantFactsJsons});
 const lookup=own(host.lookup,['pool','credential','scopes']),metadata=own(host.metadata,['pool','preparePolicy']),command=own(host.command,['journalPool','budgetPool','producerContext','approvalStore','contracts','descriptor']);
 const lifecycle=own(c.lifecycleConfiguration,['pythonExecutable','connection','workerObserver','worker','expiresAtMs','limits']);
 if(typeof c.now!=='function'||host.now!==c.now||!Number.isSafeInteger(c.originalDeadlineMs)||c.originalDeadlineMs<=c.now()||lifecycle.expiresAtMs>c.originalDeadlineMs||
    lookup.pool!==admission.pool||metadata.pool!==admission.pool||command.journalPool!==admission.pool||command.budgetPool!==admission.pool)throw Error('QUALIFICATION_APPLICATION_CONFIGURATION');
 const originalDeadlineMs=c.originalDeadlineMs,fixture=data(c.fixture),binding=grants.facts[0].binding;
 const lifecycleOptions={...lifecycle,fixture,allocationJson:admission.allocationJson,grantFactsJsons:admission.grantFactsJsons,originalDeadlineMs,now:c.now};
 validateQualificationLifecycleConfiguration(lifecycleOptions);
 const pool=admission.pool;
 const graph=createQualificationActionHost({hostConfiguration:{...host,admission:{...admission,pool},lookup:{...lookup,pool},metadata:{...metadata,pool},command:{...command,journalPool:pool,budgetPool:pool}},source:c.source});
 let state='NEW',schemaReceipt=null,activeLife=null,owner=null;
 async function open(options,reconstruction){
  const o=own(options,[],reconstruction?['signal']:['signal','prepareSchema']);nativeSignal(o.signal);
  if(state!=='NEW'||!reconstruction&&o.prepareSchema!==undefined&&typeof o.prepareSchema!=='boolean')throw Error('QUALIFICATION_APPLICATION_STATE');
  state='OPENING';let life;
  try{
   life=createOperationLifetime({deadlineMs:originalDeadlineMs,now:c.now,signal:o.signal,errorFactory:code=>Error(code)});activeLife=life;
   const schemaOptions={pool,fixture,deadlineMs:originalDeadlineMs,signal:life.signal,now:c.now};
   schemaReceipt=await life.run(()=>!reconstruction&&o.prepareSchema?prepareOwnedApplicationSchema(schemaOptions):verifyOwnedApplicationSchema(schemaOptions));life.check();
   owner=createQualificationLifecycleBridge({...lifecycleOptions,fixture:{...fixture,schemaSha256:schemaReceipt.schemaSha256}});
   const result=await life.run(()=>owner[reconstruction?'rehydrate':'activate']({signal:life.signal,deadlineMs:originalDeadlineMs}));life.check();
   if(!reconstruction){await life.run(()=>graph.bindReadGrant(life.check));await life.run(()=>graph.bindCommandGrant(life.check));}
   const run=JSON.parse(await life.run(()=>graph.currentRun(binding,{signal:life.signal})));life.limitDeadline(run.deadlineMs);life.check();
   state='READY';return data({mode:'owned-disposable-qualification',productionActivated:false,worker:result,schema:schemaReceipt,fixture:{...fixture,schemaSha256:schemaReceipt.schemaSha256},reconstruction,deadlineMs:run.deadlineMs});
  }catch(error){if(state!=='CLOSED')state='UNKNOWN';throw error;}finally{activeLife=null;life?.close();}
 }
 return Object.freeze({
  app:Object.freeze({handle(request){
   if(state!=='READY'||c.now()>=originalDeadlineMs)return Promise.resolve(new Response(JSON.stringify({error:{code:'UNAVAILABLE',outcome:'NOT_DISPATCHED'}}),{status:503,headers:{'content-type':'application/json'}}));
   return graph.app.handle(request);
  }}),
  initialize:options=>open(options??{},false),reconstruct:options=>open(options??{},true),
  revoke(options){if(!owner||state!=='READY')throw Error('QUALIFICATION_APPLICATION_STATE');return owner.revoke({...own(options??{},[],['signal']),deadlineMs:originalDeadlineMs});},
  close(){state='CLOSED';activeLife?.close();graph.close();},
  status:()=>({state,originalDeadlineMs,sourceEnabled:state==='READY',productionActivated:false,lifecycle:owner?.status()??null,host:graph.status()}),
 });
}
