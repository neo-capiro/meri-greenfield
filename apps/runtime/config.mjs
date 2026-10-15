/** Closed explicit configuration. Parsing never opens a network connection. */
import {readFile,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {remoteOriginal} from './native-authority/remote-task-boundary.mjs';
import {compileNativePreparationIntent} from './native-authority/preparation-intent.mjs';
import {compilePreparedCandidateConfiguration} from './prepared-candidate-config.mjs';
import {parseTemporalAuthorizationConfiguration} from './temporal-authorization.mjs';
export const fault=code=>Object.assign(new Error(code),{code});
const requireValue=(condition,code='RUNTIME_CONFIGURATION')=>{if(!condition)throw fault(code);};
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function file(p){requireValue(typeof p==='string'&&isAbsolute(p)&&!p.includes('/../')&&p.length<=4096);return p;}
function endpoint(value,loopback=false){let u;try{u=new URL(value);}catch{throw fault('RUNTIME_CONFIGURATION');}requireValue(!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&(u.protocol==='https:'||loopback&&u.protocol==='http:'&&['127.0.0.1','[::1]'].includes(u.hostname)));return u.origin;}
export function validateConfiguration(raw,role){
 requireValue(['control','temporal-worker','conversation-runner'].includes(role));const c=data(raw);
 const common=['version','profile','sourceEnabled','limits','native'];
 own(c,[...common,...(role==='control'?['http','database','temporal','sessions','versions']:role==='temporal-worker'?['http','temporal']:['binding','versions','workspace','proxyOrigin'])],role==='conversation-runner'?['bootstrap','captureOwnsClose','remoteTask']:role==='control'?['nativeCandidate']:[]);
 requireValue(c.version===1&&c.profile==='isolated-preview'&&c.sourceEnabled===false);
 if(c.captureOwnsClose!==undefined)requireValue(typeof c.captureOwnsClose==='boolean','RUNNER_CAPTURE_CONFIGURATION');
 if(c.bootstrap!==undefined){own(c.bootstrap,['expiresAtMs'],['remote']);requireValue(c.bootstrap.remote===undefined||typeof c.bootstrap.remote==='boolean','TASK_BOOTSTRAP_CONFIGURATION');if(c.bootstrap.remote===true)requireValue(c.captureOwnsClose===true&&c.remoteTask===undefined,'TASK_BOOTSTRAP_CONFIGURATION');requireValue(Number.isSafeInteger(c.bootstrap.expiresAtMs)&&c.bootstrap.expiresAtMs>0,'TASK_BOOTSTRAP_CONFIGURATION');}
 own(c.limits,['startupMs','shutdownMs','requestMs','requestBytes']);requireValue(integer(c.limits.startupMs,100,30000)&&integer(c.limits.shutdownMs,100,30000)&&integer(c.limits.requestMs,10,3000)&&integer(c.limits.requestBytes,1,131072));
 own(c.native,['origin','capabilityFile','loopback','maxResponseBytes'],role==='temporal-worker'?['preparedKickoff']:[]);if(c.native.preparedKickoff!==undefined)requireValue(c.native.preparedKickoff===true,'PREPARED_KICKOFF_CONFIGURATION');requireValue(typeof c.native.loopback==='boolean'&&integer(c.native.maxResponseBytes,1024,2097152)&&c.native.origin===endpoint(c.native.origin,c.native.loopback));file(c.native.capabilityFile);
 if(role!=='conversation-runner'){
  own(c.http,['hostname','port','frontendOrigin']);requireValue(['127.0.0.1','0.0.0.0','::1','::'].includes(c.http.hostname)&&integer(c.http.port,0,65535)&&c.http.frontendOrigin===endpoint(c.http.frontendOrigin,c.native.loopback));
  own(c.temporal,['address','namespace','taskQueue','tls'],['authorization']);if(c.temporal.authorization!==undefined)parseTemporalAuthorizationConfiguration(c.temporal.authorization);requireValue(typeof c.temporal.address==='string'&&/^[a-zA-Z0-9.\-]+:[1-9][0-9]{0,4}$/u.test(c.temporal.address)&&Number(c.temporal.address.split(':').at(-1))<=65535);for(const k of ['namespace','taskQueue'])requireValue(typeof c.temporal[k]==='string'&&/^[a-zA-Z0-9._\-]{1,128}$/u.test(c.temporal[k]));own(c.temporal.tls,['caFile','certFile','keyFile']);Object.values(c.temporal.tls).forEach(file);
 }
 if(role==='control'){
  own(c.database,['connectionFile']);file(c.database.connectionFile);own(c.sessions,['mode','replicas','maxSessions','maxTtlMs']);requireValue(c.sessions.mode==='process-local'&&c.sessions.replicas===1&&integer(c.sessions.maxSessions,1,1000)&&integer(c.sessions.maxTtlMs,1,300000));validateShape('RuntimeVersions',c.versions);
 }
 if(c.nativeCandidate!==undefined){requireValue(role==='control');compilePreparedCandidateConfiguration(c.nativeCandidate,c.versions);requireValue(c.native.capabilityFile===c.nativeCandidate.controlCapabilityFile,'PREPARED_CANDIDATE_CONFIGURATION');}
 if(c.remoteTask!==undefined){
  const r=own(c.remoteTask,['original','preparationIntent','taskArn','controlCapabilitySha256','processOrigin','http'],['preparedKickoff']),o=remoteOriginal(r.original),i=compileNativePreparationIntent(r.preparationIntent);
  requireValue(role==='conversation-runner'&&c.captureOwnsClose===true&&hash(o.binding)===hash(c.binding)&&hash(o.versions)===hash(c.versions)&&i.workspace===c.workspace&&o.versions.imageDigest==='sha256:'+i.imageSha256&&typeof r.controlCapabilitySha256==='string'&&/^[a-f0-9]{64}$/u.test(r.controlCapabilitySha256)&&typeof r.taskArn==='string'&&/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u.test(r.taskArn)&&r.processOrigin===endpoint(r.processOrigin),'REMOTE_RUNNER_CONFIGURATION');
  own(r.http,['hostname','port','frontendOrigin']);requireValue(['127.0.0.1','0.0.0.0','::1','::'].includes(r.http.hostname)&&integer(r.http.port,0,65535)&&r.http.frontendOrigin===endpoint(r.http.frontendOrigin),'REMOTE_RUNNER_CONFIGURATION');
  if(r.preparedKickoff!==undefined)requireValue(r.preparedKickoff===true,'REMOTE_RUNNER_CONFIGURATION');
  if(c.bootstrap)requireValue(c.bootstrap.expiresAtMs===o.expiresAtMs,'REMOTE_RUNNER_CONFIGURATION');
 }
 if(role==='conversation-runner'){validateShape('RunBinding',c.binding);validateShape('RuntimeVersions',c.versions);file(c.workspace);requireValue(c.workspace.endsWith('/'+c.binding.conversationId)&&c.proxyOrigin===endpoint(c.proxyOrigin));}
 return Object.freeze(c);
}
export async function loadConfiguration(path,role){file(path);const bytes=await readFile(path);requireValue(bytes.length<=32768);let raw;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fault('RUNTIME_CONFIGURATION');}return validateConfiguration(raw,role);}
export async function readSecret(path){
 file(path);let handle;try{handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat();requireValue(stat.isFile()&&stat.size>0&&stat.size<=32768&&(stat.mode&0o077)===0&&stat.uid===process.getuid(),'RUNTIME_SECRET_FILE');const bytes=await handle.readFile();requireValue(bytes.length<=32768,'RUNTIME_SECRET_FILE');return bytes;}catch{throw fault('RUNTIME_SECRET_FILE');}finally{await handle?.close();}
}
