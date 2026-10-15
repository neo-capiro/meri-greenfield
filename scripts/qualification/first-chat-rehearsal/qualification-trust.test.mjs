/** Controls for the qualification trust binding: contract parsing, owned material and signer-key absence, owned cluster identity,
 * source identity, launch environment binding, TLS preflight classification against a real stand-in with a throwaway CA, and the
 * real negative control shape. Nothing here installs trust; the throwaway CA lives in a private temp directory. */
import test from 'node:test';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import {mkdtempSync,readFileSync,rmSync,writeFileSync,chmodSync,mkdirSync,unlinkSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import https from 'node:https';import {randomUUID} from 'node:crypto';
import {startProviderStandIn} from './provider-standin.mjs';
import {parseQualificationTrust,withQualificationEnvironment,preflightStandIn,classifyTransportFailure,ownedClusterIdentity,readSourceIdentity,environmentIdentity,cliNegativeControl,acquireExclusiveRehearsal} from './qualification-trust.mjs';
function material(dir){const ssl=args=>execFileSync('openssl',args,{cwd:dir,stdio:['ignore','ignore','ignore']});
 ssl(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=meri-qualification-test-ca','-keyout','ca.key','-out','ca.crt','-addext','basicConstraints=critical,CA:TRUE']);
 ssl(['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout','server.key','-out','server.csr']);execFileSync('sh',['-c',"printf 'subjectAltName=IP:127.0.0.1\\nbasicConstraints=CA:FALSE\\n' > ext.cnf"],{cwd:dir});
 ssl(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile','ext.cnf','-out','server.crt']);chmodSync(join(dir,'server.key'),0o600);chmodSync(join(dir,'ca.crt'),0o644);chmodSync(join(dir,'server.crt'),0o644);}
const trustedFetch=ca=>(url,init)=>new Promise((resolve,reject)=>{const u=new URL(url);const req=https.request({host:u.hostname,port:u.port,method:init.method,path:u.pathname,ca,headers:init.headers,signal:init.signal},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const text=Buffer.concat(chunks).toString('utf8');resolve({status:res.statusCode,json:async()=>JSON.parse(text)});});});req.on('error',reject);req.end(init.body);});
function contract(t){const root=mkdtempSync(join(tmpdir(),'meri-trust-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const dir=join(root,'material');mkdirSync(dir,{mode:0o700});material(dir);
 const runId=randomUUID(),socket=join(root,'socket');mkdirSync(socket);writeFileSync(join(socket,'meri-rehearsal-owned'),runId+'\n');const identity=join(root,'source.json');writeFileSync(identity,JSON.stringify({head:'a'.repeat(40),tree:'b'.repeat(40),porcelain:[],root:'/src',recordedAt:new Date().toISOString()}));
 for(const name of ['ca.key','ca.srl','server.csr','ext.cnf'])unlinkSync(join(dir,name));
 const env={MERI_QUALIFICATION_CA:join(dir,'ca.crt'),NODE_EXTRA_CA_CERTS:join(dir,'ca.crt'),MERI_QUALIFICATION_CERT:join(dir,'server.crt'),MERI_QUALIFICATION_KEY:join(dir,'server.key'),MERI_REHEARSAL_RUN_ID:runId,MERI_REHEARSAL_PG_SOCKET:socket,MERI_REHEARSAL_PG_DATABASE:'meri_rehearsal_'+runId.replace(/-/gu,''),MERI_REHEARSAL_SOURCE_IDENTITY:identity};
 return {root,dir,env,runId,socket,identity};}
test('the contract is all-or-nothing, binds the harness CA to NODE_EXTRA_CA_CERTS, requires owned private material, refuses signer material, a shared or unowned cluster and a dirty source; absent entirely it is the product route',()=>{
 const t={after(fn){cleanup.push(fn);}},cleanup=[];try{
  const c=contract(t);const trust=parseQualificationTrust(c.env);assert.equal(trust.runId,c.runId);assert.equal(trust.cluster.database,c.env.MERI_REHEARSAL_PG_DATABASE);assert.equal(trust.sourceIdentity.clean,true);assert.match(trust.caSha256,/^[a-f0-9]{64}$/);
  assert.equal(parseQualificationTrust({PATH:'/bin'}),null,'no contract, no trust change');assert.throws(()=>parseQualificationTrust({NODE_EXTRA_CA_CERTS:'/x'}),/QUALIFICATION_TRUST_INCONSISTENT/,'a stray CA variable without the contract is refused');
  const {MERI_REHEARSAL_RUN_ID:_r,...partial}=c.env;void _r;assert.throws(()=>parseQualificationTrust(partial),/QUALIFICATION_TRUST_INCOMPLETE/);
  assert.throws(()=>parseQualificationTrust({...c.env,NODE_EXTRA_CA_CERTS:'/other.crt'}),/QUALIFICATION_TRUST_INCONSISTENT/,'the harness must trust the same CA it hands the CLI');
  chmodSync(c.env.MERI_QUALIFICATION_KEY,0o640);assert.throws(()=>parseQualificationTrust(c.env),/QUALIFICATION_TRUST_FILE_MODE/);chmodSync(c.env.MERI_QUALIFICATION_KEY,0o600);
  writeFileSync(join(c.dir,'ca.key'),'signer');assert.throws(()=>parseQualificationTrust(c.env),/QUALIFICATION_SIGNER_MATERIAL_PRESENT/,'the CA signing key must be gone before the harness starts');unlinkSync(join(c.dir,'ca.key'));
  assert.throws(()=>parseQualificationTrust({...c.env,MERI_REHEARSAL_PG_SOCKET:'/tmp/meri-broker-pg-socket-20261014'}),/QUALIFICATION_CLUSTER_SHARED/);
  writeFileSync(join(c.socket,'meri-rehearsal-owned'),randomUUID());assert.throws(()=>parseQualificationTrust(c.env),/QUALIFICATION_CLUSTER_UNOWNED/);writeFileSync(join(c.socket,'meri-rehearsal-owned'),c.runId);
  assert.throws(()=>ownedClusterIdentity({socket:c.socket,database:'postgres',runId:c.runId}),/QUALIFICATION_CLUSTER_DATABASE/);
  writeFileSync(c.identity,JSON.stringify({head:'a'.repeat(40),tree:'b'.repeat(40),porcelain:[' M x'],root:'/src',recordedAt:new Date().toISOString()}));assert.throws(()=>readSourceIdentity(c.identity),/QUALIFICATION_SOURCE_DIRTY/);
  assert.deepEqual(withQualificationEnvironment({A:'1'},null),{A:'1'});assert.deepEqual(withQualificationEnvironment({A:'1'},trust),{A:'1',NODE_EXTRA_CA_CERTS:trust.caFile});assert.throws(()=>withQualificationEnvironment({NODE_EXTRA_CA_CERTS:'/x'},trust),/QUALIFICATION_TRUST_INCONSISTENT/);
  const id=environmentIdentity({trust,harnessFile:new URL(import.meta.url).pathname,cliPath:process.execPath});assert.equal(id.uid,process.getuid());assert.match(id.node.sha256,/^[a-f0-9]{64}$/);assert.equal(id.cli.sha256,id.node.sha256);assert.equal(id.source.head,'a'.repeat(40));assert.equal(id.qualification.caSha256,trust.caSha256);
 }finally{for(const fn of cleanup)fn();}
});
test('preflight against a real stand-in: trusted through the CA passes, no CA is classified as TLS-untrusted (not unreachable), a closed port is unreachable, a wrong reply is refused; the real negative control shape',async t=>{
 const c=contract(t),standIn=await startProviderStandIn({certFile:c.env.MERI_QUALIFICATION_CERT,keyFile:c.env.MERI_QUALIFICATION_KEY,port:0});t.after(()=>standIn.close());const origin='https://127.0.0.1:'+standIn.port,ca=readFileSync(c.env.MERI_QUALIFICATION_CA);
 const ok=await preflightStandIn({origin,expectedReply:standIn.reply,fetchImpl:trustedFetch(ca)});assert.deepEqual(ok,{origin,status:200,trusted:true});
 await assert.rejects(preflightStandIn({origin,expectedReply:standIn.reply}),e=>e.code==='REHEARSAL_PROVIDER_STANDIN_TLS_UNTRUSTED','the harness without the CA is refused at TLS, before any request is served');
 const before=standIn.calls.length;await assert.rejects(preflightStandIn({origin,expectedReply:'another reply',fetchImpl:trustedFetch(ca)}),/REHEARSAL_PROVIDER_STANDIN_REQUIRED/);assert.equal(standIn.calls.length,before+1);
 const closedPort=standIn.port;const other=await startProviderStandIn({certFile:c.env.MERI_QUALIFICATION_CERT,keyFile:c.env.MERI_QUALIFICATION_KEY,port:0});const port=other.port;await other.close();
 await assert.rejects(preflightStandIn({origin:'https://127.0.0.1:'+port,expectedReply:standIn.reply,fetchImpl:trustedFetch(ca)}),/REHEARSAL_PROVIDER_STANDIN_UNREACHABLE/);void closedPort;
 await assert.rejects(preflightStandIn({origin:'http://127.0.0.1:'+standIn.port,expectedReply:standIn.reply}),/REHEARSAL_PROVIDER_STANDIN_REQUIRED/,'plain http is never a trusted stand-in');
 assert.equal(classifyTransportFailure(Object.assign(Error('fetch failed'),{cause:Object.assign(Error('x'),{code:'DEPTH_ZERO_SELF_SIGNED_CERT'})})),'UNTRUSTED');assert.equal(classifyTransportFailure(Object.assign(Error('fetch failed'),{cause:{code:'ECONNREFUSED'}})),'UNREACHABLE');assert.equal(classifyTransportFailure(Error('weird')),'OTHER');
 // The real negative control: a client process started without the CA fails at TLS with a non-zero exit and reaches no listener.
 const script=`fetch(${JSON.stringify(origin+'/v1/messages')},{method:'POST',body:'{}'}).then(()=>{console.log('served');process.exit(0);},e=>{console.error(e.cause?.code??e.message);process.exit(2);});`;
 const callsBefore=standIn.calls.length;const negative=await cliNegativeControl({command:process.execPath,args:['-e',script],cwd:c.root,env:{PATH:process.env.PATH,HOME:c.root}});
 assert.notEqual(negative.exitCode,0);assert.equal(negative.tlsRefused,true);assert.equal(standIn.calls.length,callsBefore,'no request reached the listener');
 await assert.rejects(cliNegativeControl({command:process.execPath,args:['-e','0'],cwd:c.root,env:{NODE_EXTRA_CA_CERTS:c.env.MERI_QUALIFICATION_CA}}),/QUALIFICATION_TRUST_INCONSISTENT/);
 // After close the listener is gone: the readback a run must record.
 await standIn.close();await assert.rejects(preflightStandIn({origin,expectedReply:standIn.reply,fetchImpl:trustedFetch(ca)}),/REHEARSAL_PROVIDER_STANDIN_UNREACHABLE/);
 const locked={rows:[{locked:true}]},pool={async query(sql){return sql.includes('try_advisory')?locked:{rows:[]};}};const release=await acquireExclusiveRehearsal(pool);locked.rows[0].locked=false;await assert.rejects(acquireExclusiveRehearsal(pool),/REHEARSAL_NOT_EXCLUSIVE/);await release();
});
