/** Synthetic task, Core HTTP and session ports; no live source or credential. */
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createHandlers as originalHandlers} from '../../../../gateway/general-reads/families/operational-reads.mjs';
import {createHandlers as successorHandlers} from '../../../../gateway/general-reads/families/action-items-complete.mjs';
import {fixture,NOW,uuid} from '../../../../gateway/test/fixtures.mjs';
import {createOperationalTaskPorts,OPERATIONAL_TASK_FAMILIES} from '../operational-task-ports.mjs';

const CLIENT=uuid('9'),ORIGIN='https://core.synthetic.invalid',DEADLINE=NOW+5000;
const TOKEN='LIVE_USER',SECRET='CURRENT_SERVICE';
const ref=id=>({id,version:'0.2.0'});
function setup(changes={}){
 const f=fixture(),state={bearers:0,secrets:0,wire:[],now:NOW};
 Object.assign(f.claims.scopes[0],{kind:'client',resourceId:CLIENT});
 Object.assign(f.subject,{kind:'client',entityType:'client',entityIds:[CLIENT],rosterVersionId:null});
 const task={binding:f.binding,original:{binding:f.binding,expiresAtMs:NOW+7000},scopes:f.claims.scopes,
  grant:{binding:f.binding,qualificationBinding:{policyRevision:f.claims.policyRevision}}};
 const getNativeCredentialWithExpiry=async()=>{state.bearers++;return {credential:TOKEN,expiresAtMs:NOW+3000};};
 const getServiceSecret=async()=>{state.secrets++;return SECRET;};
 const fetchImpl=async(url,options)=>{state.wire.push({url,options});return new Response(JSON.stringify(state.native),{headers:{'content-type':'application/json'}});};
 const producer=createOperationalTaskPorts({coreOrigin:ORIGIN,fetchImpl,now:()=>state.now,enabled:true});
 const ports=producer({task,getNativeCredentialWithExpiry,getServiceSecret,
  getNativeCredential(){throw Error('STRING_BEARER_MUST_NOT_BE_USED');},...changes});
 return {f,state,task,producer,ports,getNativeCredentialWithExpiry,getServiceSecret};
}
function originalPins(x,id='query_tasks'){
 const operation=ref(id),sourceIdentity=resolveOperationContract(operation).descriptor.sourceRequirements[0];
 return {operation,sourceIdentity,binding:x.f.binding,subject:x.f.subject,policyRevision:x.f.claims.policyRevision,
  sourceIds:[sourceIdentity.sourceId],argumentsSha256:'a'.repeat(64),deadlineMs:DEADLINE,signal:new AbortController().signal};
}
function successorPins(x){return {binding:x.f.binding,subject:x.f.subject,deadlineMs:DEADLINE,signal:new AbortController().signal};}
const coverage={sourceStatus:'healthy',sourceReason:null,complete:true,partial:false,paginationComplete:true,hasMore:false,
 nextCursor:null,totalIsExactForScope:true,absenceSupported:true,note:'Synthetic Core page.'};
function nativePage(id,input,f){
 const task=id==='query_tasks',s=id==='actions.query'?input.selection:input;
 return {tool:task?'query_tasks':'query_action_items',generatedAt:new Date(NOW).toISOString(),clientId:CLIENT,total:0,returned:0,
  [task?'tasks':'actions']:[],scope:task?{kind:'client',tenantId:f.binding.tenantId,actorUserId:f.binding.actorId,
   ownerUserId:s.ownerUserId,taskId:s.taskId,status:s.status,dueBefore:s.dueBefore,offset:0,limit:s.limit,cursorApplied:false}:
   {actionItemId:s.actionItemId??null,status:s.status??null,sort:s.sort,page:1,limit:s.limit,cursorApplied:false},coverage};
}
function sourceCall(x,id,args){
 const operation=ref(id),contract=resolveOperationContract(operation);
 const context=id==='actions.query'?{binding:x.f.binding,clientResolution:{reference:CLIENT,clientId:CLIENT}}:
  id==='query_tasks'?{nowMs:NOW,actorId:x.f.binding.actorId}:{actorId:x.f.binding.actorId};
 const normalized=contract.normalizeInput(args,context),sourceIds=contract.descriptor.sourceRequirements.map(row=>row.sourceId);
 const authority={binding:x.f.binding,subject:x.f.subject,claims:x.f.claims,policyRevision:x.f.claims.policyRevision,
  sourceIds,deadlineMs:DEADLINE,decision:{decisionId:x.f.subject.authorizationDecisionId,
   actor:{tenantId:x.f.binding.tenantId,actorId:x.f.binding.actorId},operation:`${id}@0.2.0`,scopes:x.f.subject.scopes,
   policyRevision:x.f.claims.policyRevision,evaluatedAt:new Date(NOW).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'}};
 return {input:normalized.input,request:args,argumentsSha256:normalized.argumentsSha256,authority,
  ...(id==='query_tasks'?{normalizationContext:context}:{})};
}

for(const [id,args,expectedBody] of [
 ['query_tasks',{clientId:CLIENT,assignedToMe:true,status:'overdue'},input=>({limit:input.limit,clientId:CLIENT,
  status:input.status,dueBefore:input.dueBefore,assignedToMe:true})],
 ['actions.query',{clientId:CLIENT,sort:'priority'},input=>({limit:input.selection.limit,sort:'priority',clientId:CLIENT})]
])test(`${id}: task port calls the existing Core adapter with selected-client body and bounded live credentials`,async()=>{
 const x=setup(),call=sourceCall(x,id,args);x.state.native=nativePage(id,call.input,x.f);
 const family=id==='actions.query'?'action-items-complete':'operational-reads';
 const handlers=(id==='actions.query'?successorHandlers:originalHandlers)({...x.ports.families[family],now:()=>x.state.now,newId:()=>uuid('7')});
 const handler=handlers.find(row=>row.operation.id===id);
 assert.ok(handler);assert.equal(x.state.bearers,0);assert.equal(x.state.secrets,0);assert.equal(x.state.wire.length,0);
 const result=JSON.parse(await handler.execute(call));
 assert.equal(result.binding.runId,x.f.binding.runId);assert.equal(result.subject.entityIds[0],CLIENT);
 assert.equal(x.state.bearers,2);assert.equal(x.state.secrets,1);assert.equal(x.state.wire.length,1);
 const wire=x.state.wire[0];assert.equal(wire.url,`${ORIGIN}/api/clio/tools/${id==='actions.query'?'query_action_items':id}`);
 assert.deepEqual(JSON.parse(wire.options.body),expectedBody(call.input));
 assert.equal(wire.options.headers.authorization,`Bearer ${TOKEN}`);
 assert.equal(wire.options.headers['x-internal-service-secret'],SECRET);
 assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.redirect,'error');
});

test('query_action_items: original body and reservation use a single-use Option B token',async()=>{
 const issuance=[];
 const x=setup({getNativeCredentialWithExpiry:async request=>{
  issuance.push({kind:'handle',request});return {credential:'mrd.synthetic-handle',expiresAtMs:NOW+3000};},
 getToolCredential:async request=>{
  issuance.push({kind:'token',request});return {bearerToken:'SYNTHETIC_SIGNED_TOOL_TOKEN',
   authorizationScheme:'CapiroMeriRead',expiresAtMs:NOW+2500};}});
 const call={...sourceCall(x,'query_action_items',{clientId:CLIENT,sort:'priority'}),invocationId:'original_action_call_1'};
 x.state.native=nativePage('query_action_items',call.input,x.f);
 const handler=originalHandlers({...x.ports.families['operational-reads'],now:()=>x.state.now,newId:()=>uuid('7')})
  .find(row=>row.operation.id==='query_action_items');
 const result=JSON.parse(await handler.execute(call));
 assert.equal(result.operation.id,'query_action_items');assert.equal(result.subject.entityIds[0],CLIENT);
 assert.equal(x.state.bearers,0);assert.equal(x.state.secrets,1);assert.equal(issuance.length,2);
 assert.equal(issuance[0].request.callKey,call.invocationId);
 assert.deepEqual(issuance[1].request.operation,{id:'query_action_items',version:'0.2.0'});
 assert.equal(issuance[1].request.argumentsSha256,call.argumentsSha256);
 assert.equal(issuance[1].request.credential,'mrd.synthetic-handle');
 const wire=x.state.wire[0],body=wire.options.body;
 assert.deepEqual(JSON.parse(body),{limit:call.input.limit,clientId:CLIENT,sort:'priority'});
 assert.deepEqual(issuance[1].request.target,{method:'POST',path:'/api/clio/tools/query_action_items',
  bodySha256:createHash('sha256').update(body,'utf8').digest('hex')});
 assert.equal(wire.options.headers.authorization,'CapiroMeriRead SYNTHETIC_SIGNED_TOOL_TOKEN');
 assert.equal(wire.options.headers['x-internal-service-secret'],SECRET);
 assert.equal(wire.options.headers['x-meri-deadline-at'],String(NOW+2500));
 assert.equal(wire.options.headers['x-meri-read-correlation'],undefined);
 assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.redirect,'error');
});

test('query_action_items: missing invocation, absent exchange and attended bearer fallback refuse before Fetch',async()=>{
 for(const failure of ['missing_invocation','missing_callback','null_fallback','ordinary_bearer','expired']){
  const token=async()=>failure==='null_fallback'?null:failure==='ordinary_bearer'?
   {bearerToken:'LIVE_USER',authorizationScheme:'Bearer',expiresAtMs:NOW+2500}:
   {bearerToken:'SIGNED_TOOL_TOKEN',authorizationScheme:'CapiroMeriRead',expiresAtMs:failure==='expired'?NOW:NOW+2500};
  const x=setup({getToolCredential:failure==='missing_callback'?undefined:token});
  const call=sourceCall(x,'query_action_items',{clientId:CLIENT,sort:'priority'});
  if(failure!=='missing_invocation')call.invocationId='original_action_call_1';
  x.state.native=nativePage('query_action_items',call.input,x.f);
  const handler=originalHandlers({...x.ports.families['operational-reads'],now:()=>x.state.now,newId:()=>uuid('7')})
   .find(row=>row.operation.id==='query_action_items');
  await assert.rejects(handler.execute(call));assert.equal(x.state.wire.length,0);
 }
});

test('query_action_items: changed selected input, reservation hash or original target refuses before token issue',async()=>{
 let issues=0;
 const x=setup({getToolCredential:async()=>{issues++;throw Error('NO_TOKEN_ISSUE');}});
 const call=sourceCall(x,'query_action_items',{clientId:CLIENT,sort:'priority'});
 const sourceIdentity=resolveOperationContract(ref('query_action_items')).descriptor.sourceRequirements[0];
 const body=JSON.stringify({limit:call.input.limit,clientId:CLIENT,sort:'priority'});
 const valid={operation:ref('query_action_items'),sourceIdentity,binding:x.f.binding,subject:x.f.subject,
  policyRevision:x.f.claims.policyRevision,sourceIds:[sourceIdentity.sourceId],argumentsSha256:call.argumentsSha256,
  input:call.input,invocationId:'original_action_call_1',target:{method:'POST',path:'/api/clio/tools/query_action_items',
   bodySha256:createHash('sha256').update(body,'utf8').digest('hex')},deadlineMs:DEADLINE,signal:new AbortController().signal};
 for(const change of [p=>{p.input.clientId=uuid('8');},p=>{p.argumentsSha256='0'.repeat(64);},
  p=>{p.target.path='/api/clio/tools/actions.query';},p=>{p.invocationId='bad id';},
  p=>{p.subject.entityIds=[uuid('8')];}]){
  const pins=structuredClone({...valid,signal:undefined});pins.signal=new AbortController().signal;change(pins);
  await assert.rejects(x.ports.families['operational-reads'].getCredentials(pins));
 }
 assert.equal(issues,0);assert.equal(x.state.bearers,0);assert.equal(x.state.secrets,0);
});

test('original credential pins require exact operation, source identity, digest, binding and selected-client subject',async()=>{
 const x=setup(),get=x.ports.families['operational-reads'].getCredentials,pins=originalPins(x);
 const credential=await get(pins);
 assert.equal(credential.expiresAtMs,NOW+3000);assert.deepEqual(credential.sourceIdentity,pins.sourceIdentity);
 assert.equal(canonicalSha256(credential.binding),canonicalSha256(x.task.binding));
 for(const mutate of [p=>p.operation.version='0.1.0',p=>p.operation.id='actions.query',
  p=>p.sourceIdentity.authority='derived',p=>p.sourceIds=['foreign'],p=>p.binding.runId=uuid('8'),
  p=>p.subject.entityIds=[uuid('8')],p=>p.subject.scopes[0].resourceId=uuid('8'),
  p=>p.policyRevision='old-policy',p=>p.argumentsSha256='0']){
  const altered=structuredClone({...pins,signal:undefined});altered.signal=new AbortController().signal;mutate(altered);
  await assert.rejects(get(altered));
 }
 assert.equal(x.state.bearers,2);assert.equal(x.state.secrets,1);assert.equal(x.state.wire.length,0);
});

test('successor credential pins require accepted full binding and selected-client subject',async()=>{
 const x=setup(),get=x.ports.families['action-items-complete'].getCredentials;
 const credential=await get(successorPins(x));assert.equal(credential.expiresAtMs,NOW+3000);
 for(const mutate of [p=>p.binding.writerFence++,p=>p.subject.entityIds=[uuid('8')],
  p=>p.subject.scopes[0].resourceId=uuid('8')]){
  const altered=structuredClone({...successorPins(x),signal:undefined});altered.signal=new AbortController().signal;mutate(altered);
  await assert.rejects(get(altered));
 }
 assert.equal(x.state.bearers,2);assert.equal(x.state.secrets,1);
});

test('task original and expiry are required at setup; selected client is required before source effect',async()=>{
 const x=setup(),task=x.task,base={task,getNativeCredentialWithExpiry:x.getNativeCredentialWithExpiry,getServiceSecret:x.getServiceSecret};
 for(const changed of [{...task,original:{...task.original,binding:{...task.binding,actorId:'foreign'}}},
  {...task,original:{...task.original,expiresAtMs:NOW}}])
  assert.throws(()=>x.producer({...base,task:changed}));
 const staleGrant=x.producer({...base,task:{...task,grant:{...task.grant,qualificationBinding:{policyRevision:'old-policy'}}}});
 await assert.rejects(staleGrant.families['action-items-complete'].getCredentials(successorPins(x)));
 const unselected=x.producer({...base,task:{...task,scopes:[{...task.scopes[0],kind:'tenant',resourceId:task.binding.tenantId}]}});
 await assert.rejects(unselected.families['action-items-complete'].getCredentials(successorPins(x)));
 assert.throws(()=>x.producer({task,getNativeCredential:x.getNativeCredentialWithExpiry,getServiceSecret:x.getServiceSecret}));
 assert.equal(x.state.bearers,0);assert.equal(x.state.secrets,0);assert.equal(x.state.wire.length,0);
});

test('reviewed action family is the only constructed port and unrelated tasks stay inert',async()=>{
 const x=setup(),producer=createOperationalTaskPorts({coreOrigin:ORIGIN,fetchImpl:async()=>{throw Error('NO_FETCH');},
  now:()=>NOW,enabled:true,familyIds:['action-items-complete']});
 const task={...x.task,scopes:[{...x.task.scopes[0],kind:'tenant',resourceId:x.task.binding.tenantId}]};
 const supplied=producer({task,getNativeCredentialWithExpiry:x.getNativeCredentialWithExpiry,getServiceSecret:x.getServiceSecret});
 assert.deepEqual(Object.keys(supplied.families),['action-items-complete']);
 await assert.rejects(supplied.families['action-items-complete'].getCredentials(successorPins(x)));
 assert.deepEqual(OPERATIONAL_TASK_FAMILIES,['operational-reads','action-items-complete']);
 for(const familyIds of [[],['action-items-complete','action-items-complete'],['mail']])
  assert.throws(()=>createOperationalTaskPorts({coreOrigin:ORIGIN,fetchImpl:async()=>{},now:()=>NOW,enabled:true,familyIds}));
 assert.equal(x.state.bearers,0);assert.equal(x.state.secrets,0);assert.equal(x.state.wire.length,0);
});

test('portfolio query_tasks and source credential expiry/session changes fail closed',async()=>{
 const x=setup(),original=x.ports.families['operational-reads'].getCredentials,portfolio=originalPins(x);
 portfolio.subject={...portfolio.subject,kind:'portfolio',rosterVersionId:'authorized-roster'};
 await assert.rejects(original(portfolio));assert.equal(x.state.bearers,0);
 const expired=setup({getNativeCredentialWithExpiry:async()=>({credential:TOKEN,expiresAtMs:NOW})});
 await assert.rejects(expired.ports.families['operational-reads'].getCredentials(originalPins(expired)));
 assert.equal(expired.state.secrets,0);
 const stringOnly=setup({getNativeCredentialWithExpiry:async()=>TOKEN});
 await assert.rejects(stringOnly.ports.families['operational-reads'].getCredentials(originalPins(stringOnly)));
 assert.equal(stringOnly.state.secrets,0);
 const bounded=setup({getNativeCredentialWithExpiry:async()=>({credential:TOKEN,expiresAtMs:NOW+9000})});
 assert.equal((await bounded.ports.families['operational-reads'].getCredentials({...originalPins(bounded),deadlineMs:NOW+8000})).expiresAtMs,NOW+7000);
 const replaced=setup({getNativeCredentialWithExpiry:async()=>({credential:++replaced.state.bearers===1?TOKEN:'REPLACED',expiresAtMs:NOW+3000})});
 await assert.rejects(replaced.ports.families['action-items-complete'].getCredentials(successorPins(replaced)));
 assert.equal(replaced.state.secrets,1);assert.equal(replaced.state.wire.length,0);
 const cancelled=setup(),controller=new AbortController();controller.abort();
 await assert.rejects(cancelled.ports.families['action-items-complete'].getCredentials({...successorPins(cancelled),signal:controller.signal}));
 assert.equal(cancelled.state.bearers,0);assert.equal(cancelled.state.secrets,0);
});
