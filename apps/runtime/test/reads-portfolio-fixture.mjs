/** Actual research adapters; ordinary resource GETs are closed synthetic Core responses. */
import assert from 'node:assert/strict';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {createMailFixture,uuid} from '../../gateway/sources/mail/test/fixtures.mjs';
import {review,snapshot,continuity,portfolioId,recordId} from '../../gateway/sources/research-portfolio-evidence/test/fixtures.mjs';
import {normalizeResearchPortfolioInput} from '../../../packages/contracts/retrieval-0.2/validate.mjs';

import {createNativeReadsClient} from '../reads-client.mjs';
export async function fixture(id='get_research_portfolio',{client=false,origin='review'}={}){
 const source=createMailFixture(undefined,{client}),binding=source.binding,operation={id,version:'0.2.0'},calls=[];
 let status=200,mutate,revoked=false;
 const family=id==='get_research_evidence'?'research-portfolio-evidence':'research-portfolio';
 const scopes=[{tenantId:binding.tenantId,kind:client?'client':'private-user',resourceId:client?source.clientId:binding.actorId,policyRevision:source.subject.policyRevision}];
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:source.state.now+10000,runtimeSessionId:'synthetic-runtime-session-00000000001'});
 const current={execution:identity,state:'running',scopes,selectedClientId:client?source.clientId:null,policyRevision:source.subject.policyRevision};
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[operation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:1048576};
 const at=new Date(source.state.now).toISOString(),detail={id:portfolioId,name:'Synthetic portfolio',purpose:null,mode:'manual',lifecycle:'active',revision:1,ownerUserId:binding.actorId,memberCount:0,clientLinkCount:0,myRole:'owner',archivedAt:null,createdAt:at,updatedAt:at,
  grants:[{id:uuid('7'),principalType:'user',principalUserId:binding.actorId,role:'owner',grantedByUserId:binding.actorId,createdAt:at,updatedAt:at}],clientLinks:[],members:[],recentEvents:[]};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.example.invalid',familyIds:[family],
  nativeCredentials:{async nativeCredentialFor(){return {credential:'SYNTHETIC_USER',expiresAtMs:identity.expiresAtMs};}},
  readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>source.state.now,newId:()=>binding.attemptId,
  capabilityPolicy:{async forRun(){return {generalReads:true,readFamilies:[family],activeReadOperations:[operation]};}},
  async fetchImpl(url,options){const parsed=new URL(url);calls.push(parsed.pathname+parsed.search);
   assert.equal(options.method,'GET');assert.equal(options.headers.authorization,'Bearer SYNTHETIC_USER');assert.equal(options.headers['x-internal-service-secret'],undefined);
   assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert(parsed.pathname.startsWith(`/api/research-portfolios/${portfolioId}`));
   const data=id==='get_research_portfolio'?structuredClone(detail):id==='get_research_portfolio_changes'?{items:[],nextCursor:null}:
    origin==='review'?(calls.length===2?[review()]:[]):origin==='snapshot'?snapshot():continuity();
   mutate?.(data);return Response.json(data,{status});
  }});
 assert.deepEqual(composer.missing,[]);
 const execution={async authenticate(){if(revoked)throw Error('EXECUTION_AUTHORITY_REFUSED');return structuredClone(current);}};
 const app=composer.createReadsRuntime({execution,binding,approvedReads});
 const args={portfolioId,...(id==='get_research_evidence'?{origin,...(origin==='current_continuity'?{}:{recordId})}:{})};
 async function execute(input=args){const request=(kind,body)=>new Request(`https://control.example.invalid/v1/runner/reads/${kind}`,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_EXECUTION','content-type':'application/json'},body:JSON.stringify(body)});
  const a=await app.handle(request('availability',{schemaVersion:approvedReads.schemaVersion,binding}));assert.equal(a.status,200,await a.clone().text());const available=await a.json();
  return app.handle(request('execute',{schemaVersion:approvedReads.schemaVersion,binding,operation,arguments:input,deliveryId:'synthetic',installationId:available.installation.installationId,executionCatalogSha256:available.installation.executionCatalogSha256}));}
 const port=createNativeReadsClient({origin:'https://control.example.invalid',credential:'SYNTHETIC_EXECUTION',binding,approvedReads,now:()=>source.state.now,fetchImpl:(url,init)=>app.handle(new Request(url,init))});
 return {execute,args,calls,port,binding,scopes,operation,scene:{arguments:args},now:()=>source.state.now,deadlineMs:identity.expiresAtMs,status:value=>{status=value;},mutate:fn=>{mutate=fn;},revoke:()=>{revoked=true;}};
}
