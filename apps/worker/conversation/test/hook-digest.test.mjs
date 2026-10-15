/** Hook digest bytes and required SDK string fields (dot P2a review, telemetry freeze blocker 1). The vectors pin the
 * single rule proposed in the lane report: digest = lowercase hex SHA-256 of the RFC 8785 canonical JSON bytes of the
 * field's JSON value, so a string is digested WITH its quotes and JSON escaping. A string field the SDK hook type
 * requires (`compact_summary`, `error`) that is absent or not a string is refused and latched, never digested as ''
 * or null. Synthetic hook inputs; no SDK process. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createAuditHooks,createCompactionHooks} from '../capabilities/hooks.mjs';
const raw=bytes=>createHash('sha256').update(bytes,'utf8').digest('hex');
/** [name, JSON value, exact canonical bytes, expected digest]. */
const DIGEST_VECTORS=Object.freeze([
 ['empty string','','""','12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126'],
 ['null (only for unknown-typed fields, absent or null)',null,'null','74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b'],
 ['escaping','a"b\\c\n\t/','"a\\"b\\\\c\\n\\t/"','37cbb89a95cfae327a2e8681bc1627570b46bbf6b4a0cb672c174d38ebb9d05d'],
 ['control character','\u0001','"\\u0001"','b81cfb0a6715e53b373345b49e8ad94eb55fd777519dc539373d0634973c186e'],
 ['Unicode BMP','é','"é"','f2886017e9c7abacf804b54d64787dce2b611c9544ba21f3affdd126a6e50086'],
 ['Unicode astral','\u{1F600}','"\u{1F600}"','7a0c50b92434b015545fe93ab723db2d4b2cdd14a441405624a9ce8be29f1d5a'],
 ['U+2028 stays literal',' ','" "','8aa716ff98153a8b537e4e21f27cb75d7ebe92f4754aca11a38ee7a27b714941'],
 ['object keys sorted',{b:1,a:[true,null,'x']},'{"a":[true,null,"x"],"b":1}','54a65415ad370228851a1da4b31b6fd42dc58b19a50d35cae759325f7388ce64']]);
const hookOptions={signal:new AbortController().signal},base={session_id:'s',transcript_path:'/tmp/t.jsonl',cwd:'/workspace/c'};
const STOP={continue:false,stopReason:'AUDIT_UNAVAILABLE'};
const sink=()=>{const published=[],latched=[];return {published,latched,ports:{publish:async(type,data)=>{published.push({type,data});},latch:e=>latched.push(e?.message)}};};

test('digest vectors: canonical bytes and SHA-256 for empty, null, escaping, control, Unicode and key order',()=>{
 for(const [name,value,bytes,hex] of DIGEST_VECTORS){assert.equal(raw(bytes),hex,`${name}: bytes`);assert.equal(canonicalSha256(value),hex,`${name}: canonicalSha256`);}
 assert.throws(()=>canonicalSha256('\ud800'),'a lone surrogate has no UTF-8 encoding and is refused');
});

test('a missing or non-string compact_summary is refused and latched, never digested as an empty summary',async()=>{
 for(const compact of [undefined,null,0,{},['x']]){
  const {published,latched,ports}=sink();const input={...base,hook_event_name:'PostCompact',trigger:'auto',...(compact===undefined?{}:{compact_summary:compact})};
  assert.deepEqual(await createCompactionHooks(ports).PostCompact[0].hooks[0](input,undefined,hookOptions),STOP,String(compact));
  assert.deepEqual(published,[]);assert.deepEqual(latched,['COMPACTION_INPUT_REFUSED']);
 }
 const {published,latched,ports}=sink();
 assert.deepEqual(await createCompactionHooks(ports).PostCompact[0].hooks[0]({...base,hook_event_name:'PostCompact',trigger:'manual',compact_summary:''},undefined,hookOptions),{});
 assert.deepEqual(published[0].data,{phase:'post',trigger:'manual',summarySha256:DIGEST_VECTORS[0][3],summaryBytes:0,agentId:null,agentType:null},'a present empty summary is valid');assert.deepEqual(latched,[]);
 const lone=sink();assert.deepEqual(await createCompactionHooks(lone.ports).PostCompact[0].hooks[0]({...base,hook_event_name:'PostCompact',trigger:'manual',compact_summary:'\ud800'},undefined,hookOptions),STOP);assert.equal(lone.latched.length,1);assert.deepEqual(lone.published,[]);
});

test('a missing or non-string tool failure error is refused and latched; a present one is digested by the rule',async()=>{
 const failure={...base,hook_event_name:'PostToolUseFailure',tool_name:'Read',tool_input:{},tool_use_id:'t1'};
 for(const error of [undefined,null,7]){
  const {published,latched,ports}=sink();
  assert.deepEqual(await createAuditHooks(ports).PostToolUseFailure[0].hooks[0]({...failure,...(error===undefined?{}:{error})},'t1',hookOptions),STOP,String(error));
  assert.deepEqual(published,[]);assert.deepEqual(latched,['AUDIT_INPUT_REFUSED']);
 }
 const {published,ports}=sink();await createAuditHooks(ports).PostToolUseFailure[0].hooks[0]({...failure,error:'é'},'t1',hookOptions);
 assert.equal(published[0].data.errorSha256,DIGEST_VECTORS[4][3]);
});

test('unknown-typed tool_input and tool_response: an absent key and null both digest as canonical null',async()=>{
 const {published,ports}=sink();const hooks=createAuditHooks(ports);
 await hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Read',tool_use_id:'t1'},'t1',hookOptions);
 await hooks.PostToolUse[0].hooks[0]({...base,hook_event_name:'PostToolUse',tool_name:'Read',tool_input:null,tool_response:null,tool_use_id:'t1'},'t1',hookOptions);
 assert.equal(published[0].data.inputSha256,DIGEST_VECTORS[1][3]);assert.equal(published[1].data.inputSha256,DIGEST_VECTORS[1][3]);assert.equal(published[1].data.responseSha256,DIGEST_VECTORS[1][3]);
});
