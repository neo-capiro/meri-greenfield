/** Bounded private transport for the pinned public Playwright CDP API. The
 * native launcher owns these streams; they are never an SDK or viewer route. */
import {Readable,Writable} from 'node:stream';
export const CONTEXT_FRAME_BYTES=16*1024*1024;
const fail=()=>{throw Error('HOST_BROWSER_TRANSPORT_REFUSED');};
export function createContextTransport({readable,writable,stop}){
 if(!(readable instanceof Readable)||!(writable instanceof Writable)||typeof stop!=='function')fail();
 const ready=Promise.withResolvers();ready.promise.catch(()=>{});
 let opened=false,closed=false,buffer=Buffer.alloc(0),receivedReady=false;
 const close=()=>{
  if(closed)return;closed=true;buffer=Buffer.alloc(0);ready.reject(Error('HOST_BROWSER_TRANSPORT_REFUSED'));
  readable.off('data',data);readable.off('end',close);readable.off('close',close);
  // Keep the inert error listeners through native stream destruction: an EPIPE
  // already queued by the kernel must not escape after teardown has begun.
  readable.destroy();writable.destroy();
  try{transport.onclose?.('HOST_BROWSER_TRANSPORT_CLOSED');}catch{}
  void Promise.resolve().then(stop).catch(()=>{});
 };
 function data(chunk){
  try{
   if(closed||!Buffer.isBuffer(chunk))fail();
   // The retained partial frame and each complete frame are bounded separately.
   let start=0;
   for(let end;(end=chunk.indexOf(10,start))!==-1;start=end+1){
    if(buffer.length+end-start>CONTEXT_FRAME_BYTES)fail();
    const frame=JSON.parse(Buffer.concat([buffer,chunk.subarray(start,end)]).toString('utf8'));buffer=Buffer.alloc(0);
    if(!frame||typeof frame!=='object'||Array.isArray(frame))fail();
    if(!receivedReady){if(Object.keys(frame).join(',')!=='bridgeReady'||frame.bridgeReady!==true)fail();receivedReady=true;ready.resolve();}
    else {if(!opened||typeof transport.onmessage!=='function')fail();transport.onmessage(frame);}
   }
   if(buffer.length+chunk.length-start>CONTEXT_FRAME_BYTES)fail();buffer=Buffer.concat([buffer,chunk.subarray(start)]);
  }catch{close();}
 }
 const transport={send(message){
  if(closed||!opened||!message||typeof message!=='object'||Array.isArray(message))fail();
  const frame=Buffer.from(JSON.stringify(message)+'\n');
  if(frame.length>CONTEXT_FRAME_BYTES||writable.writableLength+frame.length>CONTEXT_FRAME_BYTES*2){close();fail();}
  try{writable.write(frame);}catch{close();fail();}
 },close};
 readable.on('data',data);readable.on('end',close);readable.on('close',close);readable.on('error',close);writable.on('error',close);
 return Object.freeze({transport,ready:ready.promise,open(){if(closed||opened||!receivedReady)fail();opened=true;},close});
}
