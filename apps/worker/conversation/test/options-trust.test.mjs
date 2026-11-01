/** Public pinned SDK options are built directly from trusted run configuration. */
import test from 'node:test';import assert from 'node:assert/strict';
import {buildConversationOptions,RESPONSE_STYLE,RESPONSE_VOICE} from '../options.mjs';
import {binding,versions} from '../../../control/conversations/test/application-fixture.mjs';
import {BEDROCK_MODEL} from '../provider.mjs';
const runtime=extra=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,model:BEDROCK_MODEL,region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:20,maxCostMicroUSD:2000000,maxOutputBytes:1024,...extra});
test('full native preset, supported task tools and owned 5m cache basis reach the SDK directly',()=>{
 const o=buildConversationOptions(runtime(),new AbortController());
 assert.deepEqual(o.tools,{type:'preset',preset:'claude_code'});assert.equal(o.systemPrompt.preset,'claude_code');assert.equal(o.skills,'all');
 for(const tool of ['TaskCreate','TaskUpdate','TaskGet','TaskList','Agent','Skill','WebFetch'])assert.ok(o.allowedTools.includes(tool));
 assert.equal(o.settings.promptCacheTtl,'5m');assert.equal(o.settings.subagentPromptCacheTtl,'5m');assert.equal(o.sessionStoreFlush,'batched');
 assert.equal(o.env.CLAUDE_CODE_USE_BEDROCK,'1');assert.equal(o.env.AWS_REGION,'us-east-1');
 for(const key of ['ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN','NODE_EXTRA_CA_CERTS','DISABLE_PROMPT_CACHING','CLAUDE_CODE_EFFORT_LEVEL'])assert.equal(o.env[key],undefined);
 assert.equal(o.thinking,undefined);assert.equal(o.spawnClaudeCodeProcess,undefined);
});
test('canonical native limits and output schema remain intact without a model proxy',()=>{
 const r=runtime(),format={type:'json_schema',schema:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false}};
 const o=buildConversationOptions(r,new AbortController(),undefined,undefined,undefined,undefined,undefined,undefined,format);
 assert.equal(o.model,BEDROCK_MODEL);assert.equal(o.maxBudgetUsd,2);assert.equal(o.maxTurns,20);assert.deepEqual(o.outputFormat,format);
});
test('old proxy/CA/hash controls and malformed native limits refuse before querying',()=>{
 for(const extra of [{proxyUrl:'https://synthetic.invalid'},{proxyCredential:'synthetic-only'},{sdkCaFile:'/tmp/ca'},{sdkOptionsSha256:'a'.repeat(64)},{model:'other'},{region:'eu-west-1'},{maxTurns:101},{maxCostMicroUSD:0},{maxOutputTokens:0}])assert.throws(()=>buildConversationOptions(runtime(extra),new AbortController()));
});
test('quality adjustment is one short native append, without a validation loop',()=>{
 const o=buildConversationOptions(runtime(),new AbortController());const append=o.systemPrompt.append;
 for(const sentence of ['Preserve the supplied as-of date','Distinguish source deadlines from proposed dates','Uncorroborated completion is not a contradiction','an unknown owner is not unassigned','only after actually invoking one'])assert.ok(append.includes(sentence));
 assert.ok(append.startsWith('You are Meri'));assert.ok(append.includes('keep responses short does not apply'));assert.ok(append.includes('Finish every section you start'));
 assert.ok(append.startsWith(RESPONSE_STYLE+'\n\n'+RESPONSE_VOICE+'\n\n'));
 assert.equal(append.split(RESPONSE_STYLE).length-1,1);assert.equal(append.split(RESPONSE_VOICE).length-1,1);
 assert.equal(o.systemPrompt.type,'preset');assert.equal(o.systemPrompt.preset,'claude_code');assert.equal(o.hooks,undefined);
});
test('native task list is pinned only inside the owned private SDK configuration',()=>{
 const r=runtime({sdkConfigDirectory:'/run/meri/config/run',sdkSecureStorageDirectory:'/run/meri/secure',providerEnvironment:{CLAUDE_CODE_TASK_LIST_ID:'foreign-list'}});
 const o=buildConversationOptions(r,new AbortController());
 assert.equal(o.env.CLAUDE_CONFIG_DIR,r.sdkConfigDirectory);assert.equal(o.env.CLAUDE_CODE_TASK_LIST_ID,'meri');
 assert.equal(o.env.TMPDIR,'/run/meri/tmp-run');assert.notEqual(o.env.TMPDIR,o.cwd);
 assert.equal(buildConversationOptions(runtime({providerEnvironment:{CLAUDE_CODE_TASK_LIST_ID:'foreign-list'}}),new AbortController()).env.CLAUDE_CODE_TASK_LIST_ID,undefined);
});
