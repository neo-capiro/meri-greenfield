import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeHookBatch,MAX_TOOL_AUDIT_RECORDS} from '../capabilities/hooks.mjs';
const invoke=(batch,event,input)=>batch.hooks[event][0].hooks[0](input,undefined,{signal:new AbortController().signal});
test('native success and failure hooks retain names, IDs, outcome and optional duration only',async()=>{
 const batch=createNativeHookBatch();assert.deepEqual(Object.keys(batch.hooks),['PostToolUse','PostToolUseFailure']);
 const input={tool_name:'mcp__capiro__read',tool_use_id:'toolu_1',duration_ms:12,tool_input:{secret:'never'},tool_response:'never',error:'never',session_id:'never',cwd:'never',transcript_path:'never'};
 assert.deepEqual(await invoke(batch,'PostToolUse',input),{});assert.deepEqual(await invoke(batch,'PostToolUseFailure',{...input,tool_use_id:'toolu_2',duration_ms:undefined}),{});
 assert.deepEqual(batch.snapshot(),{tools:[{tool:'mcp__capiro__read',toolUseId:'toolu_1',outcome:'completed',durationMs:12},{tool:'mcp__capiro__read',toolUseId:'toolu_2',outcome:'failed',durationMs:null}],omitted:0});
 assert.equal(JSON.stringify(batch.snapshot()).includes('never'),false);
});
test('hooks never inspect input/output content or call an external port',async()=>{
 const batch=createNativeHookBatch(),input={tool_name:'Read',tool_use_id:'toolu_1'};
 for(const key of ['tool_input','tool_response','error'])Object.defineProperty(input,key,{get(){throw Error('content must not be read');}});
 assert.deepEqual(await invoke(batch,'PostToolUse',input),{});assert.equal(batch.snapshot().tools.length,1);
});
test('malformed metadata and bounded overflow remain explicit without stopping SDK',async()=>{
 const batch=createNativeHookBatch();for(const input of [null,{}, {tool_name:'Read private content',tool_use_id:'x'},{tool_name:'Read',tool_use_id:'x'.repeat(201)}])assert.deepEqual(await invoke(batch,'PostToolUse',input),{});
 for(let n=0;n<MAX_TOOL_AUDIT_RECORDS+1;n++)await invoke(batch,'PostToolUse',{tool_name:'Read',tool_use_id:`toolu_${n}`,duration_ms:-1});
 assert.equal(batch.snapshot().omitted,5);assert.equal(batch.snapshot().tools.length,MAX_TOOL_AUDIT_RECORDS);assert.equal(batch.snapshot().tools[0].durationMs,null);
});
test('taking a batch snapshot does not consume or expose mutable audit storage',async()=>{
 const batch=createNativeHookBatch();await invoke(batch,'PostToolUse',{tool_name:'Read',tool_use_id:'toolu_1'});
 const value=batch.snapshot();value.tools[0].tool='changed';value.tools.push({});
 assert.equal(batch.snapshot().tools[0].tool,'Read');assert.equal(batch.snapshot().tools.length,1);
});
