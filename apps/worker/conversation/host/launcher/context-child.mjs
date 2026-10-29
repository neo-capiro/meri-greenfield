/** Executed only after the native browser cgroup/namespace/workspace/UID gate.
 * A loopback DevTools connection stays inside that browser namespace. */
import {createRequire} from 'node:module';
import {open,constants} from 'node:fs/promises';
import {join,posix} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CONTEXT_FRAME_BYTES} from './context-transport.mjs';
export const PINNED_PLAYWRIGHT_VERSION='1.64.0-alpha-1790635538000';
const fail=()=>{throw Error('HOST_BROWSER_CONTEXT_REFUSED');};
export function pinnedChromium(cliPath){
 if(typeof cliPath!=='string'||!posix.isAbsolute(cliPath)||posix.normalize(cliPath)!==cliPath)fail();
 const require=createRequire(cliPath);
 if(require('./package.json').version!=='0.0.83'||require('playwright-core/package.json').version!==PINNED_PLAYWRIGHT_VERSION)fail();
 return require('playwright-core').chromium;
}
export async function runContextChild([cliPath,profile,proxy,action,navigation]){
 if(process.platform!=='linux'||process.getuid()===0||process.getuid()!==process.geteuid()||
  ![profile,cliPath].every(p=>typeof p==='string'&&posix.isAbsolute(p)&&posix.normalize(p)===p)||
  profile!==join(posix.dirname(process.env.HOME??''),'profile'))fail();
 const url=new URL(proxy),actionMs=Number(action),navigationMs=Number(navigation);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.origin!==proxy||
  !Number.isSafeInteger(actionMs)||actionMs<1||actionMs>60000||!Number.isSafeInteger(navigationMs)||navigationMs<1||navigationMs>120000)fail();
 const chromium=pinnedChromium(cliPath);let context,socket,closing,buffer=Buffer.alloc(0);
 const close=()=>closing??=(async()=>{clearTimeout(timer);process.stdin.pause();socket?.close();await context?.close();})();
 const timer=setTimeout(()=>{process.exitCode=111;void close();},30000);
 const stop=()=>{void close().catch(()=>{process.exitCode=111;});};
 process.stdin.on('end',stop);process.stdin.on('error',stop);process.stdout.on('error',stop);
 try{
  context=await chromium.launchPersistentContext(profile,{headless:true,chromiumSandbox:true,serviceWorkers:'block',
   proxy:{server:proxy},downloadsPath:join(posix.dirname(profile),'output'),viewport:{width:1280,height:720},
   timeout:25000,args:['--remote-debugging-port=0','--remote-debugging-address=127.0.0.1']});
  if(closing){await context.close();fail();}
  context.setDefaultTimeout(actionMs);context.setDefaultNavigationTimeout(navigationMs);
  const file=await open(join(profile,'DevToolsActivePort'),constants.O_RDONLY|constants.O_NOFOLLOW);
  let text;try{const stat=await file.stat();if(!stat.isFile()||stat.size>512)fail();text=await file.readFile('utf8');}finally{await file.close();}
  const match=/^([1-9][0-9]{0,4})\n(\/devtools\/browser\/[a-f0-9-]{36})\n?$/u.exec(text);
  if(!match||Number(match[1])>65535)fail();
  socket=new WebSocket(`ws://127.0.0.1:${match[1]}${match[2]}`);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});socket.addEventListener('close',reject,{once:true});});
  if(closing)fail();
  socket.addEventListener('message',event=>{
   try{const text=event.data;if(typeof text!=='string'||Buffer.byteLength(text)>CONTEXT_FRAME_BYTES||process.stdout.writableLength>CONTEXT_FRAME_BYTES*2)fail();
    process.stdout.write(text+'\n');}catch{process.exitCode=111;stop();}
  });
  socket.addEventListener('close',stop);socket.addEventListener('error',stop);
  process.stdin.on('data',chunk=>{
   try{let start=0;
    for(let end;(end=chunk.indexOf(10,start))!==-1;start=end+1){
     if(buffer.length+end-start>CONTEXT_FRAME_BYTES||socket.bufferedAmount>CONTEXT_FRAME_BYTES*2)fail();
     const text=Buffer.concat([buffer,chunk.subarray(start,end)]).toString('utf8');buffer=Buffer.alloc(0);
     const message=JSON.parse(text);if(!message||typeof message!=='object'||Array.isArray(message))fail();socket.send(text);
    }
    if(buffer.length+chunk.length-start>CONTEXT_FRAME_BYTES)fail();buffer=Buffer.concat([buffer,chunk.subarray(start)]);
   }catch{process.exitCode=111;stop();}
  });
  clearTimeout(timer);process.stdout.write('{"bridgeReady":true}\n');
 }catch{process.exitCode=111;await close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==7)fail();await runContextChild(process.argv.slice(2));}catch{process.exitCode=111;}
}
