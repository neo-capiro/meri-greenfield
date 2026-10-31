/** FINITE93: real throwaway-PKI issue for BOTH native identities. No host CA/private material is read. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {X509Certificate} from 'node:crypto';
import {createNativeHostCertificateIssuerFromMaterial} from '../native-authority/native-host-certificate-issuer.mjs';
import {createRunnerPoststartCsr} from '../native-authority/runner-poststart-csr.mjs';

const now=()=>Date.now();
const issuerFor=f=>createNativeHostCertificateIssuerFromMaterial({caPem:f.caPem,keyPem:f.keyPem});
const clientSan='native-host-abcdef.meri.internal';
const serverSan='control.meri.internal';

test('C2 ISSUER: only serverAuth can use the exact original cleanup ceiling',async t=>{
 const f=fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 const issuer=issuerFor(f),lease=Date.now()+600000,cleanupCeilingMs=lease+25000;
 const request={kind:'server',san:serverSan,csrPem:createRunnerPoststartCsr().csrPem,
  leaseDeadlineMs:lease,cleanupCeilingMs,notAfterMs:cleanupCeilingMs};
 const leaf=new X509Certificate((await issuer.issue(request)).certPem);
 assert.ok(Date.parse(leaf.validTo)>lease);
 assert.ok(Date.parse(leaf.validTo)<=cleanupCeilingMs);
 assert.ok(Date.parse(leaf.validTo)-Date.parse(leaf.validFrom)<=900000);
 for(const mutation of [{kind:'client'},{cleanupCeilingMs:cleanupCeilingMs+1},{notAfterMs:cleanupCeilingMs+1},
  {cleanupCeilingMs:undefined}])await assert.rejects(issuer.issue({...request,...mutation}),
   e=>e.code==='NATIVE_HOST_CERT_REFUSED');
});

function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'meri-issuer93-'));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'ca.key'),'-out',join(dir,'ca.crt'),
  '-days','2','-subj','/CN=Meri Native Test CA','-addext','basicConstraints=critical,CA:TRUE',
  '-addext','keyUsage=critical,keyCertSign,cRLSign'],{stdio:'ignore'});
 return {dir,caPem:readFileSync(join(dir,'ca.crt')),keyPem:readFileSync(join(dir,'ca.key'))};
}

test('ISSUER: clientAuth leaf has the exact single client SAN and no CN',async t=>{
 const f=fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 const issuer=issuerFor(f);
 const {csrPem}=createRunnerPoststartCsr();
 const notAfterMs=Date.now()+600000;
 const {certPem}=await issuer.issue({kind:'client',san:clientSan,csrPem,notAfterMs,leaseDeadlineMs:notAfterMs});
 const leaf=new X509Certificate(certPem),ca=new X509Certificate(f.caPem);
 assert.equal(leaf.subject,'','no CN fallback');
 assert.equal(leaf.subjectAltName,`DNS:${clientSan}`);
 assert.deepEqual(leaf.keyUsage,['1.3.6.1.5.5.7.3.2'],'exactly one EKU: clientAuth');
 assert.equal(leaf.checkIssued(ca),true);
 assert.ok(leaf.verify(ca.publicKey));
});

test('ISSUER: serverAuth leaf is a DIFFERENT certificate with only its own SAN',async t=>{
 const f=fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 const issuer=issuerFor(f),notAfterMs=Date.now()+600000;
 const client=await issuer.issue({kind:'client',san:clientSan,csrPem:createRunnerPoststartCsr().csrPem,
  notAfterMs,leaseDeadlineMs:notAfterMs});
 const server=await issuer.issue({kind:'server',san:serverSan,csrPem:createRunnerPoststartCsr().csrPem,
  notAfterMs,leaseDeadlineMs:notAfterMs});
 assert.notEqual(client.certPem,server.certPem);
 const leaf=new X509Certificate(server.certPem);
 assert.equal(leaf.subjectAltName,`DNS:${serverSan}`);
 assert.deepEqual(leaf.keyUsage,['1.3.6.1.5.5.7.3.1'],'exactly one EKU: serverAuth');
});

test('ISSUER: lifetime > 900000 ms, expiry beyond the lease, non-DNS name and bad proof are refused',async t=>{
 const f=fixture();t.after(()=>rmSync(f.dir,{recursive:true,force:true}));
 const issuer=issuerFor(f);
 const {csrPem,signProof}=createRunnerPoststartCsr();
 const at=Date.now()+600000;
 await assert.rejects(issuer.issue({kind:'client',san:clientSan,csrPem,notAfterMs:Date.now()+900001,leaseDeadlineMs:Date.now()+2000000}),
  e=>e.code==='NATIVE_HOST_CERT_REFUSED');
 await assert.rejects(issuer.issue({kind:'client',san:clientSan,csrPem,notAfterMs:at,leaseDeadlineMs:at-1}),
  e=>e.code==='NATIVE_HOST_CERT_REFUSED');
 await assert.rejects(issuer.issue({kind:'client',san:'not a dns',csrPem,notAfterMs:at,leaseDeadlineMs:at}),
  e=>e.code==='NATIVE_HOST_CERT_REFUSED');
 const message=Buffer.alloc(48,7),proofBase64=signProof(message);
 const good=await issuer.issue({kind:'client',san:clientSan,csrPem,notAfterMs:at,leaseDeadlineMs:at,
  proof:{message,proofBase64}});
 assert.ok(new X509Certificate(good.certPem).checkIssued(new X509Certificate(f.caPem)));
 const tampered=Buffer.from(proofBase64,'base64');tampered[0]^=1;
 await assert.rejects(issuer.issue({kind:'client',san:clientSan,csrPem,notAfterMs:at,leaseDeadlineMs:at,
  proof:{message,proofBase64:tampered.toString('base64')}}),e=>e.code==='NATIVE_HOST_CERT_REFUSED');
});
