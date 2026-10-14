/** Admitted parked-task authority without a fabricated SDK launch descriptor. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createPostgresAdmittedRunOwner} from '../../gateway/budget/admitted-run-owner.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {createNativeIdentityContext} from './identity-context.mjs';
import {createNativeTaskVerifier,taskFault} from './task-verifier.mjs';
import {createNativeTaskVerifierApplication} from './task-verifier-http.mjs';
export function createAdmittedTaskAuthority(configuration){
 const c=own(configuration,['pool','allocationJson','grantFactsJsons','grantId','identity','operations','callerCapabilitySha256','binding','expiresAtMs','limits'],['enabled','now']);
 const enabled=c.enabled??false,now=c.now??Date.now,i=own(c.identity,['origin','commandContext','fetchImpl','credential']),limits=data(own(c.limits,['maxRequestMs','maxFactBytes'])),commandContext=data(i.commandContext);own(commandContext,['binding','clientResolution']);
 const {facts}=parseAdmittedGrantSet(c),grant=facts.find(f=>f.grantId===c.grantId);
 if(!grant||facts.some(f=>f.capabilitySha256===c.callerCapabilitySha256)||hash(grant.binding)!==hash(c.binding)||hash(commandContext.binding)!==hash(c.binding))throw taskFault('CONFIGURATION');
 const admission=createPostgresAdmittedRunOwner({pool:c.pool,allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,namespace:'product',limits,now});
 const identityContext=createNativeIdentityContext({origin:i.origin,commandContext,fetchImpl:i.fetchImpl,currentOwner:{currentRun:admission.currentTaskRun},enabled,now,limits}),preparation=new AbortController();
 const taskVerifier=createNativeTaskVerifier({allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,grantId:c.grantId,identityCredential:i.credential,currentOwner:admission,identityContext,operations:c.operations,expiresAtMs:c.expiresAtMs,enabled,now,maxRequestMs:limits.maxRequestMs,signal:preparation.signal});
 const application=createNativeTaskVerifierApplication({verifier:taskVerifier,callerCapabilitySha256:c.callerCapabilitySha256,taskCapabilitySha256:grant.capabilitySha256,enabled,now,maxRequestMs:limits.maxRequestMs});
 return Object.freeze({admission,identityContext,taskVerifier,application,signal:preparation.signal,async close(){preparation.abort();}});
}
