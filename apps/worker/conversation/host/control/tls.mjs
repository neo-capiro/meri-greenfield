/** Shared strict mTLS material checks. Certificates are supplied by the runtime credential owner, never read
 * from environment, arbitrary paths, run data or tool inputs by this module. */
import {X509Certificate} from 'node:crypto';
import {privateAddress as sharedPrivateAddress,dnsName as sharedDnsName,sha256Der} from '../../../../../packages/contracts/native-tls-kernel.mjs';
export {sha256Der};

const HEX=/^[0-9a-f]{64}$/u;
const DNS=/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/u;
const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_TLS_REFUSED'),{code:'HOST_CONTROL_TLS_REFUSED'});};
export const MAX_CERT_LIFETIME_MS=900000;

export function privateAddress(value){return sharedPrivateAddress(value,{allowLoopback:true});}
export function dnsName(value){return sharedDnsName(value);}
export function fingerprint(value){if(typeof value!=='string'||!HEX.test(value))fail();return value;}
export function tlsBytes(value){if(!Buffer.isBuffer(value)||value.length<1||value.length>131072)fail();return Buffer.from(value);}

/** Require an exact DNS SAN (never CN fallback), a short lifetime and a current validity window. */
export function checkedCertificate(raw,{name,nowMs,maxLifetimeMs=MAX_CERT_LIFETIME_MS,notAfterMs=Infinity,fingerprintSha256}={}){
 let cert;try{cert=new X509Certificate(raw);}catch{fail();}
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!Number.isSafeInteger(maxLifetimeMs)||maxLifetimeMs<1||
  maxLifetimeMs>MAX_CERT_LIFETIME_MS||dnsName(name)!==cert.checkHost(name,{subject:'never'})||
  cert.subjectAltName!==`DNS:${name}`)fail();
 const from=Date.parse(cert.validFrom),until=Date.parse(cert.validTo);
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(until)||from>nowMs||until<=nowMs||
  until-from>maxLifetimeMs||until>notAfterMs)fail();
 const observed=sha256Der(cert.raw);
 if(fingerprintSha256!==undefined&&observed!==fingerprint(fingerprintSha256))fail();
 return Object.freeze({fingerprintSha256:observed,notAfterMs:until});
}
