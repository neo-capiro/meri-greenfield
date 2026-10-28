import {receiveRunIndexRequest,receiveRunIndexResponse,type RunIndexDetailRequest,type RunIndexListRequest} from '@capiro/meri-contracts/conversation-history';
const bytes=new Uint8Array();
const list=receiveRunIndexRequest('list',bytes);
const request:RunIndexListRequest=list;
const response=receiveRunIndexResponse('list',200,bytes,list);
if(!('error' in response)){const count:number=response.runs.length;void count;}
const detail=receiveRunIndexRequest('detail',bytes);
const typed:RunIndexDetailRequest=detail;
// @ts-expect-error Ordinary unbranded input cannot be substituted for an admitted request.
receiveRunIndexResponse('list',200,bytes,request);
// @ts-expect-error A detail request is not a list request.
receiveRunIndexResponse('list',200,bytes,detail);
void typed;
