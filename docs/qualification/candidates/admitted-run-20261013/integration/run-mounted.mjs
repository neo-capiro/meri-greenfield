/** Synthetic two-listener HTTP replay over the actual admitted-run reader and closed mount. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {admittedFixture} from '../../../../../apps/control/admitted-runs/test/fixture.mjs';
import {createCapiroApplicationAuthorityClient} from '../../../../../apps/control/action-host/application-adapters/authority-http.mjs';
import {applicationAuthorityRoutes} from '../../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {listenActionApplication} from '../../../../../apps/control/action-application/node-http.mjs';

export async function runMountedReplay(){
 const f=await admittedFixture(),hosts=[];
 let authorityServer,applicationServer,currentHost;
 const calls={identity:0,context:0};
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 try{
  const baseline=structuredClone(f.h.state());
  const original=JSON.parse(await f.owner().currentRun(f.s.binding,{}));
  authorityServer=await listenActionApplication({host:'127.0.0.1',port:0,lifetimeMs:15000,app:{async handle(request){
   if(request.method!=='POST'||request.headers.get('authorization')!==`Bearer ${f.s.credential}`)return json({error:{code:'REFUSED'}},401);
   const path=new URL(request.url).pathname,body=await request.json();
   const identity={principal:{tenantId:f.s.binding.tenantId,actorId:f.s.binding.actorId},identityRevision:'synthetic-native-session',checkedAtMs:f.now(),expiresAtMs:f.s.deadlineMs};
   if(path===applicationAuthorityRoutes.identity){assert.deepEqual(body,{});calls.identity++;return json(identity);}
   if(path!==applicationAuthorityRoutes.context)return json({error:{code:'NOT_FOUND'}},404);
   assert.deepEqual(Object.keys(body).sort(),['clientId','conversationId','identitySha256']);
   assert.equal(body.conversationId,f.s.binding.conversationId);assert.equal(body.clientId,f.s.clientId);calls.context++;
   return json({...identity,identitySha256:body.identitySha256,conversationId:body.conversationId,selectedClientId:body.clientId,contextRevision:'synthetic-authorized-client'});
  }}});
  const client=createCapiroApplicationAuthorityClient({origin:'https://synthetic-authority.invalid',enabled:true,now:f.now,limits:{maxRequestMs:1000,maxResponseBytes:65536},fetchImpl(url,init){
   const parsed=new URL(url);assert.equal(parsed.origin,'https://synthetic-authority.invalid');assert.ok(Object.values(applicationAuthorityRoutes).includes(parsed.pathname));
   assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
   // Test-only HTTPS URL to loopback mapping; this does not qualify TLS or native Capiro.
   return fetch(authorityServer.origin+parsed.pathname,init);
  }});
  const disabled=f.make({client,enabled:false});hosts.push(disabled);
  const beforeDisabled={sql:f.h.commands.length,...calls};
  assert.equal((await disabled.app.handle(new Request('http://local.invalid/api/action-followthrough/session',{method:'POST'}))).status,503);
  assert.deepEqual({sql:f.h.commands.length,...calls},beforeDisabled);disabled.close();
  currentHost=f.make({client});hosts.push(currentHost);
  applicationServer=await listenActionApplication({host:'127.0.0.1',port:0,lifetimeMs:15000,app:{handle:request=>currentHost.app.handle(request)}});
  const send=async(route,body,credential)=>{
   const response=await fetch(`${applicationServer.origin}/api/action-followthrough/${route}`,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(3000)});
   return {status:response.status,value:await response.json()};
  };
  const boot=await send('session',{},f.s.credential);assert.equal(boot.status,200);assert.notEqual(boot.value.credential,f.s.credential);assert.equal(boot.value.context.selectedClientId,f.s.clientId);
  const nativeBearer=await send('query',{request:{limit:20}},f.s.credential);assert.equal(nativeBearer.status,401);
  const wrongClient=await send('session',{clientId:randomUUID()},f.s.credential);assert.equal(wrongClient.status,401);
  const wrongRun=await send('session',{runId:randomUUID()},f.s.credential);assert.equal(wrongRun.status,401);
  const query=await send('query',{request:{limit:20}},boot.value.credential);assert.equal(query.status,503);assert.equal(query.value.error.outcome,'NOT_DISPATCHED');
  assert.equal(f.s.state.sourceReads,0);assert.equal(f.s.state.taskEffects,0);
  currentHost.close();
  assert.equal((await currentHost.app.handle(new Request('http://local.invalid/api/action-followthrough/session',{method:'POST'}))).status,503);
  currentHost=f.make({client});hosts.push(currentHost);
  const oldSession=await send('query',{request:{limit:20}},boot.value.credential);assert.equal(oldSession.status,401);
  const fresh=await send('session',{},f.s.credential);assert.equal(fresh.status,200);assert.notEqual(fresh.value.credential,boot.value.credential);
  const reconstructed=JSON.parse(await f.owner().currentRun(f.s.binding,{}));assert.deepEqual(reconstructed,original);
  assert.deepEqual(f.h.state(),baseline,'read-only current state checks preserve all canonical persisted rows and liabilities');
  // A fixture-owned row mutation simulates the existing grant owner's persisted revocation.
  f.h.state().grants.get(f.s.commandFacts.grantId).state='REVOKED';
  await assert.rejects(f.owner().currentRun(f.s.binding,{}));
  const revoked=await send('query',{request:{limit:20}},fresh.value.credential);assert.equal(revoked.status,401);
  const newAfterRevoke=await send('session',{},f.s.credential);assert.equal(newAfterRevoke.status,401);
  assert.equal(f.h.state().budget.consumed_micro_usd,baseline.budget.consumed_micro_usd);assert.deepEqual(f.h.state().reservations,baseline.reservations);
  assert.equal(f.s.state.sourceReads,0);assert.equal(f.s.state.taskEffects,0);
  await applicationServer.close();await authorityServer.close();for(const host of hosts)host.close();f.close();
  for(const server of [applicationServer,authorityServer])assert.deepEqual(server.status(),{closed:true,listening:false,activeSockets:0});
  return {kind:'fixture-isolated-admitted-run-two-listener-replay',passed:true,nativeIdentity:false,nativeDatabase:false,liveCapiro:false,tlsQualified:false,providerCalls:0,
   disabledHostStatus:503,sessionStatus:boot.status,nativeBearerStatus:nativeBearer.status,wrongClientStatus:wrongClient.status,wrongRunStatus:wrongRun.status,queryStatus:query.status,queryOutcome:query.value.error.outcome,
   reconstructedSessionStatus:fresh.status,oldSessionStatus:oldSession.status,originalPersistedDeadlinePreserved:true,readOnlyLedgerPreserved:true,revokedStatus:revoked.status,newSessionAfterRevocationStatus:newAfterRevoke.status,
   sourceReads:f.s.state.sourceReads,taskEffects:f.s.state.taskEffects,authorityCalls:calls,applicationListener:applicationServer.status(),authorityListener:authorityServer.status(),hosts:hosts.map(host=>host.status())};
 }finally{await applicationServer?.close();await authorityServer?.close();for(const host of hosts)host.close();f.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--run'){
  try{console.log(JSON.stringify(await runMountedReplay()));}catch(error){console.error(error);process.exitCode=1;}
 }else{
  console.log('Usage: node run-mounted.mjs --run | --help\nRuns synthetic loopback authority and application with a scripted SQL ledger only. Exit 0 success/help, 1 check failure, 2 invalid arguments.');
  if(args.length!==1||args[0]!=='--help')process.exitCode=2;
 }
}
