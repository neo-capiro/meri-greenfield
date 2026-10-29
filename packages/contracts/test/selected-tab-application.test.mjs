import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {SELECTED_TAB_SCHEMA as schema,receiveSelectedTabMessage,createSelectedTabShare,selectedTabOriginal,sameSelectedTabBinding} from '../selected-tab-application/receive.mjs';
const binding=()=>({tenantId:randomUUID(),actorId:randomUUID(),conversationId:randomUUID(),clientId:null});
const pair=()=>({schema,type:'pair',pairingId:randomUUID(),binding:binding(),labels:{account:'Fixture account',conversation:'Fixture chat'},expiresAtMs:600000});
const share=()=>({schema,type:'share',pairingId:randomUUID(),deviceId:randomUUID(),selectionId:randomUUID(),binding:binding(),tabId:2,
 documentId:randomUUID(),url:'https://example.invalid/page',title:'Example',capturedAtMs:1000,text:'Visible synthetic text'});
test('closed pair and immutable scope; no credential or wildcard fields',async()=>{
 const p=pair(),v=await receiveSelectedTabMessage('application',JSON.stringify(p));assert.deepEqual(v,p);assert.ok(Object.isFrozen(v.binding));
 for(const invalid of [{...p,credential:'synthetic'}, {...p,binding:{...p.binding,actorId:'*'}}, {...p,labels:{...p.labels,account:'\0'}}])
  await assert.rejects(receiveSelectedTabMessage('application',JSON.stringify(invalid)));
 assert.equal(sameSelectedTabBinding(p.binding,{...p.binding}),true);
 assert.equal(sameSelectedTabBinding(p.binding,{...p.binding,actorId:randomUUID()}),false);
});
test('exact UTF8 original includes sanitized source and title, with verified hash and byte count',async()=>{
 const v=await createSelectedTabShare({...share(),text:'Café — 日本語'}),bytes=selectedTabOriginal(v);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);assert.equal(bytes.byteLength,v.bytes);
 assert.match(new TextDecoder().decode(bytes),/^Selected tab: Example\nSource: https:\/\/example.invalid\/page\n\nCafé/u);
 assert.throws(()=>selectedTabOriginal({...v}));
 for(const invalid of [{...v,text:v.text+' changed'}, {...v,bytes:v.bytes+1}, {...v,sha256:'a'.repeat(64)}])
  await assert.rejects(receiveSelectedTabMessage('extension',JSON.stringify(invalid)));
});
test('URLs with credentials, query, fragments, non-web schemes and hidden payload fields are refused',async()=>{
 for(const url of ['https://user:pass@example.invalid/','https://example.invalid/?token=x','https://example.invalid/#x','file:///tmp/a','chrome://settings'])
  await assert.rejects(createSelectedTabShare({...share(),url}));
 await assert.rejects(createSelectedTabShare({...share(),cookies:'not allowed'}));
 await assert.rejects(createSelectedTabShare({...share(),text:'x'.repeat(262145)}));
 await assert.rejects(createSelectedTabShare({...share(),text:'\ud800'}));
});
test('directions, states, malformed JSON, oversized messages and prototype keys fail closed',async()=>{
 await assert.rejects(receiveSelectedTabMessage('extension',JSON.stringify(pair())));
 await assert.rejects(receiveSelectedTabMessage('application','{'));
 await assert.rejects(receiveSelectedTabMessage('application',' '.repeat(524289)));
 await assert.rejects(receiveSelectedTabMessage('application','{"__proto__":{}}'));
 const p=pair();await assert.rejects(receiveSelectedTabMessage('application',JSON.stringify({...p,type:'execute-script'})));
});
