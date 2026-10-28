/** Real session/context/HTTP/lifecycle/SQL owners; scripted external Core and SQL, no network or model. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createActionSessionOwner,routineManagementSessions} from '../../control/action-host/session/owner.mjs';
import {createRoutineManagementContextOwner} from '../../control/schedules/runtime-context.mjs';
import {createRoutineManagementSessionApplication} from '../../control/schedules/management-session-http.mjs';
import {createRoutinesApplication} from '../../control/schedules/application-http.mjs';
import {createRoutinesService} from '../../control/schedules/application.mjs';
import {createPostgresScheduleOwner} from '../../control/schedules/postgres-schedule-owner.mjs';
import {createRoutinesCoreClient,ROUTINES_CORE_ROUTES} from '../native-authority/routines-core-client.mjs';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
function fixture(){
 let at=Date.now(),management;const state={calls:[],queries:[],execution:0,policyStatus:200,currentStatus:200,rewrite:null};const now=()=>at;
 const wire=createRoutinesCoreClient({origin:'https://core.synthetic.invalid',now,maxRequestMs:3000,getServiceSecret:async()=>'synthetic-service',managementCredentials:{nativeCredentialFor:value=>management.nativeCredentialFor(value)},async fetchImpl(url,init){
  assert.equal(init.headers.authorization,'Bearer synthetic-native');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');const body=JSON.parse(init.body);state.calls.push({url,body});
  if(url.endsWith(ROUTINES_CORE_ROUTES.managementCurrent)){if(state.currentStatus!==200)return new Response('{}',{status:state.currentStatus});const selected=body.clientId,current={kind:'routine-management',principal:{tenantId:'tenant',actorId:'actor'},scopes:[{kind:selected===null?'private-user':'client',tenantId:'tenant',resourceId:selected??'actor',policyRevision:body.policyRevision}],selectedClientId:selected,membershipRevision:'a'.repeat(64)};
   const answer={...current,contextRevision:hash(current),checkedAtMs:at,expiresAtMs:at+30000};state.rewrite?.(answer);return Response.json(answer);}
  assert(url.endsWith(ROUTINES_CORE_ROUTES.managementPolicy));assert.equal(body.selectionSha256,hash(body.selection));assert.equal(body.selection.current.binding,undefined);assert(['list_scheduled_tasks','cancel_scheduled_task'].includes(body.selection.operation));
  return state.policyStatus===200?Response.json({authorized:true,selectionSha256:body.selectionSha256,current:body.selection.current,destinationResolution:null,limits:null,checkedAtMs:at,expiresAtMs:at+30000}):new Response('{}',{status:state.policyStatus});
 }});
 const forbidden=()=>{state.execution++;throw Error('execution owner must not be used');};
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:forbidden,resolveContext:forbidden,now,refusals:()=>{},limits:{maxSessions:4,maxRequestMs:3000,maxTtlMs:30000,maxFactBytes:65536},management:{readCurrent:wire.managementCurrent,versions,policyRevision:'policy'}});management=routineManagementSessions(sessions);
 const pool={async connect(){return {async query(sql,values=[]){state.queries.push({sql,values});if(sql.startsWith('SELECT p.projection,p.generation,p.active_intent'))return {rows:[]};if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL'))return {rows:[]};throw Error('unexpected SQL');},release(){}};}};
 const scheduleOwner=createPostgresScheduleOwner({pool}),contextOwner=createRoutineManagementContextOwner({sessions,scheduleOwner,now,newId:()=>id(99),template:{taskId:id(4),version:1,manifestSha256:'c'.repeat(64)},workflow:{taskQueue:'routine-test',workflowIdPrefix:'routine'},policy:{check:wire.managementPolicyCheck},limits:{maxRequestMs:3000,maxFactBytes:65536,retryLimit:0}});
 const connection={withDeadline:(_deadline,fn)=>fn(),withAbortSignal:(_signal,fn)=>fn()},client={connection,getHandle:forbidden};
 const service=createRoutinesService({contextOwner,journalStore:{read:forbidden},proposalReader:{readProposal:forbidden},scheduleOwner,scheduleClient:client,workflowClient:client,scheduleNotFoundError:Error,now,maxRequestMs:3000,retention:{assertServable:forbidden}});
 const issuer=createRoutineManagementSessionApplication({sessions,now,maxRequestMs:3000}),application=createRoutinesApplication({enabled:true,service,now,limits:{maxRequestMs:3000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const routes=createControlRouteApplications({assembly:{async handle(request){return await issuer.handle(request)??application.handle(request);}},candidate:{handle:async()=>null}});
 const post=(path,body,token='synthetic-native')=>routes.public.handle(new Request('http://localhost'+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {state,sessions,management,contextOwner,post,now,advance:ms=>at+=ms,close:()=>sessions.close()};
}
for(const clientId of [null,id(1)])test(`cold ${clientId===null?'General':'client'} public session and empty list require no conversation/model and scope SQL before release`,async()=>{
 const f=fixture();try{const response=await f.post('/api/routines/session',{clientId});assert.equal(response.status,200);const session=await response.json();assert.equal(session.kind,'routine-management');assert.equal(session.context.runId,undefined);
  const listed=await f.post('/api/routines/list',{},session.credential);assert.equal(listed.status,200,JSON.stringify(await listed.clone().json()));assert.deepEqual((await listed.json()).page.rows,[]);assert.equal(f.state.execution,0);
  const query=f.state.queries.find(x=>x.sql.startsWith('SELECT p.projection,p.generation'));assert(query.sql.includes(clientId===null?"projection->'scopes'=$5::jsonb":"projection->'scopes' @> $5::jsonb"));assert.deepEqual(JSON.parse(query.values[4]),[{tenantId:'tenant',kind:clientId===null?'private-user':'client',resourceId:clientId??'actor',policyRevision:'policy'}]);
  assert(f.state.calls.every(call=>!JSON.stringify(call.body).includes('conversationId')));
 }finally{f.close();}
});
test('public boundary admits only exact bootstrap; malformed selectors and absent bearer never reach Core',async()=>{
 const f=fixture();try{for(const path of ['/api/routines/session/extra','/api/routines/execute','/api/clio/routines/management/current'])assert.equal((await f.post(path,{clientId:null})).status,404);
  for(const value of [{},{clientId:null,runId:id(2)},{clientId:null,versions},{clientId:null,policyRevision:'forged'}])assert.equal((await f.post('/api/routines/session',value)).status,400);
  assert.equal((await f.post('/api/routines/session',{clientId:null},'')).status,401);
  assert.equal(f.state.calls.length,0);assert.equal(f.state.execution,0);
 }finally{f.close();}
});
test('cold management denies execution and current-work cancellation before preparation, and real Core refusal releases no list',async()=>{
 const f=fixture();try{const session=await (await f.post('/api/routines/session',{clientId:null})).json(),calls=f.state.calls.length;
  const cancel={scheduleId:id(9),mode:'pause',running:'request_cancel',runs:[],note:'Reviewed'};
  await assert.rejects(f.contextOwner.resolve({credential:session.credential,operation:'cancel_scheduled_task',request:cancel,deadlineMs:f.now()+2000}));assert.equal(f.state.calls.length,calls);
  f.state.policyStatus=403;assert.notEqual((await f.post('/api/routines/list',{},session.credential)).status,200);assert.equal(f.state.queries.length,0);assert.equal(f.state.execution,0);
 }finally{f.close();}
});
test('Core scope/current expiry substitutions refuse; temporary current-owner absence does not mint or renew a session',async()=>{
 const f=fixture();try{f.state.rewrite=r=>r.selectedClientId=id(3);assert.equal((await f.post('/api/routines/session',{clientId:null})).status,403);assert.equal(f.sessions.status().sessions,0);
  f.state.rewrite=null;const session=await (await f.post('/api/routines/session',{clientId:null})).json();f.state.currentStatus=503;assert.notEqual((await f.post('/api/routines/list',{},session.credential)).status,200);assert.equal(f.sessions.status().sessions,1);
  f.state.currentStatus=200;f.advance(30000);assert.notEqual((await f.post('/api/routines/list',{},session.credential)).status,200);assert.equal(f.state.queries.length,0);
 }finally{f.close();}
});
