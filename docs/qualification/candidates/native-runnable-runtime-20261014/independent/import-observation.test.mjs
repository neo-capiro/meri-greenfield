import test from 'node:test';import assert from 'node:assert/strict';import {Session} from 'node:inspector';
test('actual control/runnable imports parse neither SDK bundle nor snapshot verifier',async()=>{
 const observer=new Session(),urls=[];observer.connect();observer.on('Debugger.scriptParsed',event=>urls.push(event.params.url));
 try{await new Promise((resolve,reject)=>observer.post('Debugger.enable',error=>error?reject(error):resolve()));await import('../../../../../apps/runtime/control.mjs');await import('../../../../../apps/runtime/native-authority/runnable-runtime.mjs');
  assert.ok(urls.some(url=>url.endsWith('/apps/runtime/control.mjs')));assert.ok(urls.some(url=>url.endsWith('/apps/runtime/native-authority/runnable-runtime.mjs')));
  assert.equal(urls.some(url=>url.includes('/@anthropic-ai/claude-agent-sdk/')||url.endsWith('/verify-session-store.mjs')),false);
 }finally{observer.disconnect();}
});
