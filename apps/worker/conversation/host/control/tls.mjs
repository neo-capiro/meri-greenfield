/** Shared strict mTLS material checks. Certificates are supplied by the runtime credential owner, never read
 * from environment, arbitrary paths, run data or tool inputs by this module. */
import {createHash,X509Certificate} from 'node:crypto';
import {isIP} from 'node:net';

const HEX=/^[0-9a-f]{64}$/u;
const DNS=/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/u;
const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_TLS_REFUSED'),{code:'HOST_CONTROL_TLS_REFUSED'});};
export const MAX_CERT_LIFETIME_MS=900000;

export function privateAddress(value){
 if(typeof value!=='string'||isIP(value)!==4)fail();
 const octets=value.split('.').map(Number);
 if(!(octets[0]===10||octets[0]===172&&octets[1]>=16&&octets[1]<=31||
  octets[0]===192&&octets[1]===168||value==='127.0.0.1'))fail();
 return value;
}
export function dnsName(value){if(typeof value!=='string'||!DNS.test(value)||value.includes('..')||value.startsWith('*.'))fail();return value;}
export function sha256Der(raw){if(!Buffer.isBuffer(raw)||!raw.length)fail();return createHash('sha256').update(raw).digest('hex');}
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
