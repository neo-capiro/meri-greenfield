/** ONE pure TLS/DER kernel shared by the Control TLS checks and the native bootstrap contract. No I/O. */
import {createHash,X509Certificate} from 'node:crypto';
import {isIP} from 'node:net';
const DNS=/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/u;
const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_TLS_REFUSED'),{code:'HOST_CONTROL_TLS_REFUSED'});};
export function privateAddress(value,{allowLoopback=false}={}){
 if(typeof value!=='string'||isIP(value)!==4)fail();
 const o=value.split('.').map(Number);
 if(!(o[0]===10||o[0]===172&&o[1]>=16&&o[1]<=31||o[0]===192&&o[1]===168||(allowLoopback&&value==='127.0.0.1')))fail();
 return value;
}
export function dnsName(value){if(typeof value!=='string'||!DNS.test(value)||value.includes('..')||value.startsWith('*.'))fail();return value;}
export function sha256Der(raw){if(!Buffer.isBuffer(raw)||!raw.length)fail();return createHash('sha256').update(raw).digest('hex');}
export function canonicalCertificatePem(value,max=8192){
 if(typeof value!=='string'||Buffer.byteLength(value,'ascii')>max) fail();
 const blocks=[...value.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n?/gu)];
 if(blocks.length!==1||blocks[0][0]!==value) fail();
 let cert;try{cert=new X509Certificate(value);}catch{fail();}
 if(cert.toString().replace(/\r\n/gu,'\n')!==value.replace(/\r\n/gu,'\n'))fail();
 return cert;
}
