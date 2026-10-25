/** Actual native admission/candidate/control/worker composition. SQL, Core signing and provider are local fixtures. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assembleAgentCoreCandidate} from '../agentcore-candidate.mjs';
import {assembleControl} from '../control.mjs';
import {compileNativeRoutinesTask} from '../native-authority/routines-owner-composition.mjs';
import {scheduledAdmissionFixture} from '../native-authority/test/scheduled-admission-fixture.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {coreSigner} from '../native-authority/test/routines-core-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {id} from '../../control/conversations/test/store-fixture.mjs';

for(const general of [false,true])test(`native ${general?'General':'client'} occurrence reaches provider and actual private worker cost/runtime configuration with no allocation or bearer`,async t=>{
 const configuration=agentcoreControlFixture().configuration,signer=coreSigner({kid:'routine-firing'});
 configuration.agentcore.policyRevision='policy1';configuration.routines={enabled:true,task:{taskId:id(9),version:1},core:{origin:'https://core.synthetic.invalid',serviceSecretFile:'/synthetic/routines-service',unattendedGrant:signer.pin}};
 const task=compileNativeRoutinesTask(configuration),h=await scheduledAdmissionFixture({agentcore:true,general,task});
 h.occurrence.projection.maxCostMicrousd=750;
 const row=[...h.scheduleSql.state.projections.values()][0],intent=[...h.scheduleSql.state.intents.values()][0];
 row.projection=structuredClone(h.intent.projection);row.projection_sha256=hash(row.projection);intent.intent=structuredClone(h.intent);intent.intent_sha256=hash(intent.intent);
 await h.adapter.admit(h.request);
 const binding=h.identity.binding,at=h.now(),calls=[],pending=Promise.withResolvers();pending.promise.catch(()=>{});let invocation,revoked=false;
 const pool={async connect(){const c=await h.pool.connect(),s=await h.scheduleSql.pool.connect();return {async query(sql,args=[]){
  const text=typeof sql==='string'?sql:sql.text,values=typeof sql==='string'?args:sql.values??[];
  if(text.includes('FROM meri_objective_source.run_starts'))return {rows:[]};
  if(text.includes("effect->'binding'->>'conversationId'"))return {rows:structuredClone([...h.scheduleSql.state.occurrences.values()].filter(r=>r.tenant_id===values[0]&&r.effect.binding.conversationId===values[1]))};
  if(text.includes('meri_schedules.'))return s.query(text,values);
  if(text==='BEGIN ISOLATION LEVEL READ COMMITTED'||text==='BEGIN'){await s.query('BEGIN');return c.query('BEGIN');}
  if(text==='COMMIT'||text==='ROLLBACK'){await s.query(text);return c.query(text);}
  return c.query(text,values);
 },release(){s.release();c.release();}};}};
 const fetchImpl=async(url,options)=>{
  const path=new URL(url).pathname,body=JSON.parse(options.body);calls.push(path);
  if(path.startsWith('/api/clio/application-authority/')){
   assert.equal(options.headers.authorization,'Bearer synthetic-owner');assert.equal(options.headers['x-internal-service-secret'],undefined);
   const times={checkedAtMs:h.now(),expiresAtMs:h.now()+60000},principal={tenantId:binding.tenantId,actorId:binding.actorId};
   if(path.endsWith('/identity'))return Response.json({principal,identityRevision:'a'.repeat(64),...times});
   if(path.endsWith('/membership'))return Response.json({...principal,status:'active',role:'standard_user',permissions:[],clientIds:general?[]:[h.template.selectedClientId],membershipRevision:'b'.repeat(64),...times});
   return Response.json({error:'No ordinary Core bootstrap exists'},{status:403});
  }
  assert.equal(options.headers.authorization,undefined);assert.equal(options.headers['x-internal-service-secret'],'synthetic-routine-service-secret');
  if(revoked)return Response.json({error:'revoked'},{status:403});
  const p=h.occurrence.projection,limits={maxCostMicrousd:p.maxCostMicrousd,maxRuntimeSeconds:p.maxRuntimeSeconds,retryLimit:p.retryLimit};
  if(path==='/api/clio/routines/unattended-grant'){
   const signed=signer.sign({...body,scopes:h.scopes,membershipRevision:'synthetic',consentId:id(700),consentIssuedAtS:Math.floor(at/1000)-60,consentExpiresAtS:Math.floor(at/1000)+86400,limits},{nowMs:h.now(),typ:'capiro-meri-routine-fire+jwt',aud:'meri-schedule-firing'});
   return Response.json({grant:signed.proof,jti:signed.jti,expiresAtMs:signed.exp*1000});
  }
  assert.equal(path,'/api/internal/routines/current');assert.deepEqual(body.binding,binding);
  return Response.json({schemaVersion:1,tenantId:binding.tenantId,actorId:binding.actorId,clerkUserId:'synthetic',tenantSlug:'synthetic',role:'standard_user',scheduleId:p.scheduleId,occurrenceKey:h.identity.occurrenceKey,generation:1,consentId:id(700),binding,scopes:h.scopes,clientIds:general?[]:[h.template.selectedClientId],policyRevision:'policy1',limits,checkedAtMs:h.now(),effectExpiresAtMs:at+20000});
 };
 const candidate=assembleAgentCoreCandidate({configuration,pool,store:h.store,initialBindings:createInitialRunBindingJournal({pool:h.pool}),now:h.now,fetchImpl,readSecret:async()=>Buffer.from('synthetic-routine-service-secret'),
  nativeCredentials:{nativeCredentialFor(){assert.fail('No interactive identity for a Temporal occurrence');}},controlCredential:'synthetic-control-credential-long-enough',provider:{async invoke(v){invocation=v;return pending.promise;},async stop(){assert.fail('No physical stop in fixture');}}});
 const assembly=assembleControl({configuration,pool,client:h.temporal.client,native:candidate.native,execution:candidate.execution,canonicalProductPorts:candidate.productPorts,workerModelPolicy:candidate.workerModelPolicy,now:h.now});
 candidate.bindApplication(assembly.application);t.after(async()=>{pending.reject(Error('fixture cleanup'));await candidate.close();await assembly.close();});
 await candidate.native.call('execution/kickoff',{binding,executionKey:hash(binding)});assert.ok(invocation);assert.equal(invocation.execution.expiresAtMs,at+20000);
 const post=(path,body)=>candidate.application.handle(new Request('https://control.synthetic.invalid/v1/runner/'+path,{method:'POST',headers:{authorization:'Bearer '+invocation.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const load=await post('load',{binding});assert.equal(load.status,200,await load.clone().text());const loaded=await load.json();assert.equal(loaded.model.maxCostMicroUSD,750);assert.deepEqual(loaded.run.binding,binding);
 const runtime=await post('runtime',{binding,versions:configuration.versions});assert.equal(runtime.status,200,await runtime.clone().text());const prepared=await runtime.json();assert.equal(prepared.deadlineMs,at+20000);assert.equal(prepared.automaticClientContext,null);
 assert.deepEqual(calls,['/api/clio/routines/unattended-grant','/api/internal/routines/current']);assert.equal(h.conversations.state.allocations.size,0);
 const opened=await assembly.application.handle(new Request('https://control.synthetic.invalid/api/action-followthrough/session',{method:'POST',headers:{authorization:'Bearer synthetic-owner','content-type':'application/json'},body:JSON.stringify({conversationId:binding.conversationId,clientId:h.template.selectedClientId})}));
 assert.equal(opened.status,200,await opened.clone().text());assert.equal((await opened.json()).context.runId,binding.runId);assert.equal(h.conversations.state.nextRuns.size,0);
 assert.equal(calls.includes('/api/clio/application-authority/current'),false);
 revoked=true;const denied=await post('runtime',{binding,versions:configuration.versions});assert.notEqual(denied.status,200);assert.doesNotMatch(await denied.text(),/synthetic-routine-service-secret/);
 await h.store.append(binding,{eventId:id(701),createdAt:new Date(h.now()).toISOString(),type:'run.status',data:{state:'failed',reasonCode:'SYNTHETIC_TEST'}},()=>{});
 pending.resolve(await candidate.execution.settle({credential:invocation.credential,execution:invocation.execution,state:'failed'}));
});
