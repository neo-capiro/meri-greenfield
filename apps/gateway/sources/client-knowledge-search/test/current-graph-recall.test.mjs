/** Current plain read context, no retired grant/decision carrier. Synthetic HTTP only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {storedCase} from './fixture.mjs';
import {readContext} from '../../bill-text/test/fixture.mjs';

function currentFixture(){
 const f=storedCase(),call=f.call();call.authority=readContext(f.authority);
 return {...f,call};
}

test('current graph carrier preserves the bounded connection window without inventing completeness or freshness',async()=>{
 const f=currentFixture();f.state.page={...f.page,
  summary:'2 nodes, 121 connections. Edges tagged [fact]=from firm data, [mention]=from analyst notes.',
  connections:Array(120).fill('Synthetic relationship')};
 const out=JSON.parse(await f.handler()(f.call));
 assert.deepEqual(out.result,f.state.page);
 assert.equal(Object.hasOwn(out.result,'complete'),false);
 assert.equal(Object.hasOwn(out.result,'generatedAt'),false);
 assert.equal(f.wire.length,1);
});

for(const status of [408,429,500,502,503,504])test(`graph HTTP  is a source that did not answer, never malformed or empty`,async()=>{
 const f=currentFixture();f.state.responseFactory=()=>Response.json({code:'SYNTHETIC_UNAVAILABLE'},{status});
 await assert.rejects(f.handler()(f.call),{message:'SOURCE_UNAVAILABLE'});
 assert.equal(f.wire.length,1);
});

for(const status of [401,403,400])test(`graph HTTP ${status} retains its distinct refusal`,async()=>{
 const f=currentFixture();f.state.responseFactory=()=>Response.json({code:'SYNTHETIC_REFUSAL'},{status});
 await assert.rejects(f.handler()(f.call),{message:status===400?'INVALID_RESULT':'ACCESS_DENIED'});
});

test('a malformed successful graph still refuses the entire result',async()=>{
 const f=currentFixture();f.state.page={...f.page,complete:true};
 await assert.rejects(f.handler()(f.call),{message:'INVALID_RESULT'});
});
