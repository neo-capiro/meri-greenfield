/** An exact-key AWS KMS signer for the Temporal issuer's RS256 token factory.
 * The key and KMS client are provisioned separately; this module creates neither. */
import {createHash, createPublicKey, verify as verifySignature, constants} from 'node:crypto';
import {types} from 'node:util';
import {validateTemporalIssuerPublicJwk} from './protocol.mjs';

const KEY_ARN=/^arn:aws:kms:us-east-1:967807252336:key\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const HEX=/^[0-9a-f]{64}$/u;
const KID=/^[A-Za-z0-9._:-]{1,128}$/u;
const ALGORITHM='RSASSA_PKCS1_V1_5_SHA_256';
const CONFIG_KEYS=['schemaVersion','keyArn','kid','publicJwk','publicJwkSha256'];
const JWK_KEYS=['kty','kid','alg','use','n','e'];
const SPEC_BITS=Object.freeze({RSA_2048:2048,RSA_3072:3072,RSA_4096:4096});
const parsedConfigurations=new WeakSet();
const fault=()=>Object.assign(Error('TEMPORAL_ISSUER_KMS_REFUSED'),{code:'TEMPORAL_ISSUER_KMS_REFUSED'});

function exact(value,keys){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&!types.isProxy(value)&&
  Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&
  keys.every(key=>Object.hasOwn(value,key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
}
function bytes(value){return value instanceof Uint8Array&&value.byteLength>0&&value.byteLength<=8192;}
function checkSignal(signal){if(signal?.aborted)throw fault();}

/** Pure closed configuration. The pinned hash follows PR122's exact JWK key order. */
export function parseTemporalIssuerKmsSignerConfiguration(raw){
 if(!exact(raw,CONFIG_KEYS)||raw.schemaVersion!==1||typeof raw.keyArn!=='string'||
    !KEY_ARN.test(raw.keyArn)||typeof raw.kid!=='string'||!KID.test(raw.kid)||
    typeof raw.publicJwkSha256!=='string'||!HEX.test(raw.publicJwkSha256)||
    !exact(raw.publicJwk,JWK_KEYS))throw fault();
 let key;try{key=validateTemporalIssuerPublicJwk(raw.publicJwk,raw.kid);}catch{throw fault();}
 const jwk=Object.freeze({kty:raw.publicJwk.kty,kid:raw.publicJwk.kid,
  alg:raw.publicJwk.alg,use:raw.publicJwk.use,n:raw.publicJwk.n,e:raw.publicJwk.e});
 const hash=createHash('sha256').update(JSON.stringify(jwk),'utf8').digest('hex');
 if(hash!==raw.publicJwkSha256)throw fault();
 const spki=key.export({format:'der',type:'spki'});
 const parsed=Object.freeze({schemaVersion:1,keyArn:raw.keyArn,kid:raw.kid,publicJwk:jwk,
  publicJwkSha256:hash,spkiSha256:createHash('sha256').update(spki).digest('hex')});
 parsedConfigurations.add(parsed);return parsed;
}

/**
 * `kmsClient` is an AWS SDK v3 KMSClient scoped to the reviewed issuer task role.
 * `commands` permits fake command constructors in source tests only. Production
 * dynamically loads the pinned @aws-sdk/client-kms package at initialize().
 */
export function createTemporalIssuerKmsSigner({configuration,kmsClient,commands,now=Date.now}={}){
 const c=configuration&&typeof configuration==='object'&&parsedConfigurations.has(configuration)?
  configuration:parseTemporalIssuerKmsSignerConfiguration(configuration);
 if(typeof kmsClient?.send!=='function'||typeof now!=='function'||
    (commands!==undefined&&(!exact(commands,['GetPublicKeyCommand','SignCommand'])||
      typeof commands.GetPublicKeyCommand!=='function'||typeof commands.SignCommand!=='function')))throw fault();
 const publicKey=validateTemporalIssuerPublicJwk(c.publicJwk,c.kid);
 const signatureLength=publicKey.asymmetricKeyDetails.modulusLength/8;
 let closed=false,initialized=false,initializing=null,loadedCommands=commands;
 const active=new Set();
 const ensureOpen=()=>{if(closed)throw fault();};
 async function commandTypes(){
  if(loadedCommands)return loadedCommands;
  const module=await import('@aws-sdk/client-kms');
  if(typeof module.GetPublicKeyCommand!=='function'||typeof module.SignCommand!=='function')throw fault();
  loadedCommands={GetPublicKeyCommand:module.GetPublicKeyCommand,SignCommand:module.SignCommand};
  return loadedCommands;
 }
 async function invoke(call,outerSignal){
  ensureOpen();checkSignal(outerSignal);
  const controller=new AbortController();active.add(controller);
  const abort=()=>controller.abort();
  outerSignal?.addEventListener('abort',abort,{once:true});
  if(outerSignal?.aborted)controller.abort();
  let stop;
  const stopped=new Promise((_,reject)=>{
   stop=()=>reject(fault());controller.signal.addEventListener('abort',stop,{once:true});
   if(controller.signal.aborted)stop();
  });
  try{
   const result=await Promise.race([Promise.resolve().then(()=>{
    ensureOpen();checkSignal(controller.signal);return call(controller.signal);
   }),stopped]);
   ensureOpen();checkSignal(controller.signal);return result;
  }finally{
   controller.signal.removeEventListener('abort',stop);
   outerSignal?.removeEventListener('abort',abort);active.delete(controller);
  }
 }
 async function awaitInitializerForCaller(promise,signal){
  checkSignal(signal);
  if(!signal)return promise;
  let abort;
  const stopped=new Promise((_,reject)=>{
   abort=()=>reject(fault());signal.addEventListener('abort',abort,{once:true});
   if(signal.aborted)abort();
  });
  try{
   const result=await Promise.race([promise,stopped]);
   checkSignal(signal);return result;
  }finally{signal.removeEventListener('abort',abort);}
 }
 async function initialize({signal}={}){
  ensureOpen();checkSignal(signal);
  if(initialized)return Object.freeze({keyArn:c.keyArn,kid:c.kid,publicJwkSha256:c.publicJwkSha256});
  // A second caller may stop waiting without aborting the first caller's
  // underlying GetPublicKey request or being handed a result after its abort.
  if(initializing)return awaitInitializerForCaller(initializing,signal);
  initializing=(async()=>{
   const {GetPublicKeyCommand}=await commandTypes();
   const reply=await invoke(abortSignal=>kmsClient.send(new GetPublicKeyCommand({KeyId:c.keyArn}),{abortSignal}),signal);
   if(reply?.KeyId!==c.keyArn||reply.KeyUsage!=='SIGN_VERIFY'||
      !Object.hasOwn(SPEC_BITS,reply.KeySpec)||
      !Array.isArray(reply.SigningAlgorithms)||!reply.SigningAlgorithms.includes(ALGORITHM)||
      !bytes(reply.PublicKey))throw fault();
   const der=Buffer.from(reply.PublicKey);
   let fetched;try{fetched=createPublicKey({key:der,format:'der',type:'spki'});}catch{throw fault();}
   const fetchedJwk=fetched.export({format:'jwk'});
   if(fetched.asymmetricKeyType!=='rsa'||fetched.asymmetricKeyDetails?.modulusLength!==SPEC_BITS[reply.KeySpec]||
      fetched.asymmetricKeyDetails?.publicExponent!==65537n||
      fetchedJwk.n!==c.publicJwk.n||fetchedJwk.e!==c.publicJwk.e||
      createHash('sha256').update(der).digest('hex')!==c.spkiSha256)throw fault();
   ensureOpen();checkSignal(signal);initialized=true;
   return Object.freeze({keyArn:c.keyArn,kid:c.kid,publicJwkSha256:c.publicJwkSha256});
  })();
  try{return await initializing;}finally{initializing=null;}
 }
 async function sign(input,{signal}={}){
  ensureOpen();if(!initialized||!(input instanceof Uint8Array)||input.byteLength<1||input.byteLength>4096||
      !Number.isSafeInteger(now()))throw fault();
  const digest=createHash('sha256').update(input).digest();
  try{
   const {SignCommand}=await commandTypes();
   const reply=await invoke(abortSignal=>kmsClient.send(new SignCommand({KeyId:c.keyArn,
    Message:digest,MessageType:'DIGEST',SigningAlgorithm:ALGORITHM}),{abortSignal}),signal);
   if(reply?.KeyId!==c.keyArn||reply.SigningAlgorithm!==ALGORITHM||
      !(reply.Signature instanceof Uint8Array)||reply.Signature.byteLength!==signatureLength)throw fault();
   const signature=Buffer.from(reply.Signature);
   if(!verifySignature('sha256',input,{key:publicKey,padding:constants.RSA_PKCS1_PADDING},signature))throw fault();
   ensureOpen();checkSignal(signal);return signature;
  }finally{digest.fill(0);}
 }
 function close(){closed=true;initialized=false;for(const controller of active)controller.abort();}
 return Object.freeze({initialize,sign,close});
}
