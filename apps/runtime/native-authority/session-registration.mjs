/** Trusted supervisor stdout -> existing registration.read. Never install as worker authority. */
import {ChildProcess} from 'node:child_process';
import {Transform,Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {isAbsolute,join,normalize} from 'node:path';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertSdkSessionKey} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

const fault=code=>Object.assign(Error('NATIVE_SESSION_'+code),{code:'NATIVE_SESSION_'+code});
const path=value=>typeof value==='string'&&isAbsolute(value)&&normalize(value)===value&&value!=='/'&&!value.endsWith('/');

/** Only a trusted launcher supplies this original lease/process/configuration.
 * The returned read port may cross into control; stdout/lifecycle stay with the
 * supervisor. The caller forwards stdout to the worker and owns physical stop.
 * This observer neither launches/kills a child nor authenticates task admission. */
export function createNativeSessionRegistration(configuration){
 const c=own(configuration,['binding','child','workspace','configDirectory','versions','expiresAtMs'],['enabled','now','signal','limits']);
 const binding=data(c.binding);validateShape('RunBinding',binding);
 const versions=data(own(c.versions,['sdk','cli'])),enabled=c.enabled??false,now=c.now??Date.now;
 nativeSignal(c.signal);
 const l=own(c.limits??{},[],['maxFrameBytes','maxTotalBytes','maxWaiters','maxRequestMs']);
 const limits={maxFrameBytes:l.maxFrameBytes??9437184,maxTotalBytes:l.maxTotalBytes??67108864,maxWaiters:l.maxWaiters??16,maxRequestMs:l.maxRequestMs??3000};
 const caps={maxFrameBytes:9437184,maxTotalBytes:67108864,maxWaiters:32,maxRequestMs:30000};
 if(typeof enabled!=='boolean'||typeof now!=='function'||!path(c.workspace)||!path(c.configDirectory)||versions.sdk!=='0.3.295'||versions.cli!=='2.1.295'||Object.keys(limits).some(k=>!Number.isSafeInteger(limits[k])||limits[k]<1||limits[k]>caps[k]))throw fault('CONFIGURATION');
 let at=now();if(!Number.isSafeInteger(at)||at<1||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=at)throw fault('CONFIGURATION');
 const projectKey=c.workspace.replace(/[^a-zA-Z0-9]/gu,'-');
 if(projectKey.length>256)throw fault('CONFIGURATION');
 const child=c.child;
 if(!child||types.isProxy(child)||!(child instanceof ChildProcess)||!Number.isSafeInteger(child.pid)||child.pid<1||child.exitCode!==null||child.signalCode!==null)throw fault('PROCESS_REQUIRED');
 const source=child.stdout;
 if(!source||types.isProxy(source)||!(source instanceof Readable)||source.destroyed||source.readableEnded||source.readableFlowing!==null||source.listenerCount('data')!==0)throw fault('UNCONSUMED_STDOUT_REQUIRED');
 let closed=false,refusal,bytes=0,pending=Buffer.alloc(0),init,main,observation,started=false;
 const waiters=new Set();
 const notify=()=>{for(const resolve of waiters)resolve();};
 const refuse=code=>{refusal??=fault(code);init=main=undefined;notify();};
 const tick=()=>{const current=now();if(!Number.isSafeInteger(current)||current<at){refuse('CLOCK');throw refusal;}at=current;return current;};
 const check=()=>{
  if(closed||!enabled)throw fault('UNAVAILABLE');
  if(refusal)throw refusal;
  if(c.signal?.aborted){refuse('STOPPED');throw refusal;}
  if(child.exitCode!==null||child.signalCode!==null){refuse('EXITED');throw refusal;}
  if(tick()>=c.expiresAtMs){refuse('EXPIRED');throw refusal;}
 };
 function correlate(){
  if(observation||!init||!main)return;
  if(init.sessionId!==main.key.sessionId)throw fault('CONFLICT');
  const digest=createHash('sha256').update('native-init\n').update(init.bytes).update('\nnative-main-mirror\n').update(main.bytes).digest('hex');
  observation=data({binding,key:main.key,sdkVersion:versions.sdk,cliVersion:versions.cli,
   observationId:canonicalSha256({binding,pid:child.pid,startedAtMs:at,sessionEventSha256:digest}),sessionEventSha256:digest,expiresAtMs:c.expiresAtMs});
  init=main=undefined;notify();
 }
 function frame(raw){
  if(raw.length===0)return;
  let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{throw fault('FRAME');}
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.type!=='string')throw fault('FRAME');
  if(value.type==='system'&&value.subtype==='init'){
   const key=assertSdkSessionKey({projectKey,sessionId:value.session_id},{main:true});
   if(init||observation||value.claude_code_version!==versions.cli)throw fault('CONFLICT');
   init={sessionId:key.sessionId,bytes:Buffer.from(raw)};correlate();
  }else if(value.type==='transcript_mirror'){
   if(typeof value.filePath!=='string'||!Array.isArray(value.entries))throw fault('FRAME');
   const root=join(c.configDirectory,'projects',projectKey)+'/',name=value.filePath;
   if(!name.startsWith(root)||normalize(name)!==name)throw fault('CONFLICT');
   const suffix=name.slice(root.length);
   // Subagent paths cannot establish the main key. Once established they must
   // remain under that same native session; ordinary repeated main batches pass.
   if(suffix.includes('/')){
    const session=observation?.key.sessionId??init?.sessionId??main?.key.sessionId;
    if(!session||!suffix.startsWith(session+'/'))throw fault('CONFLICT');
    return;
   }
   if(!suffix.endsWith('.jsonl'))throw fault('CONFLICT');
   const key=assertSdkSessionKey({projectKey,sessionId:suffix.slice(0,-6)},{main:true});
   if(observation){if(canonicalSha256(key)!==canonicalSha256(observation.key))throw fault('CONFLICT');return;}
   if(main){if(canonicalSha256(key)!==canonicalSha256(main.key))throw fault('CONFLICT');return;}
   main={key,bytes:Buffer.from(raw)};correlate();
  }
 }
 const tap=new Transform({transform(chunk,_encoding,callback){
  try{
   check();bytes+=chunk.length;if(bytes>limits.maxTotalBytes)throw fault('LIMIT');
   let offset=0;
   while(offset<chunk.length){const newline=chunk.indexOf(10,offset),end=newline<0?chunk.length:newline;
    if(pending.length+end-offset>limits.maxFrameBytes)throw fault('LIMIT');
    pending=Buffer.concat([pending,chunk.subarray(offset,end)]);
    if(newline<0)break;
    frame(pending);pending=Buffer.alloc(0);offset=end+1;
   }
   callback(null,chunk);
  }catch{refuse('STREAM_REFUSED');callback(fault('STREAM_REFUSED'));}
 },flush(callback){if(pending.length)refuse('TRUNCATED');refuse('ENDED');pending=Buffer.alloc(0);callback();}});
 // Preserve lazy native backpressure: the owner supplies this stream to its
 // downstream transport before reading. Never race a second source reader.
 const read=tap._read;
 tap._read=function(size){if(enabled&&!started&&!closed){started=true;source.pipe(tap);}return read.call(this,size);};
 const onError=()=>{refuse('STREAM_REFUSED');tap.destroy(fault('STREAM_REFUSED'));};
 const onExit=()=>refuse('EXITED'),onClose=()=>refuse('EXITED'),onEnd=()=>refuse('ENDED'),onAbort=()=>refuse('STOPPED');
 tap.on('error',()=>{});
 tap.once('close',()=>{source.unpipe(tap);refuse('STREAM_CLOSED');});
 if(enabled){source.on('error',onError);source.once('close',onClose);source.once('end',onEnd);child.once('exit',onExit);child.once('error',onError);c.signal?.addEventListener('abort',onAbort,{once:true});}
 async function readObservation(value){
  const input=own(value,['binding','key'],['signal','deadlineMs']);nativeSignal(input.signal);
  if(input.deadlineMs!==undefined&&!Number.isSafeInteger(input.deadlineMs))throw fault('REFUSED');
  check();const requested=data(input.binding);validateShape('RunBinding',requested);
  const key=assertSdkSessionKey(input.key,{main:true});
  if(canonicalSha256(requested)!==canonicalSha256(binding)||key.projectKey!==projectKey)throw fault('REFUSED');
  const startedAt=tick(),deadlineMs=Math.min(input.deadlineMs??startedAt+limits.maxRequestMs,startedAt+limits.maxRequestMs,c.expiresAtMs);
  const life=createOperationLifetime({now:tick,deadlineMs,signal:input.signal,errorFactory:code=>fault(code)});
  let wake;
  try{
   if(!observation){
    if(waiters.size>=limits.maxWaiters)throw fault('LIMIT');
    const ready=new Promise(resolve=>{wake=resolve;waiters.add(resolve);});
    // Recheck after enrollment; native observations/refusal may already exist.
    if(observation||refusal||closed)wake();
    await life.run(()=>ready);
   }
   check();life.check();
   if(!observation||canonicalSha256(key)!==canonicalSha256(observation.key))throw fault('REFUSED');
   return data({...observation,checkedAtMs:tick()});
  }finally{if(wake)waiters.delete(wake);life.close();}
 }
 function close(){
  if(closed)return;closed=true;notify();pending=Buffer.alloc(0);init=main=undefined;
  source.unpipe(tap);source.removeListener('error',onError);source.removeListener('close',onClose);source.removeListener('end',onEnd);
  child.removeListener('exit',onExit);child.removeListener('error',onError);c.signal?.removeEventListener('abort',onAbort);
  tap.destroy();
 }
 return Object.freeze({registration:Object.freeze({read:readObservation}),stdout:tap,close,
  status:()=>Object.freeze({closed,refused:refusal!==undefined,ready:observation!==undefined&&!closed&&!refusal,pendingReads:waiters.size,bytes,physicalStopProven:false})});
}
