import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createViewerFrameOwner,MAX_VIEWER_PNG_BYTES} from '../session/viewer-frame.mjs';
function fixture(){
 const lifecycle=new EventEmitter(),frame={};let size={width:800,height:600},closed=false;
 const page={url:()=> 'https://records.example/page',mainFrame:()=>frame,isClosed:()=>closed,viewportSize:()=>size,
  on:(...args)=>lifecycle.on(...args),off:(...args)=>lifecycle.off(...args),
  async screenshot(options){assert.deepEqual(options,{type:'png',fullPage:false,scale:'css',timeout:100});
   const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);
   png.writeUInt32BE(size.width,16);png.writeUInt32BE(size.height,20);return png;}};
 const context={pages:()=>[page]},owner=createViewerFrameOwner(context),controller=new AbortController();
 const capture=()=>owner.capture({page,leaseEpoch:1,signal:controller.signal,timeoutMs:100,assertLease(){}});
 return {owner,page,context,capture,controller,frame,lifecycle,resize:()=>{size={width:801,height:600};},
  reload:()=>lifecycle.emit('framenavigated',frame),close:()=>{closed=true;lifecycle.emit('close');},
  listeners:()=>lifecycle.listenerCount('framenavigated')+lifecycle.listenerCount('close')};
}
test('viewer frame pins exact owned page, lease and native viewport without exposing page metadata',async()=>{
 const f=fixture(),view=await f.capture();assert.deepEqual(Object.keys(view),['frameId','leaseEpoch','width','height','image']);
 assert.equal(view.image.mimeType,'image/png');assert.match(view.frameId,/^[A-Za-z0-9_-]{43}$/u);
 const selected={page:f.page,leaseEpoch:1,frameId:view.frameId};f.owner.assert(selected);
 for(const invalid of [{...selected,page:{...f.page}},{...selected,leaseEpoch:2},{...selected,frameId:undefined},{...selected,frameId:'x'.repeat(43)}])assert.throws(()=>f.owner.assert(invalid),/FRAME_REFUSED/);
 f.owner.clear();assert.throws(()=>f.owner.assert(selected),/FRAME_REFUSED/);assert.equal(f.listeners(),0);
});
test('same-URL reload, viewport change and close invalidate an already displayed frame',async()=>{
 for(const change of ['reload','resize','close']){
  const f=fixture(),view=await f.capture();f[change]();
  assert.throws(()=>f.owner.assert({page:f.page,leaseEpoch:1,frameId:view.frameId}),/FRAME_REFUSED/);
  f.owner.clear();assert.equal(f.listeners(),0);
 }
});
test('a replacement capture invalidates the prior frame even when capture fails',async()=>{
 const f=fixture(),view=await f.capture();f.page.screenshot=async()=>{throw Error('Synthetic image failure');};
 await assert.rejects(f.capture());assert.throws(()=>f.owner.assert({page:f.page,leaseEpoch:1,frameId:view.frameId}),/FRAME_REFUSED/);
 assert.equal(f.listeners(),0);
});
test('navigation while pixels are captured refuses them and removes all witnesses',async()=>{
 const f=fixture(),capture=f.page.screenshot;f.page.screenshot=async options=>{const png=await capture(options);f.reload();return png;};
 await assert.rejects(f.capture(),/FRAME_REFUSED/);assert.equal(f.listeners(),0);
});
test('clearing a pending native capture cannot install a late frame or erase its successor',async()=>{
 const f=fixture(),native=f.page.screenshot,wait=Promise.withResolvers();
 f.page.screenshot=()=>wait.promise;const first=f.capture(),rejected=assert.rejects(first,/FRAME_REFUSED/);
 assert.equal(f.listeners(),2);f.owner.clear();assert.equal(f.listeners(),0);
 f.page.screenshot=native;const second=await f.capture();wait.resolve(await native({type:'png',fullPage:false,scale:'css',timeout:100}));await rejected;
 f.owner.assert({page:f.page,leaseEpoch:1,frameId:second.frameId});f.owner.clear();assert.equal(f.listeners(),0);
});
test('aborted, malformed, oversized and mismatched native images never become displayed frames',async()=>{
 for(const kind of ['abort','malformed','oversized','dimensions']){
  const f=fixture(),native=f.page.screenshot;
  f.page.screenshot=async options=>{const png=await native(options);
   if(kind==='abort')f.controller.abort();if(kind==='malformed')return Buffer.alloc(33);
   if(kind==='oversized')return Buffer.alloc(MAX_VIEWER_PNG_BYTES+1);if(kind==='dimensions')png.writeUInt32BE(1,16);return png;};
  await assert.rejects(f.capture());assert.equal(f.listeners(),0);
 }
});
