/** Runtime-only Claude API credential. No key is returned through a control/wire port. */
import {SecretsManagerClient,GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';
const unavailable=()=>Object.assign(Error('CLAUDE_API_CREDENTIAL_UNAVAILABLE'),{code:'CLAUDE_API_CREDENTIAL_UNAVAILABLE'});
export function createSdkProviderCredentials({secretArn,region='us-east-1',client}={}){
 if(secretArn===undefined)return Object.freeze({async read(){throw unavailable();},close(){}});
 if(region!=='us-east-1'||typeof secretArn!=='string'||!/^arn:aws:secretsmanager:us-east-1:967807252336:secret:[A-Za-z0-9/_+=.@-]{1,512}$/u.test(secretArn))throw unavailable();
 const owned=client===undefined,provider=client??new SecretsManagerClient({region,maxAttempts:2});let closed=false;
 return Object.freeze({async read({signal}={}){
  if(closed)throw unavailable();signal?.throwIfAborted();
  try{
   const result=await provider.send(new GetSecretValueCommand({SecretId:secretArn,VersionStage:'AWSCURRENT'}),{abortSignal:signal});
   signal?.throwIfAborted();if(closed||result.ARN!==secretArn||typeof result.SecretString!=='string'||result.SecretString.length>2048)throw unavailable();
   // Accept a raw key or the existing single-key Secrets Manager JSON representation.
   let key=result.SecretString;
   if(key.startsWith('{')){const value=JSON.parse(key);if(Object.keys(value).length!==1||typeof value.ANTHROPIC_API_KEY!=='string')throw unavailable();key=value.ANTHROPIC_API_KEY;}
   if(!/^sk-ant-[A-Za-z0-9_-]{16,512}$/u.test(key))throw unavailable();return key;
  }catch{if(signal?.aborted)signal.throwIfAborted();throw unavailable();}
 },close(){if(!closed){closed=true;if(owned)provider.destroy();}}});
}
