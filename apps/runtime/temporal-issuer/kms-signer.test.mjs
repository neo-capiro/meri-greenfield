import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign as localSign, constants} from 'node:crypto';
import {createTemporalIssuerKmsSigner,parseTemporalIssuerKmsSignerConfiguration} from './kms-signer.mjs';

const KEY_ARN='arn:aws:kms:us-east-1:967807252336:key/11111111-1111-4111-8111-111111111111';
const KID='meri-temporal-issuer-v1';
const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
const material=keys.publicKey.export({format:'jwk'});
const publicJwk={kty:'RSA',kid:KID,alg:'RS256',use:'sig',n:material.n,e:material.e};
const DER=keys.publicKey.export({format:'der',type:'spki'});
const PIN=createHash('sha256').update(JSON.stringify(publicJwk),'utf8').digest('hex');
const config=()=>({schemaVersion:1,keyArn:KEY_ARN,kid:KID,publicJwk,publicJwkSha256:PIN});
const message=Buffer.from('eyJhbGciOiJSUzI1NiJ9.eyJwZXJtaXNzaW9ucyI6WyJtZXJpOndyaXRlIl19','ascii');
const failure=promise=>assert.rejects(promise,{code:'TEMPORAL_ISSUER_KMS_REFUSED'});
class GetPublicKeyCommand{constructor(input){this.input=input;}}
class SignCommand{constructor(input){this.input=input;}}
const commands={GetPublicKeyCommand,SignCommand};
const publicReply=()=>({KeyId:KEY_ARN,KeySpec:'RSA_2048',KeyUsage:'SIGN_VERIFY',
 SigningAlgorithms:['RSASSA_PSS_SHA_256','RSASSA_PKCS1_V1_5_SHA_256'],PublicKey:DER});

function fakeClient({getPublicKey=publicReply,sign}={}){
 const calls=[];
 const client={async send(command,options){calls.push({command,options});
  if(command instanceof GetPublicKeyCommand)return getPublicKey();
  if(command instanceof SignCommand)return sign?.(command.input);
  throw Error('unexpected synthetic command');}};
 return {client,calls};
}

test('closed parser pins exact key ARN and canonical public JWK',()=>{
 const parsed=parseTemporalIssuerKmsSignerConfiguration(config());
 assert.equal(parsed.keyArn,KEY_ARN);
 assert.equal(parsed.spkiSha256,createHash('sha256').update(DER).digest('hex'));
 assert.throws(()=>parseTemporalIssuerKmsSignerConfiguration({...config(),extra:true}),{code:'TEMPORAL_ISSUER_KMS_REFUSED'});
 assert.throws(()=>parseTemporalIssuerKmsSignerConfiguration({...config(),keyArn:'alias/meri-temporal'}),{code:'TEMPORAL_ISSUER_KMS_REFUSED'});
 assert.throws(()=>parseTemporalIssuerKmsSignerConfiguration({...config(),publicJwkSha256:'0'.repeat(64)}),{code:'TEMPORAL_ISSUER_KMS_REFUSED'});
 assert.throws(()=>parseTemporalIssuerKmsSignerConfiguration({...config(),publicJwk:{...publicJwk,d:'private'}}),{code:'TEMPORAL_ISSUER_KMS_REFUSED'});
 // Only the actual parser result, not caller JSON with a forged derived field,
 // is accepted by the factory's parsed-object path.
 assert.throws(()=>createTemporalIssuerKmsSigner({configuration:{...parsed},kmsClient:{send(){}} ,commands}),{code:'TEMPORAL_ISSUER_KMS_REFUSED'});
});

test('matching KMS SPKI is bound once and each digest signature is locally verified',async()=>{
 const {client,calls}=fakeClient({sign:input=>{
  assert.equal(input.KeyId,KEY_ARN);
  assert.equal(input.MessageType,'DIGEST');
  assert.equal(input.SigningAlgorithm,'RSASSA_PKCS1_V1_5_SHA_256');
  assert.deepEqual(Buffer.from(input.Message),createHash('sha256').update(message).digest());
  return {KeyId:KEY_ARN,SigningAlgorithm:input.SigningAlgorithm,
   Signature:localSign('sha256',message,{key:keys.privateKey,padding:constants.RSA_PKCS1_PADDING})};
 }});
 const signer=createTemporalIssuerKmsSigner({configuration:parseTemporalIssuerKmsSignerConfiguration(config()),kmsClient:client,commands});
 await failure(signer.sign(message));
 assert.deepEqual(await signer.initialize(),{keyArn:KEY_ARN,kid:KID,publicJwkSha256:PIN});
 assert.deepEqual(await signer.initialize(),{keyArn:KEY_ARN,kid:KID,publicJwkSha256:PIN});
 const signature=await signer.sign(message);
 assert.equal(signature.length,256);
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0].command.input,{KeyId:KEY_ARN});
 signer.close();
 await failure(signer.sign(message));
});

test('wrong KMS key, spec, usage, algorithm or public bytes never initialize',async()=>{
 const variants=[
  {...publicReply(),KeyId:KEY_ARN.replace('11111111','22222222')},
  {...publicReply(),KeySpec:'RSA_4096'},
  {...publicReply(),KeyUsage:'ENCRYPT_DECRYPT'},
  {...publicReply(),SigningAlgorithms:['RSASSA_PSS_SHA_256']},
  {...publicReply(),PublicKey:generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({format:'der',type:'spki'})},
 ];
 for(const reply of variants){
  const {client,calls}=fakeClient({getPublicKey:()=>reply});
  const signer=createTemporalIssuerKmsSigner({configuration:config(),kmsClient:client,commands});
  await failure(signer.initialize());
  await failure(signer.sign(message));
  assert.equal(calls.length,1);
 }
});

test('wrong Sign metadata or signature fails closed after successful key pin',async()=>{
 const valid=localSign('sha256',message,{key:keys.privateKey,padding:constants.RSA_PKCS1_PADDING});
 const variants=[
  {KeyId:'arn:aws:kms:us-east-1:967807252336:key/22222222-2222-4222-8222-222222222222',SigningAlgorithm:'RSASSA_PKCS1_V1_5_SHA_256',Signature:valid},
  {KeyId:KEY_ARN,SigningAlgorithm:'RSASSA_PSS_SHA_256',Signature:valid},
  {KeyId:KEY_ARN,SigningAlgorithm:'RSASSA_PKCS1_V1_5_SHA_256',Signature:Buffer.alloc(256)},
 ];
 for(const reply of variants){
  const {client}=fakeClient({sign:()=>reply});
  const signer=createTemporalIssuerKmsSigner({configuration:config(),kmsClient:client,commands});
  await signer.initialize();await failure(signer.sign(message));signer.close();
 }
});

test('close aborts a pending KMS Sign and cannot release a late signature',async()=>{
 let complete;const waiting=new Promise(resolve=>{complete=resolve;});
 const {client,calls}=fakeClient({sign:()=>waiting});
 const signer=createTemporalIssuerKmsSigner({configuration:config(),kmsClient:client,commands});
 await signer.initialize();
 const pending=signer.sign(message);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,2);
 assert.equal(signer.close().state,'CLEANUP_UNKNOWN');
 await failure(pending);
 const unresolved=signer.close();
 assert.equal(unresolved.state,'CLEANUP_UNKNOWN');
 assert.ok(unresolved.pendingOperations>0);
 assert.equal(calls[1].options.abortSignal.aborted,true);
 complete({KeyId:KEY_ARN,SigningAlgorithm:'RSASSA_PKCS1_V1_5_SHA_256',
  Signature:localSign('sha256',message,{key:keys.privateKey,padding:constants.RSA_PKCS1_PADDING})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(signer.close(),unresolved);
 await failure(signer.sign(message));
});

test('close aborts a pending public-key preflight and rejects its late result',async()=>{
 let complete;const waiting=new Promise(resolve=>{complete=resolve;});
 const {client,calls}=fakeClient({getPublicKey:()=>waiting});
 const signer=createTemporalIssuerKmsSigner({configuration:config(),kmsClient:client,commands});
 const pending=signer.initialize();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);
 assert.equal(signer.close().state,'CLEANUP_UNKNOWN');
 await failure(pending);
 const unresolved=signer.close();
 assert.equal(unresolved.state,'CLEANUP_UNKNOWN');
 assert.equal(calls[0].options.abortSignal.aborted,true);
 complete(publicReply());
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(signer.close(),unresolved);
 await failure(signer.initialize());
});

test('second initialization caller can abort only its own wait',async()=>{
 let complete;const waiting=new Promise(resolve=>{complete=resolve;});
 const {client,calls}=fakeClient({getPublicKey:()=>waiting});
 const signer=createTemporalIssuerKmsSigner({configuration:config(),kmsClient:client,commands});
 const first=signer.initialize();
 await new Promise(resolve=>setImmediate(resolve));
 const secondController=new AbortController();
 const second=signer.initialize({signal:secondController.signal});
 secondController.abort();
 await failure(second);
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.abortSignal.aborted,false);
 complete(publicReply());
 assert.deepEqual(await first,{keyArn:KEY_ARN,kid:KID,publicJwkSha256:PIN});
 assert.equal(calls.length,1);
 signer.close();
});
