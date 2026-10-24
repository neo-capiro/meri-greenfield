import test from 'node:test';
import assert from 'node:assert/strict';
import {readExecutionSettlement,createExecutionBinding} from '../execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {binding,versions} from './application-fixture.mjs';

const check=()=>{};
function historical(){
 const record={state:'RETIRED',resource:{physicalStopProven:true},original:{binding},allocationSha256:'d'.repeat(64),grantIntents:[{grantId:'historical'}]};
 const row={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record,record_sha256:hash(record)};
 let execution=null;
 const client={async query(sql,args){assert.match(sql,/^SELECT \* FROM meri_conversations\.(native_executions|native_allocations) WHERE/u);assert.deepEqual(args,[binding.tenantId,binding.conversationId,binding.runId]);return {rows:sql.includes('native_executions')?(execution?[execution]:[]):[row]};}};
 return {client,row,setExecution(value){execution=value;}};
}
test('historical completed settlement requires verified lineage and exact stopped receipt; never creates an execution',async()=>{
 const f=historical();
 await assert.rejects(readExecutionSettlement(f.client,binding,'completed',check),/NEXT_RUN_EXECUTION_UNSETTLED/);
 const value=await readExecutionSettlement(f.client,binding,'completed',check,{historicalCompleted:true});
 assert.equal(value.recordSha256,f.row.record_sha256);assert.equal(value.record,undefined);assert.deepEqual(value.legacy,f.row.record);
 for(const mutation of [r=>{r.resource.physicalStopProven=false;},r=>{r.state='ALLOCATED';},r=>{r.original.binding={...binding,writerFence:99};}]){
  const current=historical();mutation(current.row.record);current.row.record_sha256=hash(current.row.record);
  await assert.rejects(readExecutionSettlement(current.client,binding,'completed',check,{historicalCompleted:true}),/NEXT_RUN_EXECUTION_UNSETTLED/);
 }
 f.row.record_sha256='e'.repeat(64);await assert.rejects(readExecutionSettlement(f.client,binding,'completed',check,{historicalCompleted:true}),/NEXT_RUN_EXECUTION_UNSETTLED/);
});
test('an existing native execution always overrides a historical stopped receipt',async()=>{
 const f=historical(),{versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:Date.now()+60000,runtimeSessionId:'native-'+hash(binding)});
 for(const phase of ['launching','unknown','started','stopping']){
  const record={...identity,phase,native:null};f.setExecution({...f.row,record,record_sha256:hash(record),execution_key:record.executionKey,execution_id:record.executionId});
  await assert.rejects(readExecutionSettlement(f.client,binding,'completed',check,{historicalCompleted:true}),/NEXT_RUN_EXECUTION_UNSETTLED/);
 }
 const record={...identity,phase:'settled',native:{state:'completed'}};f.setExecution({...f.row,record,record_sha256:hash(record),execution_key:record.executionKey,execution_id:record.executionId});
 const result=await readExecutionSettlement(f.client,binding,'completed',check,{historicalCompleted:true});assert.deepEqual(result.record,record);assert.equal(result.legacy,undefined);
});
