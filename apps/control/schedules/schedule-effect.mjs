/** The complete provider-normalized effect of an approved create/update schedule intent, and the same normal form read back from a
 * Temporal SDK 1.24 ScheduleHandle.describe() result. Reconciliation may acknowledge an uncertain intent only when the two are equal.
 *
 * The approved side is derived from the exact SDK options the mutation adapter sends (scheduleSdkOptions), so every field the intent
 * asks Temporal to apply is covered: schedule ID; spec (calendars, intervals, skip, start/end, jitter, time zone); the start-workflow
 * action (type, workflow type/ID, task queue, the one argument, run/execution/task timeouts, retry policy, and the action memo,
 * search attributes, static summary/details and priority it leaves unset); policies (overlap, catch-up window, pause on failure);
 * and state (paused, note, remaining actions). An options key this module does not know makes the intent non-comparable.
 *
 * Both sides are reduced to the form the SDK decodes from the wire, plus Temporal's documented equivalences for unset values (an
 * unset interval offset, jitter or timeout is zero/none, an unset time zone is UTC, an unset retry field takes its server default).
 * What describe cannot return faithfully is never assumed: cron expressions (the server compiles them into structured calendars)
 * and a create's trigger-immediately request are NOT_COMPARABLE, and the caller keeps the barrier. Schedule-level memo, search
 * attributes and run information are not part of the approved request and are not read. */
import {types} from 'node:util';
import {canonicalSha256,frozenScheduleData,denySchedule} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {scheduleSdkOptions} from './temporal-schedule-mutations.mjs';

const MONTHS=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const DAYS=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const OVERLAP=['SKIP','BUFFER_ONE','BUFFER_ALL','CANCEL_OTHER','TERMINATE_OTHER','ALLOW_ALL'];
const between=(lo,hi)=>v=>Number.isSafeInteger(v)&&v>=lo&&v<=hi?v:undefined,named=list=>v=>list.includes(v)?list.indexOf(v):undefined;
// SDK 1.24 calendar coders: the value domain (as an ordering index) and what '*' encodes to and decodes back as.
const CALENDAR={
 second:{index:between(0,59),all:[{start:0,end:59,step:1}]},minute:{index:between(0,59),all:[{start:0,end:59,step:1}]},
 hour:{index:between(0,23),all:[{start:0,end:23,step:1}]},dayOfMonth:{index:between(0,31),all:[{start:1,end:31,step:1}]},
 month:{index:named(MONTHS),all:[{start:'JANUARY',end:'DECEMBER',step:1}]},year:{index:between(0,Number.MAX_SAFE_INTEGER),all:[]},
 dayOfWeek:{index:named(DAYS),all:[{start:'SUNDAY',end:'SATURDAY',step:1}]},
};
const RETRY_DEFAULTS={initialInterval:1000,backoffCoefficient:2,maximumIntervalFactor:100};
const notComparable=()=>denySchedule('SCHEDULE_EFFECT_NOT_COMPARABLE');
const evidence=()=>denySchedule('SCHEDULE_RECONCILE_EVIDENCE');

// Read one own data property; getters, proxies and inherited values are never executed or trusted.
function own(value,name,optional=true) {
 if(!value||typeof value!=='object'||types.isProxy(value))evidence();
 const d=Object.getOwnPropertyDescriptor(value,name);
 if(!d){if(optional)return undefined;evidence();}
 if(!Object.hasOwn(d,'value'))evidence();return d.value;
}
function list(value) {
 if(!Array.isArray(value)||types.isProxy(value))evidence();
 return Array.from({length:value.length},(_,i)=>own(value,String(i),false));
}
function keysWithin(value,allowed) {
 if(!value||typeof value!=='object'||types.isProxy(value))notComparable();
 if(Reflect.ownKeys(value).some(k=>!allowed.includes(k)))notComparable();
}
const millis=v=>{if(v===undefined||v===null)return 0;if(!Number.isSafeInteger(v)||v<0)evidence();return v;};
const optionalMillis=v=>millis(v)||null;
function instant(v) {
 if(v===undefined||v===null)return null;
 if(!types.isDate(v)||types.isProxy(v))evidence();
 const ms=Date.prototype.getTime.call(v);if(!Number.isSafeInteger(ms))evidence();
 return Date.prototype.toISOString.call(v);
}
function text(v,fallback){if(v===undefined||v===null||v==='')return fallback;if(typeof v!=='string')evidence();return v;}

// The SDK decodes end <= start as start and a non-positive step as 1; apply the same to both sides.
function range(field,r) {
 const c=CALENDAR[field],start=own(r,'start',false),end=own(r,'end',false),step=own(r,'step',false);
 const s=c.index(start),e=c.index(end);
 if(s===undefined||e===undefined||!Number.isSafeInteger(step))evidence();
 return {start,end:e>s?end:start,step:step>0?step:1};
}
function calendar(value,approved) {
 const out={};
 for(const field of Object.keys(CALENDAR)) {
  const v=own(value,field,false);
  out[field]=approved&&v==='*'?CALENDAR[field].all.map(r=>({...r})):list(v).map(r=>range(field,r));
 }
 const comment=own(value,'comment');out.comment=text(comment,'');
 return out;
}
const interval=v=>{const every=millis(own(v,'every',false));if(every<1)evidence();return {every,offset:millis(own(v,'offset'))};};
function retry(v) {
 if(v===undefined||v===null)return {maximumAttempts:0,initialInterval:RETRY_DEFAULTS.initialInterval,backoffCoefficient:RETRY_DEFAULTS.backoffCoefficient,maximumInterval:RETRY_DEFAULTS.initialInterval*RETRY_DEFAULTS.maximumIntervalFactor,nonRetryableErrorTypes:[]};
 const attempts=own(v,'maximumAttempts'),backoff=own(v,'backoffCoefficient'),errors=own(v,'nonRetryableErrorTypes');
 if(attempts!==undefined&&attempts!==null&&(!Number.isSafeInteger(attempts)||attempts<0))evidence();
 if(backoff!==undefined&&backoff!==null&&(typeof backoff!=='number'||!Number.isFinite(backoff)||backoff<0))evidence();
 const initialInterval=millis(own(v,'initialInterval'))||RETRY_DEFAULTS.initialInterval;
 const names=errors===undefined||errors===null?[]:list(errors);if(names.some(n=>typeof n!=='string'))evidence();
 return {maximumAttempts:attempts??0,initialInterval,backoffCoefficient:backoff||RETRY_DEFAULTS.backoffCoefficient,
  maximumInterval:millis(own(v,'maximumInterval'))||initialInterval*RETRY_DEFAULTS.maximumIntervalFactor,nonRetryableErrorTypes:[...names].sort()};
}
// Plain data maps (memo, untyped search attributes): absent and empty are the same; any entry is part of the effect.
function dataMap(v) {
 if(v===undefined||v===null)return {};
 if(typeof v!=='object'||types.isProxy(v)||Object.getPrototypeOf(v)!==Object.prototype)evidence();
 const out={};for(const k of Object.keys(v))out[k]=canonicalSha256(frozenScheduleData(own(v,k,false)));return out;
}
function priority(v) {
 if(v===undefined||v===null)return {priorityKey:null,fairnessKey:null,fairnessWeight:null};
 return {priorityKey:own(v,'priorityKey')??null,fairnessKey:own(v,'fairnessKey')??null,fairnessWeight:own(v,'fairnessWeight')??null};
}
const argument=v=>canonicalSha256(frozenScheduleData(v));
function action(a) {
 const type=own(a,'type',false),workflowType=own(a,'workflowType',false),workflowId=own(a,'workflowId',false),taskQueue=own(a,'taskQueue',false);
 if(type!=='startWorkflow'||typeof workflowType!=='string'||typeof workflowId!=='string'||typeof taskQueue!=='string')evidence();
 // The untyped view decodes the same indexed fields as typedSearchAttributes (a class instance that is not read).
 return {type,workflowType,workflowId,taskQueue,args:list(own(a,'args',false)).map(argument),
  workflowRunTimeout:optionalMillis(own(a,'workflowRunTimeout')),workflowExecutionTimeout:optionalMillis(own(a,'workflowExecutionTimeout')),
  workflowTaskTimeout:optionalMillis(own(a,'workflowTaskTimeout')),retry:retry(own(a,'retry')),memo:dataMap(own(a,'memo')),
  searchAttributes:dataMap(own(a,'searchAttributes')),staticSummary:own(a,'staticSummary')??null,
  staticDetails:own(a,'staticDetails')??null,priority:priority(own(a,'priority'))};
}
function policies(p) {
 const overlap=own(p,'overlap')??'SKIP',catchupWindow=own(p,'catchupWindow'),pauseOnFailure=own(p,'pauseOnFailure');
 if(!OVERLAP.includes(overlap)||!Number.isSafeInteger(catchupWindow)||catchupWindow<1||typeof pauseOnFailure!=='boolean')evidence();
 return {overlap,catchupWindow,pauseOnFailure};
}
function state(s) {
 const paused=own(s,'paused'),remaining=own(s,'remainingActions');
 if(typeof paused!=='boolean'||(remaining!==undefined&&remaining!==null&&(!Number.isSafeInteger(remaining)||remaining<0)))evidence();
 return {paused,note:text(own(s,'note'),''),remainingActions:remaining??null};
}
function effect({scheduleId,spec,action:a,policies:p,state:s},approved) {
 if(typeof scheduleId!=='string'||!scheduleId)evidence();
 return frozenScheduleData({scheduleId,
  spec:{calendars:list(own(spec,'calendars')??[]).map(c=>calendar(c,approved)),intervals:list(own(spec,'intervals')??[]).map(interval),
   skip:list(own(spec,'skip')??[]).map(c=>calendar(c,approved)),startAt:instant(own(spec,'startAt')),endAt:instant(own(spec,'endAt')),
   jitter:millis(own(spec,'jitter')),timezone:text(own(spec,'timezone'),'UTC')},
  action:action(a),policies:policies(p),state:state(s)});
}

const REQUEST={top:['scheduleId','spec','action','policies','state'],spec:['calendars','intervals','cronExpressions','skip','timezone','jitter','startAt','endAt'],
 action:['type','workflowType','workflowId','taskQueue','args','workflowRunTimeout','retry'],retry:['maximumAttempts'],policies:['overlap','catchupWindow','pauseOnFailure'],
 state:['paused','note','remainingActions','triggerImmediately']};
/** The approved effect of a validated create/update intent, or a SCHEDULE_EFFECT_NOT_COMPARABLE denial. */
export function approvedScheduleEffect(intent) {
 if(intent.operation!=='schedule_task'&&intent.operation!=='update_scheduled_task')notComparable();
 const o=scheduleSdkOptions(intent);
 keysWithin(o,REQUEST.top);keysWithin(o.spec,REQUEST.spec);keysWithin(o.action,REQUEST.action);keysWithin(o.action.retry,REQUEST.retry);
 keysWithin(o.policies,REQUEST.policies);keysWithin(o.state,REQUEST.state);
 if(o.spec.cronExpressions.length)notComparable();
 // An update never sends trigger-immediately; a create's one-shot trigger leaves no describable configuration.
 if(intent.operation==='schedule_task'&&o.state.triggerImmediately!==false)notComparable();
 const {triggerImmediately,...persistent}=o.state;
 return effect({...o,state:persistent},true);
}
/** The same normal form read from a ScheduleHandle.describe() result; malformed or unreadable evidence is denied. */
export function describedScheduleEffect(description) {
 return effect({scheduleId:own(description,'scheduleId',false),spec:own(description,'spec',false),action:own(description,'action',false),
  policies:own(description,'policies',false),state:own(description,'state',false)},false);
}
