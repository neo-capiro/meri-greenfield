import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {X509Certificate} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createRunnerPoststartCsr,parseRunnerPoststartCsr} from '../runner-poststart-csr.mjs';
import {createRunnerPoststartAuthority} from '../runner-poststart-authority.mjs';
import {createRunnerPoststartCertificateIssuerFromMaterial} from '../runner-poststart-certificate-issuer.mjs';
import {createRunnerPoststartApplication} from '../runner-poststart-http.mjs';
import {compileRunnerTlsServerMaterial} from '../runner-tls-server.mjs';
import {taskRouterFixture} from './task-router-fixture.mjs';

function fixture(t,{serialBytes}={}){
 const f=taskRouterFixture(),expiresAtMs=Date.now()+2*86400000,original={...f.original,expiresAtMs},grantIntents=f.record.grantIntents.map(row=>({...row,expiresAtMs})),record={...f.record,original,expiresAtMs,grantIntents},resource=f.resource,issued={...f.issued,expiresAtMs,materialRef:'material:'+f.original.executionKey},candidate={...f.candidate,expiresAtMs};
 issued.factsSha256=hash({original,allocationSha256:record.allocationSha256,taskRequestSha256:record.taskRequestSha256,qualification:record.qualification,grantIntents,grantId:issued.grantId,operations:f.config.operations,controlCapabilitySha256:f.config.controlCapabilitySha256,transport:f.config.transport});
 const task={taskArn:resource.taskArn,clusterArn:resource.clusterArn,taskDefinitionArn:resource.taskDefinitionArn,startedBy:original.executionKey,group:'meri:'+original.executionId,createdAt:new Date(resource.createdAtMs),launchType:'FARGATE',platformFamily:'Linux',platformVersion:'1.4.0',enableExecuteCommand:false,lastStatus:'RUNNING',desiredStatus:'RUNNING',tags:[{key:'meri:execution-id',value:original.executionId},{key:'meri:binding-sha256',value:hash(original.binding)},{key:'meri:plan-sha256',value:original.planSha256},{key:'meri:expires-at-ms',value:String(expiresAtMs)}],containers:[{name:'worker',taskArn:resource.taskArn,containerArn:resource.clusterArn.replace(':cluster/',':container/')+'/'+resource.taskArn.split('/').at(-1)+'/11111111-1111-4111-8111-111111111111',imageDigest:original.versions.imageDigest,image:'repo@'+original.versions.imageDigest,lastStatus:'RUNNING'}]};
 const directory=mkdtempSync(join(tmpdir(),'meri-poststart-test-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const openssl=process.platform==='win32'?'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe':'openssl',run=args=>execFileSync(openssl,args,{cwd:directory,stdio:'ignore'});
 run(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.pem','-days','3','-subj','/CN=poststart-test-ca']);
 const ca=readFileSync(join(directory,'ca.pem')),certIssuer=createRunnerPoststartCertificateIssuerFromMaterial({caPem:ca,keyPem:readFileSync(join(directory,'ca.key')),...(serialBytes?{serialBytes}:{})});let retired=false,reads=0,resolves=0,certs=0;
 const owner=createRunnerPoststartAuthority({issuanceStore:{async read(){return issued;}},allocations:{async read(){return {run:{binding:original.binding,state:retired?'cancelled':'running'},record};}},async admissionForBinding(){return {async read(){return {state:'ADMITTED',grantFactsJsons:record.resource.grantFactsJsons,currentAllocationJson:JSON.stringify({binding:original.binding,policyRevision:record.qualification.policyRevision,deadlineMs:expiresAtMs,checkedAtMs:Date.now(),allocation:{synthetic:'canonical-admission-output'},allocationSha256:record.allocationSha256})};}};},taskReader:{async read(){reads++;return task;}},networkReader:{async observe(){return {...candidate,checkedAtMs:Date.now()};}},issuer:{async resolve(){resolves++;return f.taskCredential;}},runnerConfiguration:{async forOriginal(){return {limits:{startupMs:1000,shutdownMs:1000,requestMs:1000,requestBytes:131072},native:{maxResponseBytes:131072},workspace:'/workspace/'+original.binding.conversationId,proxyOrigin:'https://proxy.invalid'};}},certificateIssuer:{async issue(value){certs++;return certIssuer.issue(value);}},controlCa:ca,runnerCa:ca,zone:'runner.invalid',controlCapabilitySha256:f.config.controlCapabilitySha256,operations:f.config.operations,transport:f.config.transport});
 const app=createRunnerPoststartApplication({authority:owner,privateIngress:f.privateIngress});
 const post=(step,body,peer='10.40.1.42',ingress=f.ingress)=>app.privateApplication.handle(new Request('https://control.invalid/v1/runner-poststart/'+step,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'203.0.113.1, '+peer},body:JSON.stringify({schemaVersion:1,taskArn:resource.taskArn,...body})}),{ingress});
 return {f,owner,post,original,task,issued,record,get counts(){return {reads,resolves,certs};},retire:()=>{retired=true;}};
}
test('ephemeral CSR signature and nonce proof reject alteration',()=>{const c=createRunnerPoststartCsr(),p=parseRunnerPoststartCsr(c.csrPem);assert.equal(p.publicKey.asymmetricKeyType,'rsa');assert.throws(()=>parseRunnerPoststartCsr(c.csrPem.replace('A','B')));});
test('private poststart exchange joins current owners, signs exact task certificate and consumes challenge once',async t=>{
 const f=fixture(t),csr=createRunnerPoststartCsr();
 assert.equal((await f.post('challenge',{csrPem:csr.csrPem},'10.40.1.42',{})).status,403);
 assert.equal((await f.post('challenge',{csrPem:csr.csrPem},'10.40.1.43')).status,403);
 const challenge=await(await f.post('challenge',{csrPem:csr.csrPem})).json();assert.equal(challenge.schemaVersion,1);
 const proofBase64=csr.signProof(Buffer.from(challenge.proofMessage,'base64'));
 const response=await f.post('redeem',{csrPem:csr.csrPem,challengeId:challenge.challengeId,proofBase64});assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.original.executionKey,f.original.executionKey);assert.equal(body.delivery.capability,f.f.taskCredential);assert.equal(body.tls.candidate.taskArn,f.f.resource.taskArn);assert.equal(f.counts.resolves,1);assert.equal(f.counts.certs,1);
 const tls=compileRunnerTlsServerMaterial({original:f.original,candidate:body.tls.candidate,metadata:{TaskARN:f.f.resource.taskArn,Cluster:f.f.resource.clusterArn,Containers:[{Name:'worker',Networks:[{NetworkMode:'awsvpc',IPv4Addresses:['10.40.1.42']}]}]},ca:Buffer.from(body.tls.ca,'base64'),cert:Buffer.from(body.tls.cert,'base64'),key:csr.keyPem,zone:body.tls.zone});assert.equal(tls.minVersion,'TLSv1.3');
 assert.equal((await f.post('redeem',{csrPem:csr.csrPem,challengeId:challenge.challengeId,proofBase64})).status,403);f.owner.close();
});
test('wrong proof and current durable revocation release no material',async t=>{
 const f=fixture(t),csr=createRunnerPoststartCsr(),challenge=await(await f.post('challenge',{csrPem:csr.csrPem})).json();
 assert.equal((await f.post('redeem',{csrPem:csr.csrPem,challengeId:challenge.challengeId,proofBase64:Buffer.alloc(256).toString('base64')})).status,403);
 assert.equal(f.counts.resolves,0);
 const next=await(await f.post('challenge',{csrPem:csr.csrPem})).json();f.retire();
 assert.equal((await f.post('redeem',{csrPem:csr.csrPem,challengeId:next.challengeId,proofBase64:csr.signProof(Buffer.from(next.proofMessage,'base64'))})).status,403);
 assert.equal(f.counts.resolves,0);f.owner.close();
});
test('an exact running ENI peer sees only bounded ALLOCATED pending',async t=>{
 const f=fixture(t),csr=createRunnerPoststartCsr();f.record.state='ALLOCATED';
 assert.equal((await f.post('challenge',{csrPem:csr.csrPem},'10.40.1.43')).status,403);
 const response=await f.post('challenge',{csrPem:csr.csrPem});assert.equal(response.status,503);assert.equal((await response.json()).error.code,'RUNNER_POSTSTART_PENDING');assert.equal(f.counts.resolves,0);
 f.record.state='ADMITTED';assert.equal((await f.post('challenge',{csrPem:csr.csrPem})).status,200);f.owner.close();
});
test('all-zero sampled serial becomes a minimal positive DER integer',async t=>{
 const f=fixture(t,{serialBytes:()=>Buffer.alloc(16)}),csr=createRunnerPoststartCsr();
 const challenge=await(await f.post('challenge',{csrPem:csr.csrPem})).json();
 const response=await f.post('redeem',{csrPem:csr.csrPem,challengeId:challenge.challengeId,proofBase64:csr.signProof(Buffer.from(challenge.proofMessage,'base64'))});
 assert.equal(response.status,200);
 const body=await response.json(),leaf=new X509Certificate(Buffer.from(body.tls.cert,'base64'));
 assert.equal(leaf.serialNumber,'01'+'00'.repeat(15));f.owner.close();
});
