/** Historical producer expiry does not turn an active replacement into expired authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {liveFixture,requestFor} from '../../../../../apps/control/qualification-sdk-fixture/service/test/fixture.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {trustedBindingFromContext} from '../../../../../apps/control/qualification-sdk-fixture/state/binding.mjs';
const root=process.env.G1_REVIEW_SOURCE_ROOT??resolve('.');
const {createFixtureServiceHandlers}=await import(pathToFileURL(resolve(root,'apps/control/qualification-sdk-fixture/service/handlers.mjs')));
for(const operation of ['loadFixtureCheckpoint','verifyFixtureCheckpoint','authorizeFixturePhase'])test(`independent expired historical A retains valid current B ${operation}`,async()=>{
 const f=liveFixture(),now=Date.now();
 f.producer.identity.expiresAtMs=now-5000;f.receipt.producer=structuredClone(f.producer);f.reference.receiptSha256=canonicalSha256(f.receipt);
 const peerB={peerId:'synthetic-task-b',credentialId:'synthetic-credential-b'};
 const {phase,...current}=trustedBindingFromContext(f.current,peerB);
 const publication={outcome:'LOADED',receiptId:f.reference.receiptId,receiptSha256:f.reference.receiptSha256,bundleObjectId:f.receipt.bundle.objectId,bundleVersionId:f.receipt.bundle.versionId,bundleSha256:f.receipt.bundle.sha256,bundleBytes:f.receipt.bundle.bytes,workspaceSha256:f.receipt.workspaceSha256};
 const registry={authorize:async()=>({decision:'DENIED_STALE_BINDING',checkedAtMs:now,current}),publishCommit:async()=>{throw new Error('not used');},readPublication:async()=>{throw new Error('not used');},loadCheckpoint:async()=>publication,verifyCheckpoint:async()=>({outcome:'VERIFIED',...f.reference})};
 const checkpointStore={prepareCommit:async()=>{throw new Error('not used');},load:async()=>({receipt:f.receipt,bundle:f.bundle,fixtureFile:f.sentinel,readback:f.readback})};
 const handlers=createFixtureServiceHandlers({registry,checkpointStore,now:()=>now});
 const response=await handlers[operation]({peer:operation==='authorizeFixturePhase'?{peerId:'synthetic-task-a',credentialId:'synthetic-credential-a'}:peerB,context:f.current,producer:f.producer,request:requestFor(f,operation),signal:new AbortController().signal});
 assert.equal(response.status,{loadFixtureCheckpoint:'LOADED',verifyFixtureCheckpoint:'VERIFIED',authorizeFixturePhase:'DENIED_STALE_BINDING'}[operation]);
});
