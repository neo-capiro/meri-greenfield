/** Owned fixture graph: fixed action transports and the same persisted admission everywhere. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {qualificationActionTransport} from '../../gateway/index.mjs';
import {createCommandHttpSource} from '../commands/source-http.mjs';
import {createPersistedActionHost,admittedHostConfiguration} from '../admitted-runs/mount-core.mjs';
export function createQualificationActionHost(configuration){
 const c=own(configuration,['hostConfiguration','source']),hostConfiguration=admittedHostConfiguration(c.hostConfiguration),source=c.source;
 const limits=own(hostConfiguration.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes','maxFactBytes','maxCleanupMs']);
 const ports=own(source,['read','command']);
 const read=qualificationActionTransport(ports.read),write=qualificationActionTransport(ports.command);
 const command=own(hostConfiguration.command,['journalPool','budgetPool','producerContext','approvalStore','contracts','descriptor']);
 const commandSource=createCommandHttpSource({origin:write.origin,getCredentials:write.getCredentials,fetchImpl:write.fetchImpl,now:hostConfiguration.now,maxResponseBytes:write.maxResponseBytes??limits.maxResponseBytes});
 return createPersistedActionHost({...hostConfiguration,enabled:true,command:{...command,source:commandSource}},read);
}
