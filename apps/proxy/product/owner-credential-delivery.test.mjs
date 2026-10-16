import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {applicationAuthorityRoutes} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {binding} from '../../control/conversations/test/store-fixture.mjs';
import {createProductOwnerCredentialDelivery} from './owner-credential-delivery.mjs';

const NOW=1900000000000,clientId='11111111-1111-4111-8111-111111111170';
const credential='synthetic-native-opaque-credential';
const credentialSha256=createHash('sha256').update(credential).digest('hex');
const refused=/PRODUCT_OWNER_CREDENTIAL_UNAVAILABLE/;

function fixture(){
 let at=NOW,readChange=value=>value,nativeChange=value=>value,runChange=value=>value;
 const reads=[],fetches=[],runReads=[];
 const principal={tenantId:binding.tenantId,actorId:binding.actorId};
 const identity=()=>({principal,identityRevision:'native-identity-r1',checkedAtMs:at,expiresAtMs:NOW+9000});
 const configuration={binding,selectedClientId:clientId,expiresAtMs:NOW+5000,origin:'https://core.synthetic.invalid',
  now:()=>at,limits:{maxRequestMs:1000,maxFactBytes:65536,maxCredentialMs:5000},enabled:true,
  delivery:{async read(call){reads.push(call);return readChange({schemaVersion:1,leaseId:'native-lease-a',binding,selectedClientId:clientId,credential,credentialSha256,checkedAtMs:at,expiresAtMs:NOW+2000},reads.length);}},
  currentOwner:{async currentRun(value,{signal}){runReads.push({binding:value,signal});return JSON.stringify(runChange({binding,policyRevision:'a'.repeat(64),checkedAtMs:at,deadlineMs:NOW+4000},runReads.length));}},
  async fetchImpl(url,options){fetches.push({url,options});const request=JSON.parse(options.body);
   const result=url.endsWith(applicationAuthorityRoutes.identity)?identity():{identitySha256:request.identitySha256,principal,identityRevision:'native-identity-r1',conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:'native-context-r1',checkedAtMs:at,expiresAtMs:NOW+8000};
   return Response.json(nativeChange(result,fetches.length));},
 };
 return {configuration,reads,fetches,runReads,identity,make:()=>createProductOwnerCredentialDelivery(configuration),
  call:()=>({binding,deadlineMs:NOW+3000}),setRead:fn=>{readChange=fn;},setNative:fn=>{nativeChange=fn;},setRun:fn=>{runChange=fn;},advance:ms=>{at+=ms;}};
}

test('construction and disabled default make no delivery, native or current-run calls',async()=>{
 const f=fixture(),{enabled,...configuration}=f.configuration,owner=createProductOwnerCredentialDelivery(configuration);
 assert.equal(owner.available,false);await assert.rejects(owner.checkCurrentConversation(f.call()),refused);
 assert.deepEqual([f.reads.length,f.fetches.length,f.runReads.length],[0,0,0]);
});

test('fresh exact delivery is privately passed through canonical identity and current-context join',async()=>{
 const f=fixture(),owner=f.make(),receipt=await owner.checkCurrentConversation(f.call());
 assert.deepEqual(Object.keys(receipt),['identitySha256','binding','scopes','selectedClientId','contextRevision','checkedAtMs','expiresAtMs']);
 assert.equal(receipt.identitySha256,hash(f.identity()));assert.deepEqual(receipt.binding,binding);
 assert.equal(receipt.selectedClientId,clientId);assert.equal(receipt.expiresAtMs,NOW+1000);
 assert.deepEqual(receipt.scopes,[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,policyRevision:'a'.repeat(64)}]);
 assert.equal(f.reads.length,2);assert.equal(f.fetches.length,2);assert.equal(f.runReads.length,2);
 for(const read of f.reads){assert.deepEqual(read.binding,binding);assert.equal(read.selectedClientId,clientId);assert.ok(read.signal instanceof AbortSignal);}
 for(const fetch of f.fetches){assert.equal(fetch.options.headers.authorization,'Bearer '+credential);assert.equal(fetch.options.cache,'no-store');assert.equal(fetch.options.redirect,'error');}
 assert.equal(JSON.stringify(receipt).includes(credential),false);assert.equal(JSON.stringify(receipt).includes(credentialSha256),false);assert.equal(JSON.stringify(receipt).includes('native-lease-a'),false);
 assert.equal(owner.available,true);
});

for(const [label,change] of [
 ['tenant',r=>({...r,binding:{...binding,tenantId:'foreign-tenant'}})],
 ['actor',r=>({...r,binding:{...binding,actorId:'foreign-actor'}})],
 ['run',r=>({...r,binding:{...binding,runId:'11111111-1111-4111-8111-111111111199'}})],
 ['client',r=>({...r,selectedClientId:'11111111-1111-4111-8111-111111111199'})],
 ['digest',r=>({...r,credentialSha256:'b'.repeat(64)})],
 ['expired',r=>({...r,expiresAtMs:NOW})],
 ['stale',r=>({...r,checkedAtMs:NOW-1})],
 ['future',r=>({...r,checkedAtMs:NOW+1})],
 ['unbounded lease',r=>({...r,expiresAtMs:NOW+6000})],
 ['extra property',r=>({...r,authority:true})],
 ['missing lease',()=>null],
])test(`delivery ${label} refuses before native exchange`,async()=>{
 const f=fixture();f.setRead(change);const owner=f.make();await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(f.fetches.length,0);
});

for(const [label,change] of [
 ['native tenant',r=>({...r,principal:{...r.principal,tenantId:'foreign-tenant'}})],
 ['native actor',r=>({...r,principal:{...r.principal,actorId:'foreign-actor'}})],
 ['native client',r=>r.selectedClientId?{...r,selectedClientId:'11111111-1111-4111-8111-111111111199'}:r],
 ['native conversation',r=>r.conversationId?{...r,conversationId:'11111111-1111-4111-8111-111111111199'}:r],
 ['native expiry',r=>({...r,expiresAtMs:NOW})],
 ['native context digest',r=>r.identitySha256?{...r,identitySha256:'c'.repeat(64)}:r],
])test(`${label} refuses through the canonical parser and permits fresh retry after complete denial`,async()=>{
 const f=fixture();f.setNative(change);const owner=f.make();await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(owner.available,true);
 const count=f.fetches.length;f.setNative(r=>r);await owner.checkCurrentConversation(f.call());assert.ok(f.fetches.length>count);
});

test('current-run change after Core read refuses and delivery revocation/rotation cannot release a receipt',async()=>{
 const f=fixture();f.setRun((r,count)=>count===2?{...r,policyRevision:'b'.repeat(64)}:r);
 await assert.rejects(f.make().checkCurrentConversation(f.call()),refused);
 for(const change of [
  r=>({...r,leaseId:'native-lease-b'}),
  r=>({...r,credential:'changed-private-native',credentialSha256:createHash('sha256').update('changed-private-native').digest('hex')}),
  r=>({...r,expiresAtMs:NOW}),
  ()=>{throw Error('synthetic revoke with '+credential);},
 ]){
  const g=fixture();g.setRead((r,count)=>count===2?change(r):r);let error;
  try{await g.make().checkCurrentConversation(g.call());}catch(failure){error=failure;}
  assert.match(error.message,refused);assert.equal(JSON.stringify(error).includes(credential),false);assert.equal(error.cause,undefined);
 }
});

test('initial delivery expiry and configured run expiry cannot be extended by later reads',async()=>{
 const f=fixture();f.setRead((r,count)=>({...r,expiresAtMs:NOW+(count===1?400:3000)}));
 assert.equal((await f.make().checkCurrentConversation(f.call())).expiresAtMs,NOW+400);
 const g=fixture();g.configuration.expiresAtMs=NOW+250;assert.equal((await g.make().checkCurrentConversation(g.call())).expiresAtMs,NOW+250);
});

test('foreign input and pre-cancellation refuse before private reads',async()=>{
 const f=fixture(),owner=f.make(),controller=new AbortController();controller.abort();
 await assert.rejects(owner.checkCurrentConversation({...f.call(),binding:{...binding,actorId:'foreign'}}),refused);
 await assert.rejects(owner.checkCurrentConversation({...f.call(),signal:controller.signal}),refused);
 assert.equal(f.reads.length,0);
});

test('unresolved delivery and native fetch quarantine instance; repeat calls start no new work',async()=>{
 for(const port of ['delivery','fetch']){
  const f=fixture(),started=Date.now();f.configuration.now=()=>NOW+Date.now()-started;f.configuration.limits.maxRequestMs=30;
  let count=0;
  if(port==='delivery')f.configuration.delivery.read=()=>{count++;return new Promise(()=>{});};
  else{f.setRead(r=>({...r,checkedAtMs:f.configuration.now()}));f.configuration.fetchImpl=()=>{count++;return new Promise(()=>{});};}
  const owner=f.make();await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(owner.available,false);assert.equal(count,1);
  await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(count,1);
 }
});

test('completed HTTP denial with acknowledged body stop can retry a valid native exchange',async()=>{
 const f=fixture(),original=f.configuration.fetchImpl;let deny=true,stops=0;
 f.configuration.fetchImpl=(...args)=>deny?Promise.resolve(new Response(new ReadableStream({
  cancel(){stops++;},
 }),{status:403,headers:{'content-type':'application/json'}})):original(...args);
 const owner=f.make();await assert.rejects(owner.checkCurrentConversation(f.call()),refused);
 assert.equal(stops,1);assert.equal(owner.available,true);
 deny=false;await owner.checkCurrentConversation(f.call());assert.equal(owner.available,true);
});

for(const readBody of [true,false])test(`unacknowledged native body ${readBody?'read and ':''}stop quarantines without a second exchange`,async()=>{
 const f=fixture(),started=Date.now();f.configuration.now=()=>NOW+Date.now()-started;f.configuration.limits.maxRequestMs=40;
 f.setRead(r=>({...r,checkedAtMs:f.configuration.now()}));
 let sends=0,bodyReads=0,stops=0;
 f.configuration.fetchImpl=async()=>{sends++;return new Response(new ReadableStream({
  pull(){bodyReads++;return new Promise(()=>{});},cancel(){stops++;return new Promise(()=>{});},
 },{highWaterMark:0}),{status:readBody?200:403,headers:{'content-type':'application/json'}});};
 const owner=f.make();await assert.rejects(owner.checkCurrentConversation(f.call()),refused);
 assert.equal(owner.available,false);assert.equal(sends,1);assert.equal(stops,1);
 if(readBody)assert.equal(bodyReads,1);else assert.equal(bodyReads,0);
 await assert.rejects(owner.checkCurrentConversation(f.call()),refused);assert.equal(sends,1);
});
