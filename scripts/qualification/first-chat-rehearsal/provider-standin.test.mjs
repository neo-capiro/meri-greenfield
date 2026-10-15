/** Routing control for the qualification stand-in: a throwaway CA is generated in the private temp directory and pinned by the
 * client with the `ca` option (no trust store, no hosts entry, no verification disabled). Run explicitly; not in the suite globs. */
import test from 'node:test';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import https from 'node:https';
import {startProviderStandIn} from './provider-standin.mjs';
function call(port,ca,method,path,body){return new Promise((resolve,reject)=>{const req=https.request({host:'127.0.0.1',port,method,path,ca,headers:{'content-type':'application/json'}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));});req.on('error',reject);if(body)req.write(body);req.end();});}
test('the stand-in answers GET /api/hello and POST /v1/messages with or without a query string, and refuses everything else',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'meri-standin-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const ssl=args=>execFileSync('openssl',args,{cwd:dir,stdio:['ignore','ignore','ignore']});
 ssl(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=meri-standin-test-ca','-keyout','ca.key','-out','ca.crt','-addext','basicConstraints=critical,CA:TRUE']);
 ssl(['req','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-keyout','server.key','-out','server.csr']);
 execFileSync('sh',['-c',"printf 'subjectAltName=IP:127.0.0.1\\nbasicConstraints=CA:FALSE\\n' > ext.cnf"],{cwd:dir});
 ssl(['x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile','ext.cnf','-out','server.crt']);
 const s=await startProviderStandIn({certFile:join(dir,'server.crt'),keyFile:join(dir,'server.key'),port:0});t.after(()=>s.close());const ca=readFileSync(join(dir,'ca.crt'));
 assert.equal((await call(s.port,ca,'GET','/api/hello')).status,200);
 const plain=await call(s.port,ca,'POST','/v1/messages',JSON.stringify({model:'m',messages:[]}));assert.equal(plain.status,200);assert.equal(JSON.parse(plain.body).content[0].text,s.reply);
 const beta=await call(s.port,ca,'POST','/v1/messages?beta=true',JSON.stringify({model:'m',messages:[],stream:true}));assert.equal(beta.status,200);assert.match(beta.body,/event: message_start/);
 assert.equal((await call(s.port,ca,'GET','/v1/messages')).status,404);assert.equal((await call(s.port,ca,'POST','/v1/other',JSON.stringify({}))).status,404);
 assert.deepEqual(s.calls.map(c=>c.pathname),['/api/hello','/v1/messages','/v1/messages','/v1/messages','/v1/other']);
 await assert.rejects(call(s.port,undefined,'GET','/api/hello'),/UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED|unable to verify/i,'without the pinned CA the client refuses the stand-in');
});
