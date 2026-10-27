import {receiveRoutinesRequest,receiveRoutinesResponse,routinesPaths,type RoutinesProposal,type RoutinesApproveResponse,type RoutinesListRequest,type RoutinesListResponse} from '@capiro/meri-contracts/routines-application';
import {receiveRoutineManagementSessionRequest,receiveRoutineManagementSessionReceipt,routineManagementSessionPath,type RoutinesManagementSessionReceipt} from '@capiro/meri-contracts/routines-application';
const selection=receiveRoutineManagementSessionRequest('{"clientId":null}');
const management:RoutinesManagementSessionReceipt=receiveRoutineManagementSessionReceipt('{}',{tenantId:'synthetic',actorId:'synthetic',selectedClientId:selection.clientId},1000);
const kind:'routine-management'=management.kind;void kind;
const managementPath:'/api/routines/session'=routineManagementSessionPath;void managementPath;
// @ts-expect-error a management session has no run authority
void management.context.runId;
// @ts-expect-error a cold management request cannot select a conversation
void selection.conversationId;
const request:RoutinesListRequest=await receiveRoutinesRequest('list','{}');
const result=await receiveRoutinesResponse('list',200,'{}',{request});
if(!('error' in result)){const page:RoutinesListResponse=result;const rows=page.page.rows;void rows;}
const prepare=await receiveRoutinesRequest('prepare','{}');
const prepared=await receiveRoutinesResponse('prepare',200,'{}',{request:prepare});
if(!('error' in prepared)){
 const proposal:RoutinesProposal=prepared.proposal;
 const approve=await receiveRoutinesRequest('approve','{}');
 const response=await receiveRoutinesResponse('approve',200,'{}',{request:approve,proposal});
 if(!('error' in response)){const acknowledged:RoutinesApproveResponse=response;void acknowledged;}
 // @ts-expect-error approval requires its retained reviewed proposal
 await receiveRoutinesResponse('approve',200,'{}',{request:approve});
}
const listPath:'/api/routines/list'=routinesPaths.list;void listPath;
// @ts-expect-error scheduling never has a blind execute route
await receiveRoutinesRequest('execute','{}');
