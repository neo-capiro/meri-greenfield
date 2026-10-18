/** Takeover input admission (design 3.2: "Each event is checked by the session owner (lease holder, lease epoch,
 * coordinates inside the viewport, rate limit, allowed key set) and then injected through page.mouse / page.keyboard").
 * Owner answer Q-T6 (accepted): v1 has keyboard, mouse and wheel only; no clipboard sync, device uploads, drag and drop,
 * audio or recording. Pure validation: the lease epoch itself is checked by the fence (`fence.mjs`); this module checks
 * the batch shape and content and never logs or returns typed text anywhere but the caller.
 *
 * The named-key set and the numeric limits are a conservative v1 proposal (not owner decisions): no Control/Meta/Alt
 * chords, so browser shortcuts (address bar, devtools, new window) and clipboard shortcuts cannot be sent. Widening them
 * is a reviewed change. */
export const INPUT_LIMITS=Object.freeze({maxEvents:64,maxText:256,maxWheelDelta:10000,eventsPerSecond:60,burst:120});
export const NAMED_KEYS=Object.freeze(['Enter','Tab','Backspace','Delete','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Shift','Space']);
export const REFUSED_INPUT_TYPES=Object.freeze(['clipboard','paste','copy','cut','drop','drag','file','upload','audio']);
const MOUSE_ACTIONS=['move','down','up'],BUTTONS=['left','middle','right'],KEY_ACTIONS=['down','up'];
const fault=code=>Object.assign(new Error(code),{code});
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));
const within=(v,max)=>Number.isFinite(v)&&v>=0&&v<max;
const PRINTABLE=/^[^\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]$/u;
const TEXT=/^[^\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]*$/u;

function event(e,{width,height}){
 if(!e||typeof e!=='object'||typeof e.type!=='string')throw fault('TAKEOVER_INPUT_INVALID');
 if(REFUSED_INPUT_TYPES.includes(e.type))throw fault('TAKEOVER_INPUT_KIND_REFUSED');
 switch(e.type){
  case 'mouse':
   if(!keys(e,['type','action','x','y','button'])||!MOUSE_ACTIONS.includes(e.action)||!within(e.x,width)||!within(e.y,height)||(e.action==='move'?e.button!==undefined:!BUTTONS.includes(e.button)))throw fault('TAKEOVER_INPUT_INVALID');
   return Object.freeze({type:'mouse',action:e.action,x:e.x,y:e.y,...(e.button?{button:e.button}:{})});
  case 'wheel':
   if(!keys(e,['type','x','y','deltaX','deltaY'])||!within(e.x,width)||!within(e.y,height)||![e.deltaX,e.deltaY].every(d=>Number.isFinite(d)&&Math.abs(d)<=INPUT_LIMITS.maxWheelDelta))throw fault('TAKEOVER_INPUT_INVALID');
   return Object.freeze({type:'wheel',x:e.x,y:e.y,deltaX:e.deltaX,deltaY:e.deltaY});
  case 'key':
   if(!keys(e,['type','action','key','shift'])||!KEY_ACTIONS.includes(e.action)||typeof e.key!=='string'||e.shift!==undefined&&typeof e.shift!=='boolean')throw fault('TAKEOVER_INPUT_INVALID');
   if(!NAMED_KEYS.includes(e.key)&&!PRINTABLE.test(e.key))throw fault('TAKEOVER_INPUT_KEY_REFUSED');
   return Object.freeze({type:'key',action:e.action,key:e.key,shift:e.shift===true});
  case 'text':
   if(!keys(e,['type','text'])||typeof e.text!=='string'||!e.text.length||[...e.text].length>INPUT_LIMITS.maxText||!TEXT.test(e.text))throw fault('TAKEOVER_INPUT_INVALID');
   return Object.freeze({type:'text',text:e.text});
  default:throw fault('TAKEOVER_INPUT_KIND_REFUSED');
 }
}

/** Token-bucket rate limiter per lease, on an injected clock. */
export function createInputLimiter({now,eventsPerSecond=INPUT_LIMITS.eventsPerSecond,burst=INPUT_LIMITS.burst}={}){
 if(typeof now!=='function'||!Number.isSafeInteger(eventsPerSecond)||eventsPerSecond<1||!Number.isSafeInteger(burst)||burst<1)throw fault('TAKEOVER_INPUT_CONFIGURATION');
 let tokens=burst,at=now();
 return Object.freeze({take(count){const t=now();tokens=Math.min(burst,tokens+(t-at)*eventsPerSecond/1000);at=t;if(count>tokens)return false;tokens-=count;return true;}});
}

/** Validates one input batch `{leaseEpoch, events}` against the current viewport and the lease's limiter. A batch is
 * admitted or refused as a whole; nothing in a refused batch is injected. */
export function admitInputBatch(batch,{viewport,limiter}){
 if(!keys(batch,['leaseEpoch','events'])||!Number.isSafeInteger(batch.leaseEpoch)||batch.leaseEpoch<1||!Array.isArray(batch.events)||!batch.events.length||batch.events.length>INPUT_LIMITS.maxEvents)throw fault('TAKEOVER_INPUT_INVALID');
 if(!viewport||!Number.isSafeInteger(viewport.width)||!Number.isSafeInteger(viewport.height)||viewport.width<1||viewport.height<1||typeof limiter?.take!=='function')throw fault('TAKEOVER_INPUT_CONFIGURATION');
 const events=Object.freeze(batch.events.map(e=>event(e,viewport)));
 if(!limiter.take(events.length))throw fault('TAKEOVER_INPUT_RATE_LIMITED');
 return Object.freeze({leaseEpoch:batch.leaseEpoch,events});
}
