import {types} from 'node:util';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {snapshotScheduleCall,assertScheduleAuthority,frozenScheduleData,canonicalSha256,denySchedule,scheduleErrorCode} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {createTemporalScheduleInspector} from './temporal-inspection.mjs';
import {mutateTemporalSchedule,sdkMethod} from './temporal-schedule-mutations.mjs';
import {inspectOriginalRuns} from './temporal-run-history.mjs';
import {createPostgresScheduleOwner} from './postgres-schedule-owner.mjs';
import {snapshotScheduleInspectionBinding} from '../../../packages/contracts/schedules-0.2/inspection-validation.mjs';

function optionsData(options,allowed) {
  if(!options||types.isProxy(options)||Object.getPrototypeOf(options)!==Object.prototype)denySchedule('SCHEDULE_OPTIONS');
  const out={};for(const name of Reflect.ownKeys(options)) {
    const d=Object.getOwnPropertyDescriptor(options,name);
    if(!allowed.includes(name)||!d?.enumerable||!Object.hasOwn(d,'value'))denySchedule('SCHEDULE_OPTIONS');out[name]=d.value;
  }return out;
}
export function createScheduleLifecycle(options) {
  const {scheduleClient,workflowClient,scheduleOwner,authorize,runCancellation,clock=Date.now}=optionsData(options,['scheduleClient','workflowClient','scheduleOwner','authorize','clock','runCancellation']);
  const cancelRuns=runCancellation===undefined?undefined:sdkMethod(runCancellation,'cancel');
  if(typeof authorize!=='function'||typeof clock!=='function')denySchedule('SCHEDULE_OPTIONS');
  const owner=Object.fromEntries(['claim','markDispatching','commitKnown','markUnknown','list'].map(k=>[k,sdkMethod(scheduleOwner,k)]));
  // Connections are explicitly trusted borrowed SDK objects; no client is created/closed.
  const scheduleConnection=scheduleClient.connection,workflowConnection=workflowClient.connection;
  function callLifetime(kind,request) {
    const raw=optionsData(request,kind==='Execute'?['intent','approval','callerIdentity','deadlineMs','signal']:['selection','callerIdentity','deadlineMs','signal']);
    const {signal,...data}=raw;
    if(signal!==undefined&&(types.isProxy(signal)||!(signal instanceof AbortSignal)))denySchedule('SCHEDULE_SIGNAL');
    const binding=snapshotScheduleCall(kind,data,clock());let deadline=binding.deadlineMs;
    const lifetime=createOperationLifetime({deadlineMs:deadline,now:clock,signal,errorFactory:code=>Object.assign(new Error(code),{code})});
    const limitDeadline=ms=>{lifetime.limitDeadline(ms);deadline=Math.min(deadline,ms);};
    try{if(kind==='Execute')limitDeadline(Date.parse(binding.approval.expiresAt));}catch(error){lifetime.close();throw error;}
    async function current(phase,resource=null) {
      const bound=resource===null?binding:frozenScheduleData({...binding,resource,bindingSha256:canonicalSha256({bindingSha256:binding.bindingSha256,resource})});
      const receipt=await lifetime.run(signal=>authorize({phase,binding:bound,signal,limitDeadline}));
      limitDeadline(assertScheduleAuthority(receipt,bound).expiresAtMs);lifetime.check();return receipt;
    }
    async function rpc(connection,phase,action,resource=null) {
      await current(phase,resource);
      return lifetime.run(signal=>sdkMethod(connection,'withDeadline')(deadline,()=>{
        lifetime.check();return sdkMethod(connection,'withAbortSignal')(signal,()=>{lifetime.check();return action();});
      }));
    }
    return {binding,lifetime,current,rpc,deadline:()=>deadline};
  }
  async function execute(request) {
    const c=callLifetime('Execute',request),{binding,lifetime,current}=c;
    let admissionStarted=false,claimed=false,acknowledged=false;
    function receipt(value,state) {
      const r=frozenScheduleData(value);
      if(Object.keys(r).length!==3||r.intentId!==binding.intent.intentId||r.bindingSha256!==binding.bindingSha256||r.state!==state)denySchedule('SCHEDULE_OWNER_RECEIPT');
    }
    try {
      await current('before_claim');admissionStarted=true;
      receipt(await lifetime.run(()=>owner.claim(binding,lifetime.check)),'CLAIMED');claimed=true;
      await current('before_dispatch');
      receipt(await lifetime.run(()=>owner.markDispatching(binding,lifetime.check)),'DISPATCHING');
      await mutateTemporalSchedule({scheduleClient,workflowClient,binding,lifetime,...(cancelRuns===undefined?{}:{cancelRuns:()=>cancelRuns({binding,signal:lifetime.signal,deadlineMs:c.deadline()})}),effect:(phase,fn)=>c.rpc(phase==='cancel_run'?workflowConnection:scheduleConnection,`before_${phase}`,fn)});
      receipt(await lifetime.run(()=>owner.commitKnown(binding,lifetime.check)),'ACKNOWLEDGED');acknowledged=true;
      await current('before_release');lifetime.check();
      return frozenScheduleData({operation:binding.intent.operation,intentId:binding.intent.intentId,generation:binding.intent.generation,projection:binding.intent.projection,outcome:'ACKNOWLEDGED',physicalStopProven:false});
    } catch(error) {
      // If the lifetime already expired, CLAIMED/DISPATCHING itself remains a
      // durable unresolved barrier. Never launch unbounded cleanup after expiry.
      if(claimed&&!acknowledged)try{lifetime.check();await lifetime.run(()=>owner.markUnknown(binding,lifetime.check));}catch{}
      const code=['DEADLINE','CANCELLED'].includes(scheduleErrorCode(error))?scheduleErrorCode(error):'SCHEDULE_FAILED';
      throw Object.assign(new Error(code),{code,outcome:acknowledged?'ACKNOWLEDGED_NOT_RELEASED':admissionStarted?'UNKNOWN':'NOT_DISPATCHED',intentId:binding.intent.intentId});
    } finally {lifetime.close();}
  }
  async function list(request) {
    const c=callLifetime('List',request),{binding,lifetime,current}=c,s=binding.selection;
    try {
      await current('before_list');const page=frozenScheduleData(await lifetime.run(()=>owner.list(s,lifetime.check)));
      if(Object.keys(page).length!==2||!Array.isArray(page.rows)||page.rows.length>s.limit||typeof page.hasMore!=='boolean'||(page.hasMore&&page.rows.length!==s.limit))denySchedule('SCHEDULE_LIST');
      const rows=[],refs=[],seen=new Set();let previous=s.afterScheduleId?.toLowerCase()??null;
      for(const row of page.rows) {
        const p=row.projection;
        snapshotScheduleInspectionBinding({projection:p,callerIdentity:binding.callerIdentity,deadlineMs:c.deadline()},clock());
        const key=p.scheduleId.toLowerCase();
        if(Object.keys(row).length!==3||!Number.isSafeInteger(row.generation)||row.generation<0||typeof row.unresolved!=='boolean'||canonicalSha256(p.owner)!==canonicalSha256(s.owner)||(previous!==null&&key<=previous)||seen.has(key))denySchedule('SCHEDULE_LIST');
        previous=key;seen.add(key);
        let authorizationFailed=false;
        const inspector=createTemporalScheduleInspector({scheduleClient,clock,authorize:async args=>{
          try {
            args.limitDeadline(c.deadline());const a=await current(args.phase,p);args.limitDeadline(a.expiresAtMs);
            return {authorized:true,projectionSha256:args.projectionSha256,callerIdentity:binding.callerIdentity,expiresAtMs:a.expiresAtMs};
          } catch(error) {authorizationFailed=true;throw error;}
        }});
        // Cancelled means application state only; still inspect the exact ID.
        // Missing Temporal or unresolved rows are explicit, never hidden/empty.
        let inspection;
        try {inspection=await lifetime.run(signal=>inspector.inspect({projection:p,callerIdentity:binding.callerIdentity,deadlineMs:c.deadline(),signal}));}
        catch(error) {
          lifetime.check();
          if(authorizationFailed||scheduleErrorCode(error)!=='SCHEDULE_INSPECTION_FAILED')throw error;
          await current('before_unavailable_row_release',p);inspection=null;
        }
        rows.push({...row,inspection,inspectionState:inspection===null?'unavailable':'observed'});
        if(inspection!==null)for(const action of inspection.temporal.recentActions)refs.push(action.workflow);
      }
      const originalRuns=await inspectOriginalRuns({workflowClient,references:refs,limit:s.historyLimit,lifetime,read:(phase,fn)=>c.rpc(workflowConnection,phase,fn,{selection:s,originalReferences:refs.slice(0,s.historyLimit)})});
      await current('before_release');lifetime.check();
      return frozenScheduleData({operation:s.operation,rows,hasMore:page.hasMore,nextAfterScheduleId:page.hasMore&&rows.length?rows.at(-1).projection.scheduleId:null,originalRuns,coverage:{complete:false,currentRetryVerified:false}});
    } catch(error) {
      const code=['DEADLINE','CANCELLED'].includes(scheduleErrorCode(error))?scheduleErrorCode(error):'SCHEDULE_FAILED';
      throw Object.assign(new Error(code),{code});
    } finally {lifetime.close();}
  }
  return Object.freeze({execute,list});
}

/** Concrete composition; caller applies the reviewed migration separately. */
export function createPostgresScheduleLifecycle(options) {
  const {pool,...rest}=optionsData(options,['pool','scheduleClient','workflowClient','authorize','clock']);
  return createScheduleLifecycle({...rest,scheduleOwner:createPostgresScheduleOwner({pool})});
}
