import test from 'node:test';import assert from 'node:assert/strict';
import {buildConversationOptions} from '../options.mjs';
import {sdkProviderEnvironment} from '../provider.mjs';
const key='sk-ant-synthetic-test-key-never-a-credential',id='10000000-0000-4000-8000-000000000001';
const role={AWS_ACCESS_KEY_ID:'synthetic',AWS_SECRET_ACCESS_KEY:'synthetic',AWS_SESSION_TOKEN:'synthetic',AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:'/v2/credentials/'+id};
const input={binding:{conversationId:id},versions:{sdk:'0.3.295',cli:'2.1.295'},cwd:'/workspace/conversations/'+id,model:'claude-sonnet-4-6',provider:'claude-api',region:'us-east-1',maxOutputTokens:4096,providerApiKey:key,providerEnvironment:role,sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+30000,maxTurns:4,maxCostMicroUSD:1000000,maxOutputBytes:1024};
test('SDK receives the chosen model/effort and only Claude API credentials, with the full native harness',()=>{
 for(const effort of [null,'low','medium','high','xhigh','max']){
  const options=buildConversationOptions({...input,effort},new AbortController());
  assert.equal(options.model,input.model);assert.equal(options.effort,effort??undefined);assert.equal(options.env.ANTHROPIC_API_KEY,key);
  for(const name of [...Object.keys(role),'CLAUDE_CODE_USE_BEDROCK','AWS_REGION'])assert.equal(options.env[name],undefined);
  assert.equal(options.env.AWS_EC2_METADATA_DISABLED,'true');assert.equal(options.systemPrompt.preset,'claude_code');assert.deepEqual(options.tools,{type:'preset',preset:'claude_code'});assert.equal(options.skills,'all');
 }
});
test('Bedrock options preserve runtime role credentials and never accept an API key',()=>{
 const {providerApiKey,...bedrock}=input;
 const options=buildConversationOptions({...bedrock,provider:'bedrock',model:'us.anthropic.claude-opus-4-6-v1',effort:'high'},new AbortController());
 assert.equal(options.env.ANTHROPIC_API_KEY,undefined);assert.equal(options.env.CLAUDE_CODE_USE_BEDROCK,'1');assert.equal(options.env.AWS_SESSION_TOKEN,'synthetic');
 assert.throws(()=>buildConversationOptions({...bedrock,provider:'bedrock',providerApiKey,model:'us.anthropic.claude-sonnet-4-6'},new AbortController()),/SDK_PROVIDER_CONFIGURATION_REFUSED/);
});
test('invalid model/provider/effort and ambient keys fail before an SDK query without exposing secrets',()=>{
 for(const override of [{provider:'other'},{model:'https://foreign.invalid'},{providerApiKey:undefined},{effort:'invented'}])assert.throws(()=>buildConversationOptions({...input,...override},new AbortController()),e=>!e.message.includes(key));
 assert.throws(()=>sdkProviderEnvironment({...input,apiKey:key,environment:{ANTHROPIC_API_KEY:key}}),e=>e.message==='RUNNER_AMBIENT_OVERRIDE_REFUSED');
});
