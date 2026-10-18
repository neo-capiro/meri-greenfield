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
 const {families}=create({task,getSignedSourceCredentials:signed,getNativeCredentialWithExpiry:native,getServiceSecret:secret});
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

test('unlisted, duplicate, and originless remote families refuse before task or source access',()=>{
 for(const familyIds of [[],['action-items-complete','action-items-complete'],['operational-reads'],['mail'],
  [...COMPOSABLE_RETAINED_FAMILIES,'mail']])
  assert.throws(()=>createSelectedRetainedTaskPorts({familyIds,coreOrigin:origin,fetchImpl,now:()=>NOW}));
 assert.throws(()=>createSelectedRetainedTaskPorts({familyIds:['action-items-complete'],fetchImpl,now:()=>NOW}));
 assert.throws(()=>createSelectedRetainedTaskPorts({familyIds:['client-documents'],fetchImpl}));
});
