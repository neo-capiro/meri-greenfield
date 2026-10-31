/** AWS SDK caller authentication for the Control-owned EC2 physical teardown owner.
 *
 * GetCallerIdentity returns Account/Arn/UserId only. Region is NOT an STS response field, so it is bound by the
 * explicitly configured regional STS client. Expected deployment values are only a comparison target; they are
 * never accepted as caller evidence.
 */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';

const fault=code=>{throw Object.assign(Error(code),{code});};
const ACCOUNT=/^[0-9]{12}$/u,REGION=/^[a-z]{2}-[a-z]+-[0-9]$/u;
const PRINCIPAL=/^arn:aws:(?:iam|sts)::([0-9]{12}):(?:user\/|role\/|assumed-role\/)[^\s]+$/u;

export function createAwsEc2CallerVerifier({sts,sdk,now=Date.now,timeoutMs=10000}={}){
 if(typeof sts?.send!=='function'||typeof now!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)
  fault('NATIVE_EC2_CALLER_CONFIGURATION');
 const GetCallerIdentityCommand=sdk?.GetCallerIdentityCommand;
 async function verify({accountId,region,signal}={}){
  if(typeof accountId!=='string'||!ACCOUNT.test(accountId)||typeof region!=='string'||!REGION.test(region))
   fault('NATIVE_EC2_CALLER_CONFIGURATION');
  const configured=typeof sts.config?.region==='function'?await sts.config.region():undefined;
  if(configured!==region)fault('NATIVE_EC2_CALLER_REGION_REFUSED');
  const life=createOperationLifetime({now,deadlineMs:now()+timeoutMs,signal,
   errorFactory:()=>Object.assign(Error('NATIVE_EC2_CALLER_UNKNOWN'),{code:'NATIVE_EC2_CALLER_UNKNOWN'})});
  let raw;
  try{raw=await life.run(sig=>sts.send(GetCallerIdentityCommand===undefined?{input:{}}:new GetCallerIdentityCommand({}),
   {abortSignal:sig}));}
  catch{fault('NATIVE_EC2_CALLER_UNKNOWN');}
  finally{life.close();}
  if(raw===null||typeof raw!=='object'||raw.Account!==accountId||typeof raw.Arn!=='string'||
   typeof raw.UserId!=='string'||!raw.UserId||!PRINCIPAL.test(raw.Arn))fault('NATIVE_EC2_CALLER_REFUSED');
  const match=PRINCIPAL.exec(raw.Arn);
  if(match?.[1]!==accountId)fault('NATIVE_EC2_CALLER_REFUSED');
  return Object.freeze({accountId:raw.Account,region,arn:raw.Arn,userId:raw.UserId});
 }
 return Object.freeze({verify});
}

export async function createAwsEc2CallerVerifierFromRegion(region,{now=Date.now,timeoutMs=10000}={}){
 const sdk=await import('@aws-sdk/client-sts');
 const sts=new sdk.STSClient({region,maxAttempts:1});
 return Object.freeze({sts,verifier:createAwsEc2CallerVerifier({sts,sdk,now,timeoutMs}),
  async close(){if(typeof sts.destroy==='function')await sts.destroy();}});
}
