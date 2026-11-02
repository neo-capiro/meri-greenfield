/** Root-side owner of the separate egress proxy process (`proxy-child-entry.mjs`): spawns it under the dedicated proxy
 * uid/gid with an empty environment, lets the caller place its pid in the run cgroup leaf before anything listens, then
 * answers its admission questions with the real egress control. The returned handle has the shape the egress service
 * expects from `startEgressProxy` (`ports.http`, `close()`), plus the pid the nft guard readback pins. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {posix} from 'node:path';

const ENTRY=fileURLToPath(new URL('./proxy-child-entry.mjs',import.meta.url));
const fault=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw fault(code);};
const uid=n=>Number.isSafeInteger(n)&&n>=1000&&n<=65533;
const absolute=p=>typeof p==='string'&&posix.isAbsolute(p)&&posix.resolve(p)===p&&!p.includes('\0');
const bounded=(work,ms,code)=>{let timer;return Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(fault(code)),ms);})]).finally(()=>clearTimeout(timer));};
const message=(child,type,ms,code)=>bounded(()=>new Promise((resolve,reject)=>{
 const onMessage=m=>{if(m?.type===type){detach();resolve(m);}};
 const onExit=()=>{detach();reject(fault(code));};
 const detach=()=>{child.off('message',onMessage);child.off('exit',onExit);};
 child.on('message',onMessage);child.once('exit',onExit);
}),ms,code);

export async function startProxyProcess({control,onDecision=()=>{},nodePath,uid:runUid,gid:runGid,place,spawnNode=spawn,readyMs=5000,stopMs=5000,admitMs=5000}={}){
 if(typeof control?.admitProxyRequest!=='function'||typeof onDecision!=='function'||!absolute(nodePath)||!uid(runUid)||!uid(runGid)||
  typeof place!=='function'||typeof spawnNode!=='function'||![readyMs,stopMs,admitMs].every(ms=>Number.isSafeInteger(ms)&&ms>=100&&ms<=30000))fail('EGRESS_PROXY_CONFIGURATION');
 const child=spawnNode(nodePath,[ENTRY],{uid:runUid,gid:runGid,cwd:'/',env:{},stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});
 if(!child||!Number.isSafeInteger(child.pid)||child.pid<2||typeof child.send!=='function')fail('EGRESS_PROXY_UNAVAILABLE');
 const exited=new Promise(resolve=>child.once('exit',()=>resolve(true)));
 const send=m=>{try{child.send(m);return true;}catch{return false;}};
 let closing=null;
 const stop=async()=>{
  if(child.exitCode===null&&child.signalCode===null){try{child.kill('SIGKILL');}catch{}}
  try{await bounded(()=>exited,stopMs,'EGRESS_PROXY_CLEANUP_UNKNOWN');}catch{fail('EGRESS_PROXY_CLEANUP_UNKNOWN');}
 };
 child.on('message',m=>{
  if(m?.type==='admit'&&Number.isSafeInteger(m.id)&&m.request&&typeof m.request==='object'){
   const signal=AbortSignal.timeout(admitMs);
   Promise.resolve().then(()=>control.admitProxyRequest({method:String(m.request.method),target:String(m.request.target),headers:{...(m.request.headers??{})}},{signal}))
    .then(decision=>send({type:'decision',id:m.id,decision:decision?.ok===true?{ok:true,connect:{address:decision.connect?.address,port:decision.connect?.port}}:{ok:false,code:typeof decision?.code==='string'?decision.code:'EGRESS_REFUSED'}}),
     ()=>send({type:'decision',id:m.id,decision:{ok:false,code:'EGRESS_REFUSED'}}));
  }else if(m?.type==='record'&&m.decision&&typeof m.decision==='object'){try{onDecision(Object.freeze({...m.decision}));}catch{}}
 });
 try{
  // Placement happens while the child is still waiting for GO: no listener exists outside its cgroup leaf.
  try{await bounded(()=>place(child.pid),readyMs,'EGRESS_PROXY_PLACEMENT_UNKNOWN');}catch{fail('EGRESS_PROXY_PLACEMENT_UNKNOWN');}
  if(!send({type:'go'}))fail('EGRESS_PROXY_UNAVAILABLE');
  const ready=await message(child,'ready',readyMs,'EGRESS_PROXY_UNAVAILABLE');
  if(!Number.isSafeInteger(ready.port)||ready.port<1||ready.port>65535)fail('EGRESS_PROXY_UNAVAILABLE');
  return Object.freeze({pid:child.pid,ports:Object.freeze({http:ready.port}),
   close(){
    return closing??=(async()=>{
     if(child.exitCode===null&&child.signalCode===null&&send({type:'close'})){try{await message(child,'closed',stopMs,'EGRESS_PROXY_CLEANUP_UNKNOWN');}catch{}}
     await stop();return Object.freeze({closed:true});
    })();
   }});
 }catch(error){await stop().catch(()=>{});throw error;}
}
