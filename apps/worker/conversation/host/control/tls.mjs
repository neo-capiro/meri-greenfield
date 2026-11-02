/** Shared strict mTLS material checks. Certificates are supplied by the runtime credential owner, never read
 * from environment, arbitrary paths, run data or tool inputs by this module. */
import {X509Certificate} from 'node:crypto';
import {privateAddress as sharedPrivateAddress,dnsName as sharedDnsName,sha256Der} from '../../../../../packages/contracts/native-tls-kernel.mjs';
export {sha256Der};

const HEX=/^[0-9a-f]{64}$/u;
const DNS=/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/u;
const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_TLS_REFUSED'),{code:'HOST_CONTROL_TLS_REFUSED'});};
const HOST_LEAF_MAX_LIFETIME_MS=900000;
/** Control's two identities toward provisioned hosts are rendered leaves pinned by exact DER fingerprint in every host's
 * bootstrap spec, so they are checked against their own bound instead of the 15-minute bound of the per-run leaves the
 * issuer mints for hosts: `client`, the Control client leaf of the router, viewer and lifecycle calls (rendered for at most
 * 31 days and rotated by re-rendering control and worker together), and `server`, the control-private server leaf of the
 * host-currentness listener (the reviewed server-CA leaf, up to the public-TLS 398-day ceiling). */
export const PINNED_CONTROL_LIFETIME_MS=Object.freeze({client:31*86400000,server:398*86400000});

export function privateAddress(value){return sharedPrivateAddress(value,{allowLoopback:true});}
export function dnsName(value){return sharedDnsName(value);}
export function fingerprint(value){if(typeof value!=='string'||!HEX.test(value))fail();return value;}
export function tlsBytes(value){if(!Buffer.isBuffer(value)||value.length<1||value.length>131072)fail();return Buffer.from(value);}

/** Require an exact DNS SAN (never CN fallback), a bounded lifetime and a current validity window. The bound is the
 * 15-minute host-leaf bound unless the caller names which pinned Control identity it checks (`pinnedControl`: 'client'
 * or 'server'); `maxLifetimeMs` may only narrow that bound, never widen it. */
export function checkedCertificate(raw,{name,nowMs,pinnedControl,maxLifetimeMs,notAfterMs=Infinity,fingerprintSha256}={}){
 let cert;try{cert=new X509Certificate(raw);}catch{fail();}
 if(pinnedControl!==undefined&&!(typeof pinnedControl==='string'&&Object.hasOwn(PINNED_CONTROL_LIFETIME_MS,pinnedControl)))fail();
 const limit=pinnedControl===undefined?HOST_LEAF_MAX_LIFETIME_MS:PINNED_CONTROL_LIFETIME_MS[pinnedControl];
 maxLifetimeMs??=limit;
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!Number.isSafeInteger(maxLifetimeMs)||maxLifetimeMs<1||
  maxLifetimeMs>limit||dnsName(name)!==cert.checkHost(name,{subject:'never'})||
  cert.subjectAltName!==`DNS:${name}`)fail();
 const from=Date.parse(cert.validFrom),until=Date.parse(cert.validTo);
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(until)||from>nowMs||until<=nowMs||
  until-from>maxLifetimeMs||until>notAfterMs)fail();
 const observed=sha256Der(cert.raw);
 if(fingerprintSha256!==undefined&&observed!==fingerprint(fingerprintSha256))fail();
 return Object.freeze({fingerprintSha256:observed,notAfterMs:until});
}
