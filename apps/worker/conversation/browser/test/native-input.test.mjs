import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {prepareNativeBrowserInput} from '../session/native-input.mjs';
import {createInputLimiter,INPUT_LIMITS} from '../session/input.mjs';
const admit=(context,page,input)=>prepareNativeBrowserInput(context,page,input,{leaseEpoch:1,limiter:createInputLimiter({now:()=>0})});
function fixture(){
 let url='https://records.example/page',closed=false;const events=[],frame={},lifecycle=new EventEmitter();
 const page={url:()=>url,isClosed:()=>closed,mainFrame:()=>frame,viewportSize:()=>({width:800,height:600}),
  on:(...args)=>lifecycle.on(...args),off:(...args)=>lifecycle.off(...args),
  keyboard:{insertText:async text=>events.push(['text',text]),press:async key=>events.push(['key',key])},
  mouse:{click:async(x,y)=>events.push(['click',x,y]),move:async(x,y)=>events.push(['move',x,y]),wheel:async(x,y)=>events.push(['wheel',x,y])}};
 return {page,context:{pages:()=>[page]},events,navigate:()=>{url+='/next';},reload:()=>lifecycle.emit('framenavigated',frame),close:()=>{closed=true;},listeners:()=>lifecycle.listenerCount('framenavigated')};
}
test('closed native input admits owned-page text, bounded clicks and explicit keys',async()=>{
 const f=fixture();
 for(const input of [{kind:'text',text:'Synthetic text'},{kind:'click',x:2,y:3},{kind:'key',key:'Shift+Tab'},{kind:'wheel',x:2,y:3,deltaX:0,deltaY:120}]){
  const q=admit(f.context,f.page,input);assert.equal(q.text,input.text??null);await q.perform();q.dispose();
 }
 assert.deepEqual(f.events,[['text','Synthetic text'],['click',2,3],['key','Shift+Tab'],['move',2,3],['wheel',0,120]]);
});
test('input refuses foreign pages, callbacks, clipboard shortcuts and oversized or hidden fields',()=>{
 const f=fixture();
 assert.throws(()=>admit(f.context,{...f.page},{kind:'key',key:'Enter'}));
 for(const action of [{kind:'text',text:'x'.repeat(INPUT_LIMITS.maxText+1)},{kind:'text',text:'x\u0007'},{kind:'text',text:'x',perform:()=>{}},{kind:'key',key:'Control+v'},
  {kind:'key',key:'Control+r'},{kind:'key',key:'a'},{kind:'key',key:'Shift+a'},{kind:'click',x:800,y:2},{kind:'click',x:2,y:-1},{kind:'evaluate',code:'arbitrary'},
  {kind:'wheel',x:2,y:3,deltaX:0,deltaY:INPUT_LIMITS.maxWheelDelta+1}]){
  assert.throws(()=>admit(f.context,f.page,action));
 }assert.equal(f.events.length,0);
});
test('wheel positioning cannot carry a prior lease or page into scrolling',async()=>{
 for(const change of ['navigate','lease']){
  const f=fixture();let live=true;f.page.mouse.move=async()=>{change==='navigate'?f.navigate():live=false;};
  const q=admit(f.context,f.page,{kind:'wheel',x:2,y:3,deltaX:0,deltaY:120});
  await assert.rejects(q.perform({assertLease(){if(!live)throw Error('STALE_LEASE');}}));q.dispose();assert.equal(f.events.length,0);
 }
});
test('navigation including same-URL reload or page close during checks refuses native input',async()=>{
 for(const change of ['navigate','reload','close']){
  const f=fixture(),q=admit(f.context,f.page,{kind:'text',text:'Synthetic private value'});f[change]();
  await assert.rejects(q.perform(),/INPUT_REFUSED/);q.dispose();assert.equal(f.events.length,0);assert.equal(f.listeners(),0);
 }
});
test('native input preparation is consumed once and disposal removes its navigation witness',async()=>{
 const f=fixture(),q=admit(f.context,f.page,{kind:'key',key:'Enter'});assert.equal(f.listeners(),1);
 await q.perform();await assert.rejects(q.perform(),/INPUT_REFUSED/);q.dispose();assert.equal(f.listeners(),0);assert.equal(f.events.length,1);
 const closed=admit(f.context,f.page,{kind:'key',key:'Enter'});closed.dispose();await assert.rejects(closed.perform(),/INPUT_REFUSED/);assert.equal(f.events.length,1);
});
