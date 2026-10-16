/** Canonical packet validation over synthetic identities; no DB, object effect, renderer or network. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {previewClaim,verifyPreviewClaim} from '../preview/claim.mjs';
function fixture(){const createdAt='2026-01-01T00:00:00.000Z',binding={tenantId:'synthetic',actorId:'owner',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'tenant',resourceId:binding.tenantId,policyRevision:'1'}];
 const version=v.version({contractVersion:'0.1.0',versionId:randomUUID(),artifactId:randomUUID(),parentVersionId:null,binding,scopes,evidence:[],filename:'synthetic.pdf',mimeType:'application/pdf',generationStatus:'draft',previewStatus:'pending',createdAt,object:{objectId:randomUUID(),versionId:'source-native-v1',sha256:'1'.repeat(64),bytes:123,scopes}});
 const context=v.context({binding,scopes,evidence:[],assets:[],deadlineMs:Date.parse(createdAt)+60000,maxBytes:8388608}),allocation={objectId:randomUUID(),versionId:randomUUID()};
 return {version,context,allocation,createdAt,claim:previewClaim(v,version,allocation,context,createdAt)};}
const cases=[['unknown property',c=>{c.extra=true;}],['another tenant binding',c=>{c.binding.tenantId='other';}],['invalid writer fence',c=>{c.binding.writerFence=0;}],
 ['expiry preceding original claim',c=>{c.deadlineMs=Date.parse(c.createdAt)-1;}],['noncanonical timestamp',c=>{c.createdAt='2026-01-01T00:00:00+00:00';}],
 ['missing original run',c=>{delete c.binding.runId;}],['fractional expiry',c=>{c.deadlineMs+=0.5;}]];
for(const [label,mutate] of cases)test(`synthetic preview claim refuses ${label}`,()=>{const f=fixture();mutate(f.claim);assert.throws(()=>verifyPreviewClaim(v,f.claim,f.version),/ARTIFACT_PREVIEW_CLAIM/);});

test('synthetic preview claim retains expired original authority unchanged for recovery and never extends it',()=>{
 const f=fixture(),before=structuredClone(f),claim=verifyPreviewClaim(v,f.claim,f.version);
 assert.ok(claim.deadlineMs<Date.now(),'historical expiry does not disappear on replay');assert.equal(claim.deadlineMs,before.claim.deadlineMs);assert.deepEqual(f,before);
 claim.binding.actorId='mutated copy';assert.equal(f.claim.binding.actorId,'owner');
 const bad={...f.context,deadlineMs:Date.parse(f.createdAt)-1};assert.throws(()=>previewClaim(v,f.version,f.allocation,bad,f.createdAt),/ARTIFACT_PREVIEW_CLAIM/);
});
