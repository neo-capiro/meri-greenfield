/** Finite native-family business fixtures through the current execution/Core composition. */
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER} from '../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createNativeReadsClient} from '../reads-client.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
import {storedSearchPage} from '../../gateway/sources/client-knowledge-search/test/fixture.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {nativeFamilyCase,NATIVE_FAMILY_CASES,DISCLOSURE_FAMILY_CASES} from '../../gateway/general-reads/test/native-family-cases.mjs';
import {storedCase as fundingCase,storedPage as fundingPage,ids as fundingIds} from '../../gateway/sources/funding-opportunities/test/fixture.mjs';
import {storedCase as programCase,ids as programIds} from '../../gateway/sources/program-elements/test/fixture.mjs';
export const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
export const ORIGINAL_CASES=[...NATIVE_FAMILY_CASES,...DISCLOSURE_FAMILY_CASES,...fundingIds.map(id=>['funding-opportunities',id]),...programIds.map(id=>['program-elements',id])];
export const CASES=[...ORIGINAL_CASES,['business-development','get_business_development_evidence'],['public-data','search_federal_grants'],['public-data','search_federal_awards'],['bill-text','read_bill_text'],['bill-text','search_congress_bills'],['client-knowledge-search','search_client_knowledge']];
function retarget(value,old,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const [k,v] of Object.entries(value)){if(v===old.tenantId)value[k]=uuid('b');else if(v===old.actorId)value[k]=uuid('c');else retarget(v,old,seen);}}
export async function fixture(family,id,options={}){
 const scene=options.scene??(family==='bill-text'?billTextCase(id):family==='funding-opportunities'?fundingCase(id):family==='program-elements'?programCase(id):nativeFamilyCase(family,id,options));scene.binding??=scene.authority.binding;scene.contract??=resolveOperationContract(scene.operation);delete scene.authority.subject.authorizationDecisionId;retarget(scene,{...scene.binding});
 if(options.privateUser){const subject=scene.authority.subject;subject.scopes=[{tenantId:scene.binding.tenantId,kind:'private-user',resourceId:scene.binding.actorId,policyRevision:subject.policyRevision}];}
 const binding=scene.binding,operation=scene.operation,subject=scene.authority.subject,scopes=subject.scopes,selectedClientId=subject.kind==='client'?subject.entityIds[0]:null,policyRevision=subject.policyRevision;
 const contextClientId=options.contextClientId,evidenceAccuracyMode=options.evidenceAccuracyMode??'off',knowledgePageOptions=options.knowledgePageOptions;
 const calls=[];let denySource=false,revoked=false,referenceStatus=201;
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:scene.now()+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[operation],maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576};
 const clientIds=[...new Set([...(scene.visibleClientIds??[]),...(selectedClientId?[selectedClientId]:[])])],principal={tenantId:binding.tenantId,actorId:binding.actorId};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:[family],defaultCongress:119,
  nativeCredentials:{async nativeCredentialFor(){return {credential:'SYNTHETIC_NATIVE',expiresAtMs:identity.expiresAtMs};}},readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',readModeServiceSecretFile:'synthetic-mode',now:scene.now,newId:()=>binding.attemptId,
  capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:[family]};}},
  async fetchImpl(url,options){const path=new URL(url).pathname,body=typeof options.body==='string'?JSON.parse(options.body):null;calls.push(path);
   assert.equal(options.headers.authorization,'Bearer SYNTHETIC_NATIVE');
   if(path.endsWith('/application-authority/current'))return Response.json({principal,role:'standard_user',permissions:[],clientIds,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:binding.conversationId,selectedClientId,checkedAtMs:scene.now(),expiresAtMs:identity.expiresAtMs});
   if(path.endsWith('/application-authority/identity'))return Response.json({principal,identityRevision:'a'.repeat(64),checkedAtMs:scene.now(),expiresAtMs:identity.expiresAtMs});
   if(path.endsWith('/application-authority/context'))return Response.json({identitySha256:body.identitySha256,principal,identityRevision:'a'.repeat(64),conversationId:body.conversationId,selectedClientId:contextClientId??body.clientId,contextRevision:'c'.repeat(64),checkedAtMs:scene.now(),expiresAtMs:identity.expiresAtMs});
   if(path.endsWith('/read-mode-observation'))return Response.json({operation:body.operation,requestSha256:body.requestSha256,principal,surface:'chat',evidenceAccuracyMode});
   if(path.endsWith('/clients/check-ref'))return Response.json({ok:true,clientId:selectedClientId??clientIds[0]},{status:referenceStatus});
   assert.equal(path,`/api/clio/tools/${id}`);if(denySource)return Response.json({message:'refused'},{status:403});
   if(family==='funding-opportunities'){const context=decodeNativeReadObservation(options.headers[NATIVE_READ_OBSERVATION_HEADER],{operation,request:body}).context;scene.state.page=fundingPage(id,scene.contract.normalizeInput(body,context).input,context.asOf,new Date(scene.now()-60000).toISOString());}
   if(id==='search_client_knowledge'){const context=decodeNativeReadObservation(options.headers[NATIVE_READ_OBSERVATION_HEADER],{operation,request:body}).context;scene.state.page=storedSearchPage(scene.contract.normalizeInput(body,context).input,context.asOf,knowledgePageOptions);}
   return scene.transport.fetchImpl(url,options);
  }});
 const execution={async authenticate(){if(revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return {execution:structuredClone(identity),state:'running',scopes:structuredClone(scopes),selectedClientId,policyRevision};}};
 const app=composer.createReadsRuntime({execution,binding,approvedReads});
 const port=createNativeReadsClient({origin:'https://control.example.invalid',credential:'SYNTHETIC_EXECUTION',binding,approvedReads,now:scene.now,fetchImpl:(url,init)=>app.handle(new Request(url,init))});
 async function execute(args=scene.arguments){const request=(kind,body)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body)});
  const a=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));assert.equal(a.status,200,await a.clone().text());const available=await a.json();return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation,arguments:args,deliveryId:'synthetic',installationId:available.installation.installationId,executionCatalogSha256:available.installation.executionCatalogSha256}));}
 return {execute,calls,scene,port,binding,scopes,operation,now:scene.now,deadlineMs:identity.expiresAtMs,setClients:ids=>clientIds.splice(0,clientIds.length,...ids),referenceStatus:value=>{referenceStatus=value;},deny:()=>{denySource=true;},revoke:()=>{revoked=true;}};
}
