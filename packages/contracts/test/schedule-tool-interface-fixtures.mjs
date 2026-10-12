import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createScheduleToolValidators} from '../schedules-0.2/tool-interface-validation.mjs';
import {canonicalSha256} from '../validate.mjs';
export const NOW=1900000000000,ID='11111111-1111-4111-8111-111111111111',INTENT='22222222-2222-4222-8222-222222222222';
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
const load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
for(const p of ['../meri.schema.json','../schedules-0.2/lifecycle.schema.json','../schedules-0.2/inspection.schema.json'])ajv.addSchema(load(p));
export const schema=load('../schedules-0.2/tool-interface.schema.json');ajv.addSchema(schema);
export const validators=createScheduleToolValidators({schema,validateShape:(n,v)=>ajv.getSchema(`${schema.$id}#/$defs/${n}`)(v)});
export const identity=()=>({tenantId:'tenant',actorId:'owner'});
export const projection=()=>({scheduleId:ID,owner:identity(),temporalScheduleId:'temporal-owned',timezone:'UTC',scopes:[{tenantId:'tenant',kind:'client',resourceId:'client',policyRevision:'p1'}],state:'active',maxCostMicrousd:50,maxRuntimeSeconds:20,retryLimit:0,destinationId:'resolved-destination',createdAt:new Date(NOW).toISOString()});
export function fixture(operation='schedule_task') {
 const policy={spec:{calendars:[],intervals:[{every:60000,offset:0}],cronExpressions:[],skip:[],startAt:null,endAt:null,jitterMs:0,timezone:'UTC'},overlap:'SKIP',catchupWindowMs:60000,pauseOnFailure:true,remainingActions:null,paused:false,note:'reviewed',runNow:false,runNowOverlap:'ALLOW_ALL'};
 let request={taskInstruction:'Summarize selected scoped records',policy,destinationReference:'My briefing',requestedLimits:{maxCostMicrousd:100,maxRuntimeSeconds:30,retryLimit:1}};
 const c={callerIdentity:{tenantId:'tenant',actorId:'delegate'},requestSha256:'',nowMs:NOW,deadlineMs:NOW+1000,intentId:INTENT,current:null,projection:projection(),taskResolution:{instructionSha256:canonicalSha256(request.taskInstruction),task:{taskId:ID,manifestSha256:'a'.repeat(64),version:1},workflow:{workflowType:'approvedTask',workflowId:'workflow-owned',taskQueue:'owned-queue'}},destinationResolution:{reference:request.destinationReference,destinationId:'resolved-destination'},limitResolution:{requestedSha256:canonicalSha256(request.requestedLimits),effective:{maxCostMicrousd:50,maxRuntimeSeconds:20,retryLimit:0}},approval:null};
 if(operation!=='schedule_task')c.current={projection:projection(),generation:1,projectionSha256:canonicalSha256(projection())};
 if(operation==='update_scheduled_task')request={scheduleId:ID,...request};
 if(operation==='cancel_scheduled_task'){request={scheduleId:ID,mode:'pause',note:'requested',running:'leave',runs:[]};c.projection.state='paused';c.taskResolution=c.destinationResolution=c.limitResolution=null;}
 if(operation==='list_scheduled_tasks'){request={afterScheduleId:null,limit:20,historyLimit:10};const context={scheduleContext:{callerIdentity:c.callerIdentity,requestSha256:canonicalSha256(request),nowMs:NOW,deadlineMs:NOW+1000,owner:identity()}};return {operation,request,context};}
 c.requestSha256=canonicalSha256(request);return {operation,request,context:{scheduleContext:c}};
}
export function approve(f){const p=validators.prepare(f.operation,f.request,f.context);f.context.scheduleContext.approval={proposalId:p.intent.intentId,commandSha256:p.intentSha256,decision:'approved',decidedAt:new Date(NOW-100).toISOString(),expiresAt:new Date(NOW+1000).toISOString(),approver:identity(),policyRevision:'p1'};return f;}
export const authority=q=>({authorized:true,bindingSha256:q.binding.bindingSha256,callerIdentity:q.binding.callerIdentity,expiresAtMs:NOW+1000});
export {canonicalSha256};
