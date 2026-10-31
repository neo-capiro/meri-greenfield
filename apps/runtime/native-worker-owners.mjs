/** Actual default worker-side native owners, constructed only when configuration.nativeProvisioning.enabled.
 *
 * Composition order is the canonical seam order: worker authority over the allocator's supplied client, the one
 * PostgreSQL host-allocation writer, the EC2 launch port, the accepted guest235101 SSM/material/issuer owners and
 * the provisioning coordinator. No configuration selector chooses these owners; the role config only names the
 * protected files/deployment. A disabled configuration reads no native DB/issuer material and creates no cloud owner.
 */
import {Pool} from 'pg';
import {readSecret,fault} from './config.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createNativeWorkerAuthority} from './native-worker-authority.mjs';
import {createPostgresHostAllocationWriter} from '../control/browser-hosts/postgres-allocations.mjs';
import {createEc2NativeHostLaunchPort,createNativeHostProvisioning,NATIVE_PROVISIONING_EFFECT_TIMEOUT_MS}
 from './native-host-provisioning.mjs';
import {createNativeBootstrapSsmTransport} from './native-authority/native-host-bootstrap-ssm.mjs';
import {createNativeHostCertificateIssuerFromMaterial} from './native-authority/native-host-certificate-issuer.mjs';
import {createNativeHostMaterialOwner} from './native-authority/native-host-material.mjs';
import {createManagedWatchdogReadback} from './native-watchdog-readback.mjs';
import {compileNativeDeployment} from './native-deployment-configuration.mjs';
import {assertNativeRetainedPhysical,NATIVE_DECLARATION_V2} from '../../packages/contracts/native-observer.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function connectionString(bytes){
 let text,url;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).trim();url=new URL(text);}catch{throw fault('DATABASE_CONFIGURATION');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hash||url.searchParams.getAll('sslmode').length!==1||
  url.searchParams.get('sslmode')!=='verify-full'||[...url.searchParams.keys()].some(key=>key!=='sslmode'))
  throw fault('DATABASE_CONFIGURATION');
 return text;
}
async function defaultEc2Client(region){
 const sdk=await import('@aws-sdk/client-ec2');
 const client=new sdk.EC2Client({region,maxAttempts:1});
 return Object.freeze({client,sdk});
}
async function defaultSsmClient(region){
 const sdk=await import('@aws-sdk/client-ssm');
 const client=new sdk.SSMClient({region,maxAttempts:1});
 const transport=await createNativeBootstrapSsmTransport({client,sdk});
 return Object.freeze({client,transport});
}
const bounded=async(step,timeoutMs=5000)=>{
 let timer;try{return await Promise.race([Promise.resolve().then(step),new Promise((_,reject)=>{timer=setTimeout(()=>reject(
  Object.assign(Error('NATIVE_WORKER_OWNERS_CLEANUP_UNKNOWN'),{code:'NATIVE_WORKER_OWNERS_CLEANUP_UNKNOWN'})),timeoutMs);
  timer.unref?.();})]);}finally{if(timer!==undefined)clearTimeout(timer);}
};
export async function createNativeWorkerOwners({configuration,native,owners={},now=Date.now,
 effectTimeoutMs=NATIVE_PROVISIONING_EFFECT_TIMEOUT_MS}={}){
 const p=configuration?.nativeProvisioning;
 if(p?.enabled!==true)return null;
 const deployment=compileNativeDeployment(p.deployment);
 if(typeof native?.call!=='function')throw fault('NATIVE_WORKER_OWNERS_CONFIGURATION');
 const createPool=owners.createPool,createEc2Client=owners.createEc2Client,createSsmTransport=owners.createSsmTransport,
  createIssuer=owners.createIssuer,createMaterial=owners.createMaterial,createSfnClient=owners.createSfnClient,read=owners.readSecret??readSecret;
 for(const value of [createPool,createEc2Client,createSsmTransport,createIssuer,createMaterial,createSfnClient,read])
  if(value!==undefined&&typeof value!=='function')throw fault('NATIVE_WORKER_OWNERS_CONFIGURATION');
 let pool,ec2,ssm,ownedSsmClient,issuer,material,hostTeardown,watchdog,stepFunctions;
 let closed=false,closing=null;
 const close=()=>closing??=(async()=>{
  closed=true;const results=[];let materialCleanup=null;
  // The factory creates the SSM transport and BORROWS it to the material owner. Close both exactly once and keep
  // every attempt independent: a failed material close must not skip transport/EC2/pool disposal. A resolved
  // material close that reports unresolved work is uncertainty, not success. Every step is bounded.
  for(const step of [
   async()=>{if(material===undefined)return {closed:true};const value=await bounded(()=>material.close());
    materialCleanup=value;
    if(value?.closed===false||value?.pendingCalls>0)throw Object.assign(Error('NATIVE_WORKER_OWNERS_CLEANUP_UNKNOWN'),
     {code:'NATIVE_WORKER_OWNERS_CLEANUP_UNKNOWN',cleanup:value});return value;},
   ()=>ssm?.close?.(),
   ()=>ownedSsmClient?.destroy?.(),
   ()=>stepFunctions?.destroy?.(),
   ()=>ec2?.destroy?.(),
   ()=>pool?.end?.(),
  ]){
   try{results.push({status:'fulfilled',value:await bounded(step)});}catch(reason){results.push({status:'rejected',reason});}
  }
  const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  // A fulfilled close of an owner that cannot prove a physical stop is still explicit uncertainty.
  return Object.freeze({closed:true,physicalStopProven:materialCleanup?.physicalStopProven===true,
   ...(materialCleanup===null||materialCleanup===undefined?{}:{materialCleanup})});
 })();
 try{
  const [database,caPem,keyPem]=await Promise.all([read(p.databaseFile),
   read(p.issuerCaCertFile),read(p.issuerCaKeyFile)]);
  pool=(createPool??(options=>new Pool(options)))({connectionString:connectionString(database),max:10,
   connectionTimeoutMillis:configuration.limits.requestMs,idleTimeoutMillis:10000,query_timeout:configuration.limits.requestMs});
  const policySha256=deployment.bootstrapSpec.control.policySha256;
  const remote=request=>{const {signal,...body}=request;return native.call('execution/native/host-authority',body,{signal});};
  const authority=createNativeWorkerAuthority({pool,remote,now,policySha256,maxFreshMs:configuration.limits.requestMs});
  const writer=createPostgresHostAllocationWriter({pool,now,readCurrentNativeAuthority:authority.verifyInTransaction});
  const created=createEc2Client===undefined?await defaultEc2Client(deployment.region):createEc2Client({region:deployment.region});
  ec2=created.client??created;
  const launch=createEc2NativeHostLaunchPort({ec2,launch:deployment.launch});
  if(createSsmTransport===undefined){
   const owned=await defaultSsmClient(deployment.region);
   ownedSsmClient=owned.client;ssm=owned.transport;
  }else ssm=createSsmTransport({region:deployment.region});
  issuer=createIssuer===undefined?createNativeHostCertificateIssuerFromMaterial({caPem,keyPem,now}):createIssuer({caPem,keyPem,now});
  for(const bytes of [database,caPem,keyPem])try{bytes.fill(0);}catch{}
  material=createMaterial===undefined?await createNativeHostMaterialOwner({writer,issuer,transport:ssm,now}):
   await createMaterial({writer,issuer,transport:ssm,now});
  if(p.watchdog===undefined)throw fault('NATIVE_WORKER_OWNERS_CONFIGURATION');
  if(createSfnClient===undefined){
   const sdk=await import('@aws-sdk/client-sfn');
   stepFunctions=new sdk.SFNClient({region:deployment.region,maxAttempts:2});
  }else stepFunctions=createSfnClient({region:deployment.region});
  const readback=createManagedWatchdogReadback({...p.watchdog,now});
  watchdog=Object.freeze({makeIntent:args=>readback.makeIntent(args),arm:args=>readback.arm({...args,stepFunctions}),
   verify:args=>readback.verify({...args,stepFunctions}),readResult:args=>readback.readResult({...args,stepFunctions})});
  const provisioner=createNativeHostProvisioning({writer,launch,material,deployment,watchdog,
   authority:{async verify({binding,generation,signal,deadlineMs}){return authority.preflight({binding,signal,
    deadlineMs:Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:now()+effectTimeoutMs,now()+effectTimeoutMs)});}},
   now,effectTimeoutMs,ownerId:owners.ownerId??undefined});
  // Control-owned original-host teardown over the existing control:true transport. The worker names only closed
  // original identity; Control resolves and settles the canonical row. No worker credential or local lifecycle owner.
  hostTeardown=async({binding,generation,hostId,signal}={})=>{
   if(typeof binding!=='object'||binding===null||typeof hostId!=='string'||!UUID.test(hostId)||
    !Number.isSafeInteger(generation)||generation<1)throw fault('NATIVE_WORKER_OWNERS_CONFIGURATION');
   let runtime=null;
   try{
    const value=await native.call('execution/native/host-teardown',{binding,generation,hostId},{signal});
    if(value?.closed===true&&value?.verified===true)return value;
    runtime=value;
   }catch(error){runtime=error?.receipt??{unknown:true,code:error?.code};}
   // The original runtime teardown is unresolved. Read the canonical reservation and the already-armed managed
   // execution result read-only. The runtime receipt remains separate and immutable.
   const row=await writer.readNativeReservation({hostId,generation,signal});
   if(!row||row.allocation.hostId!==hostId||row.allocation.generation!==generation||
    hash(row.originalBinding)!==hash(binding))throw fault('NATIVE_WORKER_OWNERS_CLEANUP_REFUSED');
   const intent=row.declaration?.watchdog;
   if(!intent||intent.schema!=='meri-native-watchdog-intent/1')throw fault('NATIVE_WORKER_OWNERS_CLEANUP_REFUSED');
   let managed;
   try{
    if(row.declaration.schema===NATIVE_DECLARATION_V2){
     const retained=assertNativeRetainedPhysical(runtime?.physical,{allocation:row.allocation,binding:row.originalBinding,declaration:row.declaration,nowMs:now()});
     managed={status:retained.managed.disposition==='verified-absent'?'VERIFIED':'UNKNOWN',
      quarantine:true,proof:'canonical-control-observer/2',retained:retained.managed,
      executionArn:intent.executionArn,deadlineMs:intent.cleanupCeilingMs,owned:[],reason:retained.managed.reason};
    }else managed=await watchdog.readResult({intent,signal});
   }
   catch(error){managed={status:'UNKNOWN',quarantine:true,executionArn:intent.executionArn,
    executionName:intent.executionName,deadlineMs:intent.cleanupCeilingMs,owned:[],
    reason:error?.code??error?.name??'result_read_failed'};}
   const owned=Array.isArray(managed.owned)&&managed.owned.length>0?managed.owned:
    (row.observedInstance===null||row.observedInstance===undefined?[]:[{instanceId:row.observedInstance.instanceId,
     rootVolumeId:null,networkInterfaceIds:[]}]);
   managed=Object.freeze({...managed,executionName:intent.executionName,leaseDeadlineMs:intent.leaseDeadlineMs,
    cleanupCeilingMs:intent.cleanupCeilingMs,inputSha256:intent.inputSha256,owned:Object.freeze(owned)});
   const result=Object.freeze({closed:false,verified:false,unknown:true,binding,hostId,generation,
    runtime:Object.freeze(runtime??{}),managed});
   throw Object.assign(fault('NATIVE_WORKER_HOST_CLEANUP_UNKNOWN'),{receipt:result});
  };
  return Object.freeze({pool,authority,writer,launch,issuer,material,provisioner,hostTeardown,close,
   generationFor:binding=>{if(!binding||!Number.isSafeInteger(binding.writerFence)||binding.writerFence<1||
    !UUID.test(binding.conversationId))throw fault('NATIVE_WORKER_OWNERS_CONFIGURATION');return binding.writerFence;}});
 }catch(error){
  try{await close();}catch(cleanup){throw Object.assign(fault('NATIVE_WORKER_OWNERS_CLEANUP_UNKNOWN'),{cause:new AggregateError([error,cleanup],'NATIVE_WORKER_OWNERS_FAILED')});}
  throw error;
 }
}
