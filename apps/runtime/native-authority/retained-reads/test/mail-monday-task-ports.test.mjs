import test from 'node:test';
import assert from 'node:assert/strict';
import {NATIVE_READS_SCHEMA_VERSION} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createClientKnowledgeFixture,NOW,uuid} from '../../../../gateway/sources/client-knowledge/test/fixtures.mjs';
import {createMailMondayTaskPorts,MAIL_MONDAY_TASK_FAMILIES} from '../mail-monday-task-ports.mjs';

const origin='https://core.synthetic.invalid';
const operation={id:'read_monday_client_boards',version:'0.2.0'};
function scene(){
 const f=createClientKnowledgeFixture(operation.id),events=[];
 const task={binding:f.binding,original:{binding:f.binding,expiresAtMs:NOW+5000},scopes:f.subject.scopes,
  grant:{binding:f.binding,qualificationBinding:{policyRevision:f.authority.policyRevision}},
  approvedReads:{schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:true,operations:[operation],
   maxExecuteMs:2000,maxRequestBytes:65536,maxResponseBytes:1048576}};
 const getSignedSourceCredentials=async pins=>{
  events.push('credentials');return {...f.receiptPins(pins),invocationId:pins.invocationId,
   authorizationScheme:'CapiroMeriRead',target:pins.target,correlationSha256:pins.correlationSha256,
   bearerToken:'SYNTHETIC_READ_TOKEN',serviceSecret:'SYNTHETIC_SERVICE_SECRET',expiresAtMs:pins.deadlineMs};
 };
 const fetchImpl=async(url,options)=>{events.push('source');
  assert.equal(url,`${origin}/api/clio/tools/${operation.id}`);
  assert.equal(options.headers.authorization,'CapiroMeriRead SYNTHETIC_READ_TOKEN');
  return Response.json(f.page(JSON.parse(options.body).input));
 };
 const config={coreOrigin:origin,fetchImpl,now:()=>f.state.now,familyIds:['client-knowledge-monday']};
 return {f,task,events,config,getSignedSourceCredentials};
}

test('Monday task composes the actual signed Core handler without startup IO or a fabricated mapping receipt',async()=>{
 const s=scene(),create=createMailMondayTaskPorts(s.config);
 const composed=create({task:s.task,getSignedSourceCredentials:s.getSignedSourceCredentials});
 assert.deepEqual(s.events,[]);assert.deepEqual(Object.keys(composed.families),['client-knowledge-monday']);
 const family=composed.families['client-knowledge-monday'];
 assert.deepEqual(family.endpoints,{read_monday_client_boards:`${origin}/api/clio/tools/${operation.id}`});
 assert.equal(family.getCredentials,s.getSignedSourceCredentials);
 assert.equal(family.maxRequestMs,2000);assert.equal(family.maxResponseBytes,1048576);
 const handlers=await createGeneralReadFamilyHandlers({families:composed.families,now:s.config.now,newId:()=>uuid('e')});
 assert.deepEqual([...handlers.keys()],['read_monday_client_boards@0.2.0']);
 const result=JSON.parse(await handlers.get('read_monday_client_boards@0.2.0').execute({...s.f.call(),invocationId:'synthetic_monday_1'}));
 assert.deepEqual(result.result,s.f.page());assert.deepEqual(result.binding,s.f.binding);
 assert.deepEqual(s.events,['credentials','source']);
});

test('Monday task refuses wrong tenant, wrong grant binding, stale task and unapproved operation before source IO',()=>{
 const s=scene(),create=createMailMondayTaskPorts(s.config);
 for(const task of [
  {...s.task,scopes:[{...s.task.scopes[0],tenantId:uuid('f')}]},
  {...s.task,grant:{...s.task.grant,binding:{...s.task.binding,actorId:uuid('f')}}},
  {...s.task,original:{binding:s.task.binding,expiresAtMs:NOW}},
  {...s.task,approvedReads:{...s.task.approvedReads,enabled:false}},
  {...s.task,approvedReads:{...s.task.approvedReads,operations:[{id:'find_contacts',version:'0.2.0'}]}},
  {...s.task,scopes:[{...s.task.scopes[0],kind:'private-user',resourceId:s.task.binding.actorId}]},
 ])assert.throws(()=>create({task,getSignedSourceCredentials:s.getSignedSourceCredentials}));
 assert.deepEqual(s.events,[]);
});

test('Monday task preserves selected-client scope in the full composer tuple and refuses cancellation',()=>{
 const s=scene(),abort=new AbortController(),create=createMailMondayTaskPorts(s.config);
 const task={...s.task,pool:{connect(){}},allocationJson:'{}',grantFactsJsons:[],grantId:uuid('c'),
  taskArn:'arn:synthetic',issuanceFactsSha256:'a'.repeat(64),runRequestSha256:'b'.repeat(64),
  readCurrentEntry(){},currentOwner:{},sourceEnabled:true,limits:{},now:s.config.now,
  taskVerifier(){},taskCapability:'SYNTHETIC_TASK',allocation:{},signal:abort.signal};
 assert.equal(typeof create({task,getSignedSourceCredentials:s.getSignedSourceCredentials}).families['client-knowledge-monday'].getCredentials,'function');
 abort.abort();assert.throws(()=>create({task,getSignedSourceCredentials:s.getSignedSourceCredentials}),/UNAVAILABLE/);
 assert.deepEqual(s.events,[]);
});

test('Monday task accepts only canonical families, inert callbacks and an exact HTTPS origin',()=>{
 const s=scene();
 assert.deepEqual(MAIL_MONDAY_TASK_FAMILIES,['client-knowledge-monday','mail']);
 for(const familyIds of [[],['client-knowledge-monday','client-knowledge-monday'],['unknown']])
  assert.throws(()=>createMailMondayTaskPorts({...s.config,familyIds}));
 for(const coreOrigin of ['http://core.synthetic.invalid','https://core.synthetic.invalid/path'])
  assert.throws(()=>createMailMondayTaskPorts({...s.config,coreOrigin}));
 const create=createMailMondayTaskPorts(s.config);
 assert.throws(()=>create({task:s.task,getSignedSourceCredentials:undefined}),/CONFIGURATION/);
 let called=0;
 const raw={task:s.task,get getSignedSourceCredentials(){called++;return s.getSignedSourceCredentials;}};
 assert.throws(()=>create(raw));assert.equal(called,0);
});
