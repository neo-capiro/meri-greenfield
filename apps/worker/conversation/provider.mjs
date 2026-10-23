// @ts-check
/** Direct Bedrock uses the task role. The SDK receives an explicit environment, not ambient provider,
 * endpoint, task-list, pricing or cache overrides. No credentials are read or exchanged here. */
export const BEDROCK_MODEL='us.anthropic.claude-sonnet-4-6';
export const BEDROCK_REGION='us-east-1';
export const NATIVE_CACHE_SETTINGS=Object.freeze({promptCacheTtl:'5m',subagentPromptCacheTtl:'5m'});
const prohibited=['DATABASE_URL','PGPASSWORD','TEMPORAL_API_KEY','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL',
 'ANTHROPIC_BEDROCK_BASE_URL','ANTHROPIC_AWS_BEARER_TOKEN','CLAUDE_CODE_OAUTH_TOKEN','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN',
 'AWS_PROFILE','AWS_SHARED_CREDENTIALS_FILE','AWS_CONFIG_FILE','AWS_BEARER_TOKEN_BEDROCK','AWS_ENDPOINT_URL','AWS_ENDPOINT_URL_BEDROCK_RUNTIME',
 'AWS_CONTAINER_CREDENTIALS_FULL_URI','CLAUDE_CODE_SKIP_BEDROCK_AUTH','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY',
 'CLAUDE_CODE_USE_ANTHROPIC_AWS','CLAUDE_CODE_USE_BEDROCK_MANTLE','CLAUDE_CODE_USE_ANTHROPIC_GOOGLE','ANTHROPIC_BEDROCK_MANTLE_BASE_URL',
 'CLAUDE_CODE_PROMPT_CACHE_TTL','CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL','ENABLE_PROMPT_CACHING_1H','ENABLE_PROMPT_CACHING_1H_BEDROCK',
 'DISABLE_PROMPT_CACHING','MAX_THINKING_TOKENS','CLAUDE_CODE_EFFORT_LEVEL','CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING','CLAUDE_CODE_EXTRA_BODY'];
/** @param {Record<string,string|undefined>} environment */
export function assertBedrockEnvironment(environment){
 if(prohibited.some(key=>environment[key])||environment.CLAUDE_CODE_USE_BEDROCK!==undefined&&environment.CLAUDE_CODE_USE_BEDROCK!=='1')throw Error('RUNNER_AMBIENT_OVERRIDE_REFUSED');
 if(environment.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI&&!/^\/v2\/credentials\/[a-f0-9-]{36}$/iu.test(environment.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI))throw Error('RUNNER_ROLE_ENDPOINT_REFUSED');
}
/** @param {{cwd:string,model:string,region:string,configDirectory?:string,secureStorageDirectory?:string,maxOutputTokens:number,environment?:Record<string,string|undefined>}} input */
export function bedrockEnvironment({cwd,model,region,configDirectory,secureStorageDirectory,maxOutputTokens,environment=process.env}){
 assertBedrockEnvironment(environment);
 if(model!==BEDROCK_MODEL||region!==BEDROCK_REGION||!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>64000)throw Error('BEDROCK_CONFIGURATION_REFUSED');
 return {PATH:environment.PATH??'/usr/local/bin:/usr/bin:/bin',HOME:cwd,TMPDIR:cwd,LANG:'C.UTF-8',
  ...(environment.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI?{AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:environment.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI}:{}),
  AWS_REGION:region,AWS_DEFAULT_REGION:region,AWS_EC2_METADATA_DISABLED:'true',CLAUDE_CODE_USE_BEDROCK:'1',
  ...(configDirectory?{CLAUDE_CONFIG_DIR:configDirectory}:{}),...(secureStorageDirectory?{CLAUDE_SECURESTORAGE_CONFIG_DIR:secureStorageDirectory}:{}),
  CLAUDE_CODE_DISABLE_AUTO_MEMORY:'1',CLAUDE_CODE_MAX_OUTPUT_TOKENS:String(maxOutputTokens),
  ANTHROPIC_DEFAULT_HAIKU_MODEL:model,ANTHROPIC_DEFAULT_SONNET_MODEL:model,ANTHROPIC_DEFAULT_OPUS_MODEL:model};
}
