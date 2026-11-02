import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {prepareNativeBrowserInput} from '../session/native-input.mjs';
import {createInputLimiter,INPUT_LIMITS} from '../session/input.mjs';
const batch=(events,leaseEpoch=1)=>({leaseEpoch,events});
const admit=(context,page,input,leaseEpoch=1)=>prepareNativeBrowserInput(context,page,input,{leaseEpoch,limiter:createInputLimiter({now:()=>0})});
function fixture(){
 let url='https://records.example/page',closed=false;const events=[],frame={},lifecycle=new EventEmitter();
 const page={url:()=>url,isClosed:()=>closed,mainFrame:()=>frame,viewportSize:()=>({width:800,height:600}),
  on:(...args)=>lifecycle.on(...args),off:(...args)=>lifecycle.off(...args),
  keyboard:{insertText:async text=>events.push(['text',text]),down:async key=>events.push(['down',key]),up:async key=>events.push(['up',key])},
  mouse:{move:async(x,y)=>events.push(['move',x,y]),down:async o=>events.push(['mousedown',o.button]),up:async o=>events.push(['mouseup',o.button]),wheel:async(x,y)=>events.push(['wheel',x,y])}};
 return {page,context:{pages:()=>[page]},events,navigate:()=>{url+='/next';},reload:()=>lifecycle.emit('framenavigated',frame),close:()=>{closed=true;},listeners:()=>lifecycle.listenerCount('framenavigated')};
}
test('the wire batch is admitted as a whole and dispatched in order: text, named keys, mouse with button, wheel',async()=>{
 const f=fixture();
 const q=admit(f.context,f.page,batch([{type:'text',text:'Synthetic text'},{type:'key',action:'down',key:'Shift'},{type:'key',action:'down',key:'Tab',shift:true},
  {type:'key',action:'up',key:'Tab',shift:true},{type:'key',action:'up',key:'Shift'},{type:'mouse',action:'move',x:2,y:3},{type:'mouse',action:'down',x:2,y:3,button:'left'},
  {type:'mouse',action:'up',x:2,y:3,button:'left'},{type:'wheel',x:4,y:5,deltaX:0,deltaY:120}]));
 assert.equal(q.text,'Synthetic text');assert.equal(q.events.length,9);
 await q.perform();q.dispose();
 assert.deepEqual(f.events,[['text','Synthetic text'],['down','Shift'],['down','Tab'],['up','Tab'],['up','Shift'],['move',2,3],['move',2,3],['mousedown','left'],['move',2,3],['mouseup','left'],['move',4,5],['wheel',0,120]]);
});
test('the frontend keystroke shape (every character as a key down/up pair) is admitted and typed as text; named keys stay keys',async()=>{
 const f=fixture();
 // Exactly what the viewer sends for typing "Hi!" then Enter: shift held, printable keys, shift released, Enter down/up.
 const typed=[{type:'key',action:'down',key:'Shift'},{type:'key',action:'down',key:'H',shift:true},{type:'key',action:'up',key:'H',shift:true},{type:'key',action:'up',key:'Shift'},
  {type:'key',action:'down',key:'i'},{type:'key',action:'up',key:'i'},{type:'key',action:'down',key:'Shift'},{type:'key',action:'down',key:'!',shift:true},{type:'key',action:'up',key:'!',shift:true},
  {type:'key',action:'up',key:'Shift'},{type:'key',action:'down',key:'Enter'},{type:'key',action:'up',key:'Enter'}];
 const q=admit(f.context,f.page,batch(typed));
 assert.equal(q.text,'Hi!','the typed characters enter the confidentiality filter as text');
 await q.perform();q.dispose();
 assert.deepEqual(f.events,[['down','Shift'],['text','H'],['up','Shift'],['text','i'],['down','Shift'],['text','!'],['up','Shift'],['down','Enter'],['up','Enter']]);
 assert.equal(f.events.filter(e=>e[0]==='down'&&!['Shift','Enter'].includes(e[1])).length,0,'no printable key is ever pressed as a key');
});
test('input refuses foreign pages, a foreign lease epoch, chords, oversized or control text and out-of-viewport coordinates',()=>{
 const f=fixture();
 assert.throws(()=>admit(f.context,{...f.page},batch([{type:'key',action:'down',key:'Enter'}])));
 assert.throws(()=>admit(f.context,f.page,batch([{type:'key',action:'down',key:'Enter'}],2)),/BROWSER_INPUT_REFUSED/);
 for(const events of [[{type:'text',text:'x'.repeat(INPUT_LIMITS.maxText+1)}],[{type:'text',text:'x\u0007'}],[{type:'text',text:'x',perform:()=>{}}],
  [{type:'key',action:'down',key:'ab'}],[{type:'key',action:'down',key:'Control+v'}],[{type:'key',action:'down',key:'Control+r'}],[{type:'paste',text:'x'}],
  [{type:'mouse',action:'down',x:800,y:2,button:'left'}],[{type:'mouse',action:'down',x:2,y:-1,button:'left'}],[{type:'mouse',action:'down',x:2,y:2}],
  [{type:'wheel',x:2,y:3,deltaX:0,deltaY:INPUT_LIMITS.maxWheelDelta+1}],[],[{kind:'click',x:1,y:1}]]){
  assert.throws(()=>admit(f.context,f.page,batch(events)),JSON.stringify(events));
 }
 assert.throws(()=>admit(f.context,f.page,{kind:'text',text:'legacy action shape'}));
 assert.equal(f.events.length,0);
});
test('the batch is charged once against the lease limiter before any effect',()=>{
 const f=fixture(),limiter=createInputLimiter({now:()=>0,eventsPerSecond:1,burst:3});
 const two=prepareNativeBrowserInput(f.context,f.page,batch([{type:'mouse',action:'move',x:1,y:1},{type:'mouse',action:'move',x:2,y:2}]),{leaseEpoch:1,limiter});two.dispose();
 assert.throws(()=>prepareNativeBrowserInput(f.context,f.page,batch([{type:'mouse',action:'move',x:1,y:1},{type:'mouse',action:'move',x:2,y:2}]),{leaseEpoch:1,limiter}),/TAKEOVER_INPUT_RATE_LIMITED/);
 assert.equal(f.events.length,0);
});
test('a lease or page change between events stops the rest of the batch',async()=>{
 for(const change of ['navigate','lease']){
  const f=fixture();let live=true;f.page.mouse.move=async(x,y)=>{f.events.push(['move',x,y]);change==='navigate'?f.navigate():live=false;};
  const q=admit(f.context,f.page,batch([{type:'wheel',x:2,y:3,deltaX:0,deltaY:120},{type:'text',text:'never'}]));
  await assert.rejects(q.perform({assertLease(){if(!live)throw Error('STALE_LEASE');}}));q.dispose();
  assert.deepEqual(f.events,[['move',2,3]]);
 }
});
test('navigation including same-URL reload or page close during checks refuses native input',async()=>{
 for(const change of ['navigate','reload','close']){
  const f=fixture(),q=admit(f.context,f.page,batch([{type:'text',text:'Synthetic private value'}]));f[change]();
  await assert.rejects(q.perform(),/INPUT_REFUSED/);q.dispose();assert.equal(f.events.length,0);assert.equal(f.listeners(),0);
 }
});
test('native input preparation is consumed once and disposal removes its navigation witness',async()=>{
 const f=fixture(),q=admit(f.context,f.page,batch([{type:'key',action:'down',key:'Enter'}]));assert.equal(f.listeners(),1);
 await q.perform();await assert.rejects(q.perform(),/INPUT_REFUSED/);q.dispose();assert.equal(f.listeners(),0);assert.equal(f.events.length,1);
 const closed=admit(f.context,f.page,batch([{type:'key',action:'up',key:'Enter'}]));closed.dispose();await assert.rejects(closed.perform(),/INPUT_REFUSED/);assert.equal(f.events.length,1);
});
