import {receiveActionResponse,ActionResponseError,type ActionQueryResponse,type ActionDraftResponse,type ActionPrepareResponse,type ActionExecuteResponse} from '@capiro/meri-contracts/action-application';
async function consume(text:unknown){
 const q=await receiveActionResponse('query',200,text);
 if(!('error'in q)){const exact:ActionQueryResponse=q;const recommendations:false=exact.acceptedTasks;console.log(recommendations,exact.observation.result.actions);}
 const d=await receiveActionResponse('draft',200,text);if(!('error'in d)){const exact:ActionDraftResponse=d;console.log(exact.task.title);}
 const p=await receiveActionResponse('prepare',200,text);if(!('error'in p)){const exact:ActionPrepareResponse=p;const pending:'approval_required'=exact.status;console.log(pending);}
 const e=await receiveActionResponse('execute',200,text);if(!('error'in e)){const exact:ActionExecuteResponse=e;if(exact.status==='observed')console.log(exact.outcome.result.id);}
 // @ts-expect-error No approval endpoint.
 await receiveActionResponse('approve',200,text);
 // @ts-expect-error Receiving never issues approvals.
 const approval: {approved:true}=p;
 console.log(approval,new ActionResponseError('invalid'));
}
void consume;
