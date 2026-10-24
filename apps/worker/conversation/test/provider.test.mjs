import test from 'node:test';import assert from 'node:assert/strict';
import {bedrockEnvironment,assertBedrockEnvironment,BEDROCK_MODEL,BEDROCK_REGION,NATIVE_CACHE_SETTINGS} from '../provider.mjs';
const input={cwd:'/workspace/chat',model:BEDROCK_MODEL,region:BEDROCK_REGION,maxOutputTokens:4096};
test('direct provider uses only task credentials and owned native options',()=>{
 const env=bedrockEnvironment({...input,environment:{PATH:'/bin',AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:'/v2/credentials/10000000-0000-4000-8000-000000000001',CLAUDE_CODE_TASK_LIST_ID:'other-task',UNRELATED_SECRET:'private',NODE_OPTIONS:'unsafe',CLAUDE_CONFIG_DIR:'/ambient'}});
 assert.equal(env.CLAUDE_CODE_USE_BEDROCK,'1');assert.equal(env.AWS_REGION,'us-east-1');assert.ok(env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI);
 for(const key of ['UNRELATED_SECRET','CLAUDE_CODE_TASK_LIST_ID','NODE_OPTIONS','CLAUDE_CONFIG_DIR','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL','MAX_THINKING_TOKENS','DISABLE_PROMPT_CACHING'])assert.equal(env[key],undefined);
 assert.deepEqual(NATIVE_CACHE_SETTINGS,{promptCacheTtl:'5m',subagentPromptCacheTtl:'5m'});
});
test('provider/TTL/body overrides refuse without exposing the value',()=>{
 for(const key of ['AWS_PROFILE','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL','AWS_ENDPOINT_URL','CLAUDE_CODE_PROMPT_CACHE_TTL','CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL','ENABLE_PROMPT_CACHING_1H_BEDROCK','CLAUDE_CODE_EXTRA_BODY'])assert.throws(()=>bedrockEnvironment({...input,environment:{[key]:'private'}}),error=>error.message==='RUNNER_AMBIENT_OVERRIDE_REFUSED');
 assert.throws(()=>assertBedrockEnvironment({AWS_CONTAINER_CREDENTIALS_FULL_URI:'https://foreign.invalid'}),/OVERRIDE_REFUSED/);
 assert.throws(()=>assertBedrockEnvironment({AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:'/foreign'}),/ROLE_ENDPOINT_REFUSED/);
});
test('model, region and native output limit come from owned configuration',()=>{
 for(const change of [{model:'unapproved'},{region:'eu-west-1'},{maxOutputTokens:0},{maxOutputTokens:64001}])assert.throws(()=>bedrockEnvironment({...input,...change,environment:{}}),/BEDROCK_CONFIGURATION_REFUSED/);
});

test('platform-injected temporary credentials use the normal SDK chain; incomplete credentials and metadata overrides refuse',()=>{
 const role={AWS_ACCESS_KEY_ID:'synthetic-id',AWS_SECRET_ACCESS_KEY:'synthetic-secret',AWS_SESSION_TOKEN:'synthetic-token'};
 const env=bedrockEnvironment({...input,environment:role});for(const [key,value] of Object.entries(role))assert.equal(env[key],value);
 const metadata=bedrockEnvironment({...input,environment:{}});assert.equal(metadata.AWS_EC2_METADATA_DISABLED,undefined);assert.equal(metadata.AWS_EC2_METADATA_V1_DISABLED,'true');
 for(const key of Object.keys(role)){const partial={...role};delete partial[key];assert.throws(()=>bedrockEnvironment({...input,environment:partial}),/ROLE_CREDENTIALS_REFUSED/);}
 for(const key of ['AWS_EC2_METADATA_SERVICE_ENDPOINT','AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE','AWS_EC2_METADATA_DISABLED','AWS_EC2_METADATA_V1_DISABLED','AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE'])assert.throws(()=>bedrockEnvironment({...input,environment:{[key]:'override'}}),/OVERRIDE_REFUSED/);
});
