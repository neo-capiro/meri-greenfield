// @ts-check
/** Destination control for SDK-sandboxed Bash. The SDK sandbox (bubblewrap) leaves sandboxed commands no network of
 * their own; their only route out is the sandbox's proxy bridge, which `bash-sandbox.mjs` points at Meri's egress proxy
 * (`network.httpProxyPort`/`socksProxyPort`) instead of the CLI's own proxy, because the CLI's proxy matches names only
 * and never checks the address a name resolves to.
 *
 * Deny by default: the allowlist is the run's effective `sandboxNetworkDomains` (lower-case public DNS names, optional
 * leading `*.` for subdomains only), and an empty list admits nothing. A connection is admitted only when:
 *  - the grant is current (not revoked, not expired);
 *  - the destination is a DNS NAME on the allowlist: IP literals are never admitted, because the list names hosts;
 *  - the name passes the platform public-name rules (`browser/public-web.mjs`: no localhost/.internal/.local/...);
 *  - the port is 80 or 443;
 *  - EVERY address the controlled resolver returns for the name is globally routable (a mixed answer is a rebinding
 *    signal and refuses the name); the proxy then dials only the first checked address, never the name again.
 * Redirects are new requests through the proxy and are decided by the same rule. Pure apart from the injected resolver. */
import {isIP} from 'node:net';
import {lookup} from 'node:dns/promises';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {isSandboxNetworkDomain,MAX_SANDBOX_NETWORK_DOMAINS} from '../capabilities/policy.mjs';
import {isPublicHost} from '../browser/public-web.mjs';
import {proxyConnection} from '../browser/egress-proxy.mjs';
import {startEgressProxy} from './proxy-server.mjs';
export const BASH_EGRESS_SCHEMA='meri-bash-egress/1';
export const BASH_EGRESS_PORTS=Object.freeze([80,443]);
const MAX_ADDRESSES=32;
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(new Error(code),{code});};
/** @param {string} code */
const refuse=code=>Object.freeze({ok:/** @type {const} */(false),code});
/** @param {readonly unknown[]} domains @returns {readonly string[]} */
export function assertBashEgressDomains(domains){
 if(!Array.isArray(domains)||domains.length>MAX_SANDBOX_NETWORK_DOMAINS||new Set(domains).size!==domains.length||!domains.every(isSandboxNetworkDomain))fail('BASH_EGRESS_CONFIGURATION');
 return Object.freeze([.../** @type {string[]} */(domains)]);
}
/** Digest that binds the Bash sandbox settings, the egress fact and approval subjects to one domain list. @param {readonly string[]} domains */
export const bashEgressDomainsSha256=domains=>canonicalSha256({schema:BASH_EGRESS_SCHEMA,domains:[...assertBashEgressDomains(domains)]});
/** True when `host` (normalized) is named by the allowlist. `*.example.com` admits subdomains only, as the SDK does.
 * @param {readonly string[]} domains @param {string} host */
export function domainAllowed(domains,host){
 return domains.some(d=>d.startsWith('*.')?host.endsWith(d.slice(1))&&host.length>d.length-1:host===d);
}
/** @param {unknown} host */
function normalizeHost(host){
 if(typeof host!=='string'||!host||host.length>255)return null;
 const h=host.replace(/^\[|\]$/gu,'').toLowerCase();
 return h.endsWith('.')?h.slice(0,-1):h;
}
/** @param {string} a */
const isPublicAddress=a=>typeof a==='string'&&isIP(a)!==0&&isPublicHost(isIP(a)===6?`[${a}]`:a);
/** @typedef {(name:string,options:{signal?:AbortSignal})=>Promise<string[]>} Resolver */
/** Host-side control for one run. `resolve` is the controlled resolver (every A/AAAA answer as address strings).
 * @param {{domains:readonly string[],resolve:Resolver,now:()=>number,expiresAtMs:number}} input */
export function createBashEgressControl({domains,resolve,now,expiresAtMs}){
 const allow=assertBashEgressDomains(domains);
 if(typeof resolve!=='function'||typeof now!=='function'||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<1)fail('BASH_EGRESS_CONFIGURATION');
 let revoked=false;
 const stale=()=>revoked?'BASH_EGRESS_REVOKED':now()>=expiresAtMs?'BASH_EGRESS_EXPIRED':null;
 /** @param {{host:unknown,port:unknown}} destination @param {{signal?:AbortSignal}} [options] */
 async function admit({host,port},{signal}={}){
  const late=stale();if(late)return refuse(late);
  const name=normalizeHost(host);
  if(name===null)return refuse('BASH_EGRESS_REQUEST');
  if(isIP(name)!==0)return refuse('BASH_EGRESS_IP_LITERAL');
  if(!domainAllowed(allow,name))return refuse('BASH_EGRESS_DESTINATION');
  if(!isPublicHost(name))return refuse('BASH_EGRESS_NOT_PUBLIC');
  if(typeof port!=='number'||!BASH_EGRESS_PORTS.includes(port))return refuse('BASH_EGRESS_PORT');
  /** @type {unknown} */let addresses;
  try{addresses=await resolve(name,{...(signal?{signal}:{})});}catch{return refuse('BASH_EGRESS_DNS');}
  if(!Array.isArray(addresses)||!addresses.length||addresses.length>MAX_ADDRESSES||addresses.some(a=>typeof a!=='string'||isIP(a)===0))return refuse('BASH_EGRESS_DNS');
  if(!addresses.every(isPublicAddress))return refuse('BASH_EGRESS_ADDRESS');
  const after=stale();if(after)return refuse(after);
  return Object.freeze({ok:/** @type {const} */(true),host:name,connect:Object.freeze({address:/** @type {string} */(addresses[0]),port})});
 }
 return Object.freeze({
  domainsSha256:bashEgressDomainsSha256(allow),admit,
  /** One HTTP forward-proxy request (CONNECT or absolute-form). @param {{method:string,target:string,headers:Record<string,unknown>}} request @param {{signal?:AbortSignal}} [options] */
  async admitProxyRequest(request,options){
   const c=proxyConnection(request);if('code' in c&&c.code)return refuse(c.code==='BROWSER_EGRESS_PORT'?'BASH_EGRESS_PORT':'BASH_EGRESS_REQUEST');
   let u;try{u=new URL(/** @type {string} */(c.url));}catch{return refuse('BASH_EGRESS_REQUEST');}
   if(u.username||u.password)return refuse('BASH_EGRESS_REQUEST');
   const port=u.port?Number(u.port):u.protocol==='https:'||u.protocol==='wss:'?443:80;
   return admit({host:u.hostname,port},options);
  },
  /** One SOCKS5 CONNECT. @param {{host:string,port:number}} destination @param {{signal?:AbortSignal}} [options] */
  admitSocks(destination,options){return admit(destination,options);},
  revoke(){revoked=true;return Object.freeze({revoked:true});},
 });
}
/** The system resolver as the controlled resolver: every A and AAAA answer, in resolver order. On the worker this is
 * the VPC resolver; qualification records which resolver served the run. @type {Resolver} */
export async function systemResolver(name){
 const answers=await lookup(name,{all:true,verbatim:true});
 return answers.map(a=>a.address);
}
/** Starts the run's Bash egress proxy on loopback and returns the trusted runtime fact `bash-sandbox.mjs` consumes
 * (`{schema,httpProxyPort,socksProxyPort,domainsSha256}`) with the proxy handle. Called by the runtime preparation
 * owner only when the effective policy names at least one domain; the handle must be closed when the run settles.
 * @param {{domains:readonly string[],expiresAtMs:number,now?:()=>number,resolve?:Resolver,dial?:Parameters<typeof startEgressProxy>[0]['dial'],onDecision?:Parameters<typeof startEgressProxy>[0]['onDecision']}} input */
export async function startBashEgress({domains,expiresAtMs,now=Date.now,resolve=systemResolver,dial,onDecision}){
 const allow=assertBashEgressDomains(domains);if(!allow.length)fail('BASH_EGRESS_CONFIGURATION');
 const control=createBashEgressControl({domains:allow,resolve,now,expiresAtMs});
 const proxy=await startEgressProxy({control,httpPort:0,socksPort:0,...(dial?{dial}:{}),...(onDecision?{onDecision}:{})});
 const fact=Object.freeze({schema:BASH_EGRESS_SCHEMA,httpProxyPort:proxy.ports.http,socksProxyPort:/** @type {number} */(proxy.ports.socks),domainsSha256:control.domainsSha256});
 return Object.freeze({fact,proxy});
}
