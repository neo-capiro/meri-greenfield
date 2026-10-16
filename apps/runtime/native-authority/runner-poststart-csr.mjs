/** Small, closed PKCS#10 RSA CSR for an ephemeral task-local server key. The CSR
 * is signed, and a separate server nonce must be signed by the same key. */
import {createPublicKey,generateKeyPairSync,sign,verify} from 'node:crypto';
const fail=()=>{throw Object.assign(Error('RUNNER_POSTSTART_REFUSED'),{code:'RUNNER_POSTSTART_REFUSED'});};
const sequence=Buffer.from([0x30,0]);
function length(n){if(n<128)return Buffer.from([n]);if(n<256)return Buffer.from([0x81,n]);if(n<65536)return Buffer.from([0x82,n>>8,n&255]);fail();}
function der(tag,...parts){const bytes=Buffer.concat(parts);return Buffer.concat([Buffer.from([tag]),length(bytes.length),bytes]);}
const algorithm=der(0x30,Buffer.from('06092a864886f70d01010b0500','hex'));
function item(bytes,at){if(at>=bytes.length)fail();const tag=bytes[at++],first=bytes[at++];if(first===undefined)fail();let size=first;if(first&128){const n=first&127;if(n<1||n>2||at+n>bytes.length||bytes[at]===0)fail();size=0;for(let i=0;i<n;i++)size=size*256+bytes[at++];if(size<128||n===2&&size<256)fail();}const end=at+size;if(end>bytes.length)fail();return {tag,start:at,end,next:end,full:bytes.subarray(at-(first&128?2+(first&127):2),end)};}
function children(bytes,parent){const out=[];for(let at=parent.start;at<parent.end;){const child=item(bytes,at);out.push(child);at=child.next;}if(out.at(-1)?.next!==parent.end)fail();return out;}
function pem(bytes){const raw=bytes.toString('base64').match(/.{1,64}/gu).join('\n');return `-----BEGIN CERTIFICATE REQUEST-----\n${raw}\n-----END CERTIFICATE REQUEST-----\n`;}
export function createRunnerPoststartCsr(){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
 const info=der(0x30,Buffer.from([0x02,0x01,0x00]),sequence,publicKey.export({type:'spki',format:'der'}),Buffer.from([0xa0,0]));
 const signature=sign('sha256',info,privateKey),csrPem=pem(der(0x30,info,algorithm,der(0x03,Buffer.from([0]),signature)));
 return Object.freeze({csrPem,keyPem:privateKey.export({type:'pkcs8',format:'pem'}),signProof(message){if(!Buffer.isBuffer(message)||message.length<32||message.length>2048)fail();return sign('sha256',message,privateKey).toString('base64');}});
}
export function parseRunnerPoststartCsr(csrPem){
 try{
  if(typeof csrPem!=='string'||csrPem.length>8192||!/^-----BEGIN CERTIFICATE REQUEST-----\n(?:[A-Za-z0-9+/]{1,64}\n)+-----END CERTIFICATE REQUEST-----\n$/u.test(csrPem))fail();
  const body=csrPem.replace(/-----BEGIN CERTIFICATE REQUEST-----\n|-----END CERTIFICATE REQUEST-----\n|\n/gu,'');
  const bytes=Buffer.from(body,'base64');if(bytes.toString('base64')!==body||bytes.length>6144)fail();
  const outer=item(bytes,0);if(outer.tag!==0x30||outer.next!==bytes.length)fail();const [info,algo,signature,...extra]=children(bytes,outer);
  if(extra.length||info?.tag!==0x30||algo?.tag!==0x30||signature?.tag!==0x03||!bytes.subarray(algo.start,algo.end).equals(Buffer.from('06092a864886f70d01010b0500','hex'))||bytes[signature.start]!==0)fail();
  const [version,subject,spki,attributes,...more]=children(bytes,info);
  if(more.length||version?.tag!==0x02||!bytes.subarray(version.start,version.end).equals(Buffer.from([0]))||subject?.tag!==0x30||subject.start!==subject.end||spki?.tag!==0x30||attributes?.tag!==0xa0||attributes.start!==attributes.end)fail();
  const publicKey=createPublicKey({key:spki.full,format:'der',type:'spki'}),details=publicKey.asymmetricKeyDetails;
  if(publicKey.asymmetricKeyType!=='rsa'||details.modulusLength<2048||details.modulusLength>4096||details.publicExponent!==65537n||!verify('sha256',info.full,publicKey,bytes.subarray(signature.start+1,signature.end)))fail();
  return Object.freeze({publicKey,spki:Buffer.from(spki.full)});
 }catch{fail();}
}
export function verifyRunnerPoststartProof({csrPem,message,proofBase64}){
 try{const csr=parseRunnerPoststartCsr(csrPem);if(!Buffer.isBuffer(message)||message.length<32||message.length>2048||typeof proofBase64!=='string'||!/[A-Za-z0-9+/=]/u.test(proofBase64)||proofBase64.length>1024)fail();const proof=Buffer.from(proofBase64,'base64');if(proof.toString('base64')!==proofBase64||!verify('sha256',message,csr.publicKey,proof))fail();return csr;}
 catch{fail();}
}
