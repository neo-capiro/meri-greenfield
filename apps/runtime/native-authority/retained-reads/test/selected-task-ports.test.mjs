import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {fixture,NOW,uuid} from '../../../../gateway/test/fixtures.mjs';
import {COMPOSABLE_RETAINED_FAMILIES,createSelectedRetainedTaskPorts} from '../selected-task-ports.mjs';

const origin='https://core.synthetic.invalid';
const signed=async()=>{throw Error('NO_TOKEN_BEFORE_GATEWAY_CALL');};
const native=async()=>{throw Error('NO_BEARER_BEFORE_GATEWAY_CALL');};
const tool=async()=>{throw Error('NO_TOOL_TOKEN_BEFORE_GATEWAY_CALL');};
const secret=async()=>{throw Error('NO_SECRET_BEFORE_GATEWAY_CALL');};
const fetchImpl=async()=>{throw Error('NO_SOURCE_BEFORE_GATEWAY_CALL');};

test('one task-local selection composes only its reviewed signed, action, and local families',async()=>{
 const f=fixture(),familyIds=['action-items-complete','dataset-metadata','client-documents'];
 const approvedReads={schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:true,
  operations:[{id:'actions.query',version:'0.2.0'},{id:'list_global_datasets',version:'0.2.0'},
   {id:'read_client_documents',version:'0.2.0'}],maxExecuteMs:3000,maxRequestBytes:65536,maxResponseBytes:65536};
 const task={binding:f.binding,original:{binding:f.binding,expiresAtMs:NOW+5000},scopes:f.claims.scopes,
  grant:{binding:f.binding,qualificationBinding:{policyRevision:f.claims.policyRevision}},approvedReads};
 const create=createSelectedRetainedTaskPorts({familyIds,coreOrigin:origin,fetchImpl,now:()=>NOW});
 const {families}=create({task,getSignedSourceCredentials:signed,getNativeCredentialWithExpiry:native,
  getToolCredential:tool,getServiceSecret:secret});
 assert.deepEqual(Object.keys(families),familyIds);
 assert.equal(families['action-items-complete'].getCredentials instanceof Function,true);
 assert.equal(families['client-documents'].getCredentials,signed);
 assert.equal(typeof families['dataset-metadata'].registry.listDatasetMetadata,'function');
 const handlers=await createGeneralReadFamilyHandlers({families,now:()=>NOW,newId:()=>uuid('7')});
 assert.deepEqual([...handlers.keys()].sort(),approvedReads.operations.map(op=>`${op.id}@${op.version}`).sort());
 await assert.rejects(families['action-items-complete'].getCredentials({binding:f.binding,subject:f.subject,
  deadlineMs:NOW+2000,signal:new AbortController().signal}));
});

test('local dataset slice remains callable through its canonical handler without a Core credential',async()=>{
 const {families}=createSelectedRetainedTaskPorts({familyIds:['dataset-metadata']})({task:{}});
 const handlers=await createGeneralReadFamilyHandlers({families,now:()=>NOW,newId:()=>uuid('7')});
 const f=fixture(),operation={id:'list_global_datasets',version:'0.2.0'},request={};
 const authority={binding:f.binding,subject:f.subject,claims:f.claims,policyRevision:f.claims.policyRevision,deadlineMs:NOW+2000};
 const result=JSON.parse(await handlers.get('list_global_datasets@0.2.0').execute({input:request,request,authority,
  argumentsSha256:canonicalSha256(request)}));
 assert.deepEqual(result.operation,operation);
 assert.equal(result.binding.runId,f.binding.runId);
 assert.equal(result.result.tool,'list_global_datasets');
 assert.ok(result.result.datasets.length>0);
});

test('historical action family requires its exact receipt ref and a task-bound token port',async()=>{
 const f=fixture(),familyIds=['operational-reads'],action={id:'query_action_items',version:'0.2.0'};
 const task={binding:f.binding,original:{binding:f.binding,expiresAtMs:NOW+5000},scopes:f.claims.scopes,
  grant:{binding:f.binding,qualificationBinding:{policyRevision:f.claims.policyRevision}}};
 const create=createSelectedRetainedTaskPorts({familyIds,operationRefs:[action],coreOrigin:origin,fetchImpl,now:()=>NOW});
 const {families}=create({task,getNativeCredentialWithExpiry:native,getToolCredential:tool,getServiceSecret:secret});
 assert.deepEqual(Object.keys(families),familyIds);
 assert.equal(typeof families['operational-reads'].getCredentials,'function');
 await assert.rejects(families['operational-reads'].getCredentials({operation:action}));
 for(const operationRefs of [[{id:'query_tasks',version:'0.2.0'}],[action,{id:'query_tasks',version:'0.2.0'}]])
  assert.equal(typeof createSelectedRetainedTaskPorts({familyIds,operationRefs,coreOrigin:origin,fetchImpl,now:()=>NOW}), 'function');
 for(const operationRefs of [[],[{id:'query_tasks',version:'0.1.0'}],[{id:'unknown',version:'0.2.0'}]])
  assert.throws(()=>createSelectedRetainedTaskPorts({familyIds,operationRefs,coreOrigin:origin,fetchImpl,now:()=>NOW}));
});

test('selected research evidence receives the attended bearer with expiry and never the Option B handle',async()=>{
 const f=fixture(),operation={id:'get_research_evidence',version:'0.2.0'},client={tenantId:f.binding.tenantId,
  kind:'client',resourceId:uuid('d'),policyRevision:f.claims.policyRevision};
 const task={binding:f.binding,original:{binding:f.binding,expiresAtMs:NOW+5000},scopes:[client],
  grant:{binding:f.binding,qualificationBinding:{policyRevision:f.claims.policyRevision}},taskCapability:'SYNTHETIC_TASK',sourceEnabled:true,
  approvedReads:{schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:true,operations:[operation],maxExecuteMs:1000,maxRequestBytes:65536,maxResponseBytes:65536}};
 const create=createSelectedRetainedTaskPorts({familyIds:['research-portfolio-evidence'],coreOrigin:origin,fetchImpl,now:()=>NOW});
 let attended=0,delegated=0;
 const supplied=create({task,getNativeCredentialWithExpiry:async()=>{delegated++;throw Error('OPAQUE_HANDLE_MUST_NOT_BE_BEARER');},
  getAttendedCredentialWithExpiry:async()=>{attended++;return {credential:'SYNTHETIC_ATTENDED_BEARER',expiresAtMs:NOW+4000};}});
 const subject={...f.subject,kind:'entity',entityType:'research-portfolio',entityIds:[uuid('e')],rosterVersionId:null,scopes:[client]};
 const credentials=await supplied.families['research-portfolio-evidence'].getCredentials({binding:f.binding,subject,deadlineMs:NOW+1000});
 assert.equal(credentials.bearerToken,'SYNTHETIC_ATTENDED_BEARER');assert.equal(credentials.expiresAtMs,NOW+1000);
 assert.equal(attended,1);assert.equal(delegated,0);
 assert.throws(()=>create({task,getNativeCredentialWithExpiry:async()=>({credential:'opaque',expiresAtMs:NOW+4000})}));
});

test('unlisted, duplicate, and originless remote families refuse before task or source access',()=>{
 for(const familyIds of [[],['action-items-complete','action-items-complete'],['mail'],
  [...COMPOSABLE_RETAINED_FAMILIES,'mail']])
  assert.throws(()=>createSelectedRetainedTaskPorts({familyIds,coreOrigin:origin,fetchImpl,now:()=>NOW}));
 assert.throws(()=>createSelectedRetainedTaskPorts({familyIds:['action-items-complete'],fetchImpl,now:()=>NOW}));
 assert.throws(()=>createSelectedRetainedTaskPorts({familyIds:['client-documents'],fetchImpl}));
});
