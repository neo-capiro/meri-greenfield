import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../validate.mjs';
import {assertArtifactFileResult} from '../commands-0.2/validate.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = {tenantId:'review-tenant',actorId:'review-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scope = {tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:'review-policy'};
const object = {objectId:id(6),versionId:'immutable-v1',sha256:'a'.repeat(64),bytes:12,scopes:[scope]};
const command = {contractVersion:'0.1.0',commandId:id(7),binding,action:'artifact.file',arguments:{clientId:id(5),conversationId:id(1)},attachments:[object],scopes:[scope],idempotencyKey:'review-file-1'};
const context = {binding,destination:{clientId:id(5),conversationId:id(1)}};
const observation = () => ({object:structuredClone(object),fileName:'original.txt',status:'saved',documentId:id(8),location:'/synthetic/document',indexingStatus:'pending',reused:false});
const result = file => ({commandSha256:canonicalSha256(command),files:[file]});
const check = file => assertArtifactFileResult(result(file),command,context);

test('saved original bytes may retain an extraction limitation reason', () => {
  for (const reason of ['Partial extracted text','']) {
    const row = {...observation(),reason};
    assert.deepEqual(check(row).files[0],row);
  }
});
test('saved extraction limitation never permits not_indexed or partial persistence', () => {
  for (const mutate of [r=>r.indexingStatus='not_indexed',r=>delete r.documentId,r=>delete r.location,r=>delete r.reused,r=>delete r.indexingStatus]) {
    const row = {...observation(),reason:'Partial extracted text'}; mutate(row);
    assert.throws(()=>check(row));
  }
});
test('saved reason remains inert typed data without extra readiness claims', () => {
  for (const reason of [null,1,{},[]]) assert.throws(()=>check({...observation(),reason}));
  assert.throws(()=>check({...observation(),reason:'Partial',readable:true}));
  let effects=0;const row=observation();Object.defineProperty(row,'reason',{enumerable:true,get(){effects++;return 'Partial';}});
  assert.throws(()=>check(row));assert.equal(effects,0);
});
test('saved reason cannot change exact immutable object identity', () => {
  const row={...observation(),reason:'Partial'};row.object.sha256='b'.repeat(64);
  assert.throws(()=>check(row));
});
test('a saved reason is preserved in the detached admitted result', () => {
  const row={...observation(),reason:'Partial'},page=result(row);
  const admitted=assertArtifactFileResult(page,command,context);
  row.reason='changed';row.object.bytes=999;
  assert.equal(admitted.files[0].reason,'Partial');assert.equal(admitted.files[0].object.bytes,12);
});
