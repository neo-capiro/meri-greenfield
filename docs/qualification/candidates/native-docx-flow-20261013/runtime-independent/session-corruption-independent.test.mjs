import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileFunction} from 'node:vm';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const root=process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root,'Exact source root is required');
const load=path=>import(pathToFileURL(resolve(root,path)).href);
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
const {createDurableSdkSessionOwner}=await load('apps/runtime/native-authority/session-owner.mjs');
const {BudgetCommitUncertain}=await load('apps/gateway/budget/postgres-budget-store.mjs');
// Borrow only the immutable author SQL/identity fixture. Execute the current real
// session owner; add independent consistent-corruption and no-write assertions.
const fixtureSource=readFileSync(new URL('./session-sql-fixture.txt',import.meta.url),'utf8');
assert.ok(fixtureSource.startsWith('function fixture('));
const preimage=createHash('sha256').update(fixtureSource).digest('hex');
assert.equal(preimage,'e2cddcc333a62ace91b0b975afe0c422838a670000c98ea6cb8fd0dcef8b5269');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const NOW=Date.parse('2026-10-13T20:00:00Z');
const originalFixture=compileFunction(fixtureSource+'\nreturn fixture;',[
 'createDurableSdkSessionOwner','BudgetCommitUncertain','hash','assert','NOW','id',
])(createDurableSdkSessionOwner,BudgetCommitUncertain,hash,assert,NOW,id);
// The additive correlated-wire owner verifies redundant SQL tuple columns.
// Use its frozen tuple-complete fixture when present; keep the old preimage for
// the already retained ccfab failure. No production or semantic assertion changes.
let fixture=originalFixture;
try{
 const next=await load('apps/runtime/native-authority/test/fixture.mjs');
 fixture=next.fixture;
}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}

for(const [label,change] of [
 ['foreign observed SDK key',receipt=>{receipt.key.projectKey='foreign-observed.SDK.key';}],
 ['foreign append identity',receipt=>{receipt.appendId=id(999);}],
 ['inconsistent entry digest',receipt=>{receipt.entriesSha256='f'.repeat(64);}],
 ['uncommitted receipt',receipt=>{receipt.committed=false;}],
 ['impossible offset',receipt=>{receipt.offset=100001;}],
])test('consistent retained batch corruption refuses '+label,async t=>{
 t.diagnostic('Borrowed immutable author SQL fixture SHA256 '+preimage);
 const f=fixture();await f.invoke('register');
 const entries=[{type:'system',marker:'retained exact original'}];
 const call={appendId:id(10),expectedOffset:0,entriesSha256:hash(entries),entries};
 const healthy=await f.invoke('append',call);
 assert.deepEqual(await f.invoke('append',call),healthy,'Healthy exact replay must preserve its original receipt');
 assert.deepEqual((await f.invoke('load')).entries,entries,'Original transcript is readable before corruption');
 const row=f.state().batches.get(call.appendId);
 change(row.receipt);row.receipt_sha256=hash(row.receipt);
 const before=structuredClone(f.state().entries);
 await assert.rejects(f.invoke('append',call),error=>error.code==='SDK_SESSION_APPEND_CONFLICT'||error.code==='SDK_SESSION_CORRUPT');
 assert.deepEqual(f.state().entries,before,'Refusal must leave original transcript unchanged');
});

test('current native authority refuses exact retained batch replay before SQL',async()=>{
 const f=fixture();await f.invoke('register');
 const entries=[{type:'system',marker:'original'}];
 const call={appendId:id(10),expectedOffset:0,entriesSha256:hash(entries),entries};
 await f.invoke('append',call);const before=f.calls();f.revoke();
 await assert.rejects(f.invoke('append',call));assert.equal(f.calls(),before);
 assert.equal(f.state().entries.length,1);
});
