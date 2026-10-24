/** Actual saved-job HTTP port paired with every ordinary adapter. Core replies remain synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,scene} from './job-read-fixture.mjs';
import {createObjectiveReadSource} from '../../../runtime/objective-generation/read-source.mjs';
import {runStartFixture} from '../../../runtime/objective-source/test/run-start-fixture.mjs';

function rebind(value,prior,current,seen=new Set()) {
 if(!value||typeof value!=='object'||seen.has(value))return;
 seen.add(value);
 for(const[key,item]of Object.entries(value)) {
  if(typeof item==='string') {
   const field=Object.keys(prior).find(field=>typeof prior[field]==='string'&&prior[field]===item);
   if(field)value[key]=current[field];
  }else rebind(item,prior,current,seen);
 }
}
function composition(name,{response,request}={}) {
 const s=scene(name),prior=structuredClone(s.call.authority.binding);
 // Memory cursors contain the actual source principal hash; construct that principal's job rather than relabel its cursor.
 const job=runStartFixture({clientId:s.call.authority.subject.entityIds[0],...(name==='memory'?{tenantId:prior.tenantId,actorId:prior.actorId}:{})});
 for(const key of ['input','request','authority','normalizationContext'])if(s.call[key])s.call[key]=structuredClone(s.call[key]);
 s.readContext=structuredClone(s.readContext);
 rebind(s.call,prior,job.binding);rebind(s.readContext,prior,job.binding);
 const bodies=[];
 const source=createObjectiveReadSource({record:job.record,policyRevision:s.call.authority.policyRevision,origin:'https://core.example.invalid',
  getServiceSecret:async()=> 'synthetic-control-service-secret',now:s.base.now,maxRequestMs:1000,maxResponseBytes:1048576,
  fetchImpl:async(url,init)=> {
   assert.equal(url,'https://core.example.invalid/api/internal/objective-generation/reads');
   assert.equal(init.headers.authorization,undefined);
   assert.equal(init.headers['x-internal-service-secret'],'synthetic-control-service-secret');
   assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
   const body=JSON.parse(init.body);bodies.push(body);
   assert.deepEqual(body.context.binding,job.binding);assert.equal(body.generationJobId,job.generationJobId);
   assert.deepEqual(body.context.subject.entityIds,[job.clientId]);
   const override=response?.(body,bodies.length);if(override)return override;
   const raw=await s.raw({operation:body.operation,input:body.input});
   // Eligibility is produced from the already-current request, unlike historical source DTO fixtures.
   if(body.operation!=='search_memory_eligibility')rebind(raw,prior,job.binding);
   return Response.json(raw);
  }});
 const adapter=s.create({...s.base,readSource:request?value=>source(request(value)):source,
  fetchImpl:()=>{throw Error('No interactive fetch');}});
 return {s,bodies,read:()=>adapter.read(s.call)};
}
for(const name of cases) {
 test(`${name}: actual control saved-job HTTP preserves canonical body/identity without bearer`,async()=> {
  const c=composition(name);assert.ok(await c.read());assert.equal(c.bodies.length,c.s.expectedCalls);
 });
 test(`${name}: actual saved-job HTTP refuses Core denial and changed current principal`,async()=> {
  for(const status of [401,403]) {
   const c=composition(name,{response:()=>new Response('not JSON',{status})});
   await assert.rejects(c.read(),/ACCESS_DENIED/);assert.equal(c.bodies.length,1);
  }
  const c=composition(name,{request:value=>({...value,context:{...value.context,subject:{...value.context.subject,actorId:'foreign'}}})});
  await assert.rejects(c.read(),/ACCESS_DENIED/);assert.equal(c.bodies.length,0);
 });
}
test('actual saved-job HTTP rejects memory eligibility revocation after a successful page',async()=> {
 const c=composition('memory',{response:body=>body.operation==='search_memory_eligibility'?new Response('revoked',{status:403}):undefined});
 await assert.rejects(c.read(),/ACCESS_DENIED/);
 assert.deepEqual(c.bodies.map(body=>body.operation),['search_memory','search_memory_eligibility']);
});
