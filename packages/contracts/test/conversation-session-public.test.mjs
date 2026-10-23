/** Synthetic receipts only; no credentials are issued by these receivers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {receiveConversationSessionReceipt as receive,conversationSessionMetadata} from '@capiro/meri-contracts/conversation-session';
import {validSessionReceipt} from '../session-receipt/validate.mjs';
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
 assert.equal(conversationSessionMetadata.packageVersion,'0.1.11');assert.deepEqual(metadata.browserImports,[]);
 assert.ok(metadata.sources.some(row=>row.path==='session-receipt/schema.mjs'));
 for(const row of metadata.sources)assert.equal(createHash('sha256').update(await readFile(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256,row.path);
 const source=await readFile(new URL('../dist/conversation-session.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"]node:|require\(['"]node:/u);
});
