/** Explicit synthetic loopback replay; no live endpoint, native database or provider. */
import assert from 'node:assert/strict';
import {fixture,NOW} from '../../../../../apps/control/action-host/test/fixture.mjs';
import {createCapiroApplicationAuthorityClient} from '../../../../../apps/control/action-host/application-adapters/authority-http.mjs';
import {createApplicationActionHost} from '../../../../../apps/control/action-host/application-adapters/mount.mjs';
import {applicationAuthorityRoutes} from '../../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {receiveActionResponse} from '../../../../../packages/contracts/dist/action-application.mjs';
import {listenActionApplication} from '../../../../../apps/control/action-application/node-http.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export async function runMountedReplay(){
const f=await fixture();
const principal={tenantId:f.t.f.binding.tenantId,actorId:f.t.f.binding.actorId};
let authorityServer,applicationServer,host,revoked=false,approvals=0;
const counters={identity:0,context:0,currentRun:0};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
try {
 authorityServer=await listenActionApplication({host:'127.0.0.1',port:0,lifetimeMs:15000,app:{async handle(request){
  const path=new URL(request.url).pathname;
  if(revoked||request.method!=='POST'||request.headers.get('authorization')!=='Bearer synthetic-native-identity')return json({error:{code:'REFUSED'}},401);
  const body=await request.json();
  const identity={principal,identityRevision:'synthetic-stable-identity',checkedAtMs:f.t.clock(),expiresAtMs:NOW+8000};
  if(path===applicationAuthorityRoutes.identity){assert.deepEqual(body,{});counters.identity++;return json(identity);}
  if(path!==applicationAuthorityRoutes.context)return json({error:{code:'NOT_FOUND'}},404);
  assert.deepEqual(Object.keys(body).sort(),['clientId','conversationId','identitySha256']);
  assert.equal(body.clientId,f.t.clientId);assert.equal(body.conversationId,f.t.f.binding.conversationId);
  counters.context++;return json({...identity,identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:body.clientId,contextRevision:'synthetic-stable-context'});
 }}});
 const client=createCapiroApplicationAuthorityClient({origin:'https://synthetic-authority.invalid',enabled:true,now:f.t.clock,
  limits:{maxRequestMs:1000,maxResponseBytes:65536},fetchImpl(url,init){
   const parsed=new URL(url);assert.equal(parsed.origin,'https://synthetic-authority.invalid');
   assert.ok(Object.values(applicationAuthorityRoutes).includes(parsed.pathname));
   assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
   // Test-only transport mapping. TLS, real Clerk and Capiro are not exercised.
   return fetch(authorityServer.origin+parsed.pathname,init);
  }});
 host=createApplicationActionHost({services:f.config.services,client,enabled:true,
  currentRun(binding,options){counters.currentRun++;return f.t.identity.authorityPorts.currentRun(binding,options);},
  hostPorts:Object.fromEntries(['reserveLookup','issueLookupCredential','issueExecution'].map(key=>[key,f.config[key]])),
  now:f.t.clock,limits:f.config.limits,sessionLimits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:8000,maxFactBytes:65536}});
 applicationServer=await listenActionApplication({app:host.app,host:'127.0.0.1',port:0,lifetimeMs:15000});
 const send=(route,body,credential)=>fetch(`${applicationServer.origin}/api/action-followthrough/${route}`,{
  method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(3000)});
 const boot=await send('session',{},'synthetic-native-identity');assert.equal(boot.status,200);
 const issued=await boot.json();assert.notEqual(issued.credential,'synthetic-native-identity');assert.equal(issued.context.selectedClientId,f.t.clientId);
 const wrongBearer=await send('query',{request:{limit:20}},'synthetic-native-identity');assert.equal(wrongBearer.status,401);await wrongBearer.arrayBuffer();
 const call=async(route,body)=>{const result=await send(route,body,issued.credential);return {status:result.status,value:await receiveActionResponse(route,result.status,await result.text())};};
 const query=await call('query',{request:{limit:20}});assert.equal(query.status,200);
 const selection={resultReference:query.value.resultReference,resultSha256:query.value.resultSha256,actionId:query.value.observation.result.actions[0].id};
 const draft=await call('draft',{selection,edits:{title:'Explicit isolated application task',dueDate:null}});assert.equal(draft.status,200);
 const prepared=await call('prepare',{draft:draft.value});assert.equal(prepared.status,200);
 f.t.f.state.approvalRevoked=true;
 const refused=await call('execute',{proposal:prepared.value.proposal});assert.equal(refused.value.error.outcome,'NOT_DISPATCHED');assert.equal(f.t.f.state.fetches,0);
 f.approve(prepared.value.proposal);approvals++;
 const executed=await call('execute',{proposal:prepared.value.proposal});assert.equal(executed.value.status,'observed');assert.equal(f.t.f.state.fetches,1);
 const replayed=await call('execute',{proposal:prepared.value.proposal});assert.deepEqual(replayed.value,executed.value);assert.equal(f.t.f.state.fetches,1);
 revoked=true;
 const afterRevocation=await call('query',{request:{limit:20}});assert.equal(afterRevocation.status,401);assert.equal(f.t.f.state.fetches,1);
 assert.equal(host.status().sessions,0);
 await applicationServer.close();await authorityServer.close();host.close();f.t.identity.close();
 for(const server of [applicationServer,authorityServer])assert.deepEqual(server.status(),{closed:true,listening:false,activeSockets:0});
 const afterClose=await host.app.handle(new Request('http://local.invalid/api/action-followthrough/session',{method:'POST'}));assert.equal(afterClose.status,503);
 return {kind:'fixture-isolated-two-listener-application-replay',passed:true,
  sourceClock:'fixed-synthetic',nativeIdentity:false,nativeDatabase:false,liveCapiro:false,tlsQualified:false,providerCalls:0,
  sessionIssued:true,nativeBearerActionStatus:wrongBearer.status,queryStatus:query.status,draftStatus:draft.status,prepareStatus:prepared.status,
  unapprovedOutcome:refused.value.error.outcome,explicitSyntheticApprovals:approvals,taskEffects:f.t.f.state.fetches,
  replayMatched:true,revokedStatus:afterRevocation.status,postCloseStatus:afterClose.status,authorityCalls:counters,
  applicationListener:applicationServer.status(),authorityListener:authorityServer.status(),host:host.status()};
} finally {
 await applicationServer?.close();await authorityServer?.close();host?.close();f.t.identity.close();
}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--run'){
  try{console.log(JSON.stringify(await runMountedReplay()));}catch(error){console.error(error);process.exitCode=1;}
 }else{
  console.log('Usage: node run-mounted.mjs --run | --help\nRuns only synthetic loopback authority/application fixtures. Exit 0 success/help, 1 check failure, 2 invalid arguments.');
  if(args.length!==1||args[0]!=='--help')process.exitCode=2;
 }
}
