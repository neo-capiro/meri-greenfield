/** Run-bound egress control for the dedicated browser host (D005): the enforceable form of the `egress.mjs` reference
 * decision that the host's forward proxy runs for every connection the browser opens.
 *
 * - `createEgressGrant` (worker side) binds one conversation run to the digest of its effective platform ∧ tenant ∧
 *   role policy, the same validated record the browser fragment uses, with an expiry. It carries no credential.
 * - `createEgressControl` (host side) admits a connection only when: the grant is current and not revoked; the
 *   effective allowlist admits its origin (`egressDecision`, so every hop, sub-resource, fetch, WebSocket, download
 *   and tunnel is decided by one rule); its port is 80 or 443; and EVERY address the controlled resolver returns for
 *   the name is public. It answers with the single checked address the proxy must connect to, so a later DNS answer
 *   (rebinding) can never redirect an admitted connection. Each admission resolves afresh.
 *
 * Pure apart from the injected resolver: it opens no socket. Whether the real host routes all browser traffic
 * through it, and whether connection reuse lets another origin ride an admitted connection, are measured on the
 * approved host (ACTIVATION-CHECKLIST.md); this module proves neither. */
import {isIP,isIPv6} from 'node:net';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {egressDecision} from './egress.mjs';
import {validateBrowserPolicy} from './policy.mjs';
import {isPublicHost} from './public-web.mjs';
import {proxyConnection} from './egress-proxy.mjs';
export const EGRESS_GRANT_SCHEMA='meri-browser-egress-grant/1';
export const EGRESS_WEB_PORTS=Object.freeze([80,443]);
const DEFAULT_PORT=Object.freeze({'http:':80,'https:':443,'ws:':80,'wss:':443});
const MAX_ADDRESSES=32;
const fail=()=>{throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});};
const refuse=code=>Object.freeze({ok:false,code});
const isPublicAddress=a=>typeof a==='string'&&isIP(a)!==0&&isPublicHost(isIPv6(a)?`[${a}]`:a);
/** Grant for one run: `{schema,binding,policy,policySha256,expiresAtMs}`. `policy` must be the enabled effective
 * policy of this run (`resolveBrowserPolicy`/`validateBrowserPolicy` output); a disabled policy has no grant. */
export function createEgressGrant({binding,policy,expiresAtMs}={}){
 try{validateShape('RunBinding',binding);}catch{fail();}
 let p;try{p=validateBrowserPolicy(policy);}catch{fail();}
 if(!p.enabled||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<1)fail();
 return Object.freeze({schema:EGRESS_GRANT_SCHEMA,binding:Object.freeze({...binding}),policy:p,policySha256:canonicalSha256(p),expiresAtMs});
}
/** Host-side validation of a received grant: the policy must re-validate to itself and match its digest. */
function assertGrant(grant){
 if(grant?.schema!==EGRESS_GRANT_SCHEMA||!Number.isSafeInteger(grant.expiresAtMs))fail();
 try{validateShape('RunBinding',grant.binding);}catch{fail();}
 let p;try{p=validateBrowserPolicy(grant.policy);}catch{fail();}
 if(!p.enabled||canonicalSha256(p)!==grant.policySha256)fail();
 return p;
}
/** `resolve(name,{signal})` is the host's controlled resolver: every A/AAAA answer for `name` as address strings. */
export function createEgressControl({grant,resolve,now}={}){
 const policy=assertGrant(grant);
 if(typeof resolve!=='function'||typeof now!=='function')fail();
 let revoked=false;
 const current=()=>revoked?'BROWSER_EGRESS_REVOKED':now()>=grant.expiresAtMs?'BROWSER_EGRESS_EXPIRED':null;
 /** `{ok:true,origin,connect:{address,port}}` or `{ok:false,code}`. */
 async function admit({kind,url}={},{signal}={}){
  const stale=current();if(stale)return refuse(stale);
  const decision=egressDecision(policy,{kind,url});if(!decision.ok)return refuse(decision.code);
  const target=new URL(url),port=target.port?Number(target.port):DEFAULT_PORT[target.protocol];
  if(!EGRESS_WEB_PORTS.includes(port))return refuse('BROWSER_EGRESS_PORT');
  const host=target.hostname.replace(/^\[|\]$/gu,'').replace(/\.$/u,'');
  let addresses;
  if(isIP(host))addresses=[host];
  else{try{addresses=await resolve(host,{signal});}catch{return refuse('BROWSER_EGRESS_DNS');}}
  if(!Array.isArray(addresses)||!addresses.length||addresses.length>MAX_ADDRESSES||addresses.some(a=>typeof a!=='string'||isIP(a)===0))return refuse('BROWSER_EGRESS_DNS');
  // Any denied answer refuses the whole name: a mixed answer is a rebinding signal, not a choice.
  if(!addresses.every(isPublicAddress))return refuse('BROWSER_EGRESS_ADDRESS');
  const late=current();if(late)return refuse(late);
  return Object.freeze({ok:true,origin:decision.origin,connect:Object.freeze({address:addresses[0],port})});
 }
 return Object.freeze({
  binding:grant.binding,policySha256:grant.policySha256,admit,
  /** One forward-proxy request (`egress-proxy.mjs`). */
  async admitProxyRequest(request,options){const c=proxyConnection(request);return c.code?refuse(c.code):admit(c,options);},
  /** Ends the run's egress: every later admission refuses. Idempotent. */
  revoke(){revoked=true;return Object.freeze({revoked:true,binding:grant.binding,policySha256:grant.policySha256});},
 });
}
