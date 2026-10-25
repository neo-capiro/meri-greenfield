import {receiveRoutinesRequest,receiveRoutinesResponse,routinesPaths,type RoutinesProposal,type RoutinesApproveResponse,type RoutinesListRequest,type RoutinesListResponse} from '@capiro/meri-contracts/routines-application';
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
