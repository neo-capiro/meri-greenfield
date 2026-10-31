/** Published Lambda entrypoint for the existing observation-only bridge. No launch, DB or EC2 client lives here. */
import {createHash,X509Certificate} from 'node:crypto';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeObserverInput} from '../../packages/contracts/native-observer.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {createNativeObserverBridge} from './native-observer-bridge.mjs';
const fail=()=>{throw Error('NATIVE_OBSERVER_ENTRYPOINT_REFUSED');};
const sha=b=>createHash('sha256').update(b).digest('hex');
export function observerEntrypointConfiguration(raw){
 try{
  const c=own(raw,['schema','functionArn','stateMachineArn','keyId','secretArn','secretVersionId','secretSha256','caSha256']);
  const f=/^arn:aws:lambda:us-east-1:([0-9]{12}):function:[A-Za-z0-9_-]{1,64}$/u.exec(c.functionArn??'');
  if(c.schema!=='meri-native-observer-entrypoint/1'||!f||
   !new RegExp(`^arn:aws:states:us-east-1:${f[1]}:stateMachine:[A-Za-z0-9_-]{1,80}$`,'u').test(c.stateMachineArn)||
   !new RegExp(`^arn:aws:secretsmanager:us-east-1:${f[1]}:secret:[A-Za-z0-9/_+=.@-]{1,512}-[A-Za-z0-9]{6}$`,'u').test(c.secretArn)||
   !/^[A-Za-z0-9-]{32,64}$/u.test(c.secretVersionId)||!/^[A-Za-z0-9_-]{1,64}$/u.test(c.keyId)||
   !['secretSha256','caSha256'].every(k=>/^[a-f0-9]{64}$/u.test(c[k])))fail();
  return Object.freeze({...c});
 }catch{fail();}
}
/** Require both an explicitly qualified invocation and the matching actual version. Event fields are never used. */
export function observerExecutedVersion(configuration,context){
 const version=context?.functionVersion,invoked=context?.invokedFunctionArn,base=configuration.functionArn;
 if(typeof version!=='string'||!/^[1-9][0-9]*$/u.test(version)||invoked!==`${base}:${version}`||context.functionName!==base.split(':').at(-1))fail();
 return `${base}:${version}`;
}
export async function fetchObserverSecret({secretArn,secretVersionId,signal}){
 const {SecretsManagerClient,GetSecretValueCommand}=await import('@aws-sdk/client-secrets-manager');
 const client=new SecretsManagerClient({region:'us-east-1',maxAttempts:1});
 try{return await client.send(new GetSecretValueCommand({SecretId:secretArn,VersionId:secretVersionId}),{abortSignal:signal});}
 finally{client.destroy();}
}
export function createNativeObserverHandler({configuration,fetchSecret=fetchObserverSecret,post,now=Date.now}={}){
 const c=observerEntrypointConfiguration(configuration);
 return async(event,context)=>{
  let life,bytes,key,ca,finished=false;
  try{
   const functionVersionArn=observerExecutedVersion(c,context),original=assertNativeObserverInput(event?.originalInput);
   if(typeof context.getRemainingTimeInMillis!=='function')fail();
   const remaining=context.getRemainingTimeInMillis();if(!Number.isSafeInteger(remaining)||remaining<=0)fail();
   life=createOperationLifetime({now,deadlineMs:Math.min(now()+remaining,original.cleanupCeilingMs),errorFactory:()=>Error('NATIVE_OBSERVER_ENTRYPOINT_REFUSED')});
   let loaded;
   const load=()=>loaded??=life.run(async signal=>{
    const result=await fetchSecret({secretArn:c.secretArn,secretVersionId:c.secretVersionId,signal});
    if(finished)fail();
    if(result?.ARN!==c.secretArn||result.VersionId!==c.secretVersionId||typeof result.SecretString!=='string'||
     result.SecretBinary!==undefined||Buffer.byteLength(result.SecretString)>16384)fail();
    bytes=Buffer.from(result.SecretString);if(sha(bytes)!==c.secretSha256)fail();
    const secret=own(JSON.parse(bytes.toString('utf8')),['schema','keyId','keyBase64','caCertificate']);
    if(secret.schema!=='meri-native-observer-material/1'||secret.keyId!==c.keyId||typeof secret.keyBase64!=='string'||typeof secret.caCertificate!=='string')fail();
    key=Buffer.from(secret.keyBase64,'base64');ca=Buffer.from(secret.caCertificate);
    if(key.length<32||key.length>128||key.toString('base64')!==secret.keyBase64||sha(ca)!==c.caSha256||!new X509Certificate(ca).ca)fail();
   });
   const bridge=createNativeObserverBridge({functionVersionArn,stateMachineArn:c.stateMachineArn,keyId:c.keyId,now,...(post?{post}:{}),
    readKey:async()=>{await load();return key;},readCa:async()=>{await load();return ca;}});
   return await life.run(()=>bridge(event,{invokedFunctionArn:functionVersionArn,getRemainingTimeInMillis:()=>context.getRemainingTimeInMillis()}));
  }catch{fail();}
  finally{finished=true;life?.close();for(const value of [bytes,key,ca])value?.fill(0);}
 };
}
/** Lambda resolves this export. Importing the module performs no I/O or credential lookup. */
export async function handler(event,context){
 let configuration;try{configuration=JSON.parse(process.env.MERI_NATIVE_OBSERVER_CONFIG??'');}catch{fail();}
 return createNativeObserverHandler({configuration})(event,context);
}
