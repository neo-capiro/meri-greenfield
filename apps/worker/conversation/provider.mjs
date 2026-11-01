// @ts-check
/** The SDK receives only the selected provider's explicit environment. Bedrock uses the
 * platform role; the runtime alone supplies a Secrets Manager API key for Claude API. */
import path from 'node:path';
import {HISTORICAL_MODEL_SELECTION} from '../../../packages/contracts/model-selection.mjs';
/** A fresh run-owned sibling of the conversation's config parent. Keeping the path short
 * also leaves room for the SDK's Unix socket names. The directory owner creates it before query. */
export function sdkTemporaryDirectory(configDirectory){
 if(typeof configDirectory!=='string')throw Error('SDK_PROVIDER_CONFIGURATION_REFUSED');
 const paths=configDirectory.startsWith('/')?path.posix:path;
 if(!paths.isAbsolute(configDirectory)||paths.resolve(configDirectory)!==configDirectory)throw Error('SDK_PROVIDER_CONFIGURATION_REFUSED');
 return paths.join(paths.dirname(paths.dirname(configDirectory)),'tmp-'+paths.basename(configDirectory));
}
/** Legacy fixture default; admitted production turns carry the deployment-selected model explicitly. */
export const BEDROCK_MODEL=HISTORICAL_MODEL_SELECTION.modelId;
export const BEDROCK_REGION='us-east-1';
export const NATIVE_CACHE_SETTINGS=Object.freeze({promptCacheTtl:'5m',subagentPromptCacheTtl:'5m'});
const prohibited=['DATABASE_URL','PGPASSWORD','TEMPORAL_API_KEY','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL',
 'ANTHROPIC_BEDROCK_BASE_URL','ANTHROPIC_AWS_BEARER_TOKEN','CLAUDE_CODE_OAUTH_TOKEN',
 'AWS_PROFILE','AWS_SHARED_CREDENTIALS_FILE','AWS_CONFIG_FILE','AWS_BEARER_TOKEN_BEDROCK','AWS_ENDPOINT_URL','AWS_ENDPOINT_URL_BEDROCK_RUNTIME',
 'AWS_CONTAINER_CREDENTIALS_FULL_URI','AWS_CONTAINER_AUTHORIZATION_TOKEN','AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE','AWS_EC2_METADATA_SERVICE_ENDPOINT','AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE','AWS_EC2_METADATA_DISABLED','AWS_EC2_METADATA_V1_DISABLED','CLAUDE_CODE_SKIP_BEDROCK_AUTH','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY',
 'CLAUDE_CODE_USE_ANTHROPIC_AWS','CLAUDE_CODE_USE_BEDROCK_MANTLE','CLAUDE_CODE_USE_ANTHROPIC_GOOGLE','ANTHROPIC_BEDROCK_MANTLE_BASE_URL',
 'CLAUDE_CODE_PROMPT_CACHE_TTL','CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL','ENABLE_PROMPT_CACHING_1H','ENABLE_PROMPT_CACHING_1H_BEDROCK',
 'DISABLE_PROMPT_CACHING','MAX_THINKING_TOKENS','CLAUDE_CODE_EFFORT_LEVEL','CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING','CLAUDE_CODE_EXTRA_BODY'];
/** @param {Record<string,string|undefined>} environment */
export function assertProviderEnvironment(environment){
 if(prohibited.some(key=>environment[key])||environment.CLAUDE_CODE_USE_BEDROCK!==undefined&&environment.CLAUDE_CODE_USE_BEDROCK!=='1')throw Error('RUNNER_AMBIENT_OVERRIDE_REFUSED');
 const roleKeys=['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN'];
 if(roleKeys.some(key=>environment[key]!==undefined)&&!roleKeys.every(key=>typeof environment[key]==='string'&&environment[key].length>0&&!/[\r\n]/u.test(environment[key])))throw Error('RUNNER_ROLE_CREDENTIALS_REFUSED');
 if(environment.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI&&!/^\/v2\/credentials\/[a-f0-9-]{36}$/iu.test(environment.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI))throw Error('RUNNER_ROLE_ENDPOINT_REFUSED');
}
/** @param {{provider?:'bedrock'|'claude-api',apiKey?:string,cwd:string,model:string,region:string,configDirectory?:string,secureStorageDirectory?:string,maxOutputTokens:number,environment?:Record<string,string|undefined>}} input */
export function sdkProviderEnvironment({provider='bedrock',apiKey,cwd,model,region,configDirectory,secureStorageDirectory,maxOutputTokens,environment=process.env}){
 assertProviderEnvironment(environment);
 if(!['bedrock','claude-api'].includes(provider)||typeof model!=='string'||region!==BEDROCK_REGION||!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>64000)throw Error('SDK_PROVIDER_CONFIGURATION_REFUSED');
 if(provider==='bedrock'&&(!/^us\.anthropic\.claude-[a-z0-9][a-z0-9.:-]{0,150}$/u.test(model)||apiKey!==undefined)||
    provider==='claude-api'&&(!/^claude-[a-z0-9][a-z0-9.-]{0,150}$/u.test(model)||typeof apiKey!=='string'||!/^sk-ant-[A-Za-z0-9_-]{16,512}$/u.test(apiKey)))throw Error('SDK_PROVIDER_CONFIGURATION_REFUSED');
 const credentials=provider==='claude-api'?{ANTHROPIC_API_KEY:apiKey,AWS_EC2_METADATA_DISABLED:'true'}:{
  ...(environment.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI?{AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:environment.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI}:{}),
  ...Object.fromEntries(['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN'].filter(key=>environment[key]!==undefined).map(key=>[key,environment[key]])),
  AWS_REGION:region,AWS_DEFAULT_REGION:region,AWS_EC2_METADATA_V1_DISABLED:'true',CLAUDE_CODE_USE_BEDROCK:'1'};
 return {PATH:environment.PATH??'/usr/local/bin:/usr/bin:/bin',HOME:cwd,TMPDIR:configDirectory?sdkTemporaryDirectory(configDirectory):cwd,LANG:'C.UTF-8',...credentials,
  ...(configDirectory?{CLAUDE_CONFIG_DIR:configDirectory}:{}),...(secureStorageDirectory?{CLAUDE_SECURESTORAGE_CONFIG_DIR:secureStorageDirectory}:{}),
  CLAUDE_CODE_DISABLE_AUTO_MEMORY:'1',CLAUDE_CODE_MAX_OUTPUT_TOKENS:String(maxOutputTokens),
  ANTHROPIC_DEFAULT_HAIKU_MODEL:model,ANTHROPIC_DEFAULT_SONNET_MODEL:model,ANTHROPIC_DEFAULT_OPUS_MODEL:model};
}
