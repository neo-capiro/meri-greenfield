/** Concrete CONTROL factory. Only canonical gateway methods leave; no worker imports or new authority. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin,retainedOperationIds} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createGeneralReadFamilyHandlers} from '../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../general-read-runtime.mjs';
import {createCoreRetainedAuthorityClient} from './core-client.mjs';
import {createRetainedMeriContext} from './meri-context.mjs';
import {createRetainedCredentialBroker} from './credential-broker.mjs';
import {createRetainedReadControlOwner} from './control-owner.mjs';
import {createRetainedDelegatedTransport} from './source-transport.mjs';
export function createRetainedReadControl(configuration){
 const c=own(configuration,['binding','expiresAtMs'],['store','taskVerifier','taskCapability','coreOrigin','getNativeCredential','fetchImpl','issuerId','keyId','publicKeyJwk','recipients','enabled','now']),enabled=c.enabled??false,now=c.now??Date.now;
 const recipients=c.recipients===undefined?undefined:data(own(c.recipients,retainedOperationIds));if(recipients)Object.values(recipients).forEach(retainedOrigin);
 const core=createCoreRetainedAuthorityClient({origin:c.coreOrigin,getNativeCredential:c.getNativeCredential,fetchImpl:c.fetchImpl,now,enabled}),meri=createRetainedMeriContext({binding:c.binding,expiresAtMs:c.expiresAtMs,store:c.store,taskVerifier:c.taskVerifier,taskCapability:c.taskCapability,now,enabled}),broker=createRetainedCredentialBroker({issuer:core,issuerId:c.issuerId,keyId:c.keyId,publicKeyJwk:c.publicKeyJwk,recipients,now,enabled});
 return createRetainedReadControlOwner({meri,core,broker,recipients,now,enabled});
}
export async function createRetainedControlGeneralReadRuntime(configuration){
 const c=own(configuration,['retained','gateway'],['families']);if(types.isProxy(c.gateway))throw Error('RETAINED_GATEWAY_CONFIGURATION');const control=createRetainedReadControl(c.retained),gateway=own(c.gateway,[],Object.keys(c.gateway)),now=c.retained.now??Date.now;
 if(!control.available||gateway.sourceEnabled!==true)return createControlGeneralReadRuntime();
 const recipients=data(c.retained.recipients),families={...own(c.families??{},[],['meeting-source','action-items-complete','operational-reads','tenant-contacts','entity-candidates','client-knowledge-profile','client-documents','client-knowledge-memory','client-knowledge-monday','dataset-metadata','memory-proposals','research-portfolio-evidence'])};
 for(const [family,id] of [['research-portfolio','get_research_portfolio'],['florida-budget','get_florida_budget_project']])if(recipients[id])families[family]={origin:recipients[id],delegatedTransport:createRetainedDelegatedTransport({origin:recipients[id],getCredentials:control.getCredentials,now,fetchImpl:c.retained.fetchImpl})};
 // Research detail and changes share one canonical family/transport; they must have the same admitted Core origin.
 if(recipients.get_research_portfolio_changes!==undefined&&recipients.get_research_portfolio_changes!==recipients.get_research_portfolio)throw Error('RETAINED_CORE_ORIGIN_MISMATCH');
 const handlers=await createGeneralReadFamilyHandlers({families,now,newId:gateway.newId});return createControlGeneralReadRuntime({...gateway,handlers,retainedContextPorts:control.retainedContextPorts});
}
