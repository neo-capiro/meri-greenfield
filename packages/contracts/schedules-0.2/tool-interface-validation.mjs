import {assertScheduleIntent,snapshotScheduleCall,frozenScheduleData,canonicalSha256,denySchedule} from './lifecycle-validation.mjs';

export const SCHEDULE_TOOL_SCHEMA_ID='urn:meri:schedules:tool-interface:0.2.0';
export const SCHEDULE_TOOL_OPERATIONS=Object.freeze(['schedule_task','list_scheduled_tasks','cancel_scheduled_task','update_scheduled_task']);
export const SCHEDULE_TOOL_CONTEXT_KEYS=Object.freeze(['scheduleContext']);
const STEM=Object.freeze({schedule_task:'ScheduleTask',list_scheduled_tasks:'ListScheduledTasks',cancel_scheduled_task:'CancelScheduledTask',update_scheduled_task:'UpdateScheduledTask'});
const LIMITS=Object.freeze(['maxCostMicrousd','maxRuntimeSeconds','retryLimit']);
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const uuid=(a,b)=>a.toLowerCase()===b.toLowerCase();

export function createScheduleToolValidators({validateShape,schema}) {
  if(typeof validateShape!=='function'||schema?.$id!==SCHEDULE_TOOL_SCHEMA_ID)denySchedule('SCHEDULE_TOOL_CONFIGURATION');
  function shape(def,value) {
    const data=frozenScheduleData(value);
    if(!validateShape(def,data))denySchedule('SCHEDULE_TOOL_DATA');return data;
  }
  function stem(id) {if(!Object.hasOwn(STEM,id))denySchedule('SCHEDULE_TOOL_OPERATION');return STEM[id];}
  function normalized(id,raw) {
    const name=stem(id),request=shape(name+'Request',raw);
    const input=id==='list_scheduled_tasks'?{afterScheduleId:request.afterScheduleId??null,limit:request.limit??20,historyLimit:request.historyLimit??10}:request;
    if(id==='schedule_task'||id==='update_scheduled_task')return shape(name+'Input',{...input,taskInstruction:input.taskInstruction.trim(),destinationReference:input.destinationReference.trim()});
    return shape(name+'Input',input);
  }
  function prepare(id,raw,context) {
    const input=normalized(id,raw),outer=frozenScheduleData(context);
    if(Object.keys(outer).length!==1||!Object.hasOwn(outer,'scheduleContext'))denySchedule('SCHEDULE_TOOL_CONTEXT');
    const c=shape(id==='list_scheduled_tasks'?'ScheduleListContext':'ScheduleMutationContext',outer.scheduleContext);
    const requestSha256=canonicalSha256(input);
    if(c.requestSha256!==requestSha256||c.deadlineMs<=c.nowMs||c.deadlineMs-c.nowMs>60000)denySchedule('SCHEDULE_TOOL_BINDING');
    if(id==='list_scheduled_tasks') {
      const selection={operation:id,owner:c.owner,...input};
      snapshotScheduleCall('List',{selection,callerIdentity:c.callerIdentity,deadlineMs:c.deadlineMs},c.nowMs);
      return frozenScheduleData({operation:id,input,requestSha256,context:c,selection});
    }
    const p=c.projection,create=id==='schedule_task';
    if(create ? c.current!==null : c.current===null)denySchedule('SCHEDULE_TOOL_CURRENT');
    if(!create) {
      const previous=c.current.projection;
      if(c.current.projectionSha256!==canonicalSha256(previous)||!uuid(input.scheduleId,previous.scheduleId)||!uuid(p.scheduleId,previous.scheduleId)||!same(p.owner,previous.owner)||p.temporalScheduleId!==previous.temporalScheduleId||p.createdAt!==previous.createdAt)denySchedule('SCHEDULE_TOOL_CURRENT');
    }
    let configuration=null,cancel=null;
    if(id==='cancel_scheduled_task') {
      if(c.taskResolution!==null||c.destinationResolution!==null||c.limitResolution!==null)denySchedule('SCHEDULE_TOOL_RESOLUTION');
      const {scheduleId,...choice}=input;cancel=choice;
      if(!same(p,{...c.current.projection,state:cancel.mode==='delete'?'cancelled':'paused'}))denySchedule('SCHEDULE_TOOL_CURRENT');
    } else {
      if(!c.taskResolution||!c.destinationResolution||!c.limitResolution||c.taskResolution.instructionSha256!==canonicalSha256(input.taskInstruction)||c.destinationResolution.reference!==input.destinationReference||c.destinationResolution.destinationId!==p.destinationId||c.limitResolution.requestedSha256!==canonicalSha256(input.requestedLimits))denySchedule('SCHEDULE_TOOL_RESOLUTION');
      for(const key of LIMITS)if(p[key]!==c.limitResolution.effective[key]||p[key]>input.requestedLimits[key])denySchedule('SCHEDULE_TOOL_LIMITS');
      configuration={...input.policy,task:c.taskResolution.task,workflow:c.taskResolution.workflow};
    }
    const intent=assertScheduleIntent({intentId:c.intentId,operation:id,expectedGeneration:create?0:c.current.generation,generation:create?1:c.current.generation+1,previousProjectionSha256:create?null:c.current.projectionSha256,projection:p,configuration,cancel},c.callerIdentity.tenantId);
    const intentSha256=canonicalSha256(intent);
    if(c.approval!==null)snapshotScheduleCall('Execute',{intent,approval:c.approval,callerIdentity:c.callerIdentity,deadlineMs:c.deadlineMs},c.nowMs);
    const proposal={operation:id,status:'approval_required',proposalId:intent.intentId,intentSha256,taskInstruction:id==='cancel_scheduled_task'?null:input.taskInstruction,projection:p,policy:configuration===null?null:input.policy,cancel};
    return frozenScheduleData({operation:id,input,requestSha256,context:c,intent,intentSha256,proposal});
  }
  function normalizeInput(id,raw,context) {
    const p=prepare(id,raw,context);
    return frozenScheduleData({input:p.input,metadata:{requestSha256:p.requestSha256,...(p.intent?{intentSha256:p.intentSha256,approvalRequired:p.context.approval===null}:{})}});
  }
  function assertResult(id,value,raw,context) {
    const p=prepare(id,raw,context),out=shape(outputDefinition(id),value);
    if(out.operation!==id)denySchedule('SCHEDULE_TOOL_RESULT');
    if(id!=='list_scheduled_tasks') {
      if(out.status==='approval_required') {if(p.context.approval!==null||!same(out,p.proposal))denySchedule('SCHEDULE_TOOL_RESULT');}
      else if(p.context.approval===null||out.receipt.operation!==id||out.receipt.intentId!==p.intent.intentId||out.receipt.generation!==p.intent.generation||!same(out.receipt.projection,p.intent.projection))denySchedule('SCHEDULE_TOOL_RESULT');
    } else {
      const page=out.page,rows=page.rows;
      if(rows.length>p.input.limit||(page.hasMore&&rows.length!==p.input.limit)||page.nextAfterScheduleId!==(page.hasMore?rows.at(-1)?.projection.scheduleId??null:null))denySchedule('SCHEDULE_TOOL_RESULT');
      let previous=p.input.afterScheduleId?.toLowerCase()??null,observed=0;
      for(const row of rows) {
        const key=row.projection.scheduleId.toLowerCase();
        if(!same(row.projection.owner,p.context.owner)||row.projection.scopes.some(s=>s.tenantId!==p.context.callerIdentity.tenantId)||(previous!==null&&key<=previous))denySchedule('SCHEDULE_TOOL_RESULT');previous=key;
        if(row.inspection===null) {if(row.inspectionState!=='unavailable')denySchedule('SCHEDULE_TOOL_RESULT');}
        else {
          if(row.inspectionState!=='observed'||!same(row.inspection.projection,row.projection)||row.inspection.projectionSha256!==canonicalSha256(row.projection))denySchedule('SCHEDULE_TOOL_RESULT');
          observed+=row.inspection.temporal.recentActions.length;
        }
      }
      const h=page.originalRuns,c=h.coverage;
      if(h.executions.length>p.input.historyLimit||c.returned!==h.executions.length||c.observedReferences!==observed||c.omitted!==observed-c.returned)denySchedule('SCHEDULE_TOOL_RESULT');
      const refs=rows.flatMap(r=>r.inspection?.temporal.recentActions.map(a=>a.workflow)??[]).slice(0,p.input.historyLimit);
      if(h.executions.length!==refs.length||h.executions.some((r,i)=>r.workflowId!==refs[i].workflowId||r.runId!==refs[i].firstExecutionRunId))denySchedule('SCHEDULE_TOOL_RESULT');
    }
    return out;
  }
  function outputDefinition(id) {stem(id);return id==='list_scheduled_tasks'?'ListScheduledTasksOutput':'ScheduleMutationOutput';}
  return Object.freeze({normalizeInput,assertResult,prepare,inputDefinition:id=>stem(id)+'Input',requestDefinition:id=>stem(id)+'Request',outputDefinition});
}
