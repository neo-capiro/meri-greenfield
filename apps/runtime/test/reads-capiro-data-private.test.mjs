/** Actual current owner, composition and HTTP receiver; only Core I/O/session facts are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {capiroDataCase} from '../../gateway/sources/capiro-data/test/fixture.mjs';
import {createSourceReadContext} from '../read-context/source-read-context.mjs';
import {createRoutineReadContext} from '../objective-generation/read-context.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const clientId=uuid('d'),otherClient=uuid('e');

async function fixture({selected=null,narrowed,source='client_records'}={}){
 const request={source,sql:'SELECT COUNT(*) AS total FROM client_objectives',parameters:[],rowLimit:2,...(narrowed?{clientId:narrowed}:{})};
 const scene=capiroDataCase('query_capiro_data',{request}),binding=scene.authority.binding;
 binding.tenantId=uuid('b');binding.actorId=uuid('c');
 const subject=scene.authority.subject;delete subject.authorizationDecisionId;
 Object.assign(subject,{tenantId:binding.tenantId,actorId:binding.actorId,kind:selected?'client':'personal',entityType:selected?'client':'user',entityIds:[selected??binding.actorId],
   scopes:[{tenantId:binding.tenantId,kind:selected?'client':'private-user',resourceId:selected??binding.actorId,policyRevision:subject.policyRevision}]});
 if(source==='client_records')scene.page.scope.clientId=narrowed??selected;
 const {versions:_versions,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:scene.now()+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[scene.operation],maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576};
 const state={identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),clientIds:[clientId,otherClient],revoked:false};
 const currentBodies=[];let after=()=>{},sourceStatus=200;
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:['capiro-data'],
   nativeCredentials:{async nativeCredentialFor(){return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:scene.now,newId:()=>binding.attemptId,
   capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:['capiro-data'],activeReadOperations:[scene.operation]};}},
   async fetchImpl(url,options){
     const path=new URL(url).pathname;assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');
     if(path.endsWith('/application-authority/current')){
       currentBodies.push(JSON.parse(options.body));return Response.json({principal:{tenantId:binding.tenantId,actorId:binding.actorId},role:'standard_user',permissions:[],clientIds:state.clientIds,
         identityRevision:state.identityRevision,membershipRevision:state.membershipRevision,contextRevision:'c'.repeat(64),conversationId:binding.conversationId,selectedClientId:selected,checkedAtMs:scene.now(),expiresAtMs:identity.expiresAtMs});
     }
     assert.equal(path,'/api/clio/tools/query_capiro_data');
     if(sourceStatus!==200)return Response.json({message:'Unavailable'},{status:sourceStatus});
     const result=await scene.transport.fetchImpl(url,options);after();return result;
   }});
 const execution={async authenticate(){if(state.revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return {execution:structuredClone(identity),state:'running',scopes:structuredClone(subject.scopes),selectedClientId:selected,policyRevision:subject.policyRevision};}};
 const app=composer.createReadsRuntime({execution,binding,approvedReads});
 const req=(kind,body)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body)});
 async function execute(args=request){
   const available=await app.handle(req('availability',{schemaVersion:approvedReads.schemaVersion,binding}));assert.equal(available.status,200);const receipt=await available.json();
   return app.handle(req('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation:scene.operation,arguments:args,deliveryId:'synthetic',installationId:receipt.installation.installationId,executionCatalogSha256:receipt.installation.executionCatalogSha256}));
 }
 return {scene,state,execute,currentBodies,after(fn){after=fn;},status(value){sourceStatus=value;}};
}

for(const [selected,narrowed] of [[null,undefined],[null,clientId],[clientId,undefined],[clientId,clientId]])test(`private composition preserves conversation ${selected} with narrowing ${narrowed}`,async()=>{
 const f=await fixture({selected,narrowed}),response=await f.execute();assert.equal(response.status,200,await response.clone().text());
 assert(f.currentBodies.every(body=>body.clientId===selected));const page=JSON.parse((await response.json()).resultJson).result;
 assert.equal(page.scope.clientId,narrowed??selected);assert.deepEqual(page,f.scene.page);
 const correlation=JSON.parse(Buffer.from(f.scene.wire[0].options.headers['x-meri-read-correlation'],'base64url'));
 assert.deepEqual(correlation.normalizationContext.capiroDataScope,{clientId:narrowed??selected,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)});
 assert.equal(correlation.subject.kind,selected?'client':'personal');
});

for(const revision of ['identityRevision','membershipRevision'])test(`fresh ${revision} change after General aggregate withholds result`,async()=>{
 const f=await fixture();f.after(()=>{f.state[revision]='d'.repeat(64);if(revision==='membershipRevision')f.state.clientIds.pop();});
 const response=await f.execute();assert.equal(response.status,403);assert.equal(f.scene.wire.length,1);assert.doesNotMatch(await response.text(),/9007199254740993/);
});

test('private selected broadening, invisible narrowing and authority outage dispatch no SQL',async()=>{
 const wrong=await fixture({selected:clientId,narrowed:otherClient});assert.notEqual((await wrong.execute()).status,200);assert.equal(wrong.scene.wire.length,0);
 const hidden=await fixture({narrowed:clientId});hidden.state.clientIds=[];assert.notEqual((await hidden.execute()).status,200);assert.equal(hidden.scene.wire.length,0);
 const missing=await fixture();missing.state.membershipRevision='';assert.notEqual((await missing.execute()).status,200);assert.equal(missing.scene.wire.length,0);
});

test('private Core denial and late execution retirement cannot release evidence',async()=>{
 const denied=await fixture();denied.status(403);assert.equal((await denied.execute()).status,403);
 const retired=await fixture();retired.after(()=>{retired.state.revoked=true;});assert.equal((await retired.execute()).status,403);assert.equal(retired.scene.wire.length,1);
});

test('saved routine context cannot synthesize missing interactive identity/membership revisions',async()=>{
 const f=await fixture(),a=f.scene.authority,controller=new AbortController(),request=f.scene.arguments;
 const record={binding:a.binding,selectedClientId:null,expiresAtMs:f.scene.now()+5000};
 const owner=createRoutineReadContext({record,current:{role:'standard_user',clientIds:[clientId]},readSource:async()=>{assert.fail('no private saved-job source call');},policyRevision:a.policyRevision,
   approvedReads:{operations:[f.scene.operation]},now:f.scene.now});
 // This existing saved-job boundary sanitizes foreign-owner faults to INTERNAL_ERROR; it releases no private data.
 await assert.rejects(owner.nativeReadContextPorts.readCurrent({binding:a.binding,subject:a.subject,operation:f.scene.operation,request,requestSha256:canonicalSha256(request),policyRevision:a.policyRevision,sourceIds:a.sourceIds,deadlineMs:record.expiresAtMs,signal:controller.signal}),{message:'INTERNAL_ERROR'});
 // The domain context itself requires revisions, not just a visible UUID.
 assert.throws(()=>createSourceReadContext({contract:f.scene.contract,proof:{request,subject:a.subject},native:{actorRole:'standard_user',clientIds:[clientId]},now:f.scene.now}));
});
