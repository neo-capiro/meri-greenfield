import {receiveIntentsRequest,receiveIntentsResponse,intentsMetadata,intentsPaths,type IntentsListRequest,type IntentsDecideRequest,type IntentsListResponse,type IntentsDecideResponse,type IntentsErrorResponse,type IntentsItem} from '@capiro/meri-contracts/intents-application';
const list:IntentsListRequest=await receiveIntentsRequest('list',JSON.stringify({conversationId:'id'}));
const decide:IntentsDecideRequest=await receiveIntentsRequest('decide','{}');
const listed=await receiveIntentsResponse('list',200,'{}',{request:list});
const exactList:IntentsListResponse|IntentsErrorResponse=listed;void exactList;
if(!('error'in listed))for(const item of listed.intents){const entry:IntentsItem=item;if(entry.state==='prepared'&&entry.kind==='proposal'&&!('withheld'in entry)){const phase:'awaiting_approval'|'approved'|'rejected'|'expired'|'executing'|'completed'|'unknown'|'unknown_decision'=entry.phase;void phase;}}
const decided=await receiveIntentsResponse('decide',200,'{}',{request:decide});
const exactDecide:IntentsDecideResponse|IntentsErrorResponse=decided;void exactDecide;
if(!('error'in decided)&&decided.status==='executed'){const commandSha256:string=decided.outcome.receipt.commandSha256;void commandSha256;}
const path:'/api/conversations/intents/decide'=intentsPaths.decide,status:409=intentsMetadata.errorStatuses.INTENT_EXPIRED,action:'task.create'=intentsMetadata.approvableActions[0];void path;void status;void action;
// @ts-expect-error receiving a response never issues an approval
const approved:{approved:true}=decided;void approved;
// @ts-expect-error the captured request is mandatory
await receiveIntentsResponse('decide',200,'{}');
// @ts-expect-error the contract has exactly two routes and no approve or execute route
await receiveIntentsRequest('approve','{}');
// @ts-expect-error the decision vocabulary is closed
const bad:IntentsDecideRequest={conversationId:'id',deliveryId:'sdk:x',proposalId:'id',commandSha256:'x',decision:'maybe'};void bad;
// @ts-expect-error the exact HTTP vocabulary is closed
const wrong:IntentsErrorResponse={error:{code:'NOT_AN_INTENT_ERROR'}};void wrong;
