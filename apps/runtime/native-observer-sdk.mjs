/** One actual SDK credential snapshot per observer session. Never exported or persisted. */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {types} from 'node:util';
const fault=()=>Object.assign(Error('NATIVE_OBSERVER_SDK_UNKNOWN'),{code:'NATIVE_OBSERVER_SDK_UNKNOWN'});
const ec2Names=new Set(['DescribeInstances','DescribeVolumes','DescribeNetworkInterfaces','TerminateInstances']);
const sfnNames=new Set(['DescribeExecution','GetExecutionHistory']);
async function defaultClients({region,credentials}){
 const [stsSdk,ec2Sdk,sfnSdk]=await Promise.all([import('@aws-sdk/client-sts'),import('@aws-sdk/client-ec2'),import('@aws-sdk/client-sfn')]);
 return {sts:{client:new stsSdk.STSClient({region,credentials,maxAttempts:1}),sdk:stsSdk},
  ec2:{client:new ec2Sdk.EC2Client({region,credentials,maxAttempts:1}),sdk:ec2Sdk},
  sfn:{client:new sfnSdk.SFNClient({region,credentials,maxAttempts:1}),sdk:sfnSdk}};
}
async function defaultCredentials(region){
 const {STSClient}=await import('@aws-sdk/client-sts');const resolver=new STSClient({region,maxAttempts:1});
 try{return await resolver.config.credentials();}finally{resolver.destroy();}
}
export async function createNativeObserverSession({region,accountId,deadlineMs,now=Date.now,signal,
 resolveCredentials=defaultCredentials,createClients=defaultClients}={}){
 if(region!=='us-east-1'||!/^[0-9]{12}$/u.test(accountId)||!Number.isSafeInteger(deadlineMs)||deadlineMs<=now())throw fault();
 const life=createOperationLifetime({deadlineMs,now,signal,errorFactory:fault});let clients,failed=false;
 try{
  const raw=await life.run(()=>resolveCredentials(region));
  if(typeof raw?.accessKeyId!=='string'||!raw.accessKeyId||typeof raw.secretAccessKey!=='string'||!raw.secretAccessKey||
   (raw.sessionToken!==undefined&&(typeof raw.sessionToken!=='string'||!raw.sessionToken)))throw fault();
  const expires=raw.expiration===undefined?deadlineMs:new Date(raw.expiration).getTime();
  if(!Number.isSafeInteger(expires)||expires<=now())throw fault();
  const credentials=Object.freeze({accessKeyId:raw.accessKeyId,secretAccessKey:raw.secretAccessKey,
   ...(raw.sessionToken===undefined?{}:{sessionToken:raw.sessionToken}),
   ...(raw.expiration===undefined?{}:{expiration:new Date(expires)})});
  clients=await life.run(()=>Promise.resolve(createClients({region,credentials})).then(value=>{
   if(failed)for(const c of Object.values(value))c.client?.destroy?.();return value;}));
  let authenticated=false,closed=false;
  const close=()=>{if(closed)return;closed=true;for(const c of Object.values(clients))c.client?.destroy?.();};
  return Object.freeze({expiresAtMs:expires,
   async send({api,input,callDeadlineMs=deadlineMs,signal:callSignal}){
    if(closed||!Number.isSafeInteger(callDeadlineMs)||callDeadlineMs>deadlineMs||now()>=callDeadlineMs||now()>=expires)throw fault();
    const kind=api==='GetCallerIdentity'?'sts':ec2Names.has(api)?'ec2':sfnNames.has(api)?'sfn':null;
    if(!kind||(kind!=='sts'&&!authenticated))throw fault();
    const c=clients[kind],Command=c.sdk?.[`${api}Command`];if(typeof Command!=='function')throw fault();
    const signals=[signal,callSignal].filter(Boolean);
    const request=createOperationLifetime({now,signal:signals.length?AbortSignal.any(signals):undefined,
     deadlineMs:Math.min(callDeadlineMs,expires),errorFactory:fault});
    try{
     request.check();const result=await request.run(s=>c.client.send(new Command(input),{abortSignal:s}));request.check();
     if(kind==='sts'){
      if(!result||typeof result!=='object'||types.isProxy(result)||![Object.prototype,null].includes(Object.getPrototypeOf(result)))throw fault();
      const d=Object.getOwnPropertyDescriptors(result);
      if(['Account','Arn','UserId'].some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))throw fault();
      const account=d.Account.value,arn=d.Arn.value,userId=d.UserId.value;
      if(account!==accountId||typeof arn!=='string'||arn.length>2048||
       !new RegExp(`^arn:aws:(?:iam|sts)::${accountId}:(?:user/|role/|assumed-role/)[^\\s]+$`,'u').test(arn)||
       typeof userId!=='string'||!userId||userId.length>256)throw fault();
      authenticated=true;
     }
     return result;
    }finally{request.close();}
   },close});
 }catch(error){failed=true;if(clients)for(const c of Object.values(clients))c.client?.destroy?.();throw error;}
 finally{life.close();}
}
