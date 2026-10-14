/** Compiled one-run mount over the control-owned pool/native client; construction has no IO. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPostgresAdmittedRunOwner} from '../../gateway/budget/admitted-run-owner.mjs';
import {createNativeFirstRunPorts} from './first-run-ports.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertAuthorityContextRequest} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';

export function createNativeFirstRunMount(configuration){
 const {allocationJson,grantFactsJsons,identity,registration,enabled=false,limits}=own(configuration,['allocationJson','grantFactsJsons','identity','limits'],['registration','enabled']);
 const i=own(identity,['origin','commandContext','fetchImpl']);
 const admitted=data({allocationJson,grantFactsJsons,limits:own(limits,['maxRequestMs','maxFactBytes'])});
 const capturedIdentity=Object.freeze({...i,commandContext:data(i.commandContext)});
 const observed=registration===undefined?undefined:Object.freeze({read:storageMethod(registration,'read')});
 // Validate original facts and the fixed application-authority protocol inertly.
 const {facts}=parseAdmittedGrantSet(admitted),command=own(capturedIdentity.commandContext,['binding','clientResolution']);
 const resolution=own(command.clientResolution,['reference','clientId']);
 if(hash(command.binding)!==hash(facts[0].binding)||resolution.reference!==resolution.clientId||Buffer.byteLength(JSON.stringify(facts))>admitted.limits.maxFactBytes)throw Error('FIRST_RUN_CONFIGURATION');
 assertAuthorityContextRequest({identitySha256:'0'.repeat(64),conversationId:command.binding.conversationId,clientId:resolution.clientId});
 createCapiroApplicationAuthorityClient({origin:i.origin,fetchImpl:i.fetchImpl,now:Date.now,enabled,limits:{maxRequestMs:admitted.limits.maxRequestMs,maxResponseBytes:admitted.limits.maxFactBytes}});
 return context=>{
  const {pool,native,now}=own(context,['configuration','pool','native','now']);
  const admission=createPostgresAdmittedRunOwner({...admitted,pool,namespace:'product',now});
  return createNativeFirstRunPorts({identity:capturedIdentity,admission,native,registration:observed,enabled,now,limits:admitted.limits});
 };
}
