/** Opt-in synthetic identity wrapper; persisted qualification has a separate owner. */
import {createCurrentToolAuthority} from '../authorization/current-tool-authority.mjs';
import {ownFields,frozenData} from '../sources/source-admission.mjs';
import {deny} from '../dispatch/operation-result.mjs';
import {assertLocalActionIdentity} from './identity.mjs';
import {createFixtureActionGateway} from './fixture-gateway.mjs';
export function createLocalActionGateway(configuration){
 const {mode,identity,pool,allocationJson,source,limits,now,newId}=ownFields(configuration,['mode','identity','pool','allocationJson','source','limits','now','newId']);
 if(mode!=='synthetic-local')deny('GATEWAY_CONFIGURATION');assertLocalActionIdentity(identity);
 const state=identity.status(),l=frozenData(limits);if(state.closed)deny('GATEWAY_CONFIGURATION');
 const authority=createCurrentToolAuthority({ports:identity.authorityPorts,now,maxFactBytes:l.maxResponseBytes});
 return Object.freeze({...createFixtureActionGateway({binding:state.binding,authority,pool,allocationJson,source,limits:l,now,newId}),mode});
}
