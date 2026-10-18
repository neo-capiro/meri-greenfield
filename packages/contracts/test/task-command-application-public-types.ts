import {receiveTaskCommandRequest,receiveTaskCommandResponse,taskCommandMetadata,taskCommandPaths,type TaskUpdateRaw,type TaskCommandExpectedBinding,type TaskCommandPrepareRequest,type TaskCommandPrepareResponse,type TaskCommandExecuteResponse,type TaskCommandErrorResponse} from '@capiro/meri-contracts/task-command-application';
const raw:TaskUpdateRaw={taskId:'id',title:'Updated',status:'open',dueDate:null};
const prepare:TaskCommandPrepareRequest=await receiveTaskCommandRequest('prepare',JSON.stringify({arguments:raw}));
const binding:TaskCommandExpectedBinding={tenantId:'tenant',actorId:'actor',conversationId:'id',runId:'id'};
const p=await receiveTaskCommandResponse('prepare',200,'{}',{binding,request:prepare});
const exact:TaskCommandPrepareResponse|TaskCommandErrorResponse=p;void exact;
if(!('error'in p)){const response=await receiveTaskCommandResponse('execute',200,'{}',{binding,proposal:p.proposal});const observed:TaskCommandExecuteResponse|TaskCommandErrorResponse=response;if(!('error'in observed)&&observed.status==='observed'){const id:string=observed.outcome.result.id;void id;}await receiveTaskCommandRequest('execute',JSON.stringify({proposal:p.proposal}));}
const path:'/api/task-commands/prepare'=taskCommandPaths.prepare,status:503=taskCommandMetadata.errorStatuses.TASK_COMMAND_UNAVAILABLE;void path;void status;
// @ts-expect-error receiving a response never issues an approval
const approved:{approved:true}=p;void approved;
// @ts-expect-error independent context and selected request/proposal are required
await receiveTaskCommandResponse('prepare',200,'{}');
// @ts-expect-error prepare needs original raw request, not selected proposal
await receiveTaskCommandResponse('prepare',200,'{}',{binding,proposal:{}});
// @ts-expect-error fixed two-route application has no approve route
await receiveTaskCommandRequest('approve','{}');
// @ts-expect-error exact HTTP vocabulary is closed
const wrong:TaskCommandErrorResponse={error:{code:'NOT_A_COMMAND_ERROR',outcome:'UNKNOWN'}};void wrong;
