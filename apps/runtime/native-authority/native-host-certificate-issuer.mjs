/** Protected native host certificate issuer. It reuses the reviewed CSR/proof mechanics and the bounded DER signer shape of
 *  the runner poststart issuer, but the two native identities are deliberately SEPARATE: the host client leaf carries ONLY
 *  clientAuth and the exact hostClientDnsName; the host server leaf carries ONLY serverAuth and the exact endpoint SAN. There is
 *  no dual-purpose certificate, no CN fallback and no broadening of the requested name.
 */
import {X509Certificate,createPrivateKey,createPublicKey,randomBytes,sign} from 'node:crypto';
import {parseRunnerPoststartCsr,verifyRunnerPoststartProof} from './runner-poststart-csr.mjs';
import {nativeObserverDeadline} from '../../../packages/contracts/native-observer.mjs';
const fault=code=>{throw Object.assign(new Error(code),{code});};
const REFUSED='NATIVE_HOST_CERT_REFUSED';
const MAX_LIFETIME_MS=900000;
const EKU=Object.freeze({client:'2b06010505070302',server:'2b06010505070301'});
const EKU_OID='551d25';
function len(n){if(n<128)return Buffer.from([n]);if(n<256)return Buffer.from([0x81,n]);if(n<65536)return Buffer.from([0x82,n>>8,n&255]);fault(REFUSED);}
const tlv=(tag,...parts)=>{const bytes=Buffer.concat(parts);return Buffer.concat([Buffer.from([tag]),len(bytes.length),bytes]);};
const oid=value=>tlv(0x06,Buffer.from(value,'hex'));
const extension=(name,inner,critical=false)=>tlv(0x30,oid(name),...(critical?[Buffer.from([0x01,0x01,0xff])]:[]),tlv(0x04,inner));
const algorithm=tlv(0x30,Buffer.from('06092a864886f70d01010b0500','hex'));
function item(bytes,at){if(at>=bytes.length)fault(REFUSED);const tag=bytes[at++],first=bytes[at++];if(first===undefined)fault(REFUSED);
 let size=first;if(first&128){const n=first&127;if(n<1||n>2||at+n>bytes.length||bytes[at]===0)fault(REFUSED);size=0;
  for(let i=0;i<n;i++)size=size*256+bytes[at++];if(size<128||n===2&&size<256)fault(REFUSED);}
 const end=at+size;if(end>bytes.length)fault(REFUSED);return {tag,start:at,end,next:end};}
function children(bytes,parent){const out=[];for(let at=parent.start;at<parent.end;){const child=item(bytes,at);out.push(child);at=child.next;}
 if(out.length===0||out.at(-1).next!==parent.end)fault(REFUSED);return out;}
const outer=bytes=>{const root=item(bytes,0);if(root.tag!==0x30||root.next!==bytes.length)fault(REFUSED);return root;};
/** Re-emit the CA subject as a complete TLV so children are signed under the real issuer name. */
const caSubject=raw=>{const tbs=children(raw,outer(raw))[0];if(tbs.tag!==0x30)fault(REFUSED);
 const fields=children(raw,tbs),shift=fields[0]?.tag===0xa0?1:0,subject=fields[4+shift];
 if(subject?.tag!==0x30)fault(REFUSED);return tlv(0x30,Buffer.from(raw.subarray(subject.start,subject.end)));};
function clock(value){const d=new Date(value);if(!Number.isSafeInteger(value)||d.getUTCFullYear()<2020||d.getUTCFullYear()>=2050)fault(REFUSED);
 return tlv(0x17,Buffer.from(d.toISOString().replace(/[-:T]/gu,'').slice(2,14)+'Z'));}
const pem=bytes=>`-----BEGIN CERTIFICATE-----\n${bytes.toString('base64').match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`;

/** Exact single-DNS SAN and kind validation. The name comes from protected configuration, never from a request. */
export function assertNativeHostLeafRequest({kind,san,notAfterMs,nowMs,leaseDeadlineMs,cleanupCeilingMs}){
 if(typeof EKU[kind]!=='string'||typeof san!=='string'||!worldName(san)||san.length>220)fault(REFUSED);
 if(!Number.isSafeInteger(leaseDeadlineMs)||leaseDeadlineMs<=nowMs||cleanupCeilingMs!==undefined&&
  (kind!=='server'||cleanupCeilingMs!==nativeObserverDeadline(leaseDeadlineMs)))fault(REFUSED);
 const ceiling=cleanupCeilingMs??leaseDeadlineMs;
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(notAfterMs)||notAfterMs<=nowMs||
  notAfterMs-nowMs>MAX_LIFETIME_MS||notAfterMs>ceiling)fault(REFUSED);
 return Object.freeze({kind,eku:EKU[kind],san,notAfterMs,ceiling});
}
const worldName=s=>/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(s);

/** Read the EKU OIDs actually present in the issued DER (never a "true" fallback). */
function ekuOf(raw){
 const tbs=children(raw,outer(raw))[0],fields=children(raw,tbs),extensionsField=fields.at(-1);
 if(extensionsField?.tag!==0xa3)fault(REFUSED);
 const found=[];
 for(const entry of children(raw,children(raw,extensionsField)[0])){
  const parts=children(raw,entry);
  if(parts[0]?.tag!==0x06||raw.subarray(parts[0].start,parts[0].end).toString('hex')!==EKU_OID)continue;
  const value=parts.at(-1);if(value?.tag!==0x04)fault(REFUSED);
  const sequence=item(raw,value.start);if(sequence.tag!==0x30)fault(REFUSED);
  const list=children(raw,sequence);
  found.push(...list.map(o=>{if(o.tag!==0x06)fault(REFUSED);return raw.subarray(o.start,o.end).toString('hex');}));
 }
 return found;
}

function signer({caPem,keyPem,now=Date.now,serialBytes=randomBytes}){
 if(!Buffer.isBuffer(caPem)||caPem.length<1||caPem.length>16384||!Buffer.isBuffer(keyPem)||keyPem.length<1||keyPem.length>32768)
  fault(REFUSED);
 const ca=new X509Certificate(caPem),key=createPrivateKey(keyPem),details=key.asymmetricKeyDetails;
 if(!ca.ca||key.asymmetricKeyType!=='rsa'||details.modulusLength<2048||details.modulusLength>4096||
  details.publicExponent!==65537n||!createPublicKey(key).export({type:'spki',format:'der'})
  .equals(ca.publicKey.export({type:'spki',format:'der'})))fault(REFUSED);
 const issuer=caSubject(ca.raw),caFrom=Date.parse(ca.validFrom),caUntil=Date.parse(ca.validTo);
 return Object.freeze({async issue(value){
  const v=value??{},at=now();
  if(v.signal?.aborted===true)fault(REFUSED);
  if(v.deadlineMs!==undefined&&(!Number.isSafeInteger(v.deadlineMs)||at>=v.deadlineMs))fault(REFUSED);
  const request=assertNativeHostLeafRequest({kind:v.kind,san:v.san,notAfterMs:v.notAfterMs,nowMs:at,
   leaseDeadlineMs:v.leaseDeadlineMs??v.notAfterMs,cleanupCeilingMs:v.cleanupCeilingMs});
  if(at<caFrom||request.notAfterMs>caUntil)fault(REFUSED);
  let csr;
  try{csr=parseRunnerPoststartCsr(v.csrPem);
   if(v.proof!==undefined)verifyRunnerPoststartProof({csrPem:v.csrPem,message:v.proof.message,proofBase64:v.proof.proofBase64});
  }catch{fault(REFUSED);}
  const notBefore=Math.max(caFrom,Math.floor((at-1000)/1000)*1000);
  // The TOTAL DER lifetime is bounded, including the 1s backdate: clamp the expiry to notBefore+900000.
  const notAfter=Math.min(Math.floor(request.notAfterMs/1000)*1000,notBefore+MAX_LIFETIME_MS);
  if(v.cleanupCeilingMs!==undefined&&notAfter<=v.leaseDeadlineMs)fault(REFUSED);
  if(notAfter<=at||notAfter-notBefore>MAX_LIFETIME_MS)fault(REFUSED);
  const sampled=serialBytes(16);if(!Buffer.isBuffer(sampled)||sampled.length!==16)fault(REFUSED);
  const serial=Buffer.from(sampled);serial[0]=(serial[0]&0x7f)||1;
  // Empty subject: identity is carried ONLY by the single SAN, so no CN can be read as a fallback.
  const san=tlv(0x30,tlv(0x82,Buffer.from(request.san,'ascii')));
  const extensions=tlv(0xa3,tlv(0x30,extension('551d13',tlv(0x30),true),
   extension('551d0f',Buffer.from('030205a0','hex'),true),extension(EKU_OID,tlv(0x30,oid(request.eku))),
   extension('551d11',san)));
  const tbs=tlv(0x30,tlv(0xa0,Buffer.from([0x02,0x01,0x02])),tlv(0x02,serial),algorithm,issuer,
   tlv(0x30,clock(notBefore),clock(notAfter)),tlv(0x30),csr.spki,extensions);
  const certPem=pem(tlv(0x30,tbs,algorithm,tlv(0x03,Buffer.from([0]),sign('sha256',tbs,key))));
  const leaf=new X509Certificate(certPem),raw=leaf.raw;
  if(!leaf.checkIssued(ca)||!leaf.verify(ca.publicKey)||
   !leaf.publicKey.export({type:'spki',format:'der'}).equals(csr.spki))fault(REFUSED);
  if(leaf.subject!==''||leaf.subjectAltName!==`DNS:${request.san}`)fault(REFUSED);
  const ekus=ekuOf(raw);
  if(ekus.length!==1||ekus[0]!==request.eku)fault(REFUSED);
  const validFrom=Date.parse(leaf.validFrom),validTo=Date.parse(leaf.validTo);
  if(!(validFrom<=at&&validTo===notAfter&&validTo<=request.ceiling&&validTo-validFrom<=MAX_LIFETIME_MS))fault(REFUSED);
  if(v.signal?.aborted===true||(v.deadlineMs!==undefined&&now()>=v.deadlineMs))fault(REFUSED);   // no release after abort
  return Object.freeze({certPem});
 }});
}
export function createNativeHostCertificateIssuerFromMaterial(configuration){
 const c=configuration??{};
 if(c.caPem===undefined||c.keyPem===undefined)fault(REFUSED);
 return signer({caPem:Buffer.from(c.caPem),keyPem:Buffer.from(c.keyPem),now:c.now??Date.now,serialBytes:c.serialBytes??randomBytes});
}
export async function createNativeHostCertificateIssuer(configuration){
 const c=configuration??{};
 if(typeof c.caCertFile!=='string'||typeof c.caKeyFile!=='string')fault(REFUSED);
 const {readSecret}=await import('../config.mjs');   // protected reader: loaded only by the production factory
 const [caPem,keyPem]=await Promise.all([readSecret(c.caCertFile),readSecret(c.caKeyFile)]);
 return signer({caPem,keyPem,now:c.now??Date.now});
}
