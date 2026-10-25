import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreRetentionClient} from '../core-client.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=1800000000000,day=86400000,subject={tenantId:'synthetic-tenant',kind:'conversation',subjectId:id(1),ownerActorId:id(2)};
const receipt=()=>({version:'meri.conversation-retention.v1',identity:{tenantId:subject.tenantId,conversationId:id(1),ownerActorId:id(2),bootstrapRequestId:id(3),scope:{kind:'general',clientId:null}},status:'trashed',revision:'4',trashedAt:new Date(now-31*day).toISOString(),restoreUntil:new Date(now-day).toISOString(),trashRequestId:id(4),checkedAtMs:now});
function fixture(reply=receipt(),options={}){
 const calls=[],client=createCoreRetentionClient({origin:'https://core.invalid',getServiceSecret:async()=> 'synthetic-private-service-secret',now:()=>now,
  fetchImpl:async(url,request)=>{calls.push({url,request});return Response.json(reply);},...options});
 return {client,calls};
}
test('retention uses only fixed service-authenticated routes and preserves actual General identity and deadline',async()=>{
 const f=fixture();assert.deepEqual(await f.client.read(subject),receipt());const c=f.calls[0];
 assert.equal(c.url,'https://core.invalid/api/internal/conversation-retention/read');
 assert.equal(c.request.headers.authorization,undefined);assert.equal(c.request.redirect,'error');
 assert.deepEqual(JSON.parse(c.request.body),{tenantId:subject.tenantId,conversationId:subject.subjectId});
 const final={version:receipt().version,tenantId:subject.tenantId,conversationId:subject.subjectId,requestId:id(4),revision:'4',erased:true,replayed:true};
 const g=fixture(final);assert.deepEqual(await g.client.finalize(subject,{requestId:id(4),revision:'4',restoreUntilMs:now-day}),final);
 assert.equal(g.calls[0].url,'https://core.invalid/api/internal/conversation-retention/finalize');
});
test('wrong subject, deadline, scope, stale clock and invented receipt fields cannot authorize purge',async()=>{
 for(const mutate of [r=>r.identity.ownerActorId=id(8),r=>r.identity.tenantId='foreign',r=>r.identity.conversationId=id(9),
  r=>r.identity.scope.clientId=id(9),r=>r.checkedAtMs=now-5001,r=>r.checkedAtMs=now+5001,
  r=>r.restoreUntil=new Date(now).toISOString(),r=>r.extra=true]){
  const r=receipt();mutate(r);await assert.rejects(fixture(r).client.read(subject));
 }
 for(const offset of [-5000,5000]){const r=receipt();r.checkedAtMs+=offset;assert.deepEqual(await fixture(r).client.read(subject),r);}
 const f=fixture();await assert.rejects(f.client.finalize(subject,{requestId:id(4),revision:'4',restoreUntilMs:now+1}));assert.equal(f.calls.length,0);
});
test('denied, missing, redirected, oversized and unanswered Core replies stay unavailable',async()=>{
 for(const make of [()=>Response.json({}, {status:403}),()=>Response.json({}, {status:404}),()=>new Response('{}',{status:302}),
  ()=>new Response('x'.repeat(16385),{headers:{'content-type':'application/json'}})]){
  await assert.rejects(fixture(null,{fetchImpl:async()=>make()}).client.read(subject));
 }
 const f=fixture(null,{maxRequestMs:20,fetchImpl:()=>new Promise(()=>{})});await assert.rejects(f.client.read(subject),/RETENTION_AUTHORITY_UNAVAILABLE/);
});
