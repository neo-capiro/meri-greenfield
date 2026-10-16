/** Bounded X.509 v3 task leaf issuer from a reviewed, owner-only RSA CA pair.
 * Inert until constructed with material. No key generation, subprocess or AWS
 * credential is used. The runner generated CSR supplies only its public key;
 * this owner chooses the exact task SAN and expiry. */
import {X509Certificate,createPrivateKey,createPublicKey,randomBytes,sign} from 'node:crypto';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret} from '../config.mjs';
import {parseRunnerPoststartCsr} from './runner-poststart-csr.mjs';
import {assertRunnerPeerCertificate} from './runner-tls-client.mjs';
const fail=()=>{throw Object.assign(Error('RUNNER_POSTSTART_CERT_REFUSED'),{code:'RUNNER_POSTSTART_CERT_REFUSED'});};
function len(n){if(n<128)return Buffer.from([n]);if(n<256)return Buffer.from([0x81,n]);if(n<65536)return Buffer.from([0x82,n>>8,n&255]);fail();}
const tlv=(tag,...parts)=>{const bytes=Buffer.concat(parts);return Buffer.concat([Buffer.from([tag]),len(bytes.length),bytes]);};
function element(bytes,offset){if(offset>=bytes.length)fail();const tag=bytes[offset++],first=bytes[offset++];if(first===undefined)fail();let size=first;if(first&128){const n=first&127;if(n<1||n>2||offset+n>bytes.length||bytes[offset]===0)fail();size=0;for(let j=0;j<n;j++)size=size*256+bytes[offset++];if(size<128||n===2&&size<256)fail();}const end=offset+size;if(end>bytes.length)fail();return {tag,start:offset,end,next:end,full:bytes.subarray(offset-(first&128?2+(first&127):2),end)};}
function parts(bytes,parent){const out=[];for(let offset=parent.start;offset<parent.end;){const e=element(bytes,offset);out.push(e);offset=e.next;}if(out.at(-1)?.next!==parent.end)fail();return out;}
function caSubject(raw){const certificate=element(raw,0);if(certificate.tag!==0x30||certificate.next!==raw.length)fail();const [tbs]=parts(raw,certificate);if(tbs.tag!==0x30)fail();const fields=parts(raw,tbs),shift=fields[0]?.tag===0xa0?1:0,subject=fields[4+shift];if(subject?.tag!==0x30)fail();return Buffer.from(subject.full);}
const algorithm=tlv(0x30,Buffer.from('06092a864886f70d01010b0500','hex'));
const oid=value=>tlv(0x06,Buffer.from(value,'hex'));
const boolean=Buffer.from([0x01,0x01,0xff]);
const extension=(name,inner,critical=false)=>tlv(0x30,oid(name),...(critical?[boolean]:[]),tlv(0x04,inner));
function clock(value){const d=new Date(value),iso=d.toISOString();if(!Number.isSafeInteger(value)||d.getUTCFullYear()<2020||d.getUTCFullYear()>=2050)return fail();return tlv(0x17,Buffer.from(iso.slice(2,4)+iso.slice(5,7)+iso.slice(8,10)+iso.slice(11,13)+iso.slice(14,16)+iso.slice(17,19)+'Z'));}
function certificatePem(bytes){return `-----BEGIN CERTIFICATE-----\n${bytes.toString('base64').match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`;}
function signer({caPem,keyPem,now=Date.now,serialBytes=randomBytes}){
 try{
  if(!Buffer.isBuffer(caPem)||caPem.length<1||caPem.length>16384||!Buffer.isBuffer(keyPem)||keyPem.length<1||keyPem.length>32768||typeof now!=='function')fail();
  const ca=new X509Certificate(caPem),key=createPrivateKey(keyPem),details=key.asymmetricKeyDetails;
  if(!ca.ca||key.asymmetricKeyType!=='rsa'||details.modulusLength<2048||details.modulusLength>4096||details.publicExponent!==65537n||!createPublicKey(key).export({type:'spki',format:'der'}).equals(ca.publicKey.export({type:'spki',format:'der'}))||!ca.checkIssued(ca)||!ca.verify(ca.publicKey))fail();
  const issuer=caSubject(ca.raw),caFrom=Date.parse(ca.validFrom),caUntil=Date.parse(ca.validTo);
  return Object.freeze({async issue(value){const v=own(value,['csrPem','taskName','notAfterMs'],['signal']);nativeSignal(v.signal);const at=now();
   if(v.signal?.aborted||!Number.isSafeInteger(at)||!Number.isSafeInteger(v.notAfterMs)||v.notAfterMs<=at+1000||v.notAfterMs>at+7*86400000||at<caFrom||v.notAfterMs>caUntil||typeof v.taskName!=='string'||v.taskName.length>220||! /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/u.test(v.taskName))fail();
   const csr=parseRunnerPoststartCsr(v.csrPem),notBefore=Math.max(caFrom,Math.floor((at-1000)/1000)*1000),notAfter=Math.floor(v.notAfterMs/1000)*1000;
   if(notAfter<=at)fail();const sampled=serialBytes(16);if(!Buffer.isBuffer(sampled)||sampled.length!==16)fail();
   const serial=Buffer.from(sampled);serial[0]=(serial[0]&0x7f)||1; // Positive, minimal DER INTEGER.
   const subject=tlv(0x30,tlv(0x31,tlv(0x30,oid('550403'),tlv(0x0c,Buffer.from(v.taskName)))));
   const san=tlv(0x30,tlv(0x82,Buffer.from(v.taskName,'ascii')));
   const extensions=tlv(0xa3,tlv(0x30,
    extension('551d13',tlv(0x30),true),
    extension('551d0f',Buffer.from('030205a0','hex'),true),
    extension('551d25',tlv(0x30,oid('2b06010505070301'))),
    extension('551d11',san)));
   const tbs=tlv(0x30,tlv(0xa0,Buffer.from([0x02,0x01,0x02])),tlv(0x02,serial),algorithm,issuer,tlv(0x30,clock(notBefore),clock(notAfter)),subject,csr.spki,extensions);
   const signature=sign('sha256',tbs,key),certPem=certificatePem(tlv(0x30,tbs,algorithm,tlv(0x03,Buffer.from([0]),signature)));
   const leaf=new X509Certificate(certPem);assertRunnerPeerCertificate({certificate:leaf,taskName:v.taskName,nowMs:at,expiresAtMs:v.notAfterMs});
   if(!leaf.checkIssued(ca)||!leaf.verify(ca.publicKey)||!leaf.publicKey.export({type:'spki',format:'der'}).equals(csr.spki)||v.signal?.aborted)fail();
   return Object.freeze({certPem});
  }});
 }catch{fail();}
}
/** Trusted synthetic test seam, never selected by request data. */
export function createRunnerPoststartCertificateIssuerFromMaterial(configuration){return signer(own(configuration,['caPem','keyPem'],['now','serialBytes']));}
export async function createRunnerPoststartCertificateIssuer(configuration){
 const c=own(configuration,['caCertFile','caKeyFile'],['now']);
 const [caPem,keyPem]=await Promise.all([readSecret(c.caCertFile),readSecret(c.caKeyFile)]);
 return signer({caPem,keyPem,now:c.now??Date.now});
}
