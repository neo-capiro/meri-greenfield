/** Actual staging client and Fetch Responses; no DNS, socket, credentials or HTTP write. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const {createStagingE2EClient,stagingTarget}=await import(pathToFileURL(root+'/apps/control/staging-e2e/client.mjs'));
const id=n=>`97000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const config=()=>({baseUrl:'https://authorized-staging.example.invalid/',sourceCommit:'a'.repeat(40),automation:{tenantId:'review-tenant',actorId:'review-actor',clientId:id(1),conversationIds:[id(3)]},manual:{clientId:id(2),conversationIds:[id(4)]}});
const context=()=>({binding:{tenantId:'review-tenant',actorId:'review-actor',conversationId:id(3),runId:id(5),attemptId:id(6),workerId:id(7),writerFence:1},scopes:[{tenantId:'review-tenant',kind:'client',resourceId:id(1),policyRevision:'review-policy'}],selectedClientId:id(1),checkedAtMs:Date.now(),expiresAtMs:Date.now()+1000});
function fixture(change={}){let fetches=0,reads=0,proofs=0,disposed=0;const options={target:config(),maxRequestMs:500,now:Date.now,verifyCandidate:async()=>{proofs++;return {origin:'https://authorized-staging.example.invalid',sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64)};},readCurrentContext:async()=>{reads++;return context();},authenticatedFetch:async()=>{fetches++;return new Response(JSON.stringify({error:{code:'SESSION_REFUSED',outcome:'NOT_DISPATCHED'}}),{status:401});},...change};
 options.authenticatedFetch.close=()=>disposed++;const client=createStagingE2EClient(options);return {options,client,counts:()=>({fetches,reads,proofs,disposed})};}
for(const [name,mutate]of [
 ['manual conversation',c=>c.binding.conversationId=id(4)],['foreign actor',c=>c.binding.actorId='other'],
 ['additional manual scope',c=>c.scopes.push({...c.scopes[0],resourceId:id(2)})],
 ['manual selection',c=>c.selectedClientId=id(2)],['expired current receipt',c=>c.expiresAtMs=0],
])test('Current '+name+' refuses before staging effect',async()=>{let fetches=0;const f=fixture({readCurrentContext:async()=>{const c=context();mutate(c);return c;},authenticatedFetch:async()=>{fetches++;throw Error('Forbidden effect');}});
 try{await assert.rejects(f.client.request({family:'conversation',route:'history',input:{}}));assert.equal(fetches,0);assert.equal(f.client.status().activeRequests,0);}finally{f.client.close();}
});
test('Inspect, revise and download never select versions not admitted by this client',async()=>{
 const f=fixture();try{for(const route of ['inspect','download'])await assert.rejects(f.client.request({family:'document',route,input:{versionId:id(9)}}),/STAGING_UNOWNED_VERSION/);
  assert.equal(f.counts().fetches,0);assert.equal(f.client.status().ownedVersions,0);
 }finally{f.client.close();}
});
test('Oversize actual Response cancels once and unlocks despite parked transport cancellation',async()=>{
 let cancelled=0,response;const f=fixture({authenticatedFetch:async()=>response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(2097153));},cancel(){cancelled++;return new Promise(()=>{});}}))});
 try{await assert.rejects(f.client.request({family:'conversation',route:'history',input:{}}),/STAGING_RESPONSE_LIMIT/);assert.equal(cancelled,1);assert.equal(response.body.locked,false);assert.equal(f.client.status().activeRequests,0);}finally{f.client.close();}
});
test('Client close aborts parked fresh-context read; late completion performs no Fetch and does not dispose borrowed port',async()=>{
 const entered=Promise.withResolvers(),held=Promise.withResolvers();let signal;
 const f=fixture({readCurrentContext:({signal:s})=>{signal=s;entered.resolve();return held.promise;}});const pending=f.client.request({family:'conversation',route:'history',input:{}});
 await entered.promise;f.client.close();await assert.rejects(pending,/CANCELLED/);assert.equal(signal.aborted,true);held.resolve(context());await new Promise(r=>setImmediate(r));
 assert.equal(f.counts().fetches,0);assert.equal(f.counts().disposed,0);assert.equal(f.client.status().activeRequests,0);assert.equal(f.client.status().closed,true);
});
test('Post-response writer-fence drift refuses release without retaining artifact versions',async()=>{
 let n=0;const f=fixture({readCurrentContext:async()=>{const c=context();if(++n>1)c.binding.writerFence++;return c;}});
 try{await assert.rejects(f.client.request({family:'conversation',route:'history',input:{}}),/STAGING_CONTEXT_CHANGED/);assert.equal(f.counts().fetches,1);assert.equal(f.client.status().ownedVersions,0);assert.equal(f.client.status().activeRequests,0);}finally{f.client.close();}
});
test('Target getters and Proxy refuse inertly; data selectors cannot add credentials or ownership',()=>{
 let effects=0;const c=config();Object.defineProperty(c,'manual',{enumerable:true,get(){effects++;return config().manual;}});
 assert.throws(()=>stagingTarget(c));assert.throws(()=>stagingTarget(new Proxy({},{get(){effects++;},ownKeys(){effects++;return []}})));
 assert.equal(effects,0);assert.throws(()=>stagingTarget({...config(),credential:'Unrequested'}));
});
