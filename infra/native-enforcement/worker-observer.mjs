/** Fixed qualification observation; no launch, grant mutation, or network at construction. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {isCompiledBinding,canonical} from './lib/binding.mjs';
import {buildPredicates} from './lib/expressions.mjs';
import {SDK_WIRE_PROFILE,sdkTaskFacts,sdkCreatedMs} from './lib/ecs-wire.mjs';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';

export const qualificationJsonataSha256='8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b';
const observers=new WeakSet(),observations=new WeakMap();
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const deny=()=>{throw Error('WORKER_OBSERVATION_REFUSED');};
function worker(value){
 const w=data(own(value,['qualificationBinding','probeKind','attemptStartMs','attemptEndMs']));
 const q=own(w.qualificationBinding,['runId','attempt','workerArn','fence','policyRevision']);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(q.runId)||!Number.isSafeInteger(q.attempt)||q.attempt<1||q.attempt>2147483647||!Number.isSafeInteger(q.fence)||q.fence<1||q.fence>2147483647||typeof q.workerArn!=='string'||!/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[0-9a-f]{32}$/.test(q.workerArn)||typeof q.policyRevision!=='string'||!/^[0-9a-f]{64}$/.test(q.policyRevision)||!['sdk','office'].includes(w.probeKind)||!Number.isSafeInteger(w.attemptStartMs)||!Number.isSafeInteger(w.attemptEndMs)||w.attemptStartMs<0||w.attemptEndMs<w.attemptStartMs)deny();
 return w;
}
export function assertQualificationWorkerObserver(value){if(!observers.has(value))deny();return value;}
export function consumeQualificationWorkerObservation(observer,value,expected,{now,signal}={}){
 assertQualificationWorkerObserver(observer);nativeSignal(signal);
 const record=observations.get(value);observations.delete(value);
 const at=typeof now==='function'?now():NaN;
 if(!record||record.observer!==observer||hash(worker(expected))!==record.identity||!Number.isSafeInteger(at)||at<record.startedAtMs||at>=record.expiresAtMs||signal?.aborted)deny();
 return record.receipt;
}
export function createQualificationWorkerObserver(configuration){
 const c=own(configuration,['compiledAdmission','jsonataRuntimePath','reads','now'],['maxRequestMs']);
 if(!isCompiledBinding(c.compiledAdmission)||c.compiledAdmission.pins?.wireProfile!==SDK_WIRE_PROFILE||typeof c.now!=='function'||typeof c.jsonataRuntimePath!=='string')deny();
 const p=c.compiledAdmission.pins,reads=own(c.reads,['describeTasks','describeNetworkInterfaces']),maximum=c.maxRequestMs??5000;
 if(Object.values(reads).some(x=>typeof x!=='function')||!Number.isSafeInteger(maximum)||maximum<1||maximum>30000)deny();
 // Fixed public runtime bytes are checked before evaluation. No expression is supplied by callers.
 const bytes=readFileSync(c.jsonataRuntimePath);if(createHash('sha256').update(bytes).digest('hex')!==qualificationJsonataSha256)deny();
 const runtimeModule={exports:{}};new Script(bytes.toString('utf8'),{filename:'pinned-jsonata-2.0.6.js'}).runInNewContext({module:runtimeModule,exports:runtimeModule.exports},{timeout:1000});
 const jsonata=runtimeModule.exports,pred=buildPredicates(p);
 const expressions=Object.fromEntries(Object.entries({coverage:pred.coverage,safeRaw:pred.safeRaw,ownership:pred.ownership,ready:pred.ready,mismatch:pred.mismatch,attachments:pred.attachmentsCompatible,eni:pred.eniGood,eniId:pred.eniIdExpr,task:sdkTaskFacts('$raw.Tasks[0]'),created:sdkCreatedMs(p.timestampEncoding)}).map(([key,source])=>[key,jsonata(source)]));
 const evidenceKind=c.compiledAdmission.runtimeEnabled?'native-read-observation':'synthetic-observation';
 const observer=Object.freeze({async observe(input,options){
  const w=worker(input),o=own(options,['deadlineMs'],['signal']);nativeSignal(o.signal);
  const startedAtMs=c.now();if(!Number.isSafeInteger(startedAtMs)||w.qualificationBinding.runId!==p.runUuid||w.attemptEndMs>startedAtMs||!Number.isSafeInteger(o.deadlineMs))deny();
  const cutoff=Math.min(o.deadlineMs,startedAtMs+maximum),life=createOperationLifetime({deadlineMs:cutoff,now:c.now,signal:o.signal,errorFactory:()=>Error('WORKER_OBSERVATION_REFUSED')});
  const check=()=>{life.check();if(life.signal.aborted)deny();};
  const evaluate=async(name,values)=>{check();const result=await life.run(()=>expressions[name].evaluate({},values));check();return result;};
  const snapshot=value=>{const v=data(value);if(Buffer.byteLength(JSON.stringify(v))>65536)deny();return v;};
  try{
   const ctx={run:{uuid:w.qualificationBinding.runId,probeKind:w.probeKind},currentArn:w.qualificationBinding.workerArn,attemptStart:w.attemptStartMs,attemptEnd:w.attemptEndMs,owned:[],overflow:[]};
   let raw=snapshot(await life.run(()=>reads.describeTasks(data({Cluster:p.clusterArn,Tasks:[ctx.currentArn],Include:['TAGS']}),{signal:life.signal,deadlineMs:cutoff})));check();
   const observedMs=c.now(),vars={raw,ctx,observedMs,states:{result:raw}};
   if(await evaluate('safeRaw',vars)!==true||await evaluate('coverage',vars)!==true)deny();
   ctx.current=snapshot(await evaluate('task',vars));vars.createdMs=await evaluate('created',vars);
   if(await evaluate('ownership',vars)!==true||await evaluate('ready',vars)!==true||await evaluate('mismatch',vars)!==false||await evaluate('attachments',vars)!==true||ctx.current.lastStatus!=='RUNNING'||ctx.current.desiredStatus!=='RUNNING'||ctx.current.worker?.lastStatus!=='RUNNING')deny();
   const eniId=await evaluate('eniId',vars);if(typeof eniId!=='string')deny();
   const taskSha256=hash(raw);
   raw=snapshot(await life.run(()=>reads.describeNetworkInterfaces(data({NetworkInterfaceIds:[eniId]}),{signal:life.signal,deadlineMs:cutoff})));check();
   if(await evaluate('eni',{raw,ctx})!==true)deny();
   const at=c.now();check();if(at<startedAtMs)deny();
   const receipt=data({evidenceKind,staticBindingId:c.compiledAdmission.staticBindingId,qualificationBinding:w.qualificationBinding,observedAtMs:at,expiresAtMs:Math.min(cutoff,startedAtMs+5000),taskSha256,eniSha256:hash(raw)});
   const result=Object.freeze({receipt});observations.set(result,{observer,identity:hash(w),startedAtMs,expiresAtMs:receipt.expiresAtMs,receipt});return result;
  }catch{deny();}finally{life.close();}
 }});observers.add(observer);return observer;
}
