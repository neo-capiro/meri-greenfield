/** Canonical real routines service/HTTP responses over the existing scripted SQL/Core/Temporal fixture. */
import {applicationFixture,routineRequest} from '../../../apps/control/schedules/test/application-fixture.mjs';
import {createRoutinesApplication,ROUTINE_PATHS} from '../../../apps/control/schedules/application-http.mjs';
export async function routinesPublicFixture(options){
 const f=await applicationFixture(options),app=createRoutinesApplication({service:f.service,now:f.now,limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const exchange=async(route,request,{method='POST',credential=f.session.credential,headers={}}={})=>{
  const response=await app.handle(new Request('https://synthetic.invalid'+ROUTINE_PATHS[route],{method,headers:{...(credential===null?{}:{authorization:'Bearer '+credential}),'content-type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(request)}:{})}));
  const text=await response.text();return {status:response.status,text,json:JSON.parse(text)};
 };
 return {...f,exchange,routineRequest};
}
export async function routinesPublicExamples(){
 const f=await routinesPublicFixture();try{
  const prepareRequest={requestId:'routine-review-example',operation:'schedule_task',request:routineRequest()},prepared=await f.exchange('prepare',prepareRequest);
  const reconcileRequest={operation:'schedule_task',request:prepareRequest.request,proposalId:prepared.json.proposal.proposalId,intentSha256:prepared.json.proposal.intentSha256};
  const before=await f.exchange('reconcile',reconcileRequest),approveRequest={...reconcileRequest,decision:'approved'},approved=await f.exchange('approve',approveRequest),listed=await f.exchange('list',{}),after=await f.exchange('reconcile',reconcileRequest);
  return {prepare:{request:prepareRequest,...prepared},approve:{request:approveRequest,...approved},list:{request:{},...listed},reconcileBefore:{request:reconcileRequest,...before},reconcileAfter:{request:reconcileRequest,...after}};
 }finally{f.close();}
}
