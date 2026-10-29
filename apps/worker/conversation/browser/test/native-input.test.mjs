import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeBrowserInput} from '../session/native-input.mjs';
function fixture(){
 let url='https://records.example/page',closed=false;const events=[],frame={};
 const page={url:()=>url,isClosed:()=>closed,mainFrame:()=>frame,viewportSize:()=>({width:800,height:600}),
  keyboard:{insertText:async text=>events.push(['text',text]),press:async key=>events.push(['key',key])},
  mouse:{click:async(x,y)=>events.push(['click',x,y])}};
 return {page,context:{pages:()=>[page]},events,navigate:()=>{url+='/next';},close:()=>{closed=true;}};
}
test('closed native input admits owned-page text, bounded clicks and explicit keys',async()=>{
 const f=fixture();
 for(const input of [{kind:'text',text:'Synthetic text'},{kind:'click',x:2,y:3},{kind:'key',key:'Shift+Tab'}]){
  const q=prepareNativeBrowserInput(f.context,f.page,input);assert.equal(q.text,input.text??null);await q.perform();
 }
 assert.deepEqual(f.events,[['text','Synthetic text'],['click',2,3],['key','Shift+Tab']]);
});
test('input refuses foreign pages, callbacks, clipboard shortcuts and oversized or hidden fields',()=>{
 const f=fixture();
 assert.throws(()=>prepareNativeBrowserInput(f.context,{...f.page},{kind:'key',key:'Enter'}));
 for(const action of [{kind:'text',text:'x'.repeat(65537)},{kind:'text',text:'x',perform:()=>{}},{kind:'key',key:'Control+v'},
  {kind:'key',key:'Control+r'},{kind:'click',x:800,y:2},{kind:'click',x:2,y:-1},{kind:'evaluate',code:'arbitrary'}]){
  assert.throws(()=>prepareNativeBrowserInput(f.context,f.page,action));
 }assert.equal(f.events.length,0);
});
test('navigation or page close during authority checks refuses before native input',async()=>{
 for(const change of ['navigate','close']){
  const f=fixture(),q=prepareNativeBrowserInput(f.context,f.page,{kind:'text',text:'Synthetic private value'});f[change]();
  await assert.rejects(q.perform(),/INPUT_REFUSED/);assert.equal(f.events.length,0);
 }
});
