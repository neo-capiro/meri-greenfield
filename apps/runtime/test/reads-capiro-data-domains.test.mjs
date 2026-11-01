/** Actual current owner, composition and HTTP receiver; only Core I/O/session facts are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {capiroDataCase} from '../../gateway/sources/capiro-data/test/fixture.mjs';
import {createSourceReadContext} from '../read-context/source-read-context.mjs';
import {createRoutineReadContext} from '../objective-generation/read-context.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
const clientId=uuid('d'),otherClient=uuid('e');

const version='0.5.0';
async function fixture({selected=null,narrowed,source='research_portfolio',research=source==='research_portfolio'}={}){
 const request={source,sql:'SELECT COUNT(*) AS total FROM client_objectives',parameters:[],rowLimit:2,...(narrowed?{clientId:narrowed}:{})};
 const scene=capiroDataCase('query_capiro_data',{request,version}),binding=scene.authority.binding;
 binding.tenantId=uuid('b');binding.actorId=uuid('c');
 const subject=scene.authority.subject;delete subject.authorizationDecisionId;
 Object.assign(subject,{tenantId:binding.tenantId,actorId:binding.actorId,kind:selected?'client':'personal',entityType:selected?'client':'user',entityIds:[selected??binding.actorId],
   scopes:[{tenantId:binding.tenantId,kind:selected?'client':'private-user',resourceId:selected??binding.actorId,policyRevision:subject.policyRevision}]});
 if(source==='client_records')scene.page.scope.clientId=narrowed??selected;
 const {versions:_versions,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:scene.now()+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[scene.operation],maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576};
 const state={identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),clientIds:[clientId,otherClient],contextRevision:'c'.repeat(64),resourceRevision:'d'.repeat(64),revoked:false};
 const currentBodies=[];let after=()=>{},sourceStatus=200;
 const fields={kind:'research_portfolio',researchPortfolioId:uuid('f'),researchPortfolioName:'Captured research',researchPortfolioRevision:2};
 const scope={...fields,scopeVersion:createHash('sha256').update(JSON.stringify(fields)).digest('hex')};
 const observed={...scope,currentResearchPortfolioName:scope.researchPortfolioName,currentResearchPortfolioRevision:2,stale:false,resourceRevision:state.resourceRevision};
 scene.page.version='0.3.0';scene.page.scope=source==='research_portfolio'?observed:{kind:'classic_outreach',clientId:selected};
 const relation=source==='research_portfolio'?'research_portfolio_members':'classic_outreach_records';
 scene.page.relationsUsed=[relation];scene.page.coverage.relations[0].name=relation;
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:[scene.family],
   nativeCredentials:{async nativeCredentialFor(call){if(research)assert.equal(call.includeSubject,true);return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs,...(research?{scopeKind:'research_portfolio',scope}:{})};}},readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:scene.now,newId:()=>binding.attemptId,
   capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:[scene.family],activeReadOperations:[scene.operation]};}},
   async fetchImpl(url,options){
     const path=new URL(url).pathname;assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');
     if(path.endsWith('/application-authority/current')){
       currentBodies.push(JSON.parse(options.body));return Response.json({principal:{tenantId:binding.tenantId,actorId:binding.actorId},role:'standard_user',permissions:[],clientIds:state.clientIds,
         identityRevision:state.identityRevision,membershipRevision:state.membershipRevision,contextRevision:state.contextRevision,conversationId:binding.conversationId,selectedClientId:selected,checkedAtMs:scene.now(),expiresAtMs:identity.expiresAtMs,
         ...(research?{researchPortfolio:{...observed,resourceRevision:state.resourceRevision}}:{})});
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


for(const source of ['research_portfolio','classic_outreach'])test(source+': actual Control composition binds source and retains scope at release',async()=>{
 const f=await fixture({source}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());
 const page=JSON.parse((await r.json()).resultJson).result;assert.deepEqual(page,f.scene.page);
 const correlation=JSON.parse(Buffer.from(f.scene.wire[0].options.headers['x-meri-read-correlation'],'base64url'));
 assert.equal(correlation.normalizationContext.capiroDataScope.source,source);
 assert.equal(correlation.normalizationContext.capiroDataScope.contextRevision,'c'.repeat(64));
 if(source==='research_portfolio')assert(f.currentBodies.every(b=>b.scopeKind==='research_portfolio'&&b.clientId===null));
});
test('Classic follows selected client without a model client selector',async()=>{
 const f=await fixture({source:'classic_outreach',selected:clientId}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());
 assert.equal(JSON.parse((await r.json()).resultJson).result.scope.clientId,clientId);
});
for(const revision of ['identityRevision','membershipRevision','contextRevision','resourceRevision'])test('Research '+revision+' change withholds whole aggregate',async()=>{
 const f=await fixture();f.after(()=>{f.state[revision]='e'.repeat(64);});
 const r=await f.execute();assert.equal(r.status,403);assert.equal(f.scene.wire.length,1);assert.doesNotMatch(await r.text(),/9007199254740993/);
});
test('Research cannot silently become Classic and General cannot become Research',async()=>{
 for(const args of [{source:'classic_outreach',research:true},{source:'research_portfolio',research:false}]){
  const f=await fixture(args),r=await f.execute();assert.notEqual(r.status,200);assert.equal(f.scene.wire.length,0);
 }
});
test('model client selector is refused for both new sources before SQL',async()=>{
 for(const source of ['research_portfolio','classic_outreach']){
  const f=await fixture({source,narrowed:clientId}),r=await f.execute();assert.notEqual(r.status,200);assert.equal(f.scene.wire.length,0);
 }
});
test('Core denial and late execution retirement release no Research rows',async()=>{
 const f=await fixture();f.status(403);assert.equal((await f.execute()).status,403);
 const late=await fixture();late.after(()=>{late.state.revoked=true;});assert.equal((await late.execute()).status,403);
});
