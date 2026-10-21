/** Synthetic selected-client delegated producer over actual runtime/gateway owners; no live Core qualification. */
import {randomUUID} from 'node:crypto';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {storedCase,clientId} from '../../../../gateway/sources/research-legal-candidates/test/fixture.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture,origin} from './fixture.mjs';
import {createReadDelegationCoreClient} from '../../read-delegation/core-client.mjs';
import {createRunReadDelegation} from '../../read-delegation/delegation.mjs';
import {composeDelegatedNativeCredentials} from '../../read-delegation/native-credentials.mjs';
import {delegationCoreFixture} from '../../read-delegation/test/fixture.mjs';

export async function researchCandidatesFixture({named=false,owner:ownerFor,missingContext=false}={}){
 const request={query:'priority',clientId:named?'Client Alpha':clientId};
 const scene=storedCase({request,...(named?{resolution:{reference:'Client Alpha',clientId}}:{})});
 const f=await ownerFixture('search_research_sources',{scene});
 const delegatedCore=delegationCoreFixture({now:f.now,binding:f.binding,clientId,runDeadlineMs:f.deadlineMs,
  principal:f.core.principal,reservations:f.state.reservations,liveBearers:new Set(['SYNTHETIC_LIVE']),
  authority:f.core.fetchImpl,tools:f.transport.fetchImpl}),references=[];
 const fetchImpl=async(url,init)=>{
  const path=new URL(url).pathname;
  delegatedCore.state.checkRefClientId=f.core.state.resolvedClientId??clientId;
  if(path.endsWith('/clients/check-ref'))references.push({body:JSON.parse(init.body)});
  const response=await delegatedCore.fetchImpl(url,init);
  if(path.endsWith('/current')&&response.ok){
   // The synthetic producer observes the same mutable membership owner used by
   // the existing revocation cases; all consumer/credential code is production.
   const current=await response.json();current.clientIds=[...f.core.state.clientIds];
   current.membershipRevision=f.core.state.membershipRevision;current.principal=f.core.state.principal??f.core.principal;return Response.json(current,{status:response.status});
  }
  return response;
 };
 const client=createReadDelegationCoreClient({origin,now:f.now,fetchImpl,enabled:true,getServiceSecret:async()=>'SYNTHETIC_SERVICE'});
 const delegation=createRunReadDelegation({binding:f.binding,scopes:f.scopes,allocationJson:f.allocationJson,
  runDeadlineMs:f.deadlineMs,client,now:f.now,liveCredentialFor:async()=>({credential:'SYNTHETIC_LIVE',expiresAtMs:f.deadlineMs})});
 const credentials=composeDelegatedNativeCredentials({delegation,client,now:f.now});
 const configuration={...f.configuration,coreAuthority:credentials.coreAuthority,
  getNativeCredential:credentials.getNativeCredential,toolCredential:credentials.toolCredential};
 const owner=ownerFor?.({...f,configuration})??createNativeReadCredentialOwner(configuration);
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{'research-legal-candidates':{...transport,fetchImpl,credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration,original=gateway.authority;
 const authority={...original,check(call){
  // The borrowed scripted business policy accepts UUID selectors. A name still
  // goes through the actual native resolver; this fixture policy uses only its
  // already-admitted task client for the exact original request.
  return named&&call.input?.clientId===request.clientId?
   original.check({...call,input:{...call.input,clientId}}):original.check(call);
 }};
 const mount=createControlGeneralReadRuntime({...gateway,authority,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:missingContext?undefined:owner.nativeReadContextPorts});
 return {...f,configuration,owner,handlers,references,mount,delegatedCore,invoke:(extra={})=>mount.execute({operation:f.operation,arguments:f.request,deliveryId:'research-candidates-current',...extra})};
}

