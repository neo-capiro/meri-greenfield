/** Process-local attribution only. No identifiers confer authority and no counters are persisted.
 * Provisional contexts collect pre-binding work and transfer ownership once the canonical run is known.
 * Per-request owner buckets are separate from run buckets, so concurrent model requests cannot double-count.
 */
import {AsyncLocalStorage} from 'node:async_hooks';
import {createTurnLineEmitter,STAGES,CORE_ROUTES,STATUS_CLASSES,AWS_OPERATIONS,RUN_OWNER_OPERATIONS,safeId,timeoutClass} from './turn-lines.mjs';
const ambient=new AsyncLocalStorage();
export const currentTurnTelemetry=()=>ambient.getStore()?.telemetry;
const empty=()=>({core:{},coreMs:0,clerkReadsEstimate:0,authorityFresh:0,authorityReuses:0,aws:{},awsMs:0,db:{statements:0,ms:0},runOwner:{},runOwnerMs:0});
const numeric=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:0;
const clone=value=>structuredClone(value);
const keyOf=binding=>binding&&safeId(binding.runId)!=='invalid'&&safeId(binding.attemptId)!=='invalid'?`${binding.runId}:${binding.attemptId}`:undefined;
const bindingOf=b=>({runId:b?.runId,attemptId:b?.attemptId,...(b?.conversationId?{conversationId:b.conversationId}:{})});
const add=(target,key,value)=>{target[key]=(target[key]??0)+numeric(value);};
function merge(target,source){
 for(const kind of ['core','aws','runOwner'])for(const [name,counts] of Object.entries(source[kind]))for(const [outcome,count] of Object.entries(counts)){
  target[kind][name]??={};add(target[kind][name],outcome,count);
 }
 for(const key of ['coreMs','clerkReadsEstimate','authorityFresh','authorityReuses','awsMs','runOwnerMs'])add(target,key,source[key]);
 add(target.db,'statements',source.db.statements);add(target.db,'ms',source.db.ms);
 return target;
}

export function createTurnTelemetry({service,environment='Preview',write,now=Date.now,maxTrackedRuns=10000,rollupMs=60000}={}){
 const emitter=createTurnLineEmitter({service,environment,write,now}),runs=new Map(),requests=new Map();
 const limit=Number.isSafeInteger(maxTrackedRuns)&&maxTrackedRuns>0?Math.min(maxTrackedRuns,10000):10000;
 let background=empty(),timer,closed=false,lastRollup=clock();
 function clock(){try{return numeric(now());}catch{emitter.drop();return Date.now();}}
 const safe=fn=>{try{return fn();}catch{emitter.drop();return undefined;}};
 const active=()=>ambient.getStore()?.telemetry===api?ambient.getStore():undefined;
 function bounded(map,key,record){if(map.size>=limit){const first=map.keys().next().value;const evicted=map.get(first);merge(background,evicted.counts);evicted.counts=empty();evicted.evicted=true;map.delete(first);}map.set(key,record);return record;}
 function runFor(binding){const key=keyOf(binding);if(!key)return undefined;
  let run=runs.get(key);if(!run)run=bounded(runs,key,{binding:bindingOf(binding),counts:empty(),stages:{},deltas:0,sequence:-1,terminal:false,pending:false,flushed:false,active:0});
  return run;
 }
 function requestFor(requestId,binding){if(safeId(requestId)==='invalid')return undefined;
  let request=requests.get(requestId);if(!request)request=bounded(requests,requestId,{binding:bindingOf(binding),requestId,counts:empty()});
  if(keyOf(binding))request.binding=bindingOf(binding);return request;
 }
 // Post-terminal polls/rechecks after the completed rollup remain visible as background work.
 function destination(){const record=active()?.record;return record?.flushed||record?.evicted?background:record?.counts??background;}
 function inContext(context,fn){
  context.record.active=(context.record.active??0)+1;
  return ambient.run(context,()=>{let result;try{result=fn();}catch(error){finalize(context);throw error;}
   if(result&&typeof result.then==='function')return result.then(value=>{finalize(context);return value;},error=>{finalize(context);throw error;});
   finalize(context);return result;
  });
 }
 function finalize(context){safe(()=>{
  context.record.active=Math.max(0,(context.record.active??1)-1);
  if(context.record?.provisional){merge(background,context.record.counts);context.record.counts=empty();}
  const run=runFor(context.record?.binding);if(run?.pending&&run.active===0)finish(run.binding);
 });}
 function bind(binding){return safe(()=>{
  const context=active();if(!context||!keyOf(binding))return;
  if(context.record?.requestId){context.record.binding=bindingOf(binding);return;}
  const target=runFor(binding);if(context.record!==target){if(context.record?.provisional)merge(target.counts,context.record.counts);
   context.record.active=Math.max(0,(context.record.active??1)-1);target.active++;context.record=target;}
 });}
 function stage(binding,name,atMs=clock()){return safe(()=>{
  if(!STAGES.includes(name))return;const run=runFor(binding??active()?.record?.binding);if(!run||Object.hasOwn(run.stages,name))return;
  run.stages[name]=numeric(atMs);emitter.emit('meri.turn.stage',{...run.binding,stage:name,atMs:run.stages[name]});
 });}
 function emitCounts(record,counts,requestId){
  emitter.emit('meri.turn.counters',{...record.binding,...counts,...(requestId?{requestId}:{})});
  emitStatus(counts,record.binding,'turn');
 }
 function emitStatus(counts,binding,attribution){
  for(const statusClass of STATUS_CLASSES){const count=Object.values(counts.core).reduce((sum,row)=>sum+(row[statusClass]??0),0);
   if(count>0)emitter.emit('meri.core.counters',{...binding,statusClass,count,attribution});}
 }
 function counters(binding,{reset=false,requestId,includeRun=false,release=false}={}){return safe(()=>{
  const run=runFor(binding??active()?.record?.binding),record=requestId?requests.get(requestId):run;
  if(!record)return;const counts=clone(record.counts);
  if(requestId&&includeRun&&run)merge(counts,run.counts);
  emitCounts(record,counts,requestId);
  if(reset){record.counts=empty();if(requestId&&includeRun&&run)run.counts=empty();}
  if(release&&requestId)requests.delete(requestId);
  return counts;
 });}
 function finish(binding){return safe(()=>{const run=runFor(binding);if(run?.pending&&!run.flushed&&run.active===0){run.pending=false;run.flushed=true;counters(binding,{reset:true});}});}
 function summary(event){return safe(()=>{
  const binding=event?.binding,run=runFor(binding);if(!run||run.terminal)return;
  const sequence=event.sequence;if(Number.isSafeInteger(sequence)&&sequence<=run.sequence)return;
  if(Number.isSafeInteger(sequence))run.sequence=sequence;
  if(event.type==='message.delta'){run.deltas++;stage(binding,'delta.first.durable');return;}
  if(event.type!=='run.status')return;
  const state=event.data?.state;if(['starting','running'].includes(state)){stage(binding,`run.${state}`);return;}
  if(!['completed','failed','cancelled'].includes(state))return;
  stage(binding,'run.terminal');run.terminal=true;run.pending=true;
  const t0=run.stages['send.admit.received']??null,first=run.stages['delta.first.durable']??null;
  const classification=state==='failed'?timeoutClass(event.data.reasonCode,...Object.values(run.counts.core).flatMap(row=>Object.keys(row).filter(k=>row[k]>0))):'none';
  emitter.emit('meri.turn.summary',{...run.binding,state,reasonCode:event.data.reasonCode??'none',t0Ms:t0,
   stages:run.stages,firstTextMs:t0===null||first===null?null:Math.max(0,first-t0),resultMs:t0===null?null:Math.max(0,run.stages['run.terminal']-t0),
   deltaPublications:run.deltas,timeoutClass:classification});
  if(active()?.record!==run)finish(binding);
 });}
 function rollup(){return safe(()=>{
  const at=clock(),counts=background;background=empty();const dropped=emitter.takeDropped();
  const emitted=emitter.emit('meri.process.rollup',{...counts,windowMs:Math.max(0,at-lastRollup),atMs:at,telemetryDropped:dropped});
  if(!emitted&&dropped>0)emitter.drop(dropped);
  emitStatus(counts,undefined,'background');lastRollup=at;
 });}
 const api=Object.freeze({
  service,now:clock,
  recordDropped:count=>emitter.drop(count),
  capture(fn){const context=active();return (...args)=>context?ambient.run(context,()=>fn(...args)):fn(...args);},
  within(binding,fn){const existing=active();if(existing&&keyOf(existing.record?.binding)===keyOf(binding)&&keyOf(binding))return fn();
   const record=safe(()=>runFor(binding))??{provisional:true,counts:empty()};return inContext({telemetry:api,record},fn);},
  withRequest(requestId,binding,fn){const existing=active();if(existing?.record?.requestId===requestId){bind(binding);return fn();}
   const record=safe(()=>requestFor(requestId,binding))??{provisional:true,counts:empty()};return inContext({telemetry:api,record},fn);},
  background(fn){return ambient.run(undefined,fn);},
  provisional(fn){if(active())return fn();return inContext({telemetry:api,record:{provisional:true,counts:empty()}},fn);},
  bind,stage,summary,counters,finish,
  recordCore(route,status,ms){safe(()=>{const c=destination(),r=CORE_ROUTES.includes(route)?route:'other',s=STATUS_CLASSES.includes(status)?status:'unanswered';
   c.core[r]??={};add(c.core[r],s,1);add(c,'coreMs',ms);add(c,'clerkReadsEstimate',({identity:1,context:2,membership:2,current:1,other:0})[r]);});},
  recordAuthority(kind){safe(()=>{if(kind==='fresh'||kind==='reuse')add(destination(),kind==='fresh'?'authorityFresh':'authorityReuses',1);});},
  recordAws(operation,outcome,ms){safe(()=>{const c=destination(),o=AWS_OPERATIONS.includes(operation)?operation:'other',s=['success','error','timeout','unanswered'].includes(outcome)?outcome:'other';
   c.aws[o]??={};add(c.aws[o],s,1);add(c,'awsMs',ms);});},
  recordDb(ms){safe(()=>{const c=destination();add(c.db,'statements',1);add(c.db,'ms',ms);});},
  recordRunOwner(operation,status,ms){safe(()=>{const c=destination(),o=RUN_OWNER_OPERATIONS.includes(operation)?operation:'other',s=STATUS_CLASSES.includes(status)?status:'unanswered';
   c.runOwner[o]??={};add(c.runOwner[o],s,1);add(c,'runOwnerMs',ms);});},
  emit:(event,fields)=>emitter.emit(event,fields),
  health:(component,transition,code)=>emitter.emit('meri.health',{component,transition,code}),
  budgetQuarantined:(binding,reason)=>emitter.emit('meri.budget.quarantined',{...bindingOf(binding??active()?.record?.binding),reason}),
  rollup,
  start(){if(!timer&&!closed){timer=setInterval(rollup,Number.isSafeInteger(rollupMs)&&rollupMs>0?rollupMs:60000);timer.unref?.();}return api;},
  close(){if(closed)return;closed=true;if(timer)clearInterval(timer);timer=undefined;rollup();},
  get telemetryDropped(){return emitter.dropped;},
 });
 return api;
}
