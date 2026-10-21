/** Local ephemeral certificates and TLS sockets; no live control service, database or credential issuer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {X509Certificate} from 'node:crypto';
import https from 'node:https';
import {connect} from 'node:net';
import {once} from 'node:events';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {hostClientDnsName,HOST_CONTROL_RESPONSE_SCHEMA,HOST_CONTROL_PATH} from './protocol.mjs';
import {createHostCurrentnessClient} from './client.mjs';
import {createHostCurrentnessServer} from './server.mjs';

const issuer=String.raw`
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
root=Path(sys.argv[1]); client_name=sys.argv[2]; now=datetime.now(timezone.utc)
def material(name,issuer_key=None,issuer_cert=None):
 key=ed25519.Ed25519PrivateKey.generate()
 subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)])
 life=timedelta(minutes=5) if issuer_key else timedelta(days=1)
 b=x509.CertificateBuilder().subject_name(subject).issuer_name(issuer_cert.subject if issuer_cert else subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(seconds=10)).not_valid_after(now+life)
 b=b.add_extension(x509.BasicConstraints(ca=issuer_key is None,path_length=None),critical=True)
 if issuer_key:
  b=b.add_extension(x509.SubjectAlternativeName([x509.DNSName(name)]),critical=False)
  b=b.add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH if name=='control.meri.internal' else ExtendedKeyUsageOID.CLIENT_AUTH]),critical=False)
 cert=b.sign(issuer_key or key,algorithm=None)
 (root/(name+'.key')).write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
 (root/(name+'.crt')).write_bytes(cert.public_bytes(serialization.Encoding.PEM))
 return key,cert
ca_key,ca_cert=material('ca')
material('control.meri.internal',ca_key,ca_cert)
material(client_name,ca_key,ca_cert)
`;

async function withTls(t,operation){
 const dir=await mkdtemp(join(tmpdir(),'meri-host-control-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const allocation={schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
  generation:1,hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,
  leaseDeadlineMs:Date.now()+600000};
 const hostIdentity={schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',
  bootId:'00000001-0000-4000-8000-000000000000',conversationId:binding.conversationId,hostId:allocation.hostId};
 try{execFileSync('python3',['-c',issuer,dir,hostClientDnsName(allocation)],{stdio:'pipe'});}
 catch(error){t.skip(`local cryptography certificate fixture unavailable: ${error?.code??'error'}`);return;}
 const read=name=>readFile(join(dir,name));
 const ca=await read('ca.crt'),serverCert=await read('control.meri.internal.crt');
 const clientName=hostClientDnsName(allocation),clientCert=await read(`${clientName}.crt`);
 const fingerprint=cert=>new X509Certificate(cert).fingerprint256.replaceAll(':','').toLowerCase();
 await operation({allocation,hostIdentity,serverTls:{serverName:'control.meri.internal',cert:serverCert,
  key:await read('control.meri.internal.key'),clientCa:ca},
  clientTls:{cert:clientCert,key:await read(`${clientName}.key`),ca},serverFingerprintSha256:fingerprint(serverCert)});
}

test('private mTLS client reads only the exact active run over pinned IP, SAN, CA and fingerprint',async t=>{
 await withTls(t,async f=>{
  let calls=0;const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:0},tls:f.serverTls,
   store:{async readCurrent({request,fingerprintSha256,peerDnsName}){calls++;
    assert.equal(peerDnsName,hostClientDnsName(f.allocation));assert.match(fingerprintSha256,/^[0-9a-f]{64}$/);
    return {schema:HOST_CONTROL_RESPONSE_SCHEMA,nonce:request.nonce,purpose:request.purpose,receipt:{allocation:f.allocation,binding,
     policySha256:request.policySha256,phase:'active',checkedAtMs:Date.now(),currentUntilMs:Date.now()+800}};
   }},maxFreshMs:2000,requestMs:500});
  const address=await server.start();t.after(()=>server.close());
  const config={allocation:f.allocation,binding,hostIdentity:f.hostIdentity,purpose:'browser',endpoint:{address:address.address,port:address.port,
   serverName:'control.meri.internal',serverFingerprintSha256:f.serverFingerprintSha256},tls:f.clientTls,
   maxFreshMs:2000,timeoutMs:500};
  const client=createHostCurrentnessClient(config);t.after(()=>client.close());
  const receipt=await client.readCurrent({allocation:f.allocation,binding,policySha256:'c'.repeat(64)});
  assert.equal(receipt.phase,'active');assert.equal(receipt.policySha256,'c'.repeat(64));assert.equal(calls,1);
  await assert.rejects(client.readCurrent({allocation:f.allocation,binding:{...binding,writerFence:2},
   policySha256:'c'.repeat(64)}),{code:'HOST_CONTROL_UNAVAILABLE'});assert.equal(calls,1);
  const wrong=createHostCurrentnessClient({...config,endpoint:{...config.endpoint,serverFingerprintSha256:'0'.repeat(64)}});
  await assert.rejects(wrong.readCurrent({allocation:f.allocation,binding,policySha256:'c'.repeat(64)}),
   {code:'HOST_CONTROL_UNAVAILABLE'});wrong.close();assert.equal(calls,1);
  await assert.rejects(createHostCurrentnessClient({...config,endpoint:{...config.endpoint,
   serverName:'other.meri.internal'}}).readCurrent({allocation:f.allocation,binding,
   policySha256:'c'.repeat(64)}),{code:'HOST_CONTROL_UNAVAILABLE'});
  assert.throws(()=>createHostCurrentnessClient({...config,purpose:'untrusted'}),
   {code:'HOST_CONTROL_UNAVAILABLE'});
 });
});

test('never-settling durable read releases concurrency slot and closes socket at deadline',async t=>{
 await withTls(t,async f=>{
  let hang=true,calls=0;const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:0},tls:f.serverTls,
   store:{readCurrent({request}){calls++;if(hang)return new Promise(()=>{});
    return {schema:HOST_CONTROL_RESPONSE_SCHEMA,nonce:request.nonce,purpose:request.purpose,receipt:{allocation:f.allocation,binding,
     policySha256:request.policySha256,phase:'active',checkedAtMs:Date.now(),currentUntilMs:Date.now()+800}};
   }},maxFreshMs:2000,requestMs:80,maxConcurrent:1});
  const address=await server.start();t.after(()=>server.close());
  const client=createHostCurrentnessClient({allocation:f.allocation,binding,hostIdentity:f.hostIdentity,purpose:'browser',
   endpoint:{address:address.address,port:address.port,serverName:'control.meri.internal',
    serverFingerprintSha256:f.serverFingerprintSha256},tls:f.clientTls,maxFreshMs:2000,timeoutMs:500});
  t.after(()=>client.close());const input={allocation:f.allocation,binding,policySha256:'c'.repeat(64)};
  const start=Date.now();await assert.rejects(client.readCurrent(input),{code:'HOST_CONTROL_UNAVAILABLE'});
  assert.ok(Date.now()-start<500);hang=false;
  const receipt=await client.readCurrent(input);assert.equal(receipt.phase,'active');assert.equal(calls,2);
 });
});

test('silent partial request body expires and a later valid read still succeeds',async t=>{
 await withTls(t,async f=>{
  const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:0},tls:f.serverTls,
   store:{readCurrent({request}){return {schema:HOST_CONTROL_RESPONSE_SCHEMA,nonce:request.nonce,purpose:request.purpose,
    receipt:{allocation:f.allocation,binding,policySha256:request.policySha256,phase:'active',
     checkedAtMs:Date.now(),currentUntilMs:Date.now()+800}};}},maxFreshMs:2000,requestMs:80,maxConcurrent:1});
  const address=await server.start();t.after(()=>server.close());
  await new Promise((resolve,reject)=>{
   const req=https.request({host:address.address,port:address.port,path:HOST_CONTROL_PATH,method:'POST',
    servername:'control.meri.internal',cert:f.clientTls.cert,key:f.clientTls.key,ca:f.clientTls.ca,
    rejectUnauthorized:true,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
    headers:{'content-type':'application/json','content-length':'100','connection':'close'}},res=>{res.resume();res.on('end',resolve);});
   req.on('error',error=>error.code==='ECONNRESET'?resolve():reject(error));req.write('{');
   setTimeout(()=>{req.destroy();resolve();},250).unref();
  });
  const client=createHostCurrentnessClient({allocation:f.allocation,binding,hostIdentity:f.hostIdentity,purpose:'browser',
   endpoint:{address:address.address,port:address.port,serverName:'control.meri.internal',
    serverFingerprintSha256:f.serverFingerprintSha256},tls:f.clientTls,maxFreshMs:2000,timeoutMs:500});
  t.after(()=>client.close());assert.equal((await client.readCurrent({allocation:f.allocation,binding,
   policySha256:'c'.repeat(64)})).phase,'active');
 });
});

test('silent raw TCP TLS handshake expires within the socket cap and releases admission',async t=>{
 await withTls(t,async f=>{
  const server=createHostCurrentnessServer({bind:{address:'127.0.0.1',port:0},tls:f.serverTls,
   store:{readCurrent({request}){return {schema:HOST_CONTROL_RESPONSE_SCHEMA,nonce:request.nonce,purpose:request.purpose,
    receipt:{allocation:f.allocation,binding,policySha256:request.policySha256,phase:'active',
     checkedAtMs:Date.now(),currentUntilMs:Date.now()+800}};}},
   maxFreshMs:2000,requestMs:80,maxConcurrent:1,maxSockets:1});
  const address=await server.start();t.after(()=>server.close());
  const raw=connect({host:address.address,port:address.port});raw.on('error',()=>{});
  await once(raw,'connect');const started=Date.now();
  await once(raw,'close',{signal:AbortSignal.timeout(500)});
  assert.ok(Date.now()-started<500,'silent pre-TLS socket closes at the handshake deadline');
  const client=createHostCurrentnessClient({allocation:f.allocation,binding,hostIdentity:f.hostIdentity,purpose:'sdk',
   endpoint:{address:address.address,port:address.port,serverName:'control.meri.internal',
    serverFingerprintSha256:f.serverFingerprintSha256},tls:f.clientTls,maxFreshMs:2000,timeoutMs:500});
  t.after(()=>client.close());
  assert.equal((await client.readCurrent({allocation:f.allocation,binding,
   policySha256:'c'.repeat(64)})).phase,'active');
  assert.throws(()=>createHostCurrentnessServer({bind:{address:'127.0.0.1',port:0},tls:f.serverTls,
   store:{readCurrent(){}},maxFreshMs:2000,requestMs:80,maxConcurrent:2,maxSockets:1}),
   {code:'HOST_CONTROL_UNAVAILABLE'});
 });
});
