import test from 'node:test';
import assert from 'node:assert/strict';
import {NATIVE_READS_SCHEMA_VERSION} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {fixture,NOW} from '../../../../gateway/test/fixtures.mjs';
import {createMemoryTaskPorts,MEMORY_TASK_FAMILIES} from '../memory-task-ports.mjs';
import {createSelectedRetainedTaskPorts} from '../selected-task-ports.mjs';

const origin='https://core.synthetic.invalid';
const fetchImpl=async()=>{throw Error('NO_SOURCE_BEFORE_GATEWAY_CALL');};
const signed=async()=>{throw Error('NO_PARENT_TOKEN_BEFORE_GATEWAY_CALL');};
const eligibility=async()=>{throw Error('NO_HELPER_TOKEN_BEFORE_GATEWAY_CALL');};
const operations=[{id:'search_memory',version:'0.2.0'},
 {id:'memory.list_own_proposals',version:'0.2.0'}];
const previous=async()=>{throw Error('NO_CONTEXT_BEFORE_GATEWAY_CALL');};
const retain=async()=>{throw Error('NO_RETENTION_BEFORE_GATEWAY_CALL');};

function task(overrides={}){
 const f=fixture(),scope={tenantId:f.binding.tenantId,kind:'client',resourceId:'synthetic-client',
  policyRevision:f.claims.policyRevision};
 return {binding:f.binding,original:{binding:f.binding,expiresAtMs:NOW+5000},scopes:[scope],
  grant:{binding:f.binding,qualificationBinding:{policyRevision:scope.policyRevision}},
  approvedReads:{schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:true,operations,
   maxExecuteMs:2000,maxRequestBytes:65536,maxResponseBytes:1048576},...overrides};
}
const contextFactory=({binding,clientId,policyRevision,expiresAtMs})=>{
 assert.equal(binding.tenantId,'synthetic-tenant');
 assert.equal(clientId,'synthetic-client');
 assert.equal(policyRevision,'revision-1');
 assert.equal(expiresAtMs,NOW+5000);
 return {loadPrevious:previous,retain};
};

test('the two signed memory operations compose canonical handlers, fixed Core routes and a task-local context port',async()=>{
 const create=createSelectedRetainedTaskPorts({familyIds:MEMORY_TASK_FAMILIES,coreOrigin:origin,
  fetchImpl,now:()=>NOW,memoryContextPortsForTask:contextFactory});
 const composed=create({task:task(),getSignedSourceCredentials:signed,
  getMemoryEligibilityCredentials:eligibility});
 assert.deepEqual(Object.keys(composed.families),MEMORY_TASK_FAMILIES);
 assert.deepEqual(composed.families['client-knowledge-memory'].endpoints,
  {search_memory:`${origin}/api/clio/tools/search_memory`});
 assert.equal(composed.families['client-knowledge-memory'].getCredentials,signed);
 assert.equal(composed.families['client-knowledge-memory'].getEligibilityCredentials,eligibility);
 assert.equal(composed.families['memory-proposals'].origin,origin);
 assert.equal(composed.families['memory-proposals'].getCredentials,signed);
 assert.equal(typeof composed.contextPorts.memoryContextPorts.loadPrevious,'function');
 assert.equal(typeof composed.contextPorts.memoryContextPorts.retain,'function');
 for(const family of Object.values(composed.families)){
  assert.equal(family.fetchImpl,fetchImpl);
  assert.equal(family.maxRequestMs,2000);
  assert.equal(family.maxResponseBytes,1048576);
 }
 const handlers=await createGeneralReadFamilyHandlers({families:composed.families,now:()=>NOW,newId:()=> 'synthetic'});
 assert.deepEqual([...handlers.keys()].sort(),operations.map(op=>`${op.id}@${op.version}`).sort());
});

test('memory page can compose alone without a proposal continuation store',()=>{
 const create=createMemoryTaskPorts({familyIds:['client-knowledge-memory'],coreOrigin:origin,fetchImpl,now:()=>NOW});
 const composed=create({task:task(),getSignedSourceCredentials:signed,getMemoryEligibilityCredentials:eligibility});
 assert.deepEqual(Object.keys(composed.families),['client-knowledge-memory']);
 assert.equal(composed.contextPorts,undefined);
});

test('proposals refuse without a trusted task-bound durable context owner',()=>{
 assert.throws(()=>createMemoryTaskPorts({familyIds:['memory-proposals'],coreOrigin:origin,fetchImpl,now:()=>NOW}),
  {message:'CONFIGURATION'});
 for(const factory of [()=>({loadPrevious:previous}),()=>({loadPrevious:previous,retain:null}),
  async()=>({loadPrevious:previous,retain})]){
  const create=createMemoryTaskPorts({familyIds:['memory-proposals'],coreOrigin:origin,
   fetchImpl,now:()=>NOW,memoryContextPortsForTask:factory});
  assert.throws(()=>create({task:task(),getSignedSourceCredentials:signed}));
 }
});

test('personal, foreign, expired, disabled and unapproved memory tasks refuse before source work',()=>{
 const create=createMemoryTaskPorts({familyIds:['client-knowledge-memory'],coreOrigin:origin,fetchImpl,now:()=>NOW});
 const input={task:task(),getSignedSourceCredentials:signed,getMemoryEligibilityCredentials:eligibility};
 const cases=[
  task({scopes:fixture().claims.scopes}),
  task({scopes:[{...task().scopes[0],tenantId:'foreign-tenant'}]}),
  task({original:{binding:task().binding,expiresAtMs:NOW}}),
  task({approvedReads:{...task().approvedReads,enabled:false}}),
  task({approvedReads:{...task().approvedReads,operations:[operations[1]]}}),
 ];
 for(const candidate of cases)assert.throws(()=>create({...input,task:candidate}));
 assert.throws(()=>create({...input,getMemoryEligibilityCredentials:undefined}),{message:'CONFIGURATION'});
});

test('only canonical memory families and a strict Core origin are accepted',()=>{
 for(const familyIds of [[],['client-knowledge-memory','client-knowledge-memory'],['mail']])
  assert.throws(()=>createMemoryTaskPorts({familyIds,coreOrigin:origin,fetchImpl,now:()=>NOW}));
 for(const coreOrigin of ['http://core.synthetic.invalid','https://core.synthetic.invalid/path'])
  assert.throws(()=>createMemoryTaskPorts({familyIds:['client-knowledge-memory'],coreOrigin,fetchImpl,now:()=>NOW}));
});
