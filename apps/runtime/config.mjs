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
import {assertNativeReadConfiguration} from '../../packages/contracts/runtime-0.2/reads.mjs';
import {compileControlUserPreferencesConfiguration} from './user-preferences.mjs';
export {compileControlUserPreferencesConfiguration};
export const fault=code=>Object.assign(new Error(code),{code});
const requireValue=(condition,code='RUNTIME_CONFIGURATION')=>{if(!condition)throw fault(code);};
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function file(p){requireValue(typeof p==='string'&&isAbsolute(p)&&!p.includes('/../')&&p.length<=4096);return p;}
function endpoint(value,loopback=false){let u;try{u=new URL(value);}catch{throw fault('RUNTIME_CONFIGURATION');}requireValue(!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&(u.protocol==='https:'||loopback&&u.protocol==='http:'&&['127.0.0.1','[::1]'].includes(u.hostname)));return u.origin;}
const id=(prefix,value)=>typeof value==='string'&&new RegExp(`^${prefix}-[a-f0-9]+$`,'u').test(value);
const taskZone=value=>typeof value==='string'&&value.length<=220&&/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(value);
/** Static router admission is closed before startup reads material or opens a connection. */
export function compileControlTaskRouterConfiguration(configuration){
 const route=configuration.taskRouter;if(route===undefined)return null;
 const c=own(route,['enabled','runnerCaFile','zone','vpcId'],['poststart']),candidate=configuration.nativeCandidate,
  network=candidate?.taskRequest?.networkConfiguration?.awsvpcConfiguration;
 requireValue(c.enabled===true&&configuration.privateHttp?.hostname==='0.0.0.0'&&configuration.privateHttp.port===8082&&
  configuration.http?.port===8080&&configuration.privateHttp.frontendOrigin===configuration.native?.origin&&
  candidate?.multiRun?.dynamicInitialRuns===true&&typeof candidate.multiRun.materialDirectory==='string'&&
  candidate.taskOrigin===configuration.privateHttp.frontendOrigin&&candidate.taskHttp?.hostname==='0.0.0.0'&&candidate.taskHttp.port===8080&&
  typeof c.runnerCaFile==='string'&&taskZone(c.zone)&&id('vpc',c.vpcId)&&
  Array.isArray(network?.subnets)&&network.subnets.length===1&&id('subnet',network.subnets[0])&&
  Array.isArray(network.securityGroups)&&network.securityGroups.length>=1&&network.securityGroups.length<=5&&
  network.securityGroups.every(value=>id('sg',value))&&new Set(network.securityGroups).size===network.securityGroups.length&&
  network.assignPublicIp==='DISABLED','TASK_ROUTER_CONFIGURATION');file(c.runnerCaFile);
 let poststart;
 if(c.poststart!==undefined){
  const p=own(c.poststart,['enabled','runnerCaKeyFile','controlCaFile']);
  const overrides=candidate.taskRequest.overrides?.containerOverrides;
  requireValue(p.enabled===true&&Array.isArray(overrides)&&overrides.length===1&&
   overrides[0].name===candidate.containerName&&
   JSON.stringify(overrides[0].command)==='["start"]'&&
   Array.isArray(overrides[0].environment)&&overrides[0].environment.length===0,'RUNNER_POSTSTART_CONFIGURATION');
  file(p.runnerCaKeyFile);file(p.controlCaFile);
  requireValue(new Set([p.runnerCaKeyFile,p.controlCaFile,c.runnerCaFile]).size===3,'RUNNER_POSTSTART_CONFIGURATION');
  poststart=Object.freeze({runnerCaKeyFile:p.runnerCaKeyFile,controlCaFile:p.controlCaFile});
 }
 return Object.freeze({runnerCaFile:c.runnerCaFile,zone:c.zone,...(poststart?{poststart}:{}),network:Object.freeze({
  clusterArn:candidate.taskRequest.cluster,taskDefinitionArn:candidate.taskRequest.taskDefinition,
  vpcId:c.vpcId,subnetId:network.subnets[0],securityGroupIds:Object.freeze([...network.securityGroups])
 })});
}
export function validateConfiguration(raw,role){
 requireValue(['control','temporal-worker','conversation-runner'].includes(role));const c=data(raw);
 const common=['version','profile','sourceEnabled','limits','native'];
 own(c,[...common,...(role==='control'?['http','database','temporal','sessions','versions']:role==='temporal-worker'?['http','temporal']:['binding','versions','workspace','proxyOrigin'])],role==='conversation-runner'?['bootstrap','captureOwnsClose','remoteTask']:role==='control'?['nativeCandidate','retention','telemetry','downloadLinks','privateHttp','taskRouter','userPreferences']:[]);
 if(c.userPreferences!==undefined){requireValue(role==='control','USER_PREFERENCES_CONFIGURATION');compileControlUserPreferencesConfiguration(c);}
 // Retention serving is an explicit declaration: when enabled, control composes the canonical read gate over its own database and
 // readiness requires the retention projections; when absent, no gate exists and nothing pretends otherwise.
 // Purge is an explicit switch that this source only accepts off: activation is a reviewed change, never a configuration value.
 if(c.retention!==undefined){requireValue(role==='control','RETENTION_CONFIGURATION');own(c.retention,['enabled'],['purge']);requireValue(c.retention.enabled===true,'RETENTION_CONFIGURATION');if(c.retention.purge!==undefined){own(c.retention.purge,['enabled']);requireValue(c.retention.purge.enabled===false,'RETENTION_CONFIGURATION');}}
 requireValue(c.version===1&&c.profile==='isolated-preview'&&c.sourceEnabled===false);
 if(c.captureOwnsClose!==undefined)requireValue(typeof c.captureOwnsClose==='boolean','RUNNER_CAPTURE_CONFIGURATION');
 if(c.bootstrap!==undefined){own(c.bootstrap,['expiresAtMs'],['remote']);requireValue(c.bootstrap.remote===undefined||typeof c.bootstrap.remote==='boolean','TASK_BOOTSTRAP_CONFIGURATION');if(c.bootstrap.remote===true)requireValue(c.captureOwnsClose===true&&c.remoteTask===undefined,'TASK_BOOTSTRAP_CONFIGURATION');requireValue(Number.isSafeInteger(c.bootstrap.expiresAtMs)&&c.bootstrap.expiresAtMs>0,'TASK_BOOTSTRAP_CONFIGURATION');}
 own(c.limits,['startupMs','shutdownMs','requestMs','requestBytes']);requireValue(integer(c.limits.startupMs,100,30000)&&integer(c.limits.shutdownMs,100,30000)&&integer(c.limits.requestMs,10,3000)&&integer(c.limits.requestBytes,1,131072));
 own(c.native,['origin','capabilityFile','loopback','maxResponseBytes'],role==='temporal-worker'?['preparedKickoff']:[]);
 // The poller admits only the prepared original kickoff (stop-owned cleanup); the legacy execution/start mode has no original stop owner (audit L5).
 if(role==='temporal-worker'||c.native.preparedKickoff!==undefined)requireValue(c.native.preparedKickoff===true,'PREPARED_KICKOFF_CONFIGURATION');
 requireValue(typeof c.native.loopback==='boolean'&&integer(c.native.maxResponseBytes,1024,2097152)&&c.native.origin===endpoint(c.native.origin,c.native.loopback));file(c.native.capabilityFile);
 // Telemetry is an explicit control declaration: the OTLP collector origin (signal paths are appended by the SDK owner), an optional
 // export interval and service name. Absent or `enabled:false`, control composes no SDK and no instrumentation.
 if(c.telemetry!==undefined){requireValue(role==='control','TELEMETRY_CONFIGURATION');own(c.telemetry,['enabled','endpoint'],['exportIntervalMs','serviceName']);requireValue(typeof c.telemetry.enabled==='boolean'&&c.telemetry.endpoint===endpoint(c.telemetry.endpoint,c.native.loopback)&&(c.telemetry.exportIntervalMs===undefined||integer(c.telemetry.exportIntervalMs,1000,300000))&&(c.telemetry.serviceName===undefined||/^[a-z][a-z0-9-]{0,62}$/u.test(c.telemetry.serviceName)),'TELEMETRY_CONFIGURATION');}
 // Signed download links are an explicit control declaration: the owner-only signing key file (read through readSecret only by trusted
 // startup) and an optional link lifetime of at most five minutes. Absent or `enabled:false`, the link routes answer DOWNLOADS_UNAVAILABLE.
 if(c.downloadLinks!==undefined){requireValue(role==='control','DOWNLOAD_LINK_CONFIGURATION');own(c.downloadLinks,['enabled'],['keyFile','ttlMs']);requireValue(typeof c.downloadLinks.enabled==='boolean'&&(c.downloadLinks.enabled===false||c.downloadLinks.keyFile!==undefined)&&(c.downloadLinks.ttlMs===undefined||integer(c.downloadLinks.ttlMs,1000,300000)),'DOWNLOAD_LINK_CONFIGURATION');if(c.downloadLinks.keyFile!==undefined)file(c.downloadLinks.keyFile);}
 if(role!=='conversation-runner'){
  own(c.http,['hostname','port','frontendOrigin']);requireValue(['127.0.0.1','0.0.0.0','::1','::'].includes(c.http.hostname)&&integer(c.http.port,0,65535)&&c.http.frontendOrigin===endpoint(c.http.frontendOrigin,c.native.loopback));
  own(c.temporal,['address','namespace','taskQueue','tls'],['authorization']);if(c.temporal.authorization!==undefined)requireValue(parseTemporalAuthorizationConfiguration(c.temporal.authorization).namespace===c.temporal.namespace,'TEMPORAL_AUTHORIZATION_CONFIGURATION');requireValue(typeof c.temporal.address==='string'&&/^[a-zA-Z0-9.\-]+:[1-9][0-9]{0,4}$/u.test(c.temporal.address)&&Number(c.temporal.address.split(':').at(-1))<=65535);for(const k of ['namespace','taskQueue'])requireValue(typeof c.temporal[k]==='string'&&/^[a-zA-Z0-9._\-]{1,128}$/u.test(c.temporal[k]));own(c.temporal.tls,['caFile','certFile','keyFile']);Object.values(c.temporal.tls).forEach(file);
 }
 if(role==='control'){
  if(c.privateHttp!==undefined){own(c.privateHttp,['hostname','port','frontendOrigin']);requireValue(c.nativeCandidate!==undefined&&c.http.port===8080&&c.privateHttp.hostname==='0.0.0.0'&&c.privateHttp.port===8082&&c.privateHttp.frontendOrigin===endpoint(c.privateHttp.frontendOrigin)&&c.privateHttp.frontendOrigin===c.native.origin&&c.privateHttp.frontendOrigin!==c.http.frontendOrigin,'PRIVATE_CONTROL_CONFIGURATION');}
  own(c.database,['connectionFile']);file(c.database.connectionFile);own(c.sessions,['mode','replicas','maxSessions','maxTtlMs']);requireValue(c.sessions.mode==='process-local'&&c.sessions.replicas===1&&integer(c.sessions.maxSessions,1,1000)&&integer(c.sessions.maxTtlMs,1,300000));validateShape('RuntimeVersions',c.versions);
 }
 if(c.nativeCandidate!==undefined){requireValue(role==='control');compilePreparedCandidateConfiguration(c.nativeCandidate,c.versions);requireValue(c.native.capabilityFile===c.nativeCandidate.controlCapabilityFile,'PREPARED_CANDIDATE_CONFIGURATION');}
 if(c.taskRouter!==undefined){requireValue(role==='control','TASK_ROUTER_CONFIGURATION');compileControlTaskRouterConfiguration(c);}
 if(c.remoteTask!==undefined){
  const r=own(c.remoteTask,['original','preparationIntent','taskArn','controlCapabilitySha256','processOrigin','http'],['preparedKickoff','approvedReads','tls']),o=remoteOriginal(r.original),i=compileNativePreparationIntent(r.preparationIntent);
  if(r.approvedReads!==undefined)assertNativeReadConfiguration(r.approvedReads);
  requireValue(role==='conversation-runner'&&c.captureOwnsClose===true&&hash(o.binding)===hash(c.binding)&&hash(o.versions)===hash(c.versions)&&i.workspace===c.workspace&&o.versions.imageDigest==='sha256:'+i.imageSha256&&typeof r.controlCapabilitySha256==='string'&&/^[a-f0-9]{64}$/u.test(r.controlCapabilitySha256)&&typeof r.taskArn==='string'&&/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u.test(r.taskArn)&&r.processOrigin===endpoint(r.processOrigin),'REMOTE_RUNNER_CONFIGURATION');
  own(r.http,['hostname','port','frontendOrigin']);requireValue(['127.0.0.1','0.0.0.0','::1','::'].includes(r.http.hostname)&&integer(r.http.port,0,65535)&&r.http.frontendOrigin===endpoint(r.http.frontendOrigin),'REMOTE_RUNNER_CONFIGURATION');
  if(r.tls!==undefined){own(r.tls,['zone','caFile','certFile','keyFile','candidateFile','metadataFile']);requireValue(taskZone(r.tls.zone)&&r.http.hostname==='0.0.0.0'&&r.http.port===8080,'RUNNER_TLS_CONFIGURATION');for(const name of ['caFile','certFile','keyFile','candidateFile','metadataFile'])file(r.tls[name]);}
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
