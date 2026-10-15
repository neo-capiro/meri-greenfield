/** Trusted-client authorization for the pinned @temporalio/client and @temporalio/worker 1.24.0 connections. One token provider
 * serves both: the client receives the `apiKey` callback (ConnectionOptions.apiKey: string | (() => string)), the worker receives
 * the initial `apiKey` string at NativeConnection.connect and `setApiKey` on refresh. The token comes from a trusted reader port
 * (an owner-only file written by the issuer, or an issuer client); claims are checked here only for configuration consistency and
 * never as verification, which belongs to the server. No retry with a missing or expired token; refresh stops on close. */
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
export function createTemporalAuthorization({configuration,reader,now=Date.now}){
 const c=parseTemporalAuthorizationConfiguration(configuration);if(typeof reader?.read!=='function'||typeof now!=='function')throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');
 let current=null,timer=null,closed=false,attached=[],refreshing=null;
 const validate=raw=>{const t=own(data(raw),['token','expiresAtMs','claims']),claims=own(t.claims,['namespace','audience','issuer']);
  if(typeof t.token!=='string'||!/^[A-Za-z0-9._\-+/=]{16,8192}$/u.test(t.token)||!Number.isSafeInteger(t.expiresAtMs))throw fault('TEMPORAL_AUTHORIZATION_TOKEN');
  if(claims.namespace!==c.namespace||claims.audience!==c.audience||claims.issuer!==c.issuer)throw fault('TEMPORAL_AUTHORIZATION_CLAIMS');
  const at=now();if(t.expiresAtMs<=at||t.expiresAtMs-at>c.maxLifetimeMs)throw fault('TEMPORAL_AUTHORIZATION_EXPIRY');return Object.freeze({token:t.token,expiresAtMs:t.expiresAtMs,readAtMs:at});};
 async function refresh({signal}={}){if(closed)throw fault('TEMPORAL_AUTHORIZATION_CLOSED');signal?.throwIfAborted();
  return refreshing??=(async()=>{try{const next=validate(await reader.read({signal}));current=next;for(const connection of attached)await connection.setApiKey(next.token);schedule();return next;}finally{refreshing=null;}})();}
 function schedule(){if(timer)clearTimeout(timer);if(closed||!current)return;const wait=Math.max(1000,Math.min(c.refreshMs,current.expiresAtMs-now()-c.refreshMs));timer=setTimeout(()=>{refresh().catch(()=>{});},wait);timer.unref?.();}
 /** Synchronous accessor for ConnectionOptions.apiKey; fails closed when no valid token is held. Never returns a stale token. */
 function apiKey(){if(closed||!current||current.expiresAtMs<=now())throw fault('TEMPORAL_AUTHORIZATION_UNAVAILABLE');return current.token;}
 /** Worker connections receive refreshed tokens through NativeConnection.setApiKey. */
 function attach(connection){if(closed||typeof connection?.setApiKey!=='function')throw fault('TEMPORAL_AUTHORIZATION_CONFIGURATION');attached.push(connection);}
 async function close(){closed=true;if(timer)clearTimeout(timer);timer=null;attached=[];current=null;}
 return Object.freeze({refresh,apiKey,attach,close,current:()=>current?{expiresAtMs:current.expiresAtMs,readAtMs:current.readAtMs}:null,configuration:c});
}
