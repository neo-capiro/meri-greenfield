import test from 'node:test';
import assert from 'node:assert/strict';
import {X509Certificate, createHash, generateKeyPairSync, sign} from 'node:crypto';
import {createRunnerPoststartCsr} from '../native-authority/runner-poststart-csr.mjs';
import {createTemporalServiceClientCertificateIssuerFromMaterial} from './service-client-certificate.mjs';

const NOW=Date.UTC(2026,9,17,12,0,0);
const TASK='arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/0123456789abcdef0123456789abcdef';
const BASE='spiffe://meri.internal/service/control/';
const CN='meri-temporal-control:v1';
const length=n=>n<128?Buffer.from([n]):n<256?Buffer.from([0x81,n]):Buffer.from([0x82,n>>8,n&255]);
const der=(tag,...parts)=>{const bytes=Buffer.concat(parts);return Buffer.concat([Buffer.from([tag]),length(bytes.length),bytes]);};
const oid=hex=>der(0x06,Buffer.from(hex,'hex'));
const critical=Buffer.from([0x01,0x01,0xff]);
const extension=(name,inner)=>der(0x30,oid(name),critical,der(0x04,inner));
const algorithm=Buffer.from('300d06092a864886f70d01010b0500','hex');
function time(ms){const iso=new Date(ms).toISOString();return der(0x17,Buffer.from(iso.slice(2,4)+iso.slice(5,7)+iso.slice(8,10)+iso.slice(11,13)+iso.slice(14,16)+iso.slice(17,19)+'Z'));}
function pem(bytes){return `-----BEGIN CERTIFICATE-----\n${bytes.toString('base64').match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`;}
function memoryCa({ca=true,keyCertSign=true}={}){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
 const subject=der(0x30,der(0x31,der(0x30,oid('550403'),der(0x0c,Buffer.from('Test Temporal CA')))));
 const extensions=der(0xa3,der(0x30,
  extension('551d13',ca?der(0x30,Buffer.from([0x01,0x01,0xff])):der(0x30)),
  extension('551d0f',Buffer.from(keyCertSign?'03020106':'03020780','hex'))));
 const tbs=der(0x30,der(0xa0,Buffer.from([0x02,0x01,0x02])),der(0x02,Buffer.from([1])),
  algorithm,subject,der(0x30,time(NOW-60000),time(NOW+3600000)),subject,
  publicKey.export({type:'spki',format:'der'}),extensions);
 const signature=sign('sha256',tbs,privateKey);
 return {caPem:Buffer.from(pem(der(0x30,tbs,algorithm,der(0x03,Buffer.from([0]),signature)))),
  keyPem:Buffer.from(privateKey.export({type:'pkcs8',format:'pem'}))};
}
function request(){
 const csr=createRunnerPoststartCsr(),proofMessage=Buffer.from('temporal-service-task-bootstrap-proof-20261017');
 return {csr,request:{csrPem:csr.csrPem,proofMessage,proofBase64:csr.signProof(proofMessage),
  taskArn:TASK,peerSubjectCn:CN,peerUriBase:BASE,notAfterMs:NOW+300000}};
}
const caPin=material=>createHash('sha256').update(new X509Certificate(material.caPem).raw).digest('hex');
const issuer=material=>createTemporalServiceClientCertificateIssuerFromMaterial({...material,
 caSha256:material.caSha256??caPin(material),now:()=>NOW,
 serialBytes:()=>Buffer.from('102030405060708090a0b0c0d0e0f001','hex')});

test('issues one exact task-bound clientAuth leaf from a proven CSR and owner CA',async()=>{
 const material=memoryCa(),expectedPin=caPin(material),ca=new X509Certificate(material.caPem);
 const port=issuer(material),{csr,request:body}=request();
 // The caller retires its source PEM buffers immediately after import.
 material.caPem.fill(0);material.keyPem.fill(0);
 assert.equal(port.caSha256,expectedPin);
 const result=await port.issue(body),leaf=new X509Certificate(result.certPem);
 assert.equal(result.peerSanUri,BASE+encodeURIComponent(TASK));
 assert.equal(leaf.subject,`CN=${CN}`);
 assert.equal(leaf.subjectAltName,`URI:${result.peerSanUri}`);
 assert.equal(leaf.ca,false);
 assert.deepEqual(leaf.keyUsage,['1.3.6.1.5.5.7.3.2']);
 assert.equal(leaf.serialNumber,'102030405060708090A0B0C0D0E0F001');
 assert.equal(result.expiresAtMs,NOW+300000);
 assert.equal(result.certificateSha256,createHash('sha256').update(leaf.raw).digest('hex'));
 assert.equal(leaf.checkIssued(ca),true);
 assert.equal(leaf.verify(ca.publicKey),true);
 assert.deepEqual(leaf.publicKey.export({type:'spki',format:'der'}),
  (await import('node:crypto')).createPublicKey(csr.keyPem).export({type:'spki',format:'der'}));
 // The critical keyUsage extension is digitalSignature only (no keyEncipherment).
 assert.equal(leaf.raw.includes(Buffer.from('300e0603551d0f0101ff040403020780','hex')),true);
 port.close();
 await assert.rejects(port.issue(body),{code:'TEMPORAL_SERVICE_CERT_REFUSED'});
});

test('refuses unproven or substituted CSR key before any certificate is returned',async()=>{
 const port=issuer(memoryCa()),{request:body}=request();
 await assert.rejects(port.issue({...body,proofBase64:Buffer.alloc(256).toString('base64')}),
  {code:'TEMPORAL_SERVICE_CERT_REFUSED'});
 await assert.rejects(port.issue({...body,csrPem:createRunnerPoststartCsr().csrPem}),
  {code:'TEMPORAL_SERVICE_CERT_REFUSED'});
 await assert.rejects(port.issue({...body,proofMessage:Buffer.from('short')}),
  {code:'TEMPORAL_SERVICE_CERT_REFUSED'});
});

test('refuses caller-shaped identity, overlong lifetime, abort and non-CA material',async()=>{
 const port=issuer(memoryCa()),{request:body}=request();
 for(const change of [
  {taskArn:'arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/fake'},
  {peerSubjectCn:'CN=forged'},
  {peerUriBase:'spiffe://meri.internal/service/worker'},
  {notAfterMs:NOW+3600001},
  {notAfterMs:NOW+1000},
  {signal:AbortSignal.abort()},
 ])await assert.rejects(port.issue({...body,...change}),{code:'TEMPORAL_SERVICE_CERT_REFUSED'});
 assert.throws(()=>issuer(memoryCa({ca:false})),{code:'TEMPORAL_SERVICE_CERT_REFUSED'});
 assert.throws(()=>issuer(memoryCa({keyCertSign:false})),{code:'TEMPORAL_SERVICE_CERT_REFUSED'});
 const pinnedCa=memoryCa();
 assert.throws(()=>issuer({...pinnedCa,caSha256:'0'.repeat(64)}),{code:'TEMPORAL_SERVICE_CERT_REFUSED'});
 assert.throws(()=>createTemporalServiceClientCertificateIssuerFromMaterial(pinnedCa),
  {code:'TEMPORAL_SERVICE_CERT_REFUSED'});
 const other=memoryCa();
 assert.throws(()=>issuer({caPem:memoryCa().caPem,keyPem:other.keyPem}),
  {code:'TEMPORAL_SERVICE_CERT_REFUSED'});
});

test('close during serial preparation prevents signing with a released KeyObject',async()=>{
 const material=memoryCa(),{request:body}=request();let port;
 port=createTemporalServiceClientCertificateIssuerFromMaterial({...material,caSha256:caPin(material),
  now:()=>NOW,serialBytes:()=>{port.close();return Buffer.alloc(16,0x23);}});
 await assert.rejects(port.issue(body),{code:'TEMPORAL_SERVICE_CERT_REFUSED'});
 await assert.rejects(port.issue(body),{code:'TEMPORAL_SERVICE_CERT_REFUSED'});
});
