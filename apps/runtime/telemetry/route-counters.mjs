/** Per-route, per-status-class response counts for the control listeners: one `meri.http.routes` line per route and listener,
 * at most once per window, so a 5xx can be attributed to a route without any per-request logging. The routes are a closed
 * allowlist of patterns supplied by the listener owner (control-route-boundary.mjs): a path is counted under the pattern it
 * matches, with its identifier segments already `:id` in that pattern, or under `other`. Nothing else is ever a route value,
 * no body, header, query or credential is read, and a window is flushed by the telemetry rollup, by the first response after
 * it ends, and at close. */
import {HTTP_STATUS_CLASSES} from './turn-lines.mjs';
export const LISTENERS=Object.freeze(['public','private']);
const PATTERN=/^\/(?:[A-Za-z0-9._-]{1,64}|:id)(?:\/(?:[A-Za-z0-9._-]{1,64}|:id))*$/u;
/** Compiles pattern strings; `:id` matches exactly one non-empty segment without a slash. */
export function compileRoutePatterns(patterns){
 if(!Array.isArray(patterns))throw Error('ROUTE_COUNTERS_CONFIGURATION');
 return Object.freeze(patterns.map(pattern=>{
  if(typeof pattern!=='string'||!PATTERN.test(pattern))throw Error('ROUTE_COUNTERS_CONFIGURATION');
  const segments=pattern.split('/').slice(1);return Object.freeze({pattern,segments,ids:segments.some(s=>s===':id')});
 }));
}
/** The allowlisted pattern a path matches, or `other`. */
export function routePattern(pathname,compiled){
 if(typeof pathname!=='string'||!pathname.startsWith('/')||pathname.includes('?')||pathname.includes('#'))return 'other';
 const segments=pathname.split('/').slice(1);
 for(const route of compiled){
  if(route.segments.length!==segments.length)continue;
  if(route.segments.every((s,i)=>s===':id'?segments[i].length>0&&segments[i].length<=256:s===segments[i]))return route.pattern;
 }
 return 'other';
}
export function statusClass(status){
 if(!Number.isSafeInteger(status))return '5xx';
 if(status>=200&&status<300)return '2xx';if(status>=300&&status<400)return '3xx';
 if([401,403,404,409,503].includes(status))return String(status);
 if(status>=400&&status<500)return '4xx';return '5xx';
}
export function createRouteStatusCounters({emit,now=Date.now,windowMs=60000,routes}={}){
 if(typeof emit!=='function'||typeof now!=='function'||!Number.isSafeInteger(windowMs)||windowMs<1000||!routes||typeof routes!=='object')throw Error('ROUTE_COUNTERS_CONFIGURATION');
 const tables=Object.fromEntries(LISTENERS.map(listener=>[listener,compileRoutePatterns(routes[listener]??[])]));
 const counts=new Map();let windowStart=clock();
 function clock(){try{const at=now();return Number.isFinite(at)&&at>=0?at:0;}catch{return 0;}}
 function flush(){
  const at=clock(),elapsed=Math.max(0,at-windowStart);windowStart=at;
  for(const [key,entry] of counts){counts.delete(key);try{emit('meri.http.routes',{listener:entry.listener,route:entry.route,statuses:entry.statuses,windowMs:elapsed,atMs:at});}catch{}}
 }
 function record(listener,pathname,status){
  try{
   if(clock()-windowStart>=windowMs)flush();
   const where=LISTENERS.includes(listener)?listener:'public',route=routePattern(pathname,tables[where]),key=where+' '+route;
   let entry=counts.get(key);if(!entry){entry={listener:where,route,statuses:Object.fromEntries(HTTP_STATUS_CLASSES.map(c=>[c,0]))};counts.set(key,entry);}
   entry.statuses[statusClass(status)]+=1;
  }catch{}
 }
 /** Wraps a Fetch application: the final status of every response, including a thrown handler, is counted; nothing else changes. */
 function observe(listener,application){
  if(typeof application?.handle!=='function')throw Error('ROUTE_COUNTERS_CONFIGURATION');
  return Object.freeze({async handle(request,...rest){
   let pathname;try{pathname=new URL(request.url).pathname;}catch{pathname='';}
   let status;try{const response=await application.handle(request,...rest);status=response?.status;return response;}
   finally{record(listener,pathname,status);}
  }});
 }
 return Object.freeze({record,flush,observe,status:()=>Object.freeze({routes:counts.size,windowStartMs:windowStart})});
}
