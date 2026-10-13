/** Concrete source-disabled application assembly over already-admitted persisted run state. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPostgresAdmittedRunOwner,createReadAuthority,createCommandAuthority,createTaskLookupAuthorizer,createDurableSourceDisabledGateway} from '../../gateway/index.mjs';
import {assertTaskLookupStoredBinding} from '../task-lookup/index.mjs';
import {createDurableActionServices} from '../action-host/durable/index.mjs';
import {createApplicationActionHost} from '../action-host/application-adapters/mount.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),refuse=()=>{throw Error('ADMITTED_HOST_CONFIGURATION');};
export function createAdmittedActionHost(configuration){
 const c=own(configuration,['admission','readPorts','commandPorts','lookup','metadata','command','commandContext','client','hostPorts','now','newId','limits','sessionLimits'],['enabled']);
 const admission=own(c.admission,['pool','allocationJson','grantFactsJsons']);
 const context=data(c.commandContext);own(context,['binding','clientResolution']);own(context.clientResolution,['reference','clientId']);validateShape('RunBinding',context.binding);
 const read=own(c.lookup,['pool','credential','scopes']),meta=own(c.metadata,['pool','preparePolicy']);
 const cmd=own(c.command,['journalPool','budgetPool','producerContext','approvalStore','source','contracts','descriptor']);
 const limits=data(own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes','maxFactBytes','maxCleanupMs']));
 const ports=value=>{const p=own(value,['verifyCapability','authorizeBusiness','authorizeSources']);if(Object.values(p).some(v=>typeof v!=='function'))refuse();return p;};
 const rports=ports(c.readPorts),cports=ports(c.commandPorts),ss=data(read.scopes);
 const configured=data(admission.grantFactsJsons).map(raw=>JSON.parse(raw));
 if(configured.some(f=>!same(f.binding,context.binding))||ss.length!==1||ss[0].kind!=='client'||ss[0].tenantId!==context.binding.tenantId||ss[0].resourceId!==context.clientResolution.clientId||ss[0].policyRevision!==configured[0]?.qualificationBinding.policyRevision||context.clientResolution.reference!==context.clientResolution.clientId)refuse();
 validateShape('Scope',ss[0]);
 const persisted=createPostgresAdmittedRunOwner({...admission,now:c.now,limits:{maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes}});
 const readAuthorityPorts={...rports,currentRun:persisted.currentRun},commandAuthorityPorts={...cports,currentRun:persisted.currentRun};
 const readAuthority=createReadAuthority({authorityPorts:readAuthorityPorts,now:c.now,maxFactBytes:limits.maxFactBytes});
 const commandAuthority=createCommandAuthority({authorityPorts:commandAuthorityPorts,now:c.now,maxFactBytes:limits.maxFactBytes});
 const gateway=createDurableSourceDisabledGateway({authorityPorts:readAuthorityPorts,pool:admission.pool,allocationJson:admission.allocationJson,limits,now:c.now,newId:c.newId});
 const authorize=createTaskLookupAuthorizer({authority:readAuthority,credential:read.credential,commandContext:context,scopes:ss,assertStoredBinding:assertTaskLookupStoredBinding,now:c.now});
 const services=createDurableActionServices({lookup:{pool:read.pool,gateway,authorize},metadata:meta,command:{...cmd,allocationJson:admission.allocationJson,authority:commandAuthority},commandContext:context,now:c.now,newId:c.newId,limits:{maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes,maxResponseBytes:limits.maxResponseBytes,maxCleanupMs:limits.maxCleanupMs},sourceEnabled:false});
 const host=createApplicationActionHost({services,client:c.client,currentRun:persisted.currentRun,hostPorts:c.hostPorts,now:c.now,limits:{maxRequestMs:limits.maxRequestMs,maxRequestBytes:limits.maxRequestBytes,maxResponseBytes:limits.maxResponseBytes},sessionLimits:c.sessionLimits,enabled:c.enabled??false});
 return Object.freeze({app:host.app,close:host.close,status:()=>({...host.status(),sourceEnabled:false})});
}
