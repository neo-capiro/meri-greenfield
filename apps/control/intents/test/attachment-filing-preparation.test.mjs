import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttachmentFilingPreparationPolicy} from '../attachment-filing-preparation.mjs';
import {attachmentCustodyFixture,id,NOW,canonicalSha256} from './attachment-filing-fixture.mjs';

test('attachment proposal policy inspects exact current artifact bytes and returns only current policy metadata',async()=>{
 const c=attachmentCustodyFixture(),before=structuredClone(c.request),receipt=await c.policy(c.call());
 assert.equal(receipt.authorized,true);assert.equal(receipt.selectionSha256,canonicalSha256(c.selected));
 assert.deepEqual(receipt.scopes,c.f.scopes);assert.equal(c.state.lookups,1);assert.equal(c.state.byteReads,1);
 assert.equal(c.state.policyCalls.length,2);assert.deepEqual(c.request,before);
 assert.equal(Object.hasOwn(receipt,'attachmentId'),false);assert.equal(Object.hasOwn(receipt,'approved'),false);
 assert.equal(c.f.state.fetches,0);assert.equal(c.f.pg.rows.size,0);
});

test('source scopes retain their provenance independently from the approved client destination',async()=>{
 const c=attachmentCustodyFixture(),sourceScope={tenantId:c.f.binding.tenantId,kind:'private-user',
  resourceId:c.f.binding.actorId,policyRevision:'p1'};
 c.object.scopes=[sourceScope];c.version.scopes=[sourceScope];c.version.object.scopes=[sourceScope];
 const configuration={...c.configuration,
  readContext:async request=>({...await c.readContext(request),scopes:[sourceScope]}),
  preparePolicy:async call=>({...await c.configuration.preparePolicy(call),scopes:[sourceScope,...c.f.scopes]})};
 const policy=createAttachmentFilingPreparationPolicy(configuration),selection=structuredClone(c.selected);
 selection.request.objects=[c.object];selection.inputSha256=canonicalSha256({arguments:c.f.context.destination,attachments:[c.object]});
 const receipt=await policy(c.call({selection,selectionSha256:canonicalSha256(selection)}));
 assert.deepEqual(receipt.scopes,[sourceScope,...c.f.scopes]);assert.deepEqual(c.object.scopes,[sourceScope]);
 assert.equal(c.state.byteReads,1);assert.equal(c.f.state.fetches,0);
});

for(const name of ['tenant','client','conversation','object','hash','nativeVersion','size'])
test(`attachment proposal refuses changed ${name} before any registration`,async()=>{
 const c=attachmentCustodyFixture(),selection=structuredClone(c.selected);
 if(name==='tenant')selection.binding.tenantId='foreign';
 if(name==='client')selection.request.clientId=id(99);
 if(name==='conversation')selection.request.conversationId=id(99);
 if(name==='object')selection.request.objects[0].objectId=id(99);
 if(name==='hash')selection.request.objects[0].sha256='f'.repeat(64);
 if(name==='nativeVersion')selection.request.objects[0].versionId='other-version';
 if(name==='size')selection.request.objects[0].bytes=3;
 // A fresh argument hash cannot turn a forged selection into actual custody.
 if(name!=='tenant')selection.inputSha256=canonicalSha256({arguments:{clientId:selection.request.clientId,
  conversationId:selection.request.conversationId},attachments:selection.request.objects});
 await assert.rejects(c.policy(c.call({selection,selectionSha256:canonicalSha256(selection)})));
 assert.equal(c.f.state.fetches,0);assert.equal(c.f.pg.rows.size,0);
});

for(const name of ['mime','filename','sourceProvenance','bytes'])test(`canonical artifact owner refuses ${name} drift`,async()=>{
 const c=attachmentCustodyFixture();c.state.changeRecord=record=>{
  if(name==='mime')record.version.mimeType='image/png';
  if(name==='filename')record.version.filename='unrelated.txt';
  if(name==='sourceProvenance')record.version.binding.conversationId=id(99);
  if(name==='bytes')record.inspection.sha256='f'.repeat(64);
 };
 await assert.rejects(c.policy(c.call()));assert.equal(c.f.state.fetches,0);
});

test('current source suppression, revoked policy and expiry refuse custody release',async()=>{
 for(const kind of ['suppressed','artifactDenied','policyRevoked','expired']){
  const c=attachmentCustodyFixture();
  if(kind==='suppressed')c.state.suppressed=true;
  if(kind==='artifactDenied')c.state.deny=true;
  if(kind==='policyRevoked')c.state.policyHook=(receipt,call)=>{if(c.state.policyCalls.length===2)receipt.authorized=false;};
  if(kind==='expired')c.state.policyHook=receipt=>{receipt.expiresAtMs=NOW;};
  await assert.rejects(c.policy(c.call()),undefined,kind);assert.equal(c.f.state.fetches,0);
 }
});

test('changed approver or client scope after custody inspection refuses release',async()=>{
 for(const kind of ['approver','scope']){
  const c=attachmentCustodyFixture();c.state.policyHook=receipt=>{
   if(c.state.policyCalls.length===2){
    if(kind==='approver')receipt.requiredApprover={tenantId:c.f.binding.tenantId,actorId:'changed-reviewer'};
    else receipt.scopes=[{...c.f.scopes[0],policyRevision:'changed'}];
   }
  };
  await assert.rejects(c.policy(c.call()));assert.equal(c.f.state.fetches,0);
 }
});

test('aborted or parked custody check is bounded and cannot register or release a late result',async()=>{
 const c=attachmentCustodyFixture(),controller=new AbortController();let entered,release;
 const started=new Promise(resolve=>{entered=resolve;}),wait=new Promise(resolve=>{release=resolve;});
 const policy=createAttachmentFilingPreparationPolicy({...c.configuration,readContext:async request=>{
  entered();await wait;return c.readContext(request);
 }});
 const pending=policy(c.call({signal:controller.signal}));await started;controller.abort();
 await assert.rejects(pending,/CANCELLED/);release();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(c.state.lookups,0);assert.equal(c.f.state.fetches,0);
});

test('model paths/URLs and untrusted source methods refuse without custody reads',async()=>{
 const c=attachmentCustodyFixture();
 for(const key of ['path','url','mimeType','filename']){
  const selection={...c.selected,request:{...c.request,[key]:'model'}};
  await assert.rejects(c.policy(c.call({selection,selectionSha256:canonicalSha256(selection)})));
 }
 let getters=0;const artifacts={get inspect(){getters++;return c.service.inspect;}};
 assert.throws(()=>createAttachmentFilingPreparationPolicy({...c.configuration,artifacts}));assert.equal(getters,0);
 assert.equal(c.state.lookups,0);assert.equal(c.f.state.fetches,0);
});
