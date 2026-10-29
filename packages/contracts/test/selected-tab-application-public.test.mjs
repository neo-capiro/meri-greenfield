import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {
 SELECTED_TAB_SCHEMA,SELECTED_TAB_LIMITS,createSelectedTabShare,
 receiveSelectedTabMessage,selectedTabOriginal,sameSelectedTabBinding,
} from '@capiro/meri-contracts/selected-tab-application';
const binding=()=>({tenantId:randomUUID(),actorId:randomUUID(),conversationId:randomUUID(),clientId:null});

test('public selected-tab export preserves exact UTF8 and the integrity boundary',async()=>{
 const input={schema:SELECTED_TAB_SCHEMA,type:'share',pairingId:randomUUID(),deviceId:randomUUID(),
  selectionId:randomUUID(),binding:binding(),tabId:12,documentId:randomUUID(),
  url:'https://example.invalid/public',title:'Synthetic title',capturedAtMs:1000,text:'Café 日本語'};
 const produced=await createSelectedTabShare(input);
 const received=await receiveSelectedTabMessage('extension',JSON.stringify(produced));
 const bytes=selectedTabOriginal(received);
 assert.deepEqual(received,produced);
 assert.equal(received.sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(received.bytes,bytes.byteLength);
 assert.equal(new TextDecoder().decode(bytes),'Selected tab: Synthetic title\nSource: https://example.invalid/public\n\nCafé 日本語\n');
 assert.equal(sameSelectedTabBinding(received.binding,input.binding),true);
 assert.equal(sameSelectedTabBinding(received.binding,{...input.binding,actorId:randomUUID()}),false);
 assert.throws(()=>selectedTabOriginal({...received}),/INVALID_SELECTED_TAB_MESSAGE/);
 await assert.rejects(receiveSelectedTabMessage('extension',JSON.stringify({...received,text:'Substituted text'})));
 assert.equal(SELECTED_TAB_LIMITS.captureMs,60000);
});
test('application messages stay directional and cannot claim arbitrary authority',async()=>{
 const pair={schema:SELECTED_TAB_SCHEMA,type:'pair',pairingId:randomUUID(),binding:binding(),
  labels:{account:'Synthetic account',conversation:'Synthetic conversation'},expiresAtMs:600000};
 const accepted=await receiveSelectedTabMessage('application',JSON.stringify(pair));
 assert.deepEqual(accepted,pair);
 assert.ok(Object.isFrozen(accepted.binding));
 await assert.rejects(receiveSelectedTabMessage('extension',JSON.stringify(pair)));
 await assert.rejects(receiveSelectedTabMessage('application',JSON.stringify({...pair,token:'not accepted'})));
});
test('public package exposes the same generated receiver used by the extension',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.exports['./selected-tab-application'],{
  types:'./dist/selected-tab-application.d.ts',default:'./dist/selected-tab-application.mjs'});
 assert.equal(await readFile(new URL('../dist/selected-tab-application.mjs',import.meta.url),'utf8'),
  await readFile(new URL('../../../apps/browser-extension/selected-tab/contract.mjs',import.meta.url),'utf8'));
});
