/** Offline source regression: throwaway PKI, loopback TLS only, no external endpoint or credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,X509Certificate} from 'node:crypto';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:https';
import {once} from 'node:events';
import {compileControlCaBundle,CONTROL_NODE_CA_FILE,productControlTrustsCompositeCa,verifyControlCaBundle} from '../control-ca-bundle.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),run=promisify(execFile);
let work,pki,rds,privateCa,serverCaSha256;
test.before(async()=>{
 work=await mkdtemp(join(tmpdir(),'meri-control-ca-test-'));pki=work;
 const openssl=args=>{const result=spawnSync(process.env.MERI_TEST_OPENSSL??'openssl',args,{encoding:'utf8',timeout:30000,cwd:pki});assert.equal(result.status,0,'throwaway OpenSSL PKI generation');};
 openssl(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','server-ca.key.pem','-out','server-ca.pem','-days','1','-subj','/CN=Synthetic Meri test CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
 openssl(['req','-new','-newkey','rsa:2048','-nodes','-keyout','control-private.key.pem','-out','control.csr','-subj','/CN=control.meri-preview.internal']);
 await writeFile(join(pki,'leaf.ext'),'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:control.meri-preview.internal\n');
 openssl(['x509','-req','-in','control.csr','-CA','server-ca.pem','-CAkey','server-ca.key.pem','-CAcreateserial','-out','control-private.pem','-days','1','-extfile','leaf.ext']);
 [rds,privateCa]=await Promise.all([readFile(new URL('../certs/rds-global-bundle.pem',import.meta.url)),readFile(join(pki,'server-ca.pem'))]);
 serverCaSha256=hash(new X509Certificate(privateCa).raw);
});
test.after(async()=>{if(work)await rm(work,{recursive:true,force:true});});

test('composite preserves every locked RDS byte and appends exactly the pinned private server CA',()=>{
 const bundle=compileControlCaBundle({rdsBundle:rds,privateCa,serverCaSha256});
 assert.ok(bundle.subarray(0,rds.length).equals(rds));assert.ok(bundle.subarray(rds.length+1).equals(privateCa));
 const certificates=bundle.toString().match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu);
 assert.equal(certificates.length,115);assert.equal(new X509Certificate(certificates.at(-1)).ca,true);
 assert.equal(hash(new X509Certificate(certificates.at(-1)).raw),serverCaSha256);
});

test('changed RDS bytes, a foreign private pin, a leaf, multiple PEMs and private key material refuse',async()=>{
 const changed=Buffer.from(rds);changed[100]^=1;
 const leaf=await readFile(join(pki,'control-private.pem')),key=await readFile(join(pki,'server-ca.key.pem'));
 for(const value of [
  {rdsBundle:changed,privateCa,serverCaSha256},
  {rdsBundle:rds.subarray(1),privateCa,serverCaSha256},
  {rdsBundle:rds,privateCa,serverCaSha256:'0'.repeat(64)},
  {rdsBundle:rds,privateCa:leaf,serverCaSha256:hash(new X509Certificate(leaf).raw)},
  {rdsBundle:rds,privateCa:Buffer.concat([privateCa,privateCa]),serverCaSha256},
  {rdsBundle:rds,privateCa:Buffer.concat([privateCa,key]),serverCaSha256},
 ])assert.throws(()=>compileControlCaBundle(value),{code:'STATIC_INIT_CONTROL_CA_REFUSED'});
});

test('control startup admits only the fixed composite path and refuses missing/wrong environment before resources',async()=>{
 assert.equal(productControlTrustsCompositeCa({NODE_EXTRA_CA_CERTS:CONTROL_NODE_CA_FILE}),true);
 for(const value of [undefined,'','/opt/meri/certs/rds-global-bundle.pem','/run/meri/control-ca.pem','/tmp/other.pem']){
  const environment=value===undefined?{}:{NODE_EXTRA_CA_CERTS:value};
  assert.equal(productControlTrustsCompositeCa(environment),false);
  await assert.rejects(verifyControlCaBundle({}, {environment}),{code:'STATIC_INIT_CONTROL_CA_REFUSED'});
 }
});

test('fresh Node global fetch trusts the private origin with composite roots, retains all RDS roots and verifies hostname',async()=>{
 const bundle=compileControlCaBundle({rdsBundle:rds,privateCa,serverCaSha256}),file=join(work,'composite.pem');await writeFile(file,bundle);
 const server=createServer({key:await readFile(join(pki,'control-private.key.pem')),cert:await readFile(join(pki,'control-private.pem'))},(_request,response)=>response.end('private-origin-ok'));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const script=`import dns from 'node:dns';import tls from 'node:tls';import {X509Certificate,createHash} from 'node:crypto';
 dns.lookup=(name,options,callback)=>{if(typeof options==='function'){callback=options;options={};}callback(null,options?.all?[{address:'127.0.0.1',family:4}]:'127.0.0.1',4);};
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const roots=tls.getCACertificates('extra').map(p=>hash(new X509Certificate(p).raw));
 try{const response=await fetch(process.argv[1],{signal:AbortSignal.timeout(5000)});console.log(JSON.stringify({text:await response.text(),roots}));}
 catch(error){console.log(JSON.stringify({code:error.cause?.code??error.code,roots}));}`;
 const child=async(host,ca)=>JSON.parse((await run(process.execPath,['--input-type=module','-e',script,`https://${host}:${server.address().port}/`],{
  env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_EXTRA_CA_CERTS:ca},timeout:10000,maxBuffer:131072})).stdout);
 try{
  const rdsFile=join(work,'rds.pem');await writeFile(rdsFile,rds);
  const base=await child('control.meri-preview.internal',rdsFile);
  assert.ok(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','SELF_SIGNED_CERT_IN_CHAIN'].includes(base.code),base.code);
  const trusted=await child('control.meri-preview.internal',file);assert.equal(trusted.text,'private-origin-ok');
  assert.equal(trusted.roots.length,115);assert.ok(trusted.roots.includes(serverCaSha256));
  for(const cert of rds.toString().match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu))assert.ok(trusted.roots.includes(hash(new X509Certificate(cert).raw)));
  const mismatch=await child('wrong.meri-preview.internal',file);assert.equal(mismatch.code,'ERR_TLS_CERT_ALTNAME_INVALID');
 }finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
