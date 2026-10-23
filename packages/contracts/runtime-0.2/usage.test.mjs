import test from 'node:test';
import assert from 'node:assert/strict';
import {assertUsageInput,MAX_TOOL_AUDIT_RECORDS} from './usage.mjs';
import {assertRunOwnerRequest} from './validate.mjs';
const binding={tenantId:'tenant-synthetic',actorId:'actor-synthetic',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002',attemptId:'00000000-0000-4000-8000-000000000003',workerId:'00000000-0000-4000-8000-000000000004',writerFence:1};
const input=()=>({usage:null,toolsUsed:{tools:[{tool:'Read',toolUseId:'toolu_synthetic',outcome:'completed',durationMs:null}],omitted:0}});
test('terminal usage operation is closed and carries only bounded content-free facts',()=>{
 assert.deepEqual(assertRunOwnerRequest('record-usage',{binding,input:input()}),{binding,input:input()});
 for(const extra of ['arguments','result','thinking','prompt','tenantId','lineage'])assert.throws(()=>assertUsageInput({...input(),[extra]:'private'}));
 for(const extra of ['input','output','summary','error']){const v=input();v.toolsUsed.tools[0][extra]='private';assert.throws(()=>assertUsageInput(v));}
});
test('tool audit has a hard cap, strict outcome and identifiers, no large strings',()=>{
 const row=input().toolsUsed.tools[0];
 assert.throws(()=>assertUsageInput({...input(),toolsUsed:{tools:Array(MAX_TOOL_AUDIT_RECORDS+1).fill(row),omitted:0}}));
 for(const changed of [{tool:'x'.repeat(201)},{outcome:'maybe'},{durationMs:-1},{toolUseId:'contains secret\n'}])assert.throws(()=>assertUsageInput({...input(),toolsUsed:{tools:[{...row,...changed}],omitted:0}}));
 assert.throws(()=>assertUsageInput({...input(),toolsUsed:{tools:[],omitted:-1}}));
});
