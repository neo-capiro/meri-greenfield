/** Trusted host binding. Native auth/current rights/persistence stay with injected owners. */
import {createActionApplication} from '../action-application/index.mjs';
import {createHostResolver} from './resolver.mjs';
import {own,data,refuse} from './current.mjs';
export function createActionHostApplication(configuration){
 const config=own(configuration,['services','authenticateSession','readCurrentState','reserveLookup','issueLookupCredential','issueExecution','now','limits']);
 const services=own(config.services,['lookup','commandOptions','commandExecutor']),lookup=own(services.lookup,['lookup','read']);
 const options=own(services.commandOptions,['operation','action','outputShape','commandContext','validators','assertProposal','approvalMetadataOwner','executor','now','limits']);
 const metadata=own(options.approvalMetadataOwner,['prepare','read']),executor=own(options.executor,['execute'],['sourceEnabled','readOutcome','bindTrustedGrant','prepareInvocation','reconcileInvocation']);
 const ports=Object.fromEntries(['authenticateSession','readCurrentState','reserveLookup','issueLookupCredential','issueExecution'].map(k=>[k,config[k]]));
 if(Object.values(ports).some(v=>typeof v!=='function')||Object.values(lookup).some(v=>typeof v!=='function')||Object.values(metadata).some(v=>typeof v!=='function')||typeof executor.execute!=='function'||typeof config.now!=='function'||options.now!==config.now)refuse();
 const commandOptions={...options,...data({operation:options.operation,action:options.action,outputShape:options.outputShape,commandContext:options.commandContext,limits:options.limits}),approvalMetadataOwner:metadata,executor:{execute:executor.execute}};
 const limits=data(config.limits);
 return createActionApplication({resolveSession:createHostResolver({services:{...services,lookup},ports,commandOptions,now:config.now,limits}),now:config.now,limits});
}
