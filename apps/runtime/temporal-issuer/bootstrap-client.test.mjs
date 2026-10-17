import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {X509Certificate,createHash,generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {createTemporalServiceClientCertificateIssuerFromMaterial} from './service-client-certificate.mjs';
import {verifyRunnerPoststartProof} from '../native-authority/runner-poststart-csr.mjs';
import {createTemporalIssuerBootstrapClient,parseTemporalIssuerBootstrapClientConfiguration} from './bootstrap-client.mjs';

const NOW=Date.UTC(2026,9,17,12,0,0);
const CLUSTER='arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev';
const TASK='arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/0123456789abcdef0123456789abcdef';
const BASE='spiffe://issuer.meri.internal/temporal/control/';
const CN='meri-temporal-control';
const length=n=>n<128?Buffer.from([n]):n<256?Buffer.from([0x81,n]):Buffer.from([0x82,n>>8,n&255]);
const der=(tag,...parts)=>{const bytes=Buffer.concat(parts);return Buffer.concat([Buffer.from([tag]),length(bytes.length),bytes]);};
const oid=hex=>der(0x06,Buffer.from(hex,'hex'));
const algorithm=Buffer.from('300d06092a864886f70d01010b0500','hex');
const extension=(name,inner)=>der(0x30,oid(name),Buffer.from([0x01,0x01,0xff]),der(0x04,inner));
function time(ms){const iso=new Date(ms).toISOString();return der(0x17,Buffer.from(iso.slice(2,4)+iso.slice(5,7)+iso.slice(8,10)+iso.slice(11,13)+iso.slice(14,16)+iso.slice(17,19)+'Z'));}
function pem(bytes){return `-----BEGIN CERTIFICATE-----\n${bytes.toString('base64').match(/.{1,64}/gu).join('\n')}\n-----END CERTIFICATE-----\n`;}
function memoryCa(){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
 const subject=der(0x30,der(0x31,der(0x30,oid('550403'),der(0x0c,Buffer.from('Task test CA')))));
 const extensions=der(0xa3,der(0x30,extension('551d13',der(0x30,Buffer.from([0x01,0x01,0xff]))),
  extension('551d0f',Buffer.from('03020106','hex'))));
 const tbs=der(0x30,der(0xa0,Buffer.from([0x02,0x01,0x02])),der(0x02,Buffer.from([1])),
  algorithm,subject,der(0x30,time(NOW-60000),time(NOW+3600000)),subject,
  publicKey.export({type:'spki',format:'der'}),extensions);
 const signature=sign('sha256',tbs,privateKey);
 return {caPem:Buffer.from(pem(der(0x30,tbs,algorithm,der(0x03,Buffer.from([0]),signature)))),
  keyPem:Buffer.from(privateKey.export({type:'pkcs8',format:'pem'}))};
}
const pin=buffer=>createHash('sha256').update(new X509Certificate(buffer).raw).digest('hex');
function response(callback,value,{secure=false,authorized=true,statusCode=200}={}){
 const raw=Buffer.from(JSON.stringify(value));
 const reply=new EventEmitter();reply.statusCode=statusCode;
 reply.headers={'content-type':'application/json','content-length':String(raw.length)};
 reply.socket=secure?{encrypted:true,authorized,getProtocol:()=> 'TLSv1.3'}:{};
 reply.complete=true;reply.rawTrailers=[];
 reply.destroy=()=>reply.emit('aborted');
 callback(reply);queueMicrotask(()=>{reply.emit('data',raw);reply.emit('end');});
}
function fixture(){
 const ca=memoryCa(),caSha256=pin(ca.caPem),issuer=createTemporalServiceClientCertificateIssuerFromMaterial({
  ...ca,caSha256,now:()=>NOW});
 const otherCa=memoryCa(),otherIssuer=createTemporalServiceClientCertificateIssuerFromMaterial({
  ...otherCa,caSha256:pin(otherCa.caPem),now:()=>NOW});
 const configuration={schemaVersion:1,role:'control',clusterArn:CLUSTER,revision:'rev-1',
  issuerOrigin:'https://issuer.meri.internal:8445',serverName:'issuer.meri.internal',
  metadataUri:'http://169.254.170.2/v4/abcdef0123456789',peerSubjectCn:CN,
  peerUriBase:BASE,serverCaSha256:caSha256,clientCaSha256:caSha256,
  requestTimeoutMs:2000,totalTimeoutMs:10000,maxReplyBytes:16384};
 let challenge,heldCsr,redeemBody,metadataArn=TASK,authorized=true,wrongReceipt=false,wrongLeaf=false;
 const calls=[];
 function fakeRequest(secure){return (url,options,callback)=>{
  const call=new EventEmitter();call.destroy=()=>call.emit('error',Error('destroyed'));
  call.end=body=>queueMicrotask(async()=>{
   try{
    calls.push({secure,url:url.toString(),options,body:body&&JSON.parse(body.toString())});
    if(!secure){response(callback,{TaskARN:metadataArn});return;}
    assert.equal(options.method,'POST');assert.equal(options.servername,'issuer.meri.internal');
    assert.equal(options.minVersion,'TLSv1.3');assert.equal(options.rejectUnauthorized,true);
    if(url.pathname.endsWith('/challenge')){
     heldCsr=JSON.parse(body.toString());const id=randomUUID(),expiresAtMs=NOW+15000;
     const message=Buffer.from(JSON.stringify({schemaVersion:1,
      purpose:'meri-temporal-service-client-cert-bootstrap',challengeId:id,
      nonce:randomBytes(32).toString('base64url'),role:heldCsr.role,taskArn:heldCsr.taskArn,
      peerIPv4:'10.0.1.4',revision:configuration.revision,taskFactSha256:'a'.repeat(64),
      csrSha256:createHash('sha256').update(heldCsr.csrPem).digest('hex'),expiresAtMs}));
     challenge={schemaVersion:1,challengeId:id,proofMessage:message.toString('base64'),expiresAtMs};
     response(callback,challenge,{secure,authorized});return;
    }
    redeemBody=JSON.parse(body.toString());
    verifyRunnerPoststartProof({csrPem:redeemBody.csrPem,
     message:Buffer.from(challenge.proofMessage,'base64'),proofBase64:redeemBody.proofBase64});
    const issued=await (wrongLeaf?otherIssuer:issuer).issue({csrPem:redeemBody.csrPem,
     proofMessage:Buffer.from(challenge.proofMessage,'base64'),proofBase64:redeemBody.proofBase64,
     taskArn:TASK,peerSubjectCn:CN,peerUriBase:BASE,notAfterMs:NOW+300000});
    const registration={schemaVersion:1,state:'CURRENT',certificateSha256:wrongReceipt?
     '0'.repeat(64):issued.certificateSha256,role:'control',peerSanUri:issued.peerSanUri,
     taskArn:TASK,revision:'rev-1',expiresAtMs:issued.expiresAtMs};
    response(callback,{schemaVersion:1,certPem:issued.certPem,registration},{secure,authorized});
   }catch(error){call.emit('error',error);}
  });
  return call;
 };}
 const bootstrap=()=>createTemporalIssuerBootstrapClient({configuration,
  serverCaPem:ca.caPem,clientCaPem:ca.caPem,
  metadataRequest:fakeRequest(false),request:fakeRequest(true),now:()=>NOW});
 return {bootstrap,configuration,calls,issuer,otherIssuer,caPem:ca.caPem,
  setMetadataArn:value=>{metadataArn=value;},setAuthorized:value=>{authorized=value;},
  setWrongReceipt:value=>{wrongReceipt=value;},setWrongLeaf:value=>{wrongLeaf=value;},
  get redeemBody(){return redeemBody;}};
}

test('post-placement bootstrap signs the one-use CSR challenge and returns only verified task material',async()=>{
 const f=fixture(),client=f.bootstrap(),result=await client.bootstrap();
 assert.equal(result.taskArn,TASK);assert.equal(result.role,'control');
 assert.equal(result.registration.certificateSha256,result.certificateSha256);
 assert.equal(result.registration.peerSanUri,BASE+encodeURIComponent(TASK));
 assert.equal(new X509Certificate(result.certPem).verify(new X509Certificate(f.caPem).publicKey),true);
 assert.equal(f.calls[0].url,'http://169.254.170.2/v4/abcdef0123456789/task');
 assert.deepEqual(f.calls.slice(1).map(item=>new URL(item.url).pathname),[
  '/v1/internal/temporal/bootstrap/challenge','/v1/internal/temporal/bootstrap/redeem']);
 assert.deepEqual(f.calls.slice(1).map(item=>new URL(item.url).port),['8445','8445']);
 assert.equal(f.redeemBody.taskArn,TASK);
 await assert.rejects(client.bootstrap(),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 result.keyPem.fill(0);client.close();f.issuer.close();f.otherIssuer.close();
});

test('metadata selector, server TLS, and durable certificate receipt all fail closed',async()=>{
 const wrong=fixture();wrong.setMetadataArn('arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/not-valid');
 await assert.rejects(wrong.bootstrap().bootstrap(),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.equal(wrong.calls.length,1);wrong.issuer.close();wrong.otherIssuer.close();
 const tls=fixture();tls.setAuthorized(false);
 await assert.rejects(tls.bootstrap().bootstrap(),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.equal(tls.calls.length,2);tls.issuer.close();tls.otherIssuer.close();
 const receipt=fixture();receipt.setWrongReceipt(true);
 await assert.rejects(receipt.bootstrap().bootstrap(),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.equal(receipt.calls.length,3);receipt.issuer.close();receipt.otherIssuer.close();
 const leaf=fixture();leaf.setWrongLeaf(true);
 await assert.rejects(leaf.bootstrap().bootstrap(),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.equal(leaf.calls.length,3);leaf.issuer.close();leaf.otherIssuer.close();
});

test('configuration excludes arbitrary metadata hosts, posted identity and loose CA pins',()=>{
 const f=fixture();
 assert.throws(()=>parseTemporalIssuerBootstrapClientConfiguration({...f.configuration,
  metadataUri:'http://example.com/v4/token'}),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.throws(()=>parseTemporalIssuerBootstrapClientConfiguration({...f.configuration,
  issuerOrigin:'https://issuer.meri.internal:8445/' }),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.throws(()=>parseTemporalIssuerBootstrapClientConfiguration({...f.configuration,
  issuerOrigin:'https://issuer.meri.internal'}),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.throws(()=>parseTemporalIssuerBootstrapClientConfiguration({...f.configuration,
  issuerOrigin:'https://issuer.meri.internal:8446'}),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.throws(()=>parseTemporalIssuerBootstrapClientConfiguration({...f.configuration,
  taskArn:TASK}),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.throws(()=>createTemporalIssuerBootstrapClient({configuration:{...f.configuration,
  clientCaSha256:'0'.repeat(64)},clientCaPem:f.caPem,
  serverCaPem:f.caPem}),{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 f.issuer.close();f.otherIssuer.close();
});

test('close aborts a pending metadata read without generating or releasing a task key',async()=>{
 const f=fixture();let destroyed=false,rawCall;
 const metadataRequest=()=>{const call=new EventEmitter();rawCall=call;call.end=()=>{};
  call.destroy=()=>{destroyed=true;call.emit('error',Error('closed'));};return call;};
 const client=createTemporalIssuerBootstrapClient({configuration:f.configuration,
  serverCaPem:f.caPem,clientCaPem:f.caPem,metadataRequest,
  request:()=>assert.fail('issuer request after cancellation'),now:()=>NOW});
 const pending=client.bootstrap();
 const receipt=client.close();
 assert.equal(receipt.state,'CLEANUP_UNKNOWN');
 await assert.rejects(pending,{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.equal(destroyed,true);assert.equal(client.available(),false);
 assert.equal(client.close().state,'CLEANUP_UNKNOWN');
 rawCall.emit('close');
 assert.equal(client.close(),receipt);
 f.issuer.close();f.otherIssuer.close();
});

test('a late TLS socket close cannot turn an aborted certificate bootstrap into CLEAN',async()=>{
 const f=fixture();let heldSocket,heldCall,lateSocketDestroy=0;
 const metadataRequest=(_url,_options,callback)=>{
  const call=new EventEmitter();call.destroy=()=>call.emit('error',Error('destroyed'));
  call.end=()=>{response(callback,{TaskARN:TASK});
   queueMicrotask(()=>call.emit('close'));};return call;
 };
 const request=()=>{
  const call=new EventEmitter(),socket=new EventEmitter();
  socket.destroy=()=>{lateSocketDestroy++;socket.emit('close');};heldCall=call;heldSocket=socket;
  call.destroy=()=>{call.emit('error',Error('destroyed'));call.emit('close');};
  call.end=()=>{};
  return call;
 };
 const client=createTemporalIssuerBootstrapClient({configuration:f.configuration,
  serverCaPem:f.caPem,clientCaPem:f.caPem,metadataRequest,request,now:()=>NOW});
 const pending=client.bootstrap();
 for(let n=0;n<20&&!heldSocket;n++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(heldSocket);
 const receipt=client.close();
 assert.equal(receipt.state,'CLEANUP_UNKNOWN');
 await assert.rejects(pending,{code:'TEMPORAL_ISSUER_BOOTSTRAP_CLIENT_REFUSED'});
 assert.ok(heldCall);
 heldCall.emit('socket',heldSocket);
 assert.equal(lateSocketDestroy,1);
 assert.equal(client.close(),receipt);
 f.issuer.close();f.otherIssuer.close();
});
