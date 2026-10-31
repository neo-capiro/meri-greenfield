/** Synthetic receipts only; no credentials are issued by these receivers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {receiveConversationSessionReceipt as receive,conversationSessionMetadata} from '@capiro/meri-contracts/conversation-session';
import {validSessionReceipt} from '../session-receipt/validate.mjs';
import {assertActionSessionReceipt} from '../../../apps/control/action-host/session/owner.mjs';
const bytes=x=>new TextEncoder().encode(JSON.stringify(x)),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),selectedClientId:null};
const receipt={credential:'action_session_'+'A'.repeat(43),expiresAtMs:2000,context};
test('explicit General receipt matches the CONTROL base while client-only validation refuses null',()=>{
 assert.deepEqual(receive(bytes(receipt),bytes({...context,scopeKind:'general'}),1000),receipt);
 assert.equal(validSessionReceipt(receipt,1000,{general:true}),true);assert.equal(validSessionReceipt(receipt,1000),false);
 assert.ok(Object.isFrozen(receive(bytes(receipt),bytes({...context,scopeKind:'general'}),1000).context));
 const {runId,...initial}=context;assert.deepEqual(receive(bytes(receipt),bytes({...initial,scopeKind:'general'}),1000),receipt);
 const {conversationId,...missing}=initial;assert.throws(()=>receive(bytes(receipt),bytes({...missing,scopeKind:'general'}),1000));
});
test('client receipts remain compatible and are bound to the selected client',()=>{
 const c={...context,selectedClientId:id(3)},r={...receipt,context:c};
 assert.deepEqual(receive(bytes(r),bytes({...c,scopeKind:'client'}),1000),r);assert.equal(validSessionReceipt(r,1000),true);
 assert.throws(()=>receive(bytes(r),bytes({...c,scopeKind:'general'}),1000));
});
test('legacy null, v1 bootstrap, forged kind, foreign principal and stale receipts never authorize General',()=>{
 for(const expected of [context,{schemaVersion:1,requestId:id(4),clientId:null},{...context,scopeKind:'client'},{...context,scopeKind:'general',clientId:null},{...context,scopeKind:'general',actorId:'foreign'},{...context,scopeKind:'general',tenantId:'foreign'},{...context,scopeKind:'general',conversationId:id(5)},{...context,scopeKind:'general',runId:id(6)}])assert.throws(()=>receive(bytes(receipt),bytes(expected),1000));
 assert.throws(()=>receive(bytes(receipt),bytes({...context,scopeKind:'general'}),2000));
 assert.throws(()=>receive(bytes({...receipt,context:{...context,scopeKind:'general'}}),bytes({...context,scopeKind:'general'}),1000));
 assert.throws(()=>receive(bytes(receipt),bytes({...context,scopeKind:'general'}),NaN));
});
test('browser export records its canonical schema provenance and imports no server modules',async()=>{
 const metadata=JSON.parse(await readFile(new URL('../dist/conversation-session.metadata.json',import.meta.url)));
 assert.equal(conversationSessionMetadata.packageVersion,'0.1.43');assert.deepEqual(metadata.browserImports,[]);
 assert.ok(metadata.sources.some(row=>row.path==='session-receipt/schema.mjs'));
 for(const row of metadata.sources)assert.equal(createHash('sha256').update(await readFile(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256,row.path);
 const source=await readFile(new URL('../dist/conversation-session.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"]node:|require\(['"]node:/u);
});

test('CONTROL and the public receiver preserve principal UTF-16 bounds and exact closed receipt fields',()=>{
 const expected=r=>({...r.context,scopeKind:r.context.selectedClientId===null?'general':'client'});
 for(const principal of ['a'.repeat(256),'😀'.repeat(128)]){
  const value={...receipt,context:{...context,tenantId:principal,actorId:principal}};
  assert.deepEqual(assertActionSessionReceipt(value,1000),receive(bytes(value),bytes(expected(value)),1000));
 }
 for(const value of [
  {...receipt,extra:true},{...receipt,context:{...context,extra:true}},
  {...receipt,expiresAtMs:1000},{...receipt,expiresAtMs:Number.MAX_SAFE_INTEGER+1},
  {...receipt,credential:'action_session_short'},
  ...['tenantId','actorId'].flatMap(key=>['', 'a'.repeat(257),'😀'.repeat(129)].map(v=>({...receipt,context:{...context,[key]:v}}))),
  ...['conversationId','runId','selectedClientId'].map(key=>({...receipt,context:{...context,[key]:'not-a-uuid'}})),
 ]){
  assert.throws(()=>assertActionSessionReceipt(value,1000));
  assert.throws(()=>receive(bytes(value),bytes(expected(value)),1000));
 }
});

test('missing explicit client selection, malformed bytes, byte excess and extra authority-shaped fields refuse',()=>{
 const {selectedClientId,...missing}=context;
 for(const value of [ {...receipt,context:missing},{...receipt,context:{...context,scopeKind:'general'}},
  {...receipt,credential:'action_session_'+'A'.repeat(4096)}]){
  assert.throws(()=>assertActionSessionReceipt(value,1000));
  assert.throws(()=>receive(bytes(value),bytes({...context,scopeKind:'general'}),1000));
 }
 for(const raw of [new Uint8Array([255]),new TextEncoder().encode('{'),new Uint8Array(4097)])
  assert.throws(()=>receive(raw,bytes({...context,scopeKind:'general'}),1000));
 assert.throws(()=>receive(bytes(receipt),new Uint8Array(2049),1000));
 void selectedClientId;
});

for(const selectedClientId of [null,id(3)])test(`fresh exact initial rebind is received only for its full source and target (${selectedClientId===null?'General':'client'})`,()=>{
 const source={...context,selectedClientId},target={...source,runId:id(8)};
 const value={...receipt,context:target,initialRunRebind:{sourceRunId:source.runId,targetRunId:target.runId}},expected={...source,scopeKind:selectedClientId===null?'general':'client'};
 assert.deepEqual(receive(bytes(value),bytes(expected),1000),assertActionSessionReceipt(value,1000));
 const {initialRunRebind,...ordinary}=value;
 assert.throws(()=>receive(bytes(ordinary),bytes(expected),1000),'ordinary mismatches remain exact');
 assert.deepEqual(receive(bytes(ordinary),bytes({...expected,runId:target.runId}),1000),ordinary);
 for(const key of ['tenantId','actorId','conversationId','runId','selectedClientId']){
  const missing={...expected};delete missing[key];assert.throws(()=>receive(bytes(value),bytes(missing),1000));
 }
 for(const changed of [
  {...value,initialRunRebind:{sourceRunId:id(9),targetRunId:target.runId}},
  {...value,initialRunRebind:{sourceRunId:source.runId,targetRunId:id(9)}},
  {...value,initialRunRebind:{sourceRunId:target.runId,targetRunId:target.runId}},
  ...['tenantId','actorId','conversationId','selectedClientId'].map(key=>({...value,context:{...target,[key]:key.endsWith('ClientId')?id(9):key==='conversationId'?id(9):'foreign'}})),
  {...value,initialRunRebind:{...value.initialRunRebind,accepted:true}},
  {...value,initialRunRebind:{sourceRunId:source.runId}},
 ])assert.throws(()=>receive(bytes(changed),bytes(expected),1000));
 assert.throws(()=>receive(bytes(value),bytes({...expected,runId:target.runId}),1000),'rebind receipt cannot stand in for an ordinary target recheck');
 assert.throws(()=>receive(bytes(value),bytes({...expected,recovery:true}),1000),'no client recovery hint');
 const longest={...source,tenantId:'界'.repeat(256),actorId:'界'.repeat(256)};
 const bounded={...value,context:{...longest,runId:target.runId}};
 assert.deepEqual(receive(bytes(bounded),bytes({...longest,scopeKind:expected.scopeKind}),1000),assertActionSessionReceipt(bounded,1000));
 void initialRunRebind;
});
