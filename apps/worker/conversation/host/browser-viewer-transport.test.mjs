/** Real local TLS sockets, memory-only generated test certificates, no live host. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {X509Certificate} from 'node:crypto';
import {createBrowserViewerHostClient,createBrowserViewerHostServer} from './browser-viewer-transport.mjs';
import {createBrowserViewerRelay} from './browser-viewer-relay.mjs';
import {BROWSER_VIEWER_SCHEMA as schema} from '../../../../packages/contracts/browser-viewer/receive.mjs';
const issuer=String.raw`
import json,base64
from datetime import datetime,timedelta,timezone
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.x509.oid import NameOID,ExtendedKeyUsageOID
now=datetime.now(timezone.utc)
def make(name,parent=None,server=False):
 key=ed25519.Ed25519PrivateKey.generate()
 subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)])
 b=x509.CertificateBuilder().subject_name(subject).issuer_name(parent[1].subject if parent else subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(seconds=10)).not_valid_after(now+timedelta(minutes=5))
 b=b.add_extension(x509.BasicConstraints(ca=parent is None,path_length=None),critical=True)
 if parent:
  b=b.add_extension(x509.SubjectAlternativeName([x509.DNSName(name)]),critical=False)
  b=b.add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH if server else ExtendedKeyUsageOID.CLIENT_AUTH]),critical=False)
 cert=b.sign(parent[0] if parent else key,algorithm=None)
 return key,cert
root=make('fixture-ca'); host=make('browser.meri.internal',root,True); control=make('control.meri.internal',root)
out={}
for name,pair in [('ca',root),('host',host),('control',control)]:
 out[name+'Cert']=base64.b64encode(pair[1].public_bytes(serialization.Encoding.PEM)).decode()
 if name!='ca':out[name+'Key']=base64.b64encode(pair[0].private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())).decode()
print(json.dumps(out))
`;
const certs=JSON.parse(execFileSync(process.platform==='win32'?'python':'python3',['-c',issuer],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const material=Object.fromEntries(Object.entries(certs).map(([k,v])=>[k,Buffer.from(v,'base64')]));
const digest=b=>new X509Certificate(b).fingerprint256.replaceAll(':','').toLowerCase();
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const context={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),selectedClientId:null};
async function fixture(t){
 const ownerInstanceId=id(7),hostId=id(8),until=Date.now()+120000,calls=[];let state='agent';
 const relay=createBrowserViewerRelay({ownerInstanceId,binding,expiresAtMs:until});
 await relay.bind({binding,pages:()=>[],controls:{readState:async()=>({state,leaseEpoch:1,leaseExpiresAtMs:until}),
  view:async()=>{throw Error('No page');},userInput:async()=>{calls.push('input');},handBack(){state='returning';},endLease(){state='returning';}}});
 const server=createBrowserViewerHostServer({bind:{address:'127.0.0.1',port:0},
  tls:{serverName:'browser.meri.internal',cert:material.hostCert,key:material.hostKey,clientCa:material.caCert},
  peer:{name:'control.meri.internal',fingerprintSha256:digest(material.controlCert)},relay,requestMs:2000});
 t.after(async()=>{await server.close();await relay.close();});const at=await server.start();
 const config={binding,ownerInstanceId,hostId,generation:1,endpoint:{address:at.address,port:at.port,serverName:'browser.meri.internal',serverFingerprintSha256:digest(material.hostCert)},
  tls:{clientName:'control.meri.internal',cert:material.controlCert,key:material.controlKey,ca:material.caCert},requestMs:2000};
 const client=createBrowserViewerHostClient(config);t.after(()=>client.close());
 const grant={context,sessionKey:'a'.repeat(64),expiresAtMs:until,custody:{binding,ownerInstanceId,hostId,generation:1,leaseEpoch:1,expiresAtMs:until}};
 return {client,config,grant,hold:()=>{state='user';},calls};
}
test('real mTLS admission and one-use connection use an exact private host allocation',async t=>{
 const f=await fixture(t);assert.equal((await f.client.read({binding})).admitted,true);f.hold();
 const ticket=await f.client.execute({route:'ticket',request:{schema,requestId:id(10)},grant:f.grant});
 const request={schema,requestId:id(11),ticket:ticket.ticket};
 const connected=await f.client.execute({route:'connect',request,grant:f.grant});assert.equal(connected.state,'user');
 const read=await f.client.execute({route:'read',request:{schema},grant:f.grant});assert.equal(read.lease.viewerId,connected.lease.viewerId);
 await assert.rejects(f.client.execute({route:'connect',request,grant:f.grant}));
 assert.equal(f.calls.length,0);
});
test('wrong TLS peer pin and changed custody cannot select another native owner',async t=>{
 const f=await fixture(t),wrong=createBrowserViewerHostClient({...f.config,endpoint:{...f.config.endpoint,serverFingerprintSha256:'0'.repeat(64)}});t.after(()=>wrong.close());
 await assert.rejects(wrong.read({binding}));
 await assert.rejects(f.client.read({binding:{...binding,runId:id(99)}}));
 await assert.rejects(f.client.execute({route:'read',request:{schema},grant:{...f.grant,custody:{...f.grant.custody,generation:2}}}));
 assert.equal(f.calls.length,0);
});
test('client closure refuses subsequent connections and public destinations are rejected',async t=>{
 const f=await fixture(t);f.client.close();await assert.rejects(f.client.read({binding}));
 assert.throws(()=>createBrowserViewerHostClient({...f.config,endpoint:{...f.config.endpoint,address:'8.8.8.8'}}));
});
