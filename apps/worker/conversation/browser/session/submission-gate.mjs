/** Network-level submission gate on the session's browser context: the second, structural-proof layer behind the
 * interaction classifier (`interaction-classifier.mjs`). The classifier reads the clicked element and so cannot see a
 * submit that page script performs (a `type=button` that calls requestSubmit/submit or fetch POST, a change handler that
 * posts, prototype tampering). This gate sees every request the page makes, in the browser itself: Playwright routes
 * the context's traffic through the DevTools Fetch domain, below anything page script can reach.
 *
 * - Safe methods (GET, HEAD, OPTIONS) always continue: reading the web never asks, and a same-document navigation sends no
 *   request at all.
 * - While the user holds the browser (takeover) the user's own actions continue: sign-in and checkout are theirs to do.
 * - During one agent action, a request with any other method (POST, PUT, PATCH, DELETE, a POST form submission) is held
 *   and the canonical approval owner asks the user, once per destination host and method within that action; the card
 *   names the method and the destination host. An approved request continues; a refused, expired or unanswerable one is
 *   aborted and never reaches the network. When the classifier already obtained the user's approval to submit this exact
 *   action, requests to the page's own host are covered by that approval and are not asked again.
 * - Outside an agent action (page timers between turns, a returning hand-back) such a request is aborted: no one approved
 *   it. Beacons and CSP reports carry telemetry, never a user's submission, and are aborted without a question.
 * Credential input stays refused by the classifier before any of this; this gate never sees a typed password. */
import {checkBrowserUrl} from '../policy.mjs';

const SAFE=new Set(['GET','HEAD','OPTIONS']);
const TELEMETRY=new Set(['ping','cspviolationreport']);
const fail=code=>{throw Object.assign(Error(code),{code});};
const hostOf=url=>{try{return new URL(url).hostname;}catch{return null;}};
const originOf=page=>{try{const o=new URL(page.url()).origin;return o==='null'?null:o;}catch{return null;}};

/** `approve({method,host,path,pageOrigin,tool,requestKey,signal})` resolves true only for a consumed canonical approval;
 * `userDriving()` is true while the user holds the browser. Installs one context route; `close()` removes it. */
export async function createSubmissionGate({context,policy,approve,userDriving}){
 if(typeof context?.route!=='function'||typeof context.unroute!=='function'||typeof approve!=='function'||typeof userDriving!=='function')fail('BROWSER_CONFIGURATION');
 let action=null,closed=false,sequence=0;
 const abort=route=>route.abort('blockedbyclient').catch(()=>{});
 const release=route=>route.fallback().catch(()=>{});
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
  if(host===null||!checkBrowserUrl(policy,url).ok)return abort(route);
  if(current.coveredHost===host)return release(route);
  const key=`${method} ${host}`;
  let decision=current.decisions.get(key);
  if(decision===undefined){
   let pageOrigin=null;try{pageOrigin=originOf(request.frame().page());}catch{}
   const path=(()=>{try{return new URL(url).pathname.slice(0,512);}catch{return '/';}})();
   decision=pageOrigin===null?Promise.resolve(false):Promise.resolve()
    .then(()=>approve({method,host,path,pageOrigin,tool:current.tool,requestKey:`${current.requestId}:${++sequence}`,signal:current.approvalSignal}))
    .then(value=>value===true,()=>false);
   current.decisions.set(key,decision);
   decision.then(approved=>{if(!approved)current.declined.add(key);});
  }
  const pending=decision.then(approved=>approved&&!closed?release(route):abort(route));
  current.pending.add(pending);pending.finally(()=>current.pending.delete(pending));
  return pending;
 }
 await context.route('**/*',handle);
 return Object.freeze({
  /** One agent action. `coveredHost` is the page host an approved structural submission already covers, if any. */
  begin({requestId,tool,coveredHost=null,signal}){
   if(closed)fail('BROWSER_SESSION_ENDING');
   if(action!==null&&!action.ended)fail('BROWSER_SESSION_BUSY');
   const stop=new AbortController();
   const own=action={requestId,tool,coveredHost,stop,approvalSignal:signal?AbortSignal.any([signal,stop.signal]):stop.signal,
    ended:false,decisions:new Map(),pending:new Set(),declined:new Set()};
   return Object.freeze({
    /** Waits until every request held during this action was released or aborted: whether anything was asked, and the
     * declined `METHOD host` keys. */
    async settled(){while(own.pending.size)await Promise.allSettled([...own.pending]);
     return Object.freeze({asked:own.decisions.size>0,declined:Object.freeze([...own.declined].sort())});},
    end(){own.ended=true;if(action===own)action=null;},
   });
  },
  /** A takeover, revocation or session end withdraws every open question: held requests are aborted, never sent. */
  interrupt(){action?.stop.abort();},
  async close(){closed=true;if(action){action.stop.abort();action.ended=true;}action=null;try{await context.unroute('**/*',handle);}catch{}},
 });
}
