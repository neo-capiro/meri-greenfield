/** Receiving transport for one original task. Durable admission stays borrowed. */
import {types} from 'node:util';
import {createHash} from 'node:crypto';import {isAbsolute,dirname} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';import {jsonBody} from '../../control/action-application/http.mjs';import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {compileNativeLaunch,matchNativeLaunch} from './launch-configuration.mjs';import {matchesCapability} from './task-verifier.mjs';
import {remoteOriginal,exactOriginal,descriptor,preparationAck,transportLimits,remoteFault,decodeBytes,digest} from './remote-task-boundary.mjs';
import {captureSdkConfiguration,installSdkConfiguration,verifySdkConfiguration} from './sdk-config-transfer.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),frame=b=>({bytes:b.length,sha256:sha(b),base64:b.toString('base64')}),get=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
export function createRemoteNativeTaskApplication(configuration){
 const c=own(configuration,['original','controlCapabilitySha256','taskCapabilitySha256'],['task','launchConfiguration','preparationAuthorizer','nativeFactory','descriptorPolicy','taskArn','capture','enabled','now','limits','configurationSha256','parkedWorkspace']);
 const original=remoteOriginal(c.original),now=c.now??Date.now,limits=transportLimits(c.limits),enabled=c.enabled??false;
 if(typeof now!=='function'||typeof enabled!=='boolean'||![c.controlCapabilitySha256,c.taskCapabilitySha256].every(digest)||c.controlCapabilitySha256===c.taskCapabilitySha256)throw remoteFault();
 if(c.nativeFactory&&(types.isProxy(c.nativeFactory)||types.isAsyncFunction(c.nativeFactory)))throw remoteFault();const legacy=c.task!==undefined;if(legacy!== (c.launchConfiguration!==undefined)||legacy&&(c.nativeFactory!==undefined||c.descriptorPolicy!==undefined)||!legacy&&(!c.preparationAuthorizer||typeof c.nativeFactory!=='function'))throw remoteFault();
 let task=c.task,p=legacy?compileNativeLaunch(c.launchConfiguration):undefined;if(p&&(hash(p.binding)!==hash(original.binding)||p.expiresAtMs!==original.expiresAtMs))throw remoteFault();
 const authorizer=c.preparationAuthorizer,prepareAuthority=authorizer&&storageMethod(authorizer,'prepare'),verifyAuthority=authorizer&&storageMethod(authorizer,'verify'),startAuthority=authorizer&&storageMethod(authorizer,'start'),startedAuthority=authorizer&&Object.hasOwn(authorizer,'started')?storageMethod(authorizer,'started'):undefined;
 const admittedAuthority=c.parkedWorkspace&&authorizer?storageMethod(authorizer,'admitted'):undefined;if(c.parkedWorkspace&&!admittedAuthority)throw remoteFault();
 const policy=!legacy?data(own(c.descriptorPolicy,['workspace','command','configParentDirectory','secureStorageDirectory'])):null;
 let state='pristine',pins,ack,processPort,configurationTree,ended=false,exitCode=null,signalCode=null,queued=0,outputSequence=0,inputSequence=0,lastInput,lastOutput;const output=[],waiters=new Set();
 const reply=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 const notify=()=>{for(const resolve of waiters)resolve();waiters.clear();};
 async function stop(){state='stopped';ended=true;notify();if(!task)return {original,receipt:{physicalStopProven:false,notAllocated:true}};await task.close();if(task.status().supervisorPid===null)return {original,receipt:{physicalStopProven:false,notAllocated:true}};return {original,receipt:await task.inspect(original)};}
 function configs(){return {configDirectory:p.configDirectory,secureStorageDirectory:p.secureStorageDirectory};}
 async function fresh(signal){if(signal?.aborted||now()>=original.expiresAtMs)throw remoteFault();if(verifyAuthority&&ack){ack=preparationAck(await verifyAuthority({...pins,preparationId:ack.preparationId,signal}),{...pins,taskArn:c.taskArn,now,previous:ack});}}
 async function prepare(request,signal){const d=descriptor(request.descriptor),descriptorSha256=hash(d);if(state!=='pristine'){if(!pins||pins.descriptorSha256!==descriptorSha256||state==='unknown'||state==='stopped')throw remoteFault();await fresh(signal);return {original,descriptorSha256,configTreeSha256:pins.configTreeSha256,...(ack?{ack}:{})};}
  state='preparing';try{
   if(legacy){matchNativeLaunch(d,p);configurationTree=captureSdkConfiguration(configs());if(c.configurationSha256&&configurationTree.sha256!==c.configurationSha256)throw remoteFault();pins={original,descriptorSha256,configTreeSha256:configurationTree.sha256};}
   else{
    if(d.cwd!==policy.workspace||d.command!==policy.command||!isAbsolute(d.env.CLAUDE_CONFIG_DIR)||dirname(d.env.CLAUDE_CONFIG_DIR)!==policy.configParentDirectory||d.env.CLAUDE_SECURESTORAGE_CONFIG_DIR!==policy.secureStorageDirectory)throw remoteFault();
    const tree=captureSdkConfiguration({configDirectory:d.env.CLAUDE_CONFIG_DIR,secureStorageDirectory:d.env.CLAUDE_SECURESTORAGE_CONFIG_DIR},{check:()=>{if(signal.aborted||now()>=original.expiresAtMs)throw remoteFault();}});configurationTree=tree;
    pins={original,descriptorSha256,configTreeSha256:tree.sha256};ack=preparationAck(await prepareAuthority({...pins,descriptor:d,signal}),{...pins,taskArn:c.taskArn,now});
    const made=c.nativeFactory({original,descriptor:d,ack});if(types.isPromise(made)){Promise.prototype.then.call(made,async late=>{try{const bound=own(late,['task','launchConfiguration']);await storageMethod(bound.task,'close')();}catch{}},()=>{}).catch(()=>{});throw remoteFault();}const bound=own(made,['task','launchConfiguration']);task=bound.task;p=compileNativeLaunch(bound.launchConfiguration);matchNativeLaunch(d,p);
    if(hash(p.binding)!==hash(original.binding)||p.expiresAtMs!==original.expiresAtMs)throw remoteFault();verifySdkConfiguration(tree,configs());
   }
   processPort=task.spawnClaudeCodeProcess(d);processPort.stdout.on('data',raw=>{const bytes=Buffer.from(raw);for(let at=0;at<bytes.length;at+=limits.maxFrameBytes){const part=bytes.subarray(at,at+limits.maxFrameBytes);queued+=part.length;if(queued>limits.maxBufferedBytes){state='unknown';void stop().catch(()=>{});return;}output.push(Buffer.from(part));}notify();});
   processPort.stdout.on('error',()=>{state='unknown';notify();void stop().catch(()=>{});});processPort.on('exit',(code,signal)=>{ended=true;exitCode=code;signalCode=signal;notify();});await fresh(signal);state='prepared';return {original,...pins,...(ack?{ack}:{})};
  }catch(error){state='unknown';try{await stop();}catch{}throw error;}
 }
 async function operation(name,request,signal){
  if(name==='stop')return stop();if(name==='retire'){if(!task)throw remoteFault();return {original,receipt:await task.retire({...original,signal})};}if(name==='readiness'){if(!task)throw remoteFault();await task.readiness({signal});return {original};}if(name==='launch'){if(!task||!['prepared','starting'].includes(state))throw remoteFault();await fresh(signal);return {original,receipt:await task.launch({...original,...(request.plan?{plan:request.plan}:{}),signal})};}if(name==='inspect'){if(!task)throw remoteFault();return {original,receipt:await task.inspect(original)};}
  await fresh(signal);
  if(name==='configuration'){if(!legacy||state!=='pristine'||!c.configurationSha256||request.tree.sha256!==c.configurationSha256)throw remoteFault();return {original,...installSdkConfiguration(request.tree,configs(),{check:()=>{if(signal.aborted||now()>=original.expiresAtMs)throw remoteFault();}})};}
  if(name==='prepare')return prepare(request,signal);
  if(name==='start'){
   if(state!=='prepared'||request.descriptorSha256!==pins.descriptorSha256)throw remoteFault();state='starting';try{
    if(startAuthority){const started=await startAuthority({...pins,preparationId:ack.preparationId,signal});const {dispatch,...receipt}=own(started,['original','descriptorSha256','configTreeSha256','preparationId','taskArn','checkedAtMs','expiresAtMs','dispatch']);ack=preparationAck(receipt,{...pins,taskArn:c.taskArn,now,previous:ack});if(dispatch!==true)throw remoteFault();}
    verifySdkConfiguration(configurationTree,configs());if(task.status().booted){await task.inspect({...original,signal});}else await task.launch({...original,signal});verifySdkConfiguration(configurationTree,configs());await task.startPreparedProcess();if(startedAuthority)ack=preparationAck(await startedAuthority({...pins,preparationId:ack.preparationId,signal}),{...pins,taskArn:c.taskArn,now,previous:ack});await fresh(signal);state='running';return {original,descriptorSha256:pins.descriptorSha256};
   }catch(error){state='unknown';try{await stop();}catch{}throw error;}
  }
  if(name==='stdin'){
   if(state!=='running'||!Number.isSafeInteger(request.sequence)||typeof request.end!=='boolean')throw remoteFault();const bytes=decodeBytes(request.frame,limits.maxFrameBytes);if(sha(bytes)!==request.frame.sha256)throw remoteFault();const identity=hash(request);
   if(request.sequence===inputSequence-1&&lastInput===identity)return {original,sequence:request.sequence};if(request.sequence!==inputSequence)throw remoteFault();inputSequence++;lastInput=identity;
   try{await new Promise((resolve,reject)=>{const callback=error=>error?reject(error):resolve();if(request.end)processPort.stdin.end(bytes,callback);else processPort.stdin.write(bytes,callback);});await fresh(signal);return {original,sequence:request.sequence};}catch(error){state='unknown';try{await stop();}catch{}throw error;}
  }
  if(name==='stdout'){
   if(!['running','stopped'].includes(state)||!Number.isSafeInteger(request.sequence))throw remoteFault();if(request.sequence===outputSequence-1&&lastOutput)return lastOutput;if(request.sequence!==outputSequence)throw remoteFault();
   if(!output.length&&!ended)await new Promise(resolve=>{waiters.add(resolve);const timer=setTimeout(()=>{waiters.delete(resolve);resolve();},100);timer.unref?.();});await fresh(signal);const bytes=output.shift()??Buffer.alloc(0);queued-=bytes.length;
   lastOutput={original,sequence:outputSequence++,frame:frame(bytes),end:ended&&!output.length,exitCode,signal:signalCode};return lastOutput;
  }
  if(name==='workspace-restore'||name==='workspace-verify'){if(c.parkedWorkspace){await admittedAuthority({original,signal});const receipt=await storageMethod(c.parkedWorkspace,name==='workspace-restore'?'restore':'verify')({...request.request,signal});await admittedAuthority({original,signal});return {original,receipt};}if(!task)throw remoteFault();return {original,receipt:await task.workspace[name==='workspace-restore'?'restore':'verify']({...request.request,signal})};}
  if(!task)throw remoteFault();
  if(name==='registration')return {original,receipt:await task.registration.read({...request.request,signal})};
  if(name==='capture'){if(!c.capture)throw remoteFault();return {original,capture:await storageMethod(c.capture,'capture')({...request.request,signal})};}
  throw remoteFault();
 }
 const fields={prepare:['descriptor'],start:['descriptorSha256'],stdin:['sequence','frame','end'],stdout:['sequence'],stop:[],inspect:[],retire:[],readiness:[],launch:['plan'],configuration:['tree'],registration:['request'],'workspace-restore':['request'],'workspace-verify':['request'],capture:['request']};
 const worker=new Set(['prepare','start','stdin','stdout','stop']);
 return Object.freeze({async handle(request){let life;try{
  const info=Object.fromEntries(Object.entries(get).map(([k,g])=>[k,g.call(request)])),url=new URL(info.url);if(!url.pathname.startsWith('/v1/native-task/'))return null;const name=url.pathname.slice('/v1/native-task/'.length);if(!Object.hasOwn(fields,name)||url.search||info.method!=='POST')throw remoteFault();if(!enabled)return reply({error:{code:'REMOTE_TASK_UNAVAILABLE'}},503);
  const header=k=>Headers.prototype.get.call(info.headers,k),auth=header('authorization');if(!auth?.startsWith('Bearer '))throw remoteFault();const token=auth.slice(7),control=matchesCapability(token,c.controlCapabilitySha256),taskRole=matchesCapability(token,c.taskCapabilitySha256);if(!control&&!(worker.has(name)&&taskRole)||worker.has(name)&&name!=='stop'&&!taskRole)throw remoteFault();
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding'))throw remoteFault();const length=header('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))throw remoteFault();
  life=createOperationLifetime({now,signal:info.signal,deadlineMs:Math.min(now()+limits.maxRequestMs,['stop','inspect','retire'].includes(name)?Infinity:original.expiresAtMs),errorFactory:remoteFault});
  const body=own(await jsonBody({body:info.body,length:length===null?null:Number(length)},name==='configuration'||name==='workspace-restore'?50331648:2097152,life,life.check),['original',...fields[name]]);exactOriginal(body.original,original);const {original:ignored,...input}=body;const result=await life.run(signal=>operation(name,input,signal));life.check();return reply(result);
 }catch{return reply({error:{code:'REMOTE_TASK_REFUSED'}},403);}finally{life?.close();}},close:stop,status:()=>({state,inputSequence,outputSequence,queuedBytes:queued})});
}
