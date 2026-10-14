/** Immutable supervisor inputs. No worker input, IO or allocation at construction. */
import {isAbsolute,normalize} from 'node:path';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
export const launchFault=code=>Object.assign(Error('NATIVE_LAUNCH_'+code),{code:'NATIVE_LAUNCH_'+code});
const absolute=value=>typeof value==='string'&&isAbsolute(value)&&normalize(value)===value&&value!=='/'&&!value.endsWith('/')&&!/[\x00-\x1f\x7f]/u.test(value);
export function compileNativeLaunch(configuration){
 const c=own(configuration,['binding','workspace','configDirectory','versions','expiresAtMs','executableSha256','launch'],['enabled','now','signal','shutdownMs','limits']);
 const binding=data(c.binding);validateShape('RunBinding',binding);
 const versions=data(own(c.versions,['sdk','cli'])),launch=data(own(c.launch,['command','args','env']));
 nativeSignal(c.signal);const now=c.now??Date.now,shutdownMs=c.shutdownMs??1000,enabled=c.enabled??false;
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(shutdownMs)||shutdownMs<10||shutdownMs>10000||
  !absolute(c.workspace)||!absolute(c.configDirectory)||!absolute(launch.command)||
  c.workspace.replace(/[^a-zA-Z0-9]/gu,'-').length>256||versions.sdk!=='0.3.295'||versions.cli!=='2.1.295'||
  typeof c.executableSha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.executableSha256)||
  !Array.isArray(launch.args)||launch.args.length>256||launch.args.some(v=>typeof v!=='string'||v.includes('\0'))||
  Buffer.byteLength(JSON.stringify(launch.args))>65536||!launch.env||Array.isArray(launch.env)||typeof launch.env!=='object'||
  Object.entries(launch.env).some(([k,v])=>! /^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(k)||typeof v!=='string'||v.includes('\0'))||
  Buffer.byteLength(JSON.stringify(launch.env))>65536||launch.env.CLAUDE_CONFIG_DIR!==c.configDirectory||
  launch.env.CLAUDE_SECURESTORAGE_CONFIG_DIR!==c.configDirectory)throw launchFault('CONFIGURATION');
 // Proxy-scoped ANTHROPIC_AUTH_TOKEN may be compiled by the runtime owner. Never
 // inherit provider/account, database, cloud or control-plane credentials.
 const forbidden=['DATABASE_URL','PGPASSWORD','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','TEMPORAL_API_KEY','MERI_NATIVE_ADMIN_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY'];
 if(Object.keys(launch.env).some(k=>/^(AWS_|GOOGLE_|GCP_|AZURE_|OPENAI_)/u.test(k)||forbidden.includes(k)))throw launchFault('ENVIRONMENT');
 const at=now();if(!Number.isSafeInteger(at)||at<1||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=at||c.expiresAtMs-at>2147483647)throw launchFault('LEASE');
 const limits=c.limits===undefined?undefined:data(own(c.limits,[],['maxFrameBytes','maxTotalBytes','maxWaiters','maxRequestMs']));
 const caps={maxFrameBytes:9437184,maxTotalBytes:67108864,maxWaiters:32,maxRequestMs:30000};
 if(limits&&Object.keys(limits).some(k=>!Number.isSafeInteger(limits[k])||limits[k]<1||limits[k]>caps[k]))throw launchFault('CONFIGURATION');
 return Object.freeze({...c,binding,versions,launch,now,shutdownMs,enabled,limits,startedAtMs:at,
  requestSha256:canonicalSha256({...launch,cwd:c.workspace})});
}
export function matchNativeLaunch(request,c){
 const r=own(request,['command','args','cwd','env'],['signal']);nativeSignal(r.signal);
 if(canonicalSha256(data({command:r.command,args:r.args,cwd:r.cwd,env:r.env}))!==c.requestSha256)throw launchFault('REQUEST_REFUSED');
 return r.signal;
}
