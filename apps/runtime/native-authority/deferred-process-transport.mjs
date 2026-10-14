/** Bounded byte streams held until the original admitted process is attached once. */
import {PassThrough,Transform,Readable} from 'node:stream';
import {executionFault} from './execution-broker.mjs';
export function createDeferredProcessTransport({maxBytes,onError}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||typeof onError!=='function')throw executionFault('TASK_CONFIGURATION');
 let attached=false,closed=false,bytes=0;
 function admit(chunk,encoding,callback){if(closed){if(callback)process.nextTick(callback,executionFault('TASK_STOPPED'));return false;}if(attached||chunk===undefined||chunk===null||typeof chunk==='function')return true;
  const size=typeof chunk==='string'?Buffer.byteLength(chunk,encoding):chunk.byteLength;
  if(!Number.isSafeInteger(size)||size<0||size>maxBytes-bytes){const error=executionFault('TASK_INPUT_LIMIT');if(callback)process.nextTick(callback,error);stdin.destroy(error);return false;}bytes+=size;return true;}
 class Input extends Transform{
  constructor(){super({highWaterMark:Math.min(maxBytes,65536)});}
  _transform(chunk,encoding,done){done(null,chunk);}
  write(chunk,encoding,callback){if(typeof encoding==='function'){callback=encoding;encoding=undefined;}if(!admit(chunk,encoding,callback))return false;return super.write(chunk,encoding,callback);}
  end(chunk,encoding,callback){if(typeof chunk==='function'){callback=chunk;chunk=undefined;encoding=undefined;}else if(typeof encoding==='function'){callback=encoding;encoding=undefined;}if(!admit(chunk,encoding,callback))return this;return super.end(chunk,encoding,callback);}
 }
 const stdin=new Input(),output=new PassThrough({highWaterMark:65536}),stdout=Readable.from(output,{objectMode:false});
 stdin.on('error',onError);output.on('error',onError);stdout.on('error',onError);
 function close(){if(closed)return;closed=true;stdin.destroy();output.destroy();stdout.destroy();}
 function attach(value){if(attached||closed||stdin.destroyed)throw executionFault('TASK_REFUSED');attached=true;stdin.pipe(value.stdin);value.stdout.pipe(output);value.stdin.on('error',onError);value.stdout.on('error',onError);}
 return Object.freeze({stdin,stdout,attach,close});
}
