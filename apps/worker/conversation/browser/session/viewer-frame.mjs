/** Native viewer pixels and their document witness. This is not authentication:
 * only the host's separate trusted viewer channel may receive these image bytes. */
import {randomBytes} from 'node:crypto';
export const MAX_VIEWER_PNG_BYTES=8*1024*1024;
const PNG=Buffer.from([137,80,78,71,13,10,26,10]);
const fail=()=>{throw Object.assign(Error('BROWSER_VIEWER_FRAME_REFUSED'),{code:'BROWSER_VIEWER_FRAME_REFUSED'});};
function viewport(page){
 const value=page.viewportSize();
 if(!value||!Number.isSafeInteger(value.width)||!Number.isSafeInteger(value.height)||
  value.width<1||value.height<1||value.width>4096||value.height>4096)fail();
 return {width:value.width,height:value.height};
}
export function createViewerFrameOwner(context){
 let selected=null,generation=0;
 function clear(){generation++;selected?.dispose();selected=null;}
 function assert({page,leaseEpoch,frameId}){
  if(typeof frameId!=='string'||!/^[A-Za-z0-9_-]{43}$/u.test(frameId)||!selected||selected.page!==page||selected.leaseEpoch!==leaseEpoch||selected.frameId!==frameId)fail();
  selected.check();
 }
 return Object.freeze({clear,assert,async capture({page,leaseEpoch,signal,timeoutMs,assertLease}){
  clear();const attempt=generation;
  if(!context.pages().includes(page)||page.isClosed()||!Number.isSafeInteger(leaseEpoch)||leaseEpoch<1)fail();
  const size=viewport(page),frame=page.mainFrame(),url=page.url();let invalid=false,disposed=false;
  const changed=next=>{if(next===frame)invalid=true;},closed=()=>{invalid=true;};
  page.on('framenavigated',changed);page.on('close',closed);
  const dispose=()=>{disposed=true;page.off('framenavigated',changed);page.off('close',closed);};
  const check=()=>{
   const current=viewport(page);
   if(disposed||invalid||attempt!==generation||!context.pages().includes(page)||page.isClosed()||
    page.mainFrame()!==frame||page.url()!==url||current.width!==size.width||current.height!==size.height)fail();
  };
  selected={page,leaseEpoch,frameId:null,check,dispose};
  try{
   signal.throwIfAborted();assertLease();check();
   const png=await page.screenshot({type:'png',fullPage:false,scale:'css',timeout:timeoutMs});
   signal.throwIfAborted();assertLease();check();
   // Check the native viewport result before encoding; never retain the pixels in
   // the document pin or send an unbounded image through the viewer transport.
   if(!Buffer.isBuffer(png)||png.length<33||png.length>MAX_VIEWER_PNG_BYTES||!png.subarray(0,8).equals(PNG)||
    png.toString('ascii',12,16)!=='IHDR'||png.readUInt32BE(16)!==size.width||png.readUInt32BE(20)!==size.height)fail();
   const frameId=randomBytes(32).toString('base64url');
   selected={page,leaseEpoch,frameId,check,dispose};
   return Object.freeze({frameId,leaseEpoch,...size,image:Object.freeze({mimeType:'image/png',data:png.toString('base64')})});
  }catch(error){if(attempt===generation)clear();else dispose();throw error;}
 }});
}
