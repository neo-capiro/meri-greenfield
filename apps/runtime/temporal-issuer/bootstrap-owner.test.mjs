import assert from 'node:assert/strict';
import {X509Certificate, createHash, generateKeyPairSync, sign} from 'node:crypto';
import test from 'node:test';
import {createRunnerPoststartCsr} from '../native-authority/runner-poststart-csr.mjs';
import {createTemporalServiceClientCertificateIssuerFromMaterial} from './service-client-certificate.mjs';
import {createTemporalIssuerBootstrapOwner} from './bootstrap-owner.mjs';

const NOW=Date.UTC(2026,9,17,12,0,0),account='123456789012',region='us-east-1';
const cluster=`arn:aws:ecs:${region}:${account}:cluster/meri-preview`;
const TASK=`arn:aws:ecs:${region}:${account}:task/meri-preview/${'a'.repeat(32)}`;
const IP='10.0.1.4';
const length=n=>n<128?Buffer.from([n]):n<256?Buffer.from([0x81,n]):Buffer.from([0x82,n>>8,n&255]);
const der=(tag,...parts)=>{const bytes=Buffer.concat(parts);return Buffer.concat([Buffer.from([tag]),length(bytes.length),bytes]);};
const oid=hex=>der(0x06,Buffer.from(hex,'hex'));
const algorithm=Buffer.from('300d06092a864886f70d01010b0500','hex');
const extension=(name,inner)=>der(0x30,oid(name),Buffer.from([0x01,0x01,0xff]),der(0x04,inner));
function time(ms){const iso=new Date(ms).toISOString();return der(0x17,Buffer.from(iso.slice(2,4)+iso.slice(5,7)+iso.slice(8,10)+iso.slice(11,13)+iso.slice(14,16)+iso.slice(17,19)+'Z'));}
function pem(bytes){return `-----BEGIN CERTIFICATE-----\n${bytes.toString('base64').match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`;}
function memoryCa(){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
 const subject=der(0x30,der(0x31,der(0x30,oid('550403'),der(0x0c,Buffer.from('Test Temporal CA')))));
 const extensions=der(0xa3,der(0x30,extension('551d13',der(0x30,Buffer.from([0x01,0x01,0xff]))),
  extension('551d0f',Buffer.from('03020106','hex'))));
 const tbs=der(0x30,der(0xa0,Buffer.from([0x02,0x01,0x02])),der(0x02,Buffer.from([1])),
  algorithm,subject,der(0x30,time(NOW-60000),time(NOW+3600000)),subject,
  publicKey.export({type:'spki',format:'der'}),extensions);
 const signature=sign('sha256',tbs,privateKey);
 return {caPem:Buffer.from(pem(der(0x30,tbs,algorithm,der(0x03,Buffer.from([0]),signature)))),
  keyPem:Buffer.from(privateKey.export({type:'pkcs8',format:'pem'}))};
}
const material=memoryCa();
function rolePin(name){
 const prefix=name==='control'?'control':'worker';
 return {subject:`meri-temporal-${prefix}:v1`,workloadPrincipal:`meri-workload-${prefix}:v1`,
  peerSubjectCn:`meri-temporal-${prefix}`,peerUriBase:`spiffe://issuer.meri.internal/temporal/${prefix}/`,
  serviceArn:`arn:aws:ecs:${region}:${account}:service/meri-preview/meri-${prefix}`,
  taskDefinitionArn:`arn:aws:ecs:${region}:${account}:task-definition/meri-${prefix}:7`,
  containerName:`meri-${prefix}`,
  imageUri:`${account}.dkr.ecr.${region}.amazonaws.com/meri/${prefix}@sha256:${'b'.repeat(64)}`,
  taskRoleArn:`arn:aws:iam::${account}:role/meri-${prefix}-task`,
  executionRoleArn:`arn:aws:iam::${account}:role/meri-${prefix}-execution`,revision:'revision-17'};
}
function fixture(){
 let currentMs=NOW;
 const configuration={schemaVersion:1,clusterArn:cluster,vpcId:'vpc-12345678',
  privateSubnetIds:['subnet-12345678'],securityGroupIds:['sg-12345678'],maxLeaseMs:10000,
  roles:{control:rolePin('control'),'temporal-worker':rolePin('temporal-worker')}};
 const pin=configuration.roles.control,csr=createRunnerPoststartCsr(),calls=[];
 const socket={encrypted:true,remoteAddress:IP};
 const fact=()=>({state:'CURRENT',role:'control',taskArn:TASK,peerIPv4:IP,
  revision:pin.revision,serviceArn:pin.serviceArn,taskDefinitionArn:pin.taskDefinitionArn,
  imageUri:pin.imageUri,taskRoleArn:pin.taskRoleArn,executionRoleArn:pin.executionRoleArn,
  observedAtMs:NOW,validUntilMs:NOW+10000});
 const ports={taskProof:{async readCurrent(request){calls.push('proof');
   assert.equal(request.role,'control');assert.equal(request.taskArn,TASK);
   assert.equal(request.peerIPv4,IP);return ports.nextFact?.()??fact();}},
  registration:{async readTaskCurrent(request){calls.push('registrationRead');
   assert.equal(request.role,'control');assert.equal(request.taskArn,TASK);
   return ports.nextPrior?.()??{schemaVersion:1,state:'ABSENT',certificateSha256:null};},
   async registerCurrent(row){calls.push('register');
   ports.registrationRow=row;
   ports.registrationReceipt=ports.nextReceipt?.(row)??{schemaVersion:1,state:'CURRENT',
    certificateSha256:row.certificateSha256,role:row.role,peerSanUri:row.peerSanUri,
    taskArn:row.taskArn,revision:row.revision,expiresAtMs:row.expiresAtMs};
   return ports.registrationReceipt;},
   async readCurrent(request){calls.push('bindingRead');
    assert.equal(request.certificateSha256,ports.registrationRow.certificateSha256);
    return ports.nextPrimary?.()??ports.registrationReceipt;}}};
 const certificateIssuer=createTemporalServiceClientCertificateIssuerFromMaterial({...material,
  caSha256:createHash('sha256').update(new X509Certificate(material.caPem).raw).digest('hex'),
  now:()=>currentMs});
 const owner=createTemporalIssuerBootstrapOwner({configuration,taskProof:ports.taskProof,
  registration:ports.registration,certificateIssuer,now:()=>currentMs});
 const body={schemaVersion:1,role:'control',taskArn:TASK,csrPem:csr.csrPem};
 async function challenge(){return owner.challenge(body,{socket});}
 async function redeem(challenge){return owner.redeem({...body,challengeId:challenge.challengeId,
  proofBase64:csr.signProof(Buffer.from(challenge.proofMessage,'base64'))},{socket});}
 return {owner,configuration,body,socket,csr,pin,ports,calls,fact,challenge,redeem,
  certificateIssuer,advance:milliseconds=>{currentMs+=milliseconds;}};
}

test('post-placement challenge proves CSR possession and returns only persisted task certificate',async()=>{
 const f=fixture(),challenge=await f.challenge();
 const result=await f.redeem(challenge);
 assert.equal(result.schemaVersion,1);
 assert.equal(result.registration.certificateSha256,f.ports.registrationRow.certificateSha256);
 assert.equal(result.registration.peerSanUri,f.pin.peerUriBase+encodeURIComponent(TASK));
 assert.equal(f.ports.registrationRow.proofObservedAtMs,NOW);
 assert.deepEqual(f.calls,['proof','proof','registrationRead','proof','register','bindingRead','proof']);
 await assert.rejects(f.redeem(challenge),{code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
 f.owner.close();f.certificateIssuer.close();
});

test('direct observed TLS peer is required, and a failed redeem consumes the challenge',async()=>{
 const f=fixture(),challenge=await f.challenge();
 await assert.rejects(f.owner.redeem({...f.body,challengeId:challenge.challengeId,
  proofBase64:f.csr.signProof(Buffer.from(challenge.proofMessage,'base64'))},
 {socket:{encrypted:true,remoteAddress:'10.0.1.5'}}),{code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
 await assert.rejects(f.redeem(challenge),{code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
 assert.deepEqual(f.calls,['proof']);
 await assert.rejects(f.owner.challenge(f.body,{socket:{encrypted:false,remoteAddress:IP}}),
  {code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
});

test('a changed current task fact or revoked task refuses before registration',async()=>{
 const f=fixture(),challenge=await f.challenge();
 f.ports.nextFact=()=>({...f.fact(),imageUri:'bad-image'});
 await assert.rejects(f.redeem(challenge),{code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
 assert.deepEqual(f.calls,['proof','proof']);
 const g=fixture();g.ports.nextFact=()=>({...g.fact(),state:'REVOKED'});
 await assert.rejects(g.challenge(),{code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
 assert.deepEqual(g.calls,['proof']);
});

test('substituted proof and wrong durable receipt cannot release a certificate',async()=>{
 const f=fixture(),challenge=await f.challenge();
 await assert.rejects(f.owner.redeem({...f.body,challengeId:challenge.challengeId,
  proofBase64:Buffer.alloc(256).toString('base64')},{socket:f.socket}),
  {code:'RUNNER_POSTSTART_REFUSED'});
 assert.deepEqual(f.calls,['proof']);
 const g=fixture(),second=await g.challenge();
 g.ports.nextReceipt=row=>({schemaVersion:1,state:'CURRENT',certificateSha256:'0'.repeat(64),
  role:row.role,peerSanUri:row.peerSanUri,taskArn:row.taskArn,
  revision:row.revision,expiresAtMs:row.expiresAtMs});
 await assert.rejects(g.redeem(second),{code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
 assert.deepEqual(g.calls,['proof','proof','registrationRead','proof','register']);
});

test('canonical registration rejects a proof lease that expires before its transaction commits',async()=>{
 const f=fixture(),challenge=await f.challenge();
 f.ports.nextFact=()=>({...f.fact(),validUntilMs:f.calls.filter(call=>call==='proof').length===3?NOW+100:NOW+10000});
 f.ports.nextReceipt=row=>{f.advance(200);
  assert.equal(row.proofValidUntilMs<=NOW+200,true);
  throw Object.assign(Error('TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'),
   {code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});};
 await assert.rejects(f.redeem(challenge),{code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
 assert.deepEqual(f.calls,['proof','proof','registrationRead','proof','register']);
});

test('rotation is CAS-bound to the prior fingerprint and checked again on primary read',async()=>{
 const f=fixture(),challenge=await f.challenge(),prior='c'.repeat(64);
 f.ports.nextPrior=()=>({schemaVersion:1,state:'CURRENT',certificateSha256:prior,
  role:'control',peerSanUri:f.pin.peerUriBase+encodeURIComponent(TASK),
  taskArn:TASK,revision:f.pin.revision,expiresAtMs:NOW+1000});
 const result=await f.redeem(challenge);
 assert.equal(f.ports.registrationRow.expectedCertificateSha256,prior);
 assert.equal(result.registration.certificateSha256,f.ports.registrationRow.certificateSha256);
 const g=fixture(),other=await g.challenge();
 g.ports.nextPrimary=()=>({schemaVersion:1,state:'REVOKED',certificateSha256:null});
 await assert.rejects(g.redeem(other),{code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
 assert.deepEqual(g.calls,['proof','proof','registrationRead','proof','register','bindingRead']);
});

test('task stop after registration commit and primary read prevents certificate release',async()=>{
 const f=fixture(),challenge=await f.challenge();
 f.ports.nextFact=()=>f.calls.filter(call=>call==='proof').length===4?
  {...f.fact(),state:'REVOKED'}:f.fact();
 await assert.rejects(f.redeem(challenge),{code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
 assert.deepEqual(f.calls,['proof','proof','registrationRead','proof','register','bindingRead','proof']);
 const g=fixture(),other=await g.challenge();
 g.ports.nextFact=()=>g.calls.filter(call=>call==='proof').length===4?
  {...g.fact(),state:'UNAVAILABLE'}:g.fact();
 await assert.rejects(g.redeem(other),{code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
 assert.deepEqual(g.calls,['proof','proof','registrationRead','proof','register','bindingRead','proof']);
});

test('registration is mandatory, and close/abort fail closed',async()=>{
 const f=fixture();
 assert.throws(()=>createTemporalIssuerBootstrapOwner({configuration:f.configuration,
  taskProof:f.ports.taskProof,certificateIssuer:f.certificateIssuer}),
  {code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
 await assert.rejects(f.owner.challenge(f.body,{socket:f.socket,signal:AbortSignal.abort()}),
  {code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
 f.owner.close();
 await assert.rejects(f.challenge(),{code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
});

test('close reports a held AWS task proof until the raw read actually settles',async()=>{
 const f=fixture();let release;
 f.ports.taskProof.readCurrent=()=>new Promise(resolve=>{release=resolve;});
 const pending=f.challenge();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof release,'function');
 const receipt=f.owner.close();
 assert.equal(receipt.state,'CLEANUP_UNKNOWN');
 assert.ok(receipt.pendingOperations>0);
 await assert.rejects(pending,{code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
 assert.equal(f.owner.close().state,'CLEANUP_UNKNOWN');
 release(f.fact());
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.owner.close(),receipt);
});

test('close cannot claim a held durable registration settled or release its late certificate',async()=>{
 const f=fixture(),issued=await f.challenge();let release;
 f.ports.registration.registerCurrent=row=>{f.calls.push('register');
  f.ports.registrationRow=row;return new Promise(resolve=>{release=resolve;});};
 const pending=f.redeem(issued);
 for(let attempt=0;attempt<30&&typeof release!=='function';attempt++)
  await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof release,'function');
 const receipt=f.owner.close();
 assert.equal(receipt.state,'CLEANUP_UNKNOWN');
 await assert.rejects(pending,{code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
 assert.equal(f.owner.close().state,'CLEANUP_UNKNOWN');
 release({schemaVersion:1,state:'CURRENT',certificateSha256:f.ports.registrationRow.certificateSha256,
  role:'control',peerSanUri:f.ports.registrationRow.peerSanUri,taskArn:TASK,
  revision:f.pin.revision,expiresAtMs:f.ports.registrationRow.expiresAtMs});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.owner.close(),receipt);
 assert.equal(f.calls.includes('bindingRead'),false);
});
