/** Immutable image/runner/path/SDK-option intent, compiled before RunTask. */
import {isAbsolute,normalize,dirname} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {executionFault} from './execution-broker.mjs';
const refuse=()=>{throw executionFault('PREPARATION_REFUSED');};
const absolute=p=>typeof p==='string'&&isAbsolute(p)&&normalize(p)===p&&p!=='/'&&!p.endsWith('/')&&!/[\x00-\x1f\x7f]/u.test(p);
export function compileNativePreparationIntent(value){
 const c=data(own(value,['workspace','configParentDirectory','secureStorageDirectory','launchTemplate','executableSha256','imageSha256','runnerSha256','sdkOptionsSha256','authoritySha256']));
 const t=own(c.launchTemplate,['command','args','env']);
 if(![c.workspace,c.configParentDirectory,c.secureStorageDirectory,t.command].every(absolute)||!['executableSha256','imageSha256','runnerSha256','sdkOptionsSha256','authoritySha256'].every(k=>typeof c[k]==='string'&&/^[a-f0-9]{64}$/u.test(c[k]))||!Array.isArray(t.args)||t.args.length>256||t.args.some(v=>typeof v!=='string'||v.includes('\0'))||!t.env||typeof t.env!=='object'||Array.isArray(t.env)||Object.hasOwn(t.env,'CLAUDE_CONFIG_DIR')||t.env.CLAUDE_SECURESTORAGE_CONFIG_DIR!==c.secureStorageDirectory||Object.entries(t.env).some(([k,v])=>! /^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(k)||typeof v!=='string'||v.includes('\0'))||Buffer.byteLength(JSON.stringify(t))>131072)refuse();
 const forbidden=new Set(['DATABASE_URL','PGPASSWORD','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','ANTHROPIC_AWS_BEARER_TOKEN','ANTHROPIC_AWS_REGION','TEMPORAL_API_KEY','MERI_NATIVE_ADMIN_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY']);
 if(Object.keys(t.env).some(k=>/^(AWS_|GOOGLE_|GCP_|AZURE_|OPENAI_)/u.test(k)||forbidden.has(k)))refuse();
 return c;
}
export function matchPreparedDescriptor(value,intent){
 const i=compileNativePreparationIntent(intent),d=data(own(value,['command','args','cwd','env'])),env=d.env;
 if(!env||Array.isArray(env)||!absolute(env.CLAUDE_CONFIG_DIR)||dirname(env.CLAUDE_CONFIG_DIR)!==i.configParentDirectory||d.cwd!==i.workspace)refuse();
 const {CLAUDE_CONFIG_DIR:ignored,...fixed}=env;
 if(hash({command:d.command,args:d.args,env:fixed})!==hash(i.launchTemplate))refuse();
 return d;
}
