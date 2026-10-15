/** Trusted-client authorization for the pinned @temporalio/client and @temporalio/worker 1.24.0 connections. One token provider
 * serves both: the client receives the `apiKey` callback (ConnectionOptions.apiKey: string | (() => string)), the worker receives
 * the initial `apiKey` string at NativeConnection.connect and `setApiKey` on refresh. The token comes from a trusted reader port
 * (an owner-only file written by the issuer, or an issuer client); claims are checked here only for configuration consistency and
 * never as verification, which belongs to the server. A missing, expired, unreadable or rejected token is a fail-closed state
 * (no stale token is ever served, pollers are told to stop, readiness fails) with bounded retries; refresh stops on close. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret,fault} from './config.mjs';
const name=/^[a-zA-Z0-9._:\/\-]{1,256}$/u;
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
/** Closed configuration: a token file (owner-only, read with readSecret semantics), the expected claims and the refresh bounds. */
export function parseTemporalAuthorizationConfiguration(value){
 const c=own(data(value),['tokenFile','namespace','audience','issuer','refreshMs','maxLifetimeMs']);
 if(typeof c.tokenFile!=='string'||!c.tokenFile.startsWith('/')||c.tokenFile.includes('/../')||c.tokenFile.length>4096)throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');
 for(const k of ['namespace','audience','issuer'])if(typeof c[k]!=='string'||!name.test(c[k]))throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');
 if(!integer(c.refreshMs,1000,3600000)||!integer(c.maxLifetimeMs,c.refreshMs+1,86400000))throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');
 return Object.freeze(c);
}
/** Reader over an owner-only JSON file: {token, expiresAtMs, claims:{namespace,audience,issuer}} as written by the trusted issuer. */
export function createTemporalTokenFileReader({tokenFile}){
 return Object.freeze({async read(){const bytes=await readSecret(tokenFile);let parsed;try{parsed=JSON.parse(bytes.toString('utf8'));}catch{throw fault('TEMPORAL_AUTHORIZATION_TOKEN');}return parsed;}});
}
/** Fail-closed token provider. A token is served only while the last refresh succeeded and the token has not expired; any read
 * failure, timeout, claim or expiry fault, close during a read, or worker rotation failure drops the current token (no stale reuse),
 * notifies watchers (the worker stops polling; readiness fails) and schedules a bounded retry until close. Reads are bounded by
 * `readTimeoutMs`; the reader receives an abort signal. `current` moves only after every attached worker connection accepted the
 * new key. Timers are injectable for tests. */
export function createTemporalAuthorization({configuration,reader,now=Date.now,timers={setTimeout,clearTimeout},readTimeoutMs=null}){
 const c=parseTemporalAuthorizationConfiguration(configuration);if(typeof reader?.read!=='function'||typeof now!=='function'||typeof timers?.setTimeout!=='function'||typeof timers?.clearTimeout!=='function')throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');
 const readBound=readTimeoutMs===null?Math.min(c.refreshMs,5000):readTimeoutMs;if(!integer(readBound,1,c.refreshMs))throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');const retryMs=Math.min(c.refreshMs,1000);
 let current=null,timer=null,expiry=null,closed=false,attached=[],refreshing=null,failure=null;const watchers=new Set();
 const validate=raw=>{const t=own(data(raw),['token','expiresAtMs','claims']),claims=own(t.claims,['namespace','audience','issuer']);
  if(typeof t.token!=='string'||!/^[A-Za-z0-9._\-+/=]{16,8192}$/u.test(t.token)||!Number.isSafeInteger(t.expiresAtMs))throw fault('TEMPORAL_AUTHORIZATION_TOKEN');
  if(claims.namespace!==c.namespace||claims.audience!==c.audience||claims.issuer!==c.issuer)throw fault('TEMPORAL_AUTHORIZATION_CLAIMS');
  const at=now();if(t.expiresAtMs<=at||t.expiresAtMs-at>c.maxLifetimeMs)throw fault('TEMPORAL_AUTHORIZATION_EXPIRY');return Object.freeze({token:t.token,expiresAtMs:t.expiresAtMs,readAtMs:at});};
 const clear=()=>{if(timer)timers.clearTimeout(timer);timer=null;if(expiry)timers.clearTimeout(expiry);expiry=null;};
 const notify=code=>{for(const w of [...watchers])try{w(code);}catch{}};
 /** Drops the token, tells watchers, and (unless closed) retries after a bounded delay. The worker keeps whatever key the native
  * connection last accepted, which is why watchers stop the worker. */
 function failClosed(error){current=null;failure=typeof error?.code==='string'?error:Object.assign(fault('TEMPORAL_AUTHORIZATION_FAILED'),{cause:error});clear();notify(failure.code);if(!closed){timer=timers.setTimeout(()=>{refresh().catch(()=>{});},retryMs);timer.unref?.();}}
 async function readBounded(signal){const controller=new AbortController(),onAbort=()=>controller.abort();signal?.addEventListener('abort',onAbort,{once:true});let t;
  const timeout=new Promise((_,reject)=>{t=timers.setTimeout(()=>{controller.abort();reject(fault('TEMPORAL_AUTHORIZATION_TIMEOUT'));},readBound);t.unref?.();});
  try{return await Promise.race([reader.read({signal:controller.signal}),timeout]);}finally{timers.clearTimeout(t);signal?.removeEventListener('abort',onAbort);}}
 async function refresh({signal}={}){if(closed)throw fault('TEMPORAL_AUTHORIZATION_CLOSED');signal?.throwIfAborted();
  return refreshing??=(async()=>{try{
   let next;try{const raw=await readBounded(signal);if(closed)throw fault('TEMPORAL_AUTHORIZATION_CLOSED');next=validate(raw);}catch(error){if(!closed)failClosed(error);throw error;}
   for(const connection of attached){try{await connection.setApiKey(next.token);}catch(error){const f=Object.assign(fault('TEMPORAL_AUTHORIZATION_ROTATION'),{cause:error});failClosed(f);throw f;}if(closed)throw fault('TEMPORAL_AUTHORIZATION_CLOSED');}
   current=next;failure=null;schedule();return next;}finally{refreshing=null;}})();}
 function schedule(){clear();if(closed||!current)return;const wait=Math.max(1000,Math.min(c.refreshMs,current.expiresAtMs-now()-c.refreshMs));timer=timers.setTimeout(()=>{refresh().catch(()=>{});},wait);timer.unref?.();
  const held=current;expiry=timers.setTimeout(()=>{if(current===held&&!closed)failClosed(fault('TEMPORAL_AUTHORIZATION_EXPIRY'));},Math.max(1,held.expiresAtMs-now()));expiry.unref?.();}
 const healthy=()=>!closed&&failure===null&&current!==null&&current.expiresAtMs>now();
 /** Synchronous accessor for ConnectionOptions.apiKey; fails closed when no valid token is held. Never returns a stale or expired token. */
 function apiKey(){if(!healthy())throw fault('TEMPORAL_AUTHORIZATION_UNAVAILABLE');return current.token;}
 /** Worker connections receive refreshed tokens through NativeConnection.setApiKey. */
 function attach(connection){if(closed||typeof connection?.setApiKey!=='function')throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');attached.push(connection);}
 /** Watchers learn of every fail-closed transition (read failure, timeout, bad claims, expiry, rotation failure) so pollers stop. */
 function watch(listener){if(typeof listener!=='function')throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');watchers.add(listener);return ()=>watchers.delete(listener);}
 async function close(){closed=true;clear();attached=[];current=null;watchers.clear();}
 return Object.freeze({refresh,apiKey,attach,watch,healthy,close,current:()=>current?{expiresAtMs:current.expiresAtMs,readAtMs:current.readAtMs}:null,failure:()=>failure?.code??null,configuration:c});
}
