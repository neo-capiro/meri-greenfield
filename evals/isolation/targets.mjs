/** Seeded offline targets: every tenant owns one conversation, one artifact version, one gateway capability. */
import {createScriptedConversationApplication,syntheticId} from '../offline-targets/conversation-application.mjs';
import {createScriptedArtifactService} from '../offline-targets/artifact-service.mjs';
import {createScriptedGatewayDispatch,gatewayPrincipal} from '../offline-targets/gateway-dispatch.mjs';
import {createTaskLookupAuthorizer} from '../../apps/gateway/authorization/task-lookup-authorizer.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function createIsolationTargets({tenants,now=Date.now}){
 if(!Array.isArray(tenants)||tenants.length<3)fail('ISOLATION_TENANTS');
 const conversations=await createScriptedConversationApplication({principals:tenants.map(t=>t.principal),now});
 const artifacts=createScriptedArtifactService({now});
 const gatewayPrincipals=new Map(tenants.map(t=>[t.tenantId,gatewayPrincipal(t.principal,{tag:t.tag,now})]));
 const gateway=createScriptedGatewayDispatch({principals:[...gatewayPrincipals.values()],now});
 const seeded=new Map();
 try{
  for(const tenant of tenants){
   const sessionCredential=await conversations.issue(tenant.principal);
   const submit=await conversations.app.handle(conversations.request({route:'submit',credential:sessionCredential,body:{requestId:syntheticId(tenant.tag,500),prompt:`Seeded request ${tenant.promptSentinel}`}}));
   if(submit.status!==200)fail('ISOLATION_SEED_CONVERSATION');
   const created=await artifacts.service.create(artifacts.textRequest(`Seeded ${tenant.tag}`,`Seeded artifact ${tenant.artifactSentinel}\n`),artifacts.context(tenant.principal));
   seeded.set(tenant.tenantId,Object.freeze({sessionCredential,artifactVersionId:created.version.versionId,gatewayCredential:gatewayPrincipals.get(tenant.tenantId).credential,gatewayScope:gatewayPrincipals.get(tenant.tenantId).scope}));
  }
 }catch(error){conversations.close();throw error;}
 const lookupAuthorizer=tenant=>{const g=gatewayPrincipals.get(tenant.tenantId);
  return createTaskLookupAuthorizer({authority:gateway.authority,credential:g.credential,commandContext:{binding:structuredClone(tenant.principal.binding),clientResolution:{reference:tenant.principal.selectedClientId,clientId:tenant.principal.selectedClientId}},scopes:[structuredClone(g.scope)],assertStoredBinding:()=>fail('ISOLATION_NO_STORED_BINDING'),now});};
 return Object.freeze({conversations,artifacts,gateway,seeded,lookupAuthorizer,close(){conversations.close();}});
}
