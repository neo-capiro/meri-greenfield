import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createServer} from 'node:https';
import {agentcoreEnvironment,createAgentCoreControlTransport} from '../agentcore-control-client.mjs';import {createRunnerTlsCertificateFixture} from '../native-authority/test/runner-tls-fixture.mjs';
test('control HTTPS uses only exact public PEM trust and refuses altered pins/origins; no global TLS mutation',async t=>{
 const certificates=createRunnerTlsCertificateFixture(t),leaf=certificates.issueLeaf('control','IP:127.0.0.1');let requests=0;
 const server=createServer({...leaf,ca:certificates.ca,minVersion:'TLSv1.3'},(req,res)=>{requests++;let bytes=0;req.on('data',part=>{bytes+=part.length;});req.on('end',()=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({bytes}));});});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const env={MERI_CONTROL_ORIGIN:'https://127.0.0.1:'+server.address().port,MERI_CONTROL_CA_BASE64:certificates.ca.toString('base64'),MERI_CONTROL_CA_SHA256:createHash('sha256').update(certificates.ca).digest('hex'),AWS_REGION:'us-east-1'},before=process.env.NODE_TLS_REJECT_UNAUTHORIZED;
 const configuration=agentcoreEnvironment(env),transport=createAgentCoreControlTransport(configuration);
 try{const response=await transport.fetch(configuration.origin+'/v1/runner/load',{method:'POST',redirect:'error',body:'{}',headers:{'content-type':'application/json'}});assert.deepEqual(await response.json(),{bytes:2});
 for(const patch of [{MERI_CONTROL_CA_SHA256:'a'.repeat(64)},{MERI_CONTROL_CA_BASE64:env.MERI_CONTROL_CA_BASE64+'\n'},{MERI_CONTROL_ORIGIN:env.MERI_CONTROL_ORIGIN+'/path'},{AWS_REGION:'eu-west-1'}])assert.throws(()=>agentcoreEnvironment({...env,...patch}));
 await assert.rejects(transport.fetch('https://foreign.invalid/v1/runner/load',{method:'POST',redirect:'error',body:'{}'}));assert.equal(requests,1);assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED,before);
 }finally{transport.close();await new Promise(resolve=>server.close(resolve));}
});
