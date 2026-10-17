/** Bounded Temporal service-task mTLS client leaf from an owner-only RSA CA.
 * The CSR supplies only a proven public key. A separate authenticated bootstrap
 * owner must supply the actual ECS task ARN, role CN and role URI base. This
 * module does not register tasks, authorize callers or provision key material. */
import {X509Certificate, createHash, createPrivateKey, createPublicKey, randomBytes, sign} from 'node:crypto';
import {types} from 'node:util';
import {verifyRunnerPoststartProof} from '../native-authority/runner-poststart-csr.mjs';

const refused=()=>{throw Object.assign(Error('TEMPORAL_SERVICE_CERT_REFUSED'),{code:'TEMPORAL_SERVICE_CERT_REFUSED'});};
const TASK_ARN=/^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u;
const SUBJECT=/^[A-Za-z0-9._:-]{1,128}$/u;
const URI_BASE=/^spiffe:\/\/[a-z0-9.-]+\/[A-Za-z0-9/_-]+\/$/u;
const ALGORITHM=Buffer.from('300d06092a864886f70d01010b0500','hex');
const CRITICAL=Buffer.from([0x01,0x01,0xff]);

function own(value,required,optional=[]){
 if(!value||typeof value!=='object'||Array.isArray(value)||types.isProxy(value)||
    Object.getPrototypeOf(value)!==Object.prototype||
    Reflect.ownKeys(value).some(key=>!required.includes(key)&&!optional.includes(key))||
    required.some(key=>!Object.hasOwn(value,key))||
    Reflect.ownKeys(value).some(key=>!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value')))refused();
 return value;
}
function length(n){if(n<128)return Buffer.from([n]);if(n<256)return Buffer.from([0x81,n]);if(n<65536)return Buffer.from([0x82,n>>8,n&255]);refused();}
function der(tag,...parts){const bytes=Buffer.concat(parts);return Buffer.concat([Buffer.from([tag]),length(bytes.length),bytes]);}
function element(bytes,at){
 if(at>=bytes.length)refused();const start=at,tag=bytes[at++],first=bytes[at++];if(first===undefined)refused();
 let size=first;if(first&128){const count=first&127;if(count<1||count>2||at+count>bytes.length||bytes[at]===0)refused();
  size=0;for(let i=0;i<count;i++)size=size*256+bytes[at++];if(size<128||count===2&&size<256)refused();}
 const end=at+size;if(end>bytes.length)refused();return {tag,start:at,end,next:end,full:bytes.subarray(start,end)};
}
function children(bytes,parent){const values=[];for(let at=parent.start;at<parent.end;){const child=element(bytes,at);values.push(child);at=child.next;}
 if(values.at(-1)?.next!==parent.end)refused();return values;}
function caSubject(raw){
 const certificate=element(raw,0);if(certificate.tag!==0x30||certificate.next!==raw.length)refused();
 const [tbs]=children(raw,certificate);if(tbs?.tag!==0x30)refused();
 const fields=children(raw,tbs),shift=fields[0]?.tag===0xa0?1:0,subject=fields[4+shift];
 if(subject?.tag!==0x30)refused();return Buffer.from(subject.full);
}
function caCanSign(raw){
 const outer=element(raw,0),[tbs]=children(raw,outer),fields=children(raw,tbs);
 const extensions=fields.find(field=>field.tag===0xa3);if(!extensions)refused();
 const [sequence]=children(raw,extensions);if(sequence?.tag!==0x30)refused();
 const keyUsage=children(raw,sequence).filter(field=>{
  if(field.tag!==0x30)refused();const [name]=children(raw,field);
  return name?.tag===0x06&&raw.subarray(name.start,name.end).equals(Buffer.from('551d0f','hex'));
 });
 if(keyUsage.length!==1)refused();
 const values=children(raw,keyUsage[0]),last=values.at(-1);
 if(last?.tag!==0x04)refused();
 const bits=element(raw.subarray(last.start,last.end),0);
 if(bits.tag!==0x03||bits.next!==last.end-last.start||bits.end-bits.start!==2||
    (raw[last.start+bits.start+1]&0x04)===0)refused();
}
const oid=hex=>der(0x06,Buffer.from(hex,'hex'));
const extension=(name,value,critical=false)=>der(0x30,oid(name),...(critical?[CRITICAL]:[]),der(0x04,value));
function utcTime(value){
 if(!Number.isSafeInteger(value))refused();const date=new Date(value);
 if(date.getUTCFullYear()<2020||date.getUTCFullYear()>=2050)refused();
 const iso=date.toISOString();return der(0x17,Buffer.from(iso.slice(2,4)+iso.slice(5,7)+iso.slice(8,10)+
  iso.slice(11,13)+iso.slice(14,16)+iso.slice(17,19)+'Z','ascii'));
}
function pem(bytes){return `-----BEGIN CERTIFICATE-----\n${bytes.toString('base64').match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`;}

function assertIssued({leaf,ca,csr,serial,peerSanUri,peerSubjectCn,nowMs,expiresAtMs,expectedExtensions}){
 const from=Date.parse(leaf.validFrom),until=Date.parse(leaf.validTo);
 if(leaf.ca||leaf.subject!==`CN=${peerSubjectCn}`||leaf.subjectAltName!==`URI:${peerSanUri}`||
    leaf.keyUsage?.length!==1||leaf.keyUsage[0]!=='1.3.6.1.5.5.7.3.2'||
    !Number.isSafeInteger(from)||!Number.isSafeInteger(until)||from>nowMs||until<=nowMs||until!==expiresAtMs||
    !leaf.checkIssued(ca)||!leaf.verify(ca.publicKey)||
    !leaf.publicKey.export({type:'spki',format:'der'}).equals(csr.spki)||
    leaf.serialNumber!==serial.toString('hex').toUpperCase())refused();
 const outer=element(leaf.raw,0);if(outer.tag!==0x30||outer.next!==leaf.raw.length)refused();
 const [tbs]=children(leaf.raw,outer),fields=children(leaf.raw,tbs);
 if(fields.length!==8||fields[0].tag!==0xa0||fields[1].tag!==0x02||
    !leaf.raw.subarray(fields[1].start,fields[1].end).equals(serial)||
    !fields[7].full.equals(expectedExtensions))refused();
}

/** No file or network access. The caller retains and can wipe its source PEM
 * buffers after import. close() drops our KeyObject reference; Node cannot
 * prove physical KeyObject zeroization or the time at which GC retires it. */
export function createTemporalServiceClientCertificateIssuerFromMaterial(configuration){
 try{
  const c=own(configuration,['caPem','keyPem','caSha256'],['now','serialBytes']);
  if(!Buffer.isBuffer(c.caPem)||c.caPem.length<1||c.caPem.length>16384||
     !Buffer.isBuffer(c.keyPem)||c.keyPem.length<1||c.keyPem.length>32768||
     typeof c.caSha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.caSha256)||
     c.now!==undefined&&typeof c.now!=='function'||c.serialBytes!==undefined&&typeof c.serialBytes!=='function')refused();
  const ca=new X509Certificate(c.caPem);let key=createPrivateKey(c.keyPem);
  const details=key.asymmetricKeyDetails;
  if(createHash('sha256').update(ca.raw).digest('hex')!==c.caSha256)refused();
  if(!ca.ca||key.asymmetricKeyType!=='rsa'||details.modulusLength<2048||details.modulusLength>4096||
     details.publicExponent!==65537n||
     !createPublicKey(key).export({type:'spki',format:'der'}).equals(ca.publicKey.export({type:'spki',format:'der'}))||
     !ca.checkIssued(ca)||!ca.verify(ca.publicKey))refused();
  caCanSign(ca.raw);
  const issuer=caSubject(ca.raw),caFrom=Date.parse(ca.validFrom),caUntil=Date.parse(ca.validTo);
  if(!Number.isSafeInteger(caFrom)||!Number.isSafeInteger(caUntil)||caFrom>=caUntil)refused();
  const now=c.now??Date.now,serialBytes=c.serialBytes??randomBytes,caSha256=c.caSha256;let closed=false;
  return Object.freeze({
   caSha256,
   close(){closed=true;key=null;},
   async issue(value){
    try{
     const v=own(value,['csrPem','proofMessage','proofBase64','taskArn','peerSubjectCn','peerUriBase','notAfterMs'],['signal']);
     const at=now();if(closed||v.signal!==undefined&&!(v.signal instanceof AbortSignal)||v.signal?.aborted||!Number.isSafeInteger(at)||
       !Number.isSafeInteger(v.notAfterMs)||v.notAfterMs<=at+1000||v.notAfterMs>at+3600000||
       at<caFrom||v.notAfterMs>caUntil||typeof v.taskArn!=='string'||!TASK_ARN.test(v.taskArn)||
       typeof v.peerSubjectCn!=='string'||!SUBJECT.test(v.peerSubjectCn)||
       typeof v.peerUriBase!=='string'||!URI_BASE.test(v.peerUriBase)||v.peerUriBase.length>220)refused();
     const csr=verifyRunnerPoststartProof({csrPem:v.csrPem,message:v.proofMessage,proofBase64:v.proofBase64});
     const peerSanUri=v.peerUriBase+encodeURIComponent(v.taskArn);
     const notBefore=Math.max(caFrom,Math.floor((at-1000)/1000)*1000);
     const expiresAtMs=Math.floor(v.notAfterMs/1000)*1000;if(expiresAtMs<=at)refused();
     const sampled=serialBytes(16);if(!Buffer.isBuffer(sampled)||sampled.length!==16)refused();
     const serial=Buffer.from(sampled);serial[0]=(serial[0]&0x7f)||1;
     const subject=der(0x30,der(0x31,der(0x30,oid('550403'),der(0x0c,Buffer.from(v.peerSubjectCn,'utf8')))));
     const extensions=der(0xa3,der(0x30,
      extension('551d13',der(0x30),true), // basicConstraints: CA=false
      extension('551d0f',Buffer.from('03020780','hex'),true), // digitalSignature only
      extension('551d25',der(0x30,oid('2b06010505070302'))), // clientAuth only
      extension('551d11',der(0x30,der(0x86,Buffer.from(peerSanUri,'ascii'))))));
     const tbs=der(0x30,der(0xa0,Buffer.from([0x02,0x01,0x02])),der(0x02,serial),ALGORITHM,issuer,
      der(0x30,utcTime(notBefore),utcTime(expiresAtMs)),subject,csr.spki,extensions);
     if(closed||key===null||v.signal?.aborted)refused();
     const signature=sign('sha256',tbs,key),certPem=pem(der(0x30,tbs,ALGORITHM,der(0x03,Buffer.from([0]),signature)));
     const leaf=new X509Certificate(certPem);
     assertIssued({leaf,ca,csr,serial,peerSanUri,peerSubjectCn:v.peerSubjectCn,nowMs:at,expiresAtMs,expectedExtensions:extensions});
     if(closed||v.signal?.aborted)refused();
     return Object.freeze({certPem,certificateSha256:createHash('sha256').update(leaf.raw).digest('hex'),
      expiresAtMs,peerSanUri});
    }catch{refused();}
   },
  });
 }catch{refused();}
}
