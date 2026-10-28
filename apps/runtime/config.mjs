/** Closed explicit configuration. Parsing never opens a network connection. */
import {readFile,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {compileAgentCoreConfiguration} from './agentcore-configuration.mjs';
import {assertModelCatalog} from '../../packages/contracts/model-selection.mjs';
import {compileControlUserPreferencesConfiguration} from './user-preferences.mjs';
import {compileScheduleServiceConfiguration} from './schedule-service-configuration.mjs';
import {compileCapabilityPlatform} from './product-ports/capability-policy.mjs';
import {compileRuntimeArtifactsConfiguration} from './artifacts/configuration.mjs';
import {compileIntentsConfiguration} from './product-ports/intents.mjs';
import {compileMemoryConfiguration} from './product-ports/memory.mjs';
import {compileUploadNativeConfiguration} from './uploads/control-lifecycle.mjs';
import {compileRoutinesCoreConfiguration} from './native-authority/routines-configuration.mjs';
import {compileObjectiveGenerationConfiguration} from './objective-generation/configuration.mjs';
export {compileControlUserPreferencesConfiguration};
// Control carries the full read roster in its capability and admission policies.
// Other role configurations and individual secret files retain their 32 KiB bound.
export const configurationMaxBytes=role=>role==='control'?40*1024:32*1024;
export const fault=code=>Object.assign(new Error(code),{code});
const requireValue=(condition,code='RUNTIME_CONFIGURATION')=>{if(!condition)throw fault(code);};
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function file(p){requireValue(typeof p==='string'&&isAbsolute(p)&&!p.includes('/../')&&p.length<=4096);return p;}
function endpoint(value,loopback=false){let u;try{u=new URL(value);}catch{throw fault('RUNTIME_CONFIGURATION');}requireValue(!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&(u.protocol==='https:'||loopback&&u.protocol==='http:'&&['127.0.0.1','[::1]'].includes(u.hostname)));return u.origin;}
export function validateConfiguration(raw,role){
 requireValue(['control','temporal-worker','schedule-worker'].includes(role));const c=data(raw);
 // The schedule worker is a separately supervised control-domain Temporal poller with a health-only listener. Its four domain
 // owners are trusted in-process ports, never configuration, so JSON alone cannot start it; it may declare `native` (its client to
 // control's private occurrence operations, lane B3; schedule-service-configuration.mjs) and `routines` (Core's firing pin, lane B2).
 const common=['version','profile','sourceEnabled','limits',...(role==='schedule-worker'?[]:['native'])];
 own(c,[...common,...(role==='control'?['http','database','temporal','sessions','versions','agentcore','models']:role==='temporal-worker'?['http','temporal']:['http','temporal','versions','scheduledDispatch'])],role==='control'?['retention','telemetry','downloadLinks','privateHttp','userPreferences','tenantSettings','capabilityPlatform','routines','artifacts','intents','reads','objectiveGeneration','memory','uploads']:role==='schedule-worker'?['database','native','routines']:['objectiveGeneration']);
 if(role==='control')assertModelCatalog(c.models);
 if(c.userPreferences!==undefined){requireValue(role==='control','USER_PREFERENCES_CONFIGURATION');compileControlUserPreferencesConfiguration(c);}
 // Lane B control opt-ins (product-ports/settings.mjs, routines.mjs) and the trusted platform capability record (capability-policy.mjs, N3).
 // `routines` is also the schedule worker's firing declaration (lane B2/B3); `routines.task` is control's routine task identity.
 for(const [key,code] of [['tenantSettings','TENANT_SETTINGS_CONFIGURATION'],['routines','ROUTINES_CONFIGURATION']])if(c[key]!==undefined){requireValue(role==='control'||key==='routines'&&role==='schedule-worker',code);own(c[key],['enabled'],key==='routines'?['core','task','workflow']:[]);requireValue(typeof c[key].enabled==='boolean',code);}
 // Routines Core owners (lane B2): the wire A policy client and the Core-proof run control compose only from this closed block.
 if(c.routines?.core!==undefined)compileRoutinesCoreConfiguration(c);
 // Existing routine business identity. Its AgentCore admission owner is a separate required composition; JSON is not authority.
 if(c.routines?.task!==undefined){requireValue(role==='control','ROUTINES_CONFIGURATION');own(c.routines.task,['taskId','version']);requireValue(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(c.routines.task.taskId)&&integer(c.routines.task.version,1,Number.MAX_SAFE_INTEGER),'ROUTINES_CONFIGURATION');}
 // Attended routine dispatch names the separately configured schedule worker target; JSON alone never supplies its owners.
 if(c.routines?.workflow!==undefined){requireValue(role==='control'&&c.routines.enabled===true,'ROUTINES_CONFIGURATION');own(c.routines.workflow,['taskQueue','workflowIdPrefix']);requireValue(typeof c.routines.workflow.taskQueue==='string'&&/^[A-Za-z0-9._-]{1,128}$/u.test(c.routines.workflow.taskQueue)&&typeof c.routines.workflow.workflowIdPrefix==='string'&&/^[A-Za-z0-9._/-]{1,128}$/u.test(c.routines.workflow.workflowIdPrefix),'ROUTINES_CONFIGURATION');}
 if(c.capabilityPlatform!==undefined){requireValue(role==='control','CAPABILITY_PLATFORM_CONFIGURATION');compileCapabilityPlatform(c);}
 // Objective generation opt-ins (objective-generation/configuration.mjs): control `runs`/`start`, worker `runs`. Absent = disabled.
 if(c.objectiveGeneration!==undefined)compileObjectiveGenerationConfiguration(c,role);
 // Retention serving is an explicit declaration: when enabled, control composes the canonical read gate over its own database and
 // readiness requires the retention projections; when absent, no gate exists and nothing pretends otherwise.
 // Purge is an explicit switch that this source only accepts off: activation is a reviewed change, never a configuration value.
 if(c.retention!==undefined){requireValue(role==='control','RETENTION_CONFIGURATION');own(c.retention,['enabled'],['purge']);requireValue(c.retention.enabled===true,'RETENTION_CONFIGURATION');if(c.retention.purge!==undefined){own(c.retention.purge,['enabled']);requireValue(typeof c.retention.purge.enabled==='boolean','RETENTION_CONFIGURATION');}}
 // G1: source connectivity is an explicit boolean (decided: 10-15 #5, D015 #4a). The schedule worker stays source-disabled
 // (schedule-service-configuration.mjs); every source owner keeps its own enablement, authority and fail-closed checks.
 requireValue(c.version===1&&c.profile==='isolated-preview'&&typeof c.sourceEnabled==='boolean'&&(role!=='schedule-worker'||c.sourceEnabled===false));
 own(c.limits,['startupMs','shutdownMs','requestMs','requestBytes']);requireValue(integer(c.limits.startupMs,100,30000)&&integer(c.limits.shutdownMs,100,30000)&&integer(c.limits.requestMs,10,30000)&&integer(c.limits.requestBytes,1,131072));
 if(role!=='schedule-worker'||c.native!==undefined){own(c.native,['origin','capabilityFile','loopback','maxResponseBytes'],['serverCaFile','serverCaSha256',...(role==='temporal-worker'?['preparedKickoff']:[])]);
 // The poller admits only the prepared original kickoff (stop-owned cleanup); the legacy execution/start mode has no original stop owner (audit L5).
 if(role==='temporal-worker'||c.native.preparedKickoff!==undefined)requireValue(c.native.preparedKickoff===true,'PREPARED_KICKOFF_CONFIGURATION');
 requireValue(typeof c.native.loopback==='boolean'&&integer(c.native.maxResponseBytes,1024,2097152)&&c.native.origin===endpoint(c.native.origin,c.native.loopback));file(c.native.capabilityFile);if(c.native.serverCaFile!==undefined||c.native.serverCaSha256!==undefined){file(c.native.serverCaFile);requireValue(/^[a-f0-9]{64}$/u.test(c.native.serverCaSha256),'NATIVE_SERVER_CA_CONFIGURATION');}}
 // Log telemetry is always on and needs only an environment label. OTLP remains a separate control-only opt-in.
 if(c.telemetry!==undefined){
  requireValue(role==='control','TELEMETRY_CONFIGURATION');
  own(c.telemetry,[],['environment','enabled','endpoint','exportIntervalMs','serviceName']);
  requireValue(c.telemetry.environment===undefined||['Preview','Production'].includes(c.telemetry.environment),'TELEMETRY_CONFIGURATION');
  const otel=['enabled','endpoint','exportIntervalMs','serviceName'].some(key=>Object.hasOwn(c.telemetry,key));
  if(otel){requireValue(role==='control','TELEMETRY_CONFIGURATION');own(c.telemetry,['enabled','endpoint'],['environment','exportIntervalMs','serviceName']);requireValue(typeof c.telemetry.enabled==='boolean'&&c.telemetry.endpoint===endpoint(c.telemetry.endpoint,c.native.loopback)&&(c.telemetry.exportIntervalMs===undefined||integer(c.telemetry.exportIntervalMs,1000,300000))&&(c.telemetry.serviceName===undefined||/^[a-z][a-z0-9-]{0,62}$/u.test(c.telemetry.serviceName)),'TELEMETRY_CONFIGURATION');}
 }
 // Signed download links are an explicit control declaration: the owner-only signing key file (read through readSecret only by trusted
 // startup) and an optional link lifetime of at most five minutes. Absent or `enabled:false`, the link routes answer DOWNLOADS_UNAVAILABLE.
 if(c.downloadLinks!==undefined){requireValue(role==='control','DOWNLOAD_LINK_CONFIGURATION');own(c.downloadLinks,['enabled'],['keyFile','ttlMs']);requireValue(typeof c.downloadLinks.enabled==='boolean'&&(c.downloadLinks.enabled===false||c.downloadLinks.keyFile!==undefined)&&(c.downloadLinks.ttlMs===undefined||integer(c.downloadLinks.ttlMs,1000,300000)),'DOWNLOAD_LINK_CONFIGURATION');if(c.downloadLinks.keyFile!==undefined)file(c.downloadLinks.keyFile);}
 // Private artifact storage is an explicit control declaration composed by product-ports/documents.mjs; `enabled:false` composes no
 // artifact port. tenantId (publication custody) is required exactly when retention is declared.
 if(c.artifacts!==undefined){requireValue(role==='control','ARTIFACT_CONFIGURATION');compileRuntimeArtifactsConfiguration(c);}
 // Conversation write intents (lane 3, product-ports/intents.mjs): an explicit control opt-in; absent means disabled.
 if(c.intents!==undefined){requireValue(role==='control','INTENTS_CONFIGURATION');compileIntentsConfiguration(c);}
 // Memory (lane M): review-only proposals over Core M2; the service secret is a server-side file.
 if(c.memory!==undefined){requireValue(role==='control','MEMORY_CONFIGURATION');compileMemoryConfiguration(c);if(c.memory.enabled)file(c.memory.serviceSecretFile);}
 // Native upload inspection (uploads/control-lifecycle.mjs) is an explicit control declaration: the sandbox image digest and
 // the two bounded budgets. Absent or `enabled:false` mounts nothing. JSON is never host qualification and no request can
 // enable it, and an unobserved or failed host leaves the uploads family honestly unavailable without touching any other product.
 if(c.uploads!==undefined){requireValue(role==='control','UPLOAD_NATIVE_CONFIGURATION');compileUploadNativeConfiguration(c);}
 // Typed reads use the current Core service identity plus the live user relay. No installation proof, grant or bearer file.
 if(c.reads!==undefined){
  requireValue(role==='control','READS_CONFIGURATION');
  own(c.reads,['enabled'],['serviceSecretFile','readModeServiceSecretFile','defaultCongress']);
  requireValue(typeof c.reads.enabled==='boolean','READS_CONFIGURATION');
  if(c.reads.enabled){file(c.reads.serviceSecretFile);if(c.reads.readModeServiceSecretFile!==undefined)file(c.reads.readModeServiceSecretFile);requireValue(c.capabilityPlatform!==undefined,'READS_CONFIGURATION');}
  else requireValue(c.reads.serviceSecretFile===undefined&&c.reads.readModeServiceSecretFile===undefined&&c.reads.defaultCongress===undefined,'READS_CONFIGURATION');
  if(c.reads.defaultCongress!==undefined)requireValue(integer(c.reads.defaultCongress,1,1000),'READS_CONFIGURATION');
 }
 {
  own(c.http,['hostname','port','frontendOrigin']);requireValue(['127.0.0.1','0.0.0.0','::1','::'].includes(c.http.hostname)&&integer(c.http.port,0,65535)&&c.http.frontendOrigin===endpoint(c.http.frontendOrigin,c.native?.loopback??false));
  own(c.temporal,['address','namespace','taskQueue','tls']);requireValue(typeof c.temporal.address==='string'&&/^[a-zA-Z0-9.\-]+:[1-9][0-9]{0,4}$/u.test(c.temporal.address)&&Number(c.temporal.address.split(':').at(-1))<=65535);for(const k of ['namespace','taskQueue'])requireValue(typeof c.temporal[k]==='string'&&/^[a-zA-Z0-9._\-]{1,128}$/u.test(c.temporal[k]));own(c.temporal.tls,['caFile','certFile','keyFile']);Object.values(c.temporal.tls).forEach(file);
 }
 if(role==='control'){
  if(c.privateHttp!==undefined){own(c.privateHttp,['hostname','port','frontendOrigin']);requireValue(c.agentcore!==undefined&&c.http.port===8080&&c.privateHttp.hostname==='0.0.0.0'&&c.privateHttp.port===8082&&c.privateHttp.frontendOrigin===endpoint(c.privateHttp.frontendOrigin)&&c.privateHttp.frontendOrigin===c.native.origin&&c.privateHttp.frontendOrigin!==c.http.frontendOrigin,'PRIVATE_CONTROL_CONFIGURATION');}
  own(c.database,['connectionFile']);file(c.database.connectionFile);own(c.sessions,['mode','replicas','maxSessions','maxTtlMs']);requireValue(c.sessions.mode==='process-local'&&c.sessions.replicas===1&&integer(c.sessions.maxSessions,1,1000)&&integer(c.sessions.maxTtlMs,1,300000));validateShape('RuntimeVersions',c.versions);
 }
 if(role==='schedule-worker'){
  validateShape('RuntimeVersions',c.versions);
  compileScheduleServiceConfiguration(c);if(c.database!==undefined){own(c.database,['connectionFile']);file(c.database.connectionFile);}
 }
 if(c.agentcore!==undefined){requireValue(role==='control');compileAgentCoreConfiguration(c.agentcore);}
 return Object.freeze(c);
}
export async function loadConfiguration(path,role){file(path);const bytes=await readFile(path);requireValue(bytes.length<=configurationMaxBytes(role));let raw;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fault('RUNTIME_CONFIGURATION');}return validateConfiguration(raw,role);}
export async function readSecret(path){
 file(path);let handle;try{handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat();requireValue(stat.isFile()&&stat.size>0&&stat.size<=32768&&(stat.mode&0o077)===0&&stat.uid===process.getuid(),'RUNTIME_SECRET_FILE');const bytes=await handle.readFile();requireValue(bytes.length<=32768,'RUNTIME_SECRET_FILE');return bytes;}catch{throw fault('RUNTIME_SECRET_FILE');}finally{await handle?.close();}
}
