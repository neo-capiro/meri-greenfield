import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough,Writable} from 'node:stream';
import {createContextTransport,CONTEXT_FRAME_BYTES} from './context-transport.mjs';
function fixture(writable=new PassThrough()){
 const readable=new PassThrough();let stops=0;
 const owner=createContextTransport({readable,writable,stop:async()=>{stops++;}});
 return {owner,readable,writable,get stops(){return stops;}};
}
test('native readiness precedes public CDP open, with fragmented and coalesced frames',async()=>{
 const f=fixture(),received=[],written=[];f.writable.on('data',chunk=>written.push(chunk.toString()));
 assert.throws(()=>f.owner.open(),/REFUSED/);
 f.readable.write('{"bridge');f.readable.write('Ready":true}\n');await f.owner.ready;
 f.owner.transport.onmessage=value=>received.push(value);f.owner.open();
 f.readable.write('{"id":1,');f.readable.write('"result":{}}\n{"method":"event"}\n');
 assert.deepEqual(received,[{id:1,result:{}},{method:'event'}]);
 f.owner.transport.send({id:2,method:'Browser.getVersion'});assert.deepEqual(written,['{"id":2,"method":"Browser.getVersion"}\n']);
 f.owner.close();await Promise.resolve();assert.equal(f.stops,1);assert.throws(()=>f.owner.transport.send({id:3}),/REFUSED/);
});
for(const input of ['{}\n','{"bridgeReady":true,"extra":1}\n','null\n','not-json\n'])test('malformed readiness closes native streams: '+input.trim(),async()=>{
 const f=fixture();f.readable.write(input);await assert.rejects(f.owner.ready,/REFUSED/);await Promise.resolve();
 assert.equal(f.readable.destroyed,true);assert.equal(f.writable.destroyed,true);assert.equal(f.stops,1);
});
test('oversized unfinished native frame cannot grow without bound',async()=>{
 const f=fixture();f.readable.write(Buffer.alloc(CONTEXT_FRAME_BYTES,32));f.readable.write('x');
 await assert.rejects(f.owner.ready,/REFUSED/);await Promise.resolve();assert.equal(f.stops,1);
});
test('protocol before public open and a dropped native stream both fail closed',async()=>{
 const f=fixture();f.readable.write('{"bridgeReady":true}\n{"id":1}\n');await f.owner.ready;
 await Promise.resolve();assert.equal(f.stops,1);
 const g=fixture();g.readable.end();await assert.rejects(g.owner.ready,/REFUSED/);await Promise.resolve();assert.equal(g.stops,1);
});
test('stalled native writer is bounded and closes instead of accumulating commands',async()=>{
 const f=fixture(new Writable({write(){}}));f.readable.write('{"bridgeReady":true}\n');await f.owner.ready;f.owner.open();
 const frame={value:'x'.repeat(CONTEXT_FRAME_BYTES-100)};f.owner.transport.send(frame);f.owner.transport.send(frame);
 assert.throws(()=>f.owner.transport.send(frame),/REFUSED/);await Promise.resolve();assert.equal(f.stops,1);
});

test('a failing transport close callback and late pipe errors cannot prevent native cleanup',async()=>{
 const f=fixture();f.owner.transport.onclose=()=>{throw Error('closed consumer');};
 f.owner.close();f.readable.emit('error',Error('late read'));f.writable.emit('error',Error('late write'));
 await Promise.resolve();assert.equal(f.stops,1);await assert.rejects(f.owner.ready,/REFUSED/);
});
