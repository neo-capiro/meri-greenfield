/** Network-level submission gate on the session's browser context: the second, structural-proof layer behind the
 * interaction classifier (`interaction-classifier.mjs`). The classifier reads the clicked element and so cannot see a
 * submit that page script performs (a `type=button` that calls requestSubmit/submit or fetch POST, a change handler that
 * posts, prototype tampering). This gate sees every request the page makes, in the browser itself: Playwright routes
 * the context's traffic through the DevTools Fetch domain, below anything page script can reach.
 *
 * - Safe methods (GET, HEAD, OPTIONS) always continue: reading the web never asks, and a same-document navigation sends no
 *   request at all. This includes a GET form submission (method=get, also by requestSubmit): it is a navigation to a URL,
 *   which the structural classifier asks about when the model clicks a submit control, but this gate does not hold.
 * - While the user holds the browser (takeover) the user's own actions continue: sign-in and checkout are theirs to do.
 * - During one agent action, a request with a standard sending method (POST, PUT, PATCH, DELETE, a POST form submission)
 *   is held and the canonical approval owner asks the user, once per destination host and method within that action, for
 *   at most MAX_QUESTIONS_PER_ACTION destinations; the card names the method and the destination host. An approved request
 *   continues; a refused, expired or withdrawn one is aborted and never reaches the network. When the classifier already
 *   obtained the user's approval to submit this exact tool call, requests to the page's own host are covered by that
 *   approval and are not asked again.
 * - Refused by policy without a question (and reported to the model as such): a non-standard or malformed method, a
 *   destination outside the browser policy, a request with no public page behind it (a popup still at about:blank, a
 *   worker without a page), a destination beyond the per-action question limit, and a redirect (307/308, which re-sends
 *   the body) of a sending request to another host. Redirect hops never reach Playwright routes, so a browser-level
 *   DevTools Fetch interception at the response stage sees each redirect of a sending request before the browser follows
 *   it; a same-host redirect stays inside what was approved for that host.
 * - Outside an agent action such a request is aborted: no one approved it. Beacons and CSP reports carry telemetry,
 *   never a user's submission, and are aborted without a question or a report.
 * Credential input stays refused by the classifier before any of this; this gate never sees a typed password. */
import {checkBrowserUrl} from '../policy.mjs';

const SAFE=new Set(['GET','HEAD','OPTIONS']);
const SENDING=new Set(['POST','PUT','PATCH','DELETE']);
const TELEMETRY=new Set(['ping','cspviolationreport']);
/** Distinct destinations (method and host) the user may be asked about within one agent action. */
export const MAX_QUESTIONS_PER_ACTION=3;
/** Response-stage interception covers the request kinds that can carry a sending method. */
const REDIRECT_WATCH=Object.freeze(['Document','XHR','Fetch','Other','Ping','EventSource'].map(resourceType=>({urlPattern:'*',resourceType,requestStage:'Response'})));
const fail=code=>{throw Object.assign(Error(code),{code});};
const hostOf=url=>{try{return new URL(url).hostname;}catch{return null;}};
const originOf=page=>{try{const o=new URL(page.url()).origin;return o==='null'?null:o;}catch{return null;}};

/** `approve({method,host,path,pageOrigin,tool,requestKey,signal})` resolves true only for a consumed canonical approval;
 * `userDriving()` is true while the user holds the browser. Installs one context route and one browser-level redirect
 * watch; `close()` removes both. */
export async function createSubmissionGate({context,policy,approve,userDriving}){
 if(typeof context?.route!=='function'||typeof context.unroute!=='function'||typeof approve!=='function'||typeof userDriving!=='function')fail('BROWSER_CONFIGURATION');
 const browser=typeof context.browser==='function'?context.browser():null;
 if(typeof browser?.newBrowserCDPSession!=='function')fail('BROWSER_CONFIGURATION');
 let action=null,closed=false,sequence=0;
 const abort=route=>route.abort('blockedbyclient').catch(()=>{});
 const release=route=>route.fallback().catch(()=>{});
 const refuse=(current,route,key)=>{current.refused.add(key);return abort(route);};
 async function handle(route,request){
  let method;try{method=request.method().toUpperCase();}catch{return abort(route);}
  if(SAFE.has(method))return release(route);
  if(closed)return abort(route);
  if(userDriving())return release(route);
  const current=action;
  if(current===null||current.ended)return abort(route);
  let type;try{type=request.resourceType();}catch{type='other';}
  if(TELEMETRY.has(type))return abort(route);
  const url=request.url(),host=hostOf(url);
  const key=`${SENDING.has(method)?method:'non-standard method'} ${host??'unknown destination'}`;
  if(!SENDING.has(method)||host===null||!checkBrowserUrl(policy,url).ok)return refuse(current,route,key);
  if(current.coveredHost===host)return release(route);
  let decision=current.decisions.get(key);
  if(decision===undefined){
   let pageOrigin=null;try{pageOrigin=originOf(request.frame().page());}catch{}
   if(pageOrigin===null||current.decisions.size>=MAX_QUESTIONS_PER_ACTION)return refuse(current,route,key);
   const path=(()=>{try{return new URL(url).pathname.slice(0,512);}catch{return '/';}})();
   decision=Promise.resolve()
    .then(()=>approve({method,host,path,pageOrigin,tool:current.tool,requestKey:`${current.requestId}:${++sequence}`,signal:current.approvalSignal}))
    .then(value=>value===true,()=>false);
   current.decisions.set(key,decision);
   decision.then(approved=>{if(!approved)current.declined.add(key);});
  }
  const pending=decision.then(approved=>approved&&!closed?release(route):abort(route));
  current.pending.add(pending);pending.finally(()=>current.pending.delete(pending));
  return pending;
 }
 // Every redirect of a sending request is seen before the browser follows it: a 307/308 re-sends the body, so one to
 // another host is refused (it was never approved); every other response continues unchanged.
 const cdp=await browser.newBrowserCDPSession();
 const onPaused=async event=>{
  let refused=false;
  try{
   const method=String(event.request?.method??'').toUpperCase(),status=event.responseStatusCode;
   if(!SAFE.has(method)&&(status===307||status===308)&&!userDriving()){
    const location=(event.responseHeaders??[]).find(h=>String(h.name).toLowerCase()==='location')?.value;
    const target=location===undefined?null:hostOf(new URL(location,event.request.url).href);
    if(target!==hostOf(event.request.url)){
     refused=true;
     const current=action;if(current!==null&&!current.ended)current.refused.add(`${SENDING.has(method)?method:'non-standard method'} ${target??'unknown destination'}`);
    }
   }
  }catch{refused=true;}
  try{await cdp.send(refused?'Fetch.failRequest':'Fetch.continueRequest',refused?{requestId:event.requestId,errorReason:'BlockedByClient'}:{requestId:event.requestId});}catch{}
 };
 cdp.on('Fetch.requestPaused',onPaused);
 try{await cdp.send('Fetch.enable',{patterns:REDIRECT_WATCH});await context.route('**/*',handle);}
 catch(error){try{await cdp.detach();}catch{}throw error;}
 return Object.freeze({
  /** One agent action. `coveredHost` is the page host an approved structural submission already covers, if any. */
  begin({requestId,tool,coveredHost=null,signal}){
   if(closed)fail('BROWSER_SESSION_ENDING');
   if(action!==null&&!action.ended)fail('BROWSER_SESSION_BUSY');
   const stop=new AbortController();
   const own=action={requestId,tool,coveredHost,stop,approvalSignal:signal?AbortSignal.any([signal,stop.signal]):stop.signal,
    ended:false,decisions:new Map(),pending:new Set(),declined:new Set(),refused:new Set()};
   return Object.freeze({
    /** Waits until every request held during this action was released or aborted: whether anything was asked, the
     * `METHOD host` keys the user declined, and those refused by policy without a question. */
    async settled(){while(own.pending.size)await Promise.allSettled([...own.pending]);
     return Object.freeze({asked:own.decisions.size>0,declined:Object.freeze([...own.declined].sort()),
      refused:Object.freeze([...own.refused].filter(key=>!own.declined.has(key)).sort())});},
    end(){own.ended=true;if(action===own)action=null;},
   });
  },
  /** A takeover, revocation or session end withdraws every open question: held requests are aborted, never sent. */
  interrupt(){action?.stop.abort();},
  async close(){closed=true;if(action){action.stop.abort();action.ended=true;}action=null;
   try{await context.unroute('**/*',handle);}catch{}
   try{await cdp.send('Fetch.disable');}catch{}try{await cdp.detach();}catch{}},
 });
}
