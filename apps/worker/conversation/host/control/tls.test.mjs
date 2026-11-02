/** Certificate lifetime bounds of the host-control mTLS boundary on local ephemeral certificates: the per-run host leaves
 * keep the 15-minute bound; Control's pinned client leaf is admitted up to 31 days; its reviewed control-private server leaf
 * (pinned by fingerprint in every bootstrap spec and rendered for months) up to 398 days, by the listener itself and by
 * the host client. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkedCertificate,PINNED_CONTROL_LIFETIME_MS,sha256Der} from './tls.mjs';
import {createHostCurrentnessServer} from './server.mjs';
import {X509Certificate} from 'node:crypto';

const issuer=String.raw`
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.x509.oid import NameOID
root=Path(sys.argv[1]); now=datetime.now(timezone.utc)
ca_key=ed25519.Ed25519PrivateKey.generate(); ca_name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'ca')])
ca=x509.CertificateBuilder().subject_name(ca_name).issuer_name(ca_name).public_key(ca_key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(seconds=10)).not_valid_after(now+timedelta(days=500)).add_extension(x509.BasicConstraints(ca=True,path_length=None),critical=True).sign(ca_key,algorithm=None)
(root/'ca.crt').write_bytes(ca.public_bytes(serialization.Encoding.PEM))
for label,life in (('short',timedelta(minutes=10)),('client',timedelta(days=7)),('control',timedelta(days=90)),('excessive',timedelta(days=400))):
 key=ed25519.Ed25519PrivateKey.generate()
 cert=x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'control.meri.internal')])).issuer_name(ca_name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(seconds=10)).not_valid_after(now+life).add_extension(x509.BasicConstraints(ca=False,path_length=None),critical=True).add_extension(x509.SubjectAlternativeName([x509.DNSName('control.meri.internal')]),critical=False).sign(ca_key,algorithm=None)
 (root/(label+'.crt')).write_bytes(cert.public_bytes(serialization.Encoding.PEM))
 (root/(label+'.key')).write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
`;
async function material(t){
 const dir=await mkdtemp(join(tmpdir(),'meri-host-tls-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 try{execFileSync(process.env.MERI_TEST_PYTHON??'python3',['-c',issuer,dir],{stdio:'pipe'});}
 catch(error){t.skip(`local cryptography certificate fixture unavailable: ${error?.code??'error'}`);return null;}
 const read=name=>readFile(join(dir,name));
 return {ca:await read('ca.crt'),short:await read('short.crt'),client:await read('client.crt'),control:await read('control.crt'),controlKey:await read('control.key'),excessive:await read('excessive.crt')};
}
const store={readCurrent(){},readFacts(){},resolveBrowserWorkflow(){},holdBrowser(){}};

test('host leaves keep the 15-minute bound; each pinned Control identity is admitted up to its own bound, never beyond',async t=>{
 const m=await material(t);if(!m)return;
 const at=Date.now(),der=pem=>sha256Der(Buffer.from(new X509Certificate(pem).raw)),name='control.meri.internal';
 const refused={code:'HOST_CONTROL_TLS_REFUSED'};
 assert.deepEqual(PINNED_CONTROL_LIFETIME_MS,{client:31*86400000,server:398*86400000});
 assert.ok(checkedCertificate(m.short,{name,nowMs:at}));
 assert.throws(()=>checkedCertificate(m.client,{name,nowMs:at}),refused,'default bound is the host-leaf bound');
 // The Control client leaf: 7 days passes, 90 days is beyond the 31-day client bound.
 assert.equal(checkedCertificate(m.client,{name,nowMs:at,pinnedControl:'client',fingerprintSha256:der(m.client)}).fingerprintSha256,der(m.client));
 assert.throws(()=>checkedCertificate(m.control,{name,nowMs:at,pinnedControl:'client'}),refused,'a server-length leaf is not a client leaf');
 // The control-private server leaf: 90 days passes, 400 days does not.
 const pinned=checkedCertificate(m.control,{name,nowMs:at,pinnedControl:'server',fingerprintSha256:der(m.control)});
 assert.equal(pinned.fingerprintSha256,der(m.control));
 assert.throws(()=>checkedCertificate(m.control,{name,nowMs:at,pinnedControl:'server',fingerprintSha256:der(m.short)}),refused,'a different leaf never passes the pin');
 assert.throws(()=>checkedCertificate(m.excessive,{name,nowMs:at,pinnedControl:'server'}),refused);
 // A caller may narrow its identity's bound, never widen it, and names only a known identity.
 assert.throws(()=>checkedCertificate(m.client,{name,nowMs:at,pinnedControl:'client',maxLifetimeMs:PINNED_CONTROL_LIFETIME_MS.client+1}),refused);
 assert.throws(()=>checkedCertificate(m.client,{name,nowMs:at,pinnedControl:'client',maxLifetimeMs:86400000}),refused,'narrowed below the leaf lifetime');
 assert.throws(()=>checkedCertificate(m.short,{name,nowMs:at,maxLifetimeMs:900001}),refused);
 for(const pinnedControl of ['toString','host',''])assert.throws(()=>checkedCertificate(m.short,{name,nowMs:at,pinnedControl}),refused,pinnedControl);
});

test('the listener accepts the rendered control-private leaf and binds the task interfaces, or a private literal, never a public address',async t=>{
 const m=await material(t);if(!m)return;
 const tls={serverName:'control.meri.internal',cert:m.control,key:m.controlKey,clientCa:m.ca};
 const listener=bind=>createHostCurrentnessServer({bind,tls,store,maxFreshMs:3000,requestMs:5000});
 for(const bind of [{address:'0.0.0.0',port:8443},{address:'10.0.0.7',port:8443},{address:'127.0.0.1',port:0}])assert.ok(listener(bind),bind.address);
 for(const bind of [{address:'8.8.8.8',port:8443},{address:'0.0.0.0',port:0},{address:'::',port:8443}])
  assert.throws(()=>listener(bind),{code:'HOST_CONTROL_UNAVAILABLE'},bind.address);
 assert.throws(()=>createHostCurrentnessServer({bind:{address:'0.0.0.0',port:8443},tls:{...tls,cert:m.excessive},store,maxFreshMs:3000,requestMs:5000}),{code:'HOST_CONTROL_UNAVAILABLE'});
});
