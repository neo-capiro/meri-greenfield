import {receiveIntentsRequest,receiveIntentsResponse,intentsMetadata,intentsPaths,type IntentsListRequest,type IntentsDecideRequest,type IntentsListResponse,type IntentsDecideResponse,type IntentsErrorResponse,type IntentsItem,type IntentsProposal} from '@capiro/meri-contracts/intents-application';
const list:IntentsListRequest=await receiveIntentsRequest('list',JSON.stringify({conversationId:'id'}));
const decide:IntentsDecideRequest=await receiveIntentsRequest('decide','{}');
const listed=await receiveIntentsResponse('list',200,'{}',{request:list});
const exactList:IntentsListResponse|IntentsErrorResponse=listed;void exactList;
let retained:IntentsProposal|undefined;
if(!('error'in listed))for(const item of listed.intents){const entry:IntentsItem=item;if(entry.state==='prepared'&&entry.kind==='proposal'&&!('withheld'in entry)){retained=entry.proposal;const phase:'awaiting_approval'|'approved'|'rejected'|'expired'|'executing'|'completed'|'unknown'|'unknown_decision'=entry.phase;void phase;}}
if(retained===undefined)throw new Error('no proposal admitted');
const decided=await receiveIntentsResponse('decide',200,'{}',{request:decide,proposal:retained});
const exactDecide:IntentsDecideResponse|IntentsErrorResponse=decided;void exactDecide;
if(!('error'in decided)&&decided.status==='executed'){
 if('receipt'in decided.outcome){const commandSha256:string=decided.outcome.receipt.commandSha256;void commandSha256;}
 else if('version'in decided.outcome){const versionId:string=decided.outcome.version.versionId;void versionId;}
 else {const kind:'native-task'=decided.outcome.execution.kind;const taskId:string=decided.outcome.result.id;void kind;void taskId;}
}
if(retained.command.action==='task.update'){const taskId:string=retained.command.arguments.taskId;void taskId;}
if(retained.command.action==='document.draft'){
 const kind:'0.2.0'=retained.command.contractVersion,format:'docx'=retained.command.arguments.format;
 const preparation:string=retained.command.arguments.preparationSha256;void kind;void format;void preparation;
 // @ts-expect-error native document approval is not a task
 const taskId:string=retained.command.arguments.taskId;void taskId;
}
const path:'/api/conversations/intents/decide'=intentsPaths.decide,status:409=intentsMetadata.errorStatuses.INTENT_EXPIRED,action:'task.create'=intentsMetadata.approvableActions[0];void path;void status;void action;
// @ts-expect-error receiving a response never issues an approval
const approved:{approved:true}=decided;void approved;
// @ts-expect-error the captured request is mandatory
await receiveIntentsResponse('decide',200,'{}');
// @ts-expect-error a decide answer needs the proposal admitted from an earlier list answer
await receiveIntentsResponse('decide',200,'{}',{request:decide});
// @ts-expect-error the contract has exactly two routes and no approve or execute route
await receiveIntentsRequest('approve','{}');
// @ts-expect-error the decision vocabulary is closed
const bad:IntentsDecideRequest={conversationId:'id',deliveryId:'sdk:x',proposalId:'id',commandSha256:'x',decision:'maybe'};void bad;
// @ts-expect-error the exact HTTP vocabulary is closed
const wrong:IntentsErrorResponse={error:{code:'NOT_AN_INTENT_ERROR'}};void wrong;
