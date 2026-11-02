/** Per-route, per-status-class response counts for the control listeners: one `meri.http.routes` line per route and listener,
 * at most once per window, so a 5xx can be attributed to a route pattern without any per-request logging. Identifiers in
 * paths are replaced by `:id`, no body, header, query or credential is read, and the route table is bounded; everything past
 * the bound is counted as `other`. No timer: a window is flushed by the first response after it ends and at close. */
import {HTTP_STATUS_CLASSES} from './turn-lines.mjs';
const ID_SEGMENT=/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24,}|[0-9]+|[A-Za-z0-9_-]{32,})$/iu;
const ROUTE_SEGMENT=/^[A-Za-z0-9._-]{1,64}$/u;
export const LISTENERS=Object.freeze(['public','private']);
/** The route pattern of a path: identifier-like segments become `:id`, anything else unusual becomes `other`. */
export function routePattern(pathname){
 if(typeof pathname!=='string'||!pathname.startsWith('/'))return 'other';
 const segments=pathname.split('/').slice(1,13).map(segment=>segment===''?'':ID_SEGMENT.test(segment)?':id':ROUTE_SEGMENT.test(segment)?segment:null);
 if(segments.some(segment=>segment===null)||pathname.split('/').length>13)return 'other';
 return '/'+segments.join('/');
}
export function statusClass(status){
 if(!Number.isSafeInteger(status))return '5xx';
 if(status>=200&&status<300)return '2xx';if(status>=300&&status<400)return '3xx';
 if([401,403,404,409,503].includes(status))return String(status);
 if(status>=400&&status<500)return '4xx';return '5xx';
}
export function createRouteStatusCounters({emit,now=Date.now,windowMs=60000,maxRoutes=200}={}){
 if(typeof emit!=='function'||typeof now!=='function'||!Number.isSafeInteger(windowMs)||windowMs<1000||!Number.isSafeInteger(maxRoutes)||maxRoutes<1)throw Error('ROUTE_COUNTERS_CONFIGURATION');
 const counts=new Map();let windowStart=clock();
 function clock(){try{const at=now();return Number.isFinite(at)&&at>=0?at:0;}catch{return 0;}}
 function flush(){
  const at=clock(),elapsed=Math.max(0,at-windowStart);windowStart=at;
  for(const [key,entry] of counts){counts.delete(key);try{emit('meri.http.routes',{listener:entry.listener,route:entry.route,statuses:entry.statuses,windowMs:elapsed,atMs:at});}catch{}}
 }
 function record(listener,pathname,status){
  try{
   if(clock()-windowStart>=windowMs)flush();
   const where=LISTENERS.includes(listener)?listener:'public';let route=routePattern(pathname);
   let key=where+' '+route;if(!counts.has(key)&&counts.size>=maxRoutes){route='other';key=where+' '+route;}
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
