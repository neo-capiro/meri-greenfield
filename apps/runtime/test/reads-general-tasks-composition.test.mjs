/** Real discovery, composer, original source adapter and public result validation; synthetic Core HTTP. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions,id} from '../../control/conversations/test/store-fixture.mjs';

const now=Date.parse('2026-10-25T00:00:00.000Z'),stamp=new Date(now).toISOString();
const operation={id:'query_tasks',version:'0.2.0'},other={id:'query_action_items',version:'0.2.0'};
const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'policy1'}];
function task(clientId,taskId,dueDate=null){
 const row={id:taskId,title:'Synthetic visible task',body:null,status:'todo',ownerUserId:binding.actorId,dueDate,
  clientId,clientName:'Synthetic visible client',meetingId:null,meetingTitle:null,contactId:null,mailThreadId:null,
  sourceType:null,sourceId:null,createdByUserId:binding.actorId,createdAt:stamp,updatedAt:stamp};
 return {...row,overdue:dueDate!==null&&Date.parse(dueDate)<now,recordKind:'native_task',recommendation:false,
  nativeCompletion:{completed:false,evidence:null,establishesDeliveryOrAcceptance:false,note:'Native status only.'},
  sourceProof:{version:1,owner:'engagement_tasks',sourceRecordId:taskId,currentClientId:clientId,sourceVersion:stamp,
   contentSha256:createHash('sha256').update(JSON.stringify(row)).digest('hex'),linkedSources:[]}};
}
async function fixture(){
 const calls=[];let denied=false,revoked=false,after,mutate,clock=now;
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:now+10000,
  runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[operation,other],maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:['operational-reads'],now:()=>clock,newId:()=>id(80),
  nativeCredentials:{async nativeCredentialFor(request){assert.equal(request.selectedClientId,null);return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},
  readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',
  capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:['operational-reads'],activeReadOperations:[operation,other]};}},
  async fetchImpl(url,options){
   assert.equal(new URL(url).pathname,'/api/clio/tools/query_tasks');
   assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
   const input=JSON.parse(options.body);calls.push(input);if(denied)return Response.json({message:'Unavailable'},{status:403});
   const offset=input.cursor?1:0,hasMore=offset===0;
   const page={tool:'query_tasks',generatedAt:new Date(clock).toISOString(),clientId:null,total:2,returned:1,
    tasks:[task(id(70+offset),id(75+offset),input.status==='overdue'?new Date(now-1000).toISOString():null)],
    scope:{kind:'authorized_tasks',tenantId:binding.tenantId,actorUserId:binding.actorId,ownerUserId:input.assignedToMe?binding.actorId:null,
     taskId:null,status:input.status??null,dueBefore:input.dueBefore??(input.status==='overdue'&&input.cursor?stamp:null),offset,limit:1,cursorApplied:offset!==0},
    coverage:{sourceStatus:'healthy',sourceReason:null,complete:false,partial:true,paginationComplete:!hasMore,hasMore,
     nextCursor:hasMore?'OPAQUE_CORE_CURSOR':null,totalIsExactForScope:true,absenceSupported:false,note:'Synthetic bounded page.'}};
   mutate?.(page);after?.();return Response.json(page);
  }});
 const execution={async authenticate(){if(revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return {execution:identity,state:'running',scopes,selectedClientId:null,policyRevision:'policy1'};}};
 const app=composer.createReadsRuntime({execution,binding,approvedReads});
 const request=(kind,value)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(value)});
 async function available(){const response=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));assert.equal(response.status,200);return response.json();}
 async function execute(args={limit:1}){const current=await available();return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation,arguments:args,
  deliveryId:'synthetic',installationId:current.installation.installationId,executionCatalogSha256:current.installation.executionCatalogSha256}));}
 return {available,execute,calls,advance:()=>{clock+=1000;},deny:()=>{denied=true;},afterRevoke:()=>{after=()=>{revoked=true;};},mutate:fn=>{mutate=fn;}};
}
test('General exposes authorized task reads, preserves both client pages and forwards opaque continuation unchanged',async()=>{
 const f=await fixture(),available=await f.available();assert.deepEqual(available.discovery.operations,[operation]);
 const first=await f.execute({limit:1,assignedToMe:true});assert.equal(first.status,200,await first.clone().text());
 const page=JSON.parse((await first.json()).resultJson);assert.equal(page.subject.kind,'personal');assert.deepEqual(page.subject.scopes,scopes);assert.equal(page.subject.rosterVersionId,null);
 assert.equal(page.tasks[0].clientId,id(70));assert.equal(page.scope.kind,'authorized_tasks');
 const next=await f.execute({limit:1,assignedToMe:true,cursor:page.pageCoverage.nextCursor});assert.equal(next.status,200,await next.clone().text());
 assert.equal(JSON.parse((await next.json()).resultJson).tasks[0].clientId,id(71));
 assert.equal(f.calls[1].cursor,'OPAQUE_CORE_CURSOR');assert.equal(f.calls[1].assignedToMe,true);assert.equal(f.calls.length,2);
});
test('General cannot turn a model client selector into a client subject',async()=>{
 const f=await fixture();assert.notEqual((await f.execute({limit:1,clientId:id(70)})).status,200);assert.equal(f.calls.length,0);
});
test('General overdue follow-up forwards the opaque cursor and retains Core original filter time',async()=>{
 const f=await fixture(),input={limit:1,status:'overdue'};
 const first=await f.execute(input);assert.equal(first.status,200,await first.clone().text());
 const original=JSON.parse((await first.json()).resultJson);assert.equal(original.scope.dueBefore,stamp);
 f.advance();
 const next=await f.execute({...input,cursor:original.pageCoverage.nextCursor});
 assert.equal(next.status,200,await next.clone().text());
 const continued=JSON.parse((await next.json()).resultJson);
 assert.equal(continued.selection.dueBefore,null);assert.equal(continued.scope.dueBefore,stamp);
 assert.equal(continued.scope.cursorApplied,true);assert.equal(f.calls[1].cursor,'OPAQUE_CORE_CURSOR');
 assert.equal(Object.hasOwn(f.calls[1],'dueBefore'),false);
});
test('current Core refusal and execution revocation withhold General task content',async()=>{
 for(const revoke of [false,true]){const f=await fixture();if(revoke)f.afterRevoke();else f.deny();const response=await f.execute();assert.notEqual(response.status,200);assert.doesNotMatch(await response.text(),/Synthetic visible/);assert.equal(f.calls.length,1);}
});
test('a foreign actor in the Core task page cannot become a General success',async()=>{
 const f=await fixture();f.mutate(page=>{page.scope.actorUserId=id(99);});assert.notEqual((await f.execute()).status,200);
});
