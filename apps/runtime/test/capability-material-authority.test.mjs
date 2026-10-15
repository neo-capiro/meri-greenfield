/** The file-backed capability-material authority: one generation per key, owner-only files, retrieval only by matching grant before expiry, status by digest. Synthetic bindings only. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,statSync,readFileSync,readdirSync,chmodSync,symlinkSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createFileCapabilityAuthority} from '../capability-material-authority.mjs';
import {createPreparedRunIssuer} from '../prepared-run-issuer.mjs';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const binding=()=>({tenantId:'tenant-a',actorId:'actor-a',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1});
test('generate writes one owner-only record per key and refuses a second generation; retrieve needs the matching grant and an unexpired record; status reports identity by digest; the directory and records must be owned and private',async t=>{
 const root=mkdtempSync(join(tmpdir(),'meri-material-'));t.after(()=>rmSync(root,{recursive:true,force:true}));let now=1_800_000_000_000;const directory=join(root,'material'),authority=createFileCapabilityAuthority({directory,now:()=>now});
 const b=binding(),issuanceKey=hash(b),expiresAtMs=now+600000;const m=await authority.generate({issuanceKey,binding:b,expiresAtMs});
 assert.match(m.capability,/^[A-Za-z0-9_-]{43}$/);assert.equal(m.materialRef,'material:'+issuanceKey);assert.equal(statSync(directory).mode&0o777,0o700);const file=join(directory,issuanceKey+'.json');assert.equal(statSync(file).mode&0o777,0o600);assert.deepEqual(readdirSync(directory),[issuanceKey+'.json']);
 await assert.rejects(authority.generate({issuanceKey,binding:b,expiresAtMs}),/CAPABILITY_AUTHORITY_ALREADY_GENERATED/,'exactly one generation per key');assert.equal(readFileSync(file,'utf8').includes(m.capability),true,'the record holds the material; nothing else does');
 assert.deepEqual(await authority.retrieve({materialRef:m.materialRef,grantId:m.grantId}),{state:'PRESENT',capability:m.capability});assert.deepEqual(await authority.retrieve({materialRef:m.materialRef,grantId:randomUUID()}),{state:'ABSENT'});assert.deepEqual(await authority.retrieve({materialRef:'material:'+'0'.repeat(64),grantId:m.grantId}),{state:'ABSENT'});
 assert.deepEqual(await authority.status({issuanceKey}),{state:'PRESENT',grantId:m.grantId,capabilitySha256:capabilityDigest(m.capability),materialRef:m.materialRef});assert.deepEqual(await authority.status({issuanceKey:'1'.repeat(64)}),{state:'ABSENT'});
 await assert.rejects(authority.status({issuanceKey,expiresAtMs:expiresAtMs+1}),/CAPABILITY_AUTHORITY_REFUSED/,'status is bound to the recorded expiry when one is claimed');
 now=expiresAtMs;assert.deepEqual(await authority.retrieve({materialRef:m.materialRef,grantId:m.grantId}),{state:'EXPIRED'});const b2=binding();await assert.rejects(authority.generate({issuanceKey:hash(b2),binding:b2,expiresAtMs:now}),/CAPABILITY_AUTHORITY_REFUSED/,'no generation at or after expiry');
 await assert.rejects(authority.generate({issuanceKey:'0'.repeat(64),binding:b,expiresAtMs:now+1000}),/CAPABILITY_AUTHORITY_REFUSED/,'the key must be the binding hash');
 chmodSync(file,0o640);await assert.rejects(authority.retrieve({materialRef:m.materialRef,grantId:m.grantId}),/CAPABILITY_AUTHORITY_RECORD_REFUSED/,'a record readable by others is refused');chmodSync(file,0o600);
 const linked=join(root,'linked');symlinkSync(directory,linked);const b3=binding();await assert.rejects(createFileCapabilityAuthority({directory:linked,now:()=>now}).generate({issuanceKey:hash(b3),binding:b3,expiresAtMs:now+1000}),/CAPABILITY_AUTHORITY_DIRECTORY_REFUSED/,'a linked directory is not an owned one');
 const other=join(root,'other');writeFileSync(other,'x');assert.throws(()=>createFileCapabilityAuthority({directory:'relative'}),/CAPABILITY_AUTHORITY_CONFIGURATION/);const b4=binding();await assert.rejects(createFileCapabilityAuthority({directory:other,now:()=>now}).generate({issuanceKey:hash(b4),binding:b4,expiresAtMs:now+1000}),/CAPABILITY_AUTHORITY_DIRECTORY_REFUSED/,'a file at the directory path refuses');
});
test('through the issuer: a lost acknowledgement after generation reconciles from the file record without a second generation; an expired record resolves EXPIRED; the material never reaches the store',async t=>{
 const root=mkdtempSync(join(tmpdir(),'meri-material-'));t.after(()=>rmSync(root,{recursive:true,force:true}));let now=1_800_000_000_000;const authority=createFileCapabilityAuthority({directory:join(root,'material'),now:()=>now}),store=createMemoryIssuanceStore({crashAt:'before-complete'});
 const b=binding(),intent={issuanceKey:hash(b),binding:b,requestSha256:hash({prompt:'p'}),expiresAtMs:now+600000};
 await assert.rejects(createPreparedRunIssuer({store,authority,now:()=>now,maxRequestMs:300}).issue(intent),/PREPARED_RUN_ISSUER_UNKNOWN/);assert.equal((await store.read({issuanceKey:intent.issuanceKey})).state,'CLAIMED');
 const issuer=createPreparedRunIssuer({store,authority,now:()=>now});await assert.rejects(issuer.issue(intent),/PREPARED_RUN_ISSUER_UNKNOWN/,'the claim is uncertain and the authority refuses a second generation');
 const reconciled=await issuer.reconcile(intent);assert.equal(reconciled.state,'ISSUED');const status=await authority.status({issuanceKey:intent.issuanceKey});assert.equal(reconciled.issuance.capabilitySha256,status.capabilitySha256);
 const capability=await issuer.resolve(reconciled.issuance);assert.equal(capabilityDigest(capability),status.capabilitySha256);assert.ok(!JSON.stringify([...store.snapshot()]).includes(capability),'the store holds the digest and the reference, never the material');
 now=intent.expiresAtMs;await assert.rejects(issuer.resolve(reconciled.issuance),/PREPARED_RUN_ISSUER_EXPIRED/);
});
