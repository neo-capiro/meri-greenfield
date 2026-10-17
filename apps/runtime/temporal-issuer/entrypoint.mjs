/** Composed private Temporal issuer. Importing this module performs no IO. */
import {constants as fileFlags} from 'node:fs';
import {open,lstat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {isIP} from 'node:net';
import {types} from 'node:util';
import {X509Certificate,createHash} from 'node:crypto';
import {parseTemporalIssuerServiceConfiguration,createTemporalIssuerService} from './service.mjs';
import {parseTemporalIssuerTaskAuthorityConfiguration,createTemporalIssuerTaskAuthority,
 createTemporalIssuerAwsReaders,createTemporalIssuerAwsTaskProof} from './task-authority.mjs';
import {parseTemporalIssuerKmsSignerConfiguration,createTemporalIssuerKmsSigner} from './kms-signer.mjs';
import {createTemporalIssuerBootstrapOwner} from './bootstrap-owner.mjs';
import {createTemporalServiceClientCertificateIssuerFromMaterial} from './service-client-certificate.mjs';
import {createTemporalIssuerServiceTaskRegistrationPg} from './service-task-registration-pg.mjs';

const CONFIG_KEYS=['schemaVersion','service','taskAuthority','signer','listen','tls','bootstrap',
 'registrationRole','startupTimeoutMs'];
const LISTEN_KEYS=['host','port'];
const TLS_KEYS=['keyFile','certFile','caFile'];
const BOOTSTRAP_KEYS=['caKeyFile','caSha256'];
const SHA256=/^[a-f0-9]{64}$/u;
const MATERIAL_ROOT='/run/meri-temporal/issuer/';
const parsedConfigurations=new WeakSet();
const fault=()=>Object.assign(Error('TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'),
 {code:'TEMPORAL_ISSUER_ENTRYPOINT_REFUSED'});

function exact(value,keys){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&!types.isProxy(value)&&
  Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&
  keys.every(key=>Object.hasOwn(value,key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
}
function privateIpv4(host){
 if(typeof host!=='string'||isIP(host)!==4)return false;
 const octets=host.split('.').map(Number);
 return octets.every((octet,index)=>String(octet)===host.split('.')[index])&&
  (octets[0]===10||(octets[0]===172&&octets[1]>=16&&octets[1]<=31)||
   (octets[0]===192&&octets[1]===168));
}
function materialPath(path){
 return typeof path==='string'&&path.startsWith(MATERIAL_ROOT)&&path.length>MATERIAL_ROOT.length&&
  /^\/run\/meri-temporal\/issuer\/[A-Za-z0-9._-]+$/u.test(path)&&!path.endsWith('/.')&&
  !path.includes('..');
}
function checkSignal(signal){if(signal?.aborted)throw fault();}

/** A closed configuration with exact service, task, KMS and file joins. */
export function parseTemporalIssuerEntrypointConfiguration(raw){
 if(!exact(raw,CONFIG_KEYS)||raw.schemaVersion!==1||!exact(raw.listen,LISTEN_KEYS)||
    !privateIpv4(raw.listen.host)||!Number.isSafeInteger(raw.listen.port)||
    raw.listen.port!==443||
    !Number.isSafeInteger(raw.startupTimeoutMs)||raw.startupTimeoutMs<1||
    raw.startupTimeoutMs>120000||!exact(raw.tls,TLS_KEYS)||
    TLS_KEYS.some(key=>!materialPath(raw.tls[key]))||
    new Set(TLS_KEYS.map(key=>raw.tls[key])).size!==TLS_KEYS.length||
    !exact(raw.bootstrap,BOOTSTRAP_KEYS)||!materialPath(raw.bootstrap.caKeyFile)||
    TLS_KEYS.some(key=>raw.tls[key]===raw.bootstrap.caKeyFile)||
    !SHA256.test(raw.bootstrap.caSha256)||
    typeof raw.registrationRole!=='string'||
    !/^[a-z][a-z0-9_]{2,62}$/u.test(raw.registrationRole))throw fault();
 let service,taskAuthority,signer;
 try{
  service=parseTemporalIssuerServiceConfiguration(raw.service);
  taskAuthority=parseTemporalIssuerTaskAuthorityConfiguration(raw.taskAuthority);
  signer=parseTemporalIssuerKmsSignerConfiguration(raw.signer);
 }catch{throw fault();}
 const clusterParts=taskAuthority.clusterArn.split(':'),keyParts=signer.keyArn.split(':');
 if(clusterParts[3]!==keyParts[3]||clusterParts[4]!==keyParts[4]||
    service.kid!==signer.kid||service.maxRequestMs>=taskAuthority.maxLeaseMs||
    taskAuthority.maxLeaseMs>service.currentnessLeaseMs)throw fault();
 const parsed=Object.freeze({schemaVersion:1,service,taskAuthority,signer,
  registrationRole:raw.registrationRole,
  startupTimeoutMs:raw.startupTimeoutMs,
  listen:Object.freeze({...raw.listen}),tls:Object.freeze({...raw.tls}),
  bootstrap:Object.freeze({...raw.bootstrap})});
 parsedConfigurations.add(parsed);return parsed;
}

async function ownerOnlyRead(path,{signal,maxBytes}){
 checkSignal(signal);
 let file,bytes;
 try{
  const directory=await lstat(dirname(path));
  if(!directory.isDirectory()||(directory.mode&0o077)!==0||
     (typeof process.getuid==='function'&&directory.uid!==process.getuid()))throw fault();
  file=await open(path,fileFlags.O_RDONLY|fileFlags.O_NOFOLLOW);
  checkSignal(signal);
  const stat=await file.stat();
  if(!stat.isFile()||stat.size<1||stat.size>maxBytes||
     (stat.mode&0o077)!==0||
     (typeof process.getuid==='function'&&stat.uid!==process.getuid()))throw fault();
  bytes=await file.readFile({signal});
  if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>maxBytes){bytes?.fill?.(0);throw fault();}
  checkSignal(signal);return bytes;
 }catch{bytes?.fill?.(0);throw fault();}
 finally{
  try{await file?.close();}
  catch{bytes?.fill?.(0);throw fault();}
 }
}

/** Late material returned after cancellation is wiped before it can be observed. */
async function boundedMaterialRead(readMaterial,path,maxBytes,signal){
 checkSignal(signal);
 let onAbort;
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>reject(fault());signal.addEventListener('abort',onAbort,{once:true});
 });
 const read=Promise.resolve().then(()=>readMaterial(path,{signal,maxBytes})).then(bytes=>{
  if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>maxBytes){bytes?.fill?.(0);throw fault();}
  if(signal.aborted){bytes.fill(0);throw fault();}
  return bytes;
 });
 try{return await Promise.race([read,aborted]);}
 finally{signal.removeEventListener('abort',onAbort);}
}

/**
 * registrationPool is a borrowed dedicated primary-writer pg Pool. The entrypoint
 * owns only its registration adapter, never the Pool. A supplied registration port
 * is an isolated test seam. Missing or competing owners fail before any IO.
 * Production uses actual SDK v3 clients; injected clients and material reader are
 * test seams and are never selected by the default runtime mount.
 */
export function createTemporalIssuerEntrypoint({configuration,registrationPool,serviceTaskRegistration,
 awsClients,readMaterial=ownerOnlyRead,now=Date.now,kmsCommands,
 serviceFactory=createTemporalIssuerService}={}){
 const c=configuration&&typeof configuration==='object'&&parsedConfigurations.has(configuration)?
  configuration:parseTemporalIssuerEntrypointConfiguration(configuration);
 if((registrationPool===undefined)===(serviceTaskRegistration===undefined)||
    (registrationPool!==undefined&&typeof registrationPool?.connect!=='function')||
    (serviceTaskRegistration!==undefined&&[
     'probe','readCurrent','readTaskCurrent','registerCurrent'].some(name=>
      typeof serviceTaskRegistration?.[name]!=='function'))||
    typeof readMaterial!=='function'||
    typeof now!=='function'||typeof serviceFactory!=='function'||
    (awsClients!==undefined&&(!exact(awsClients,['ecs','ec2','kms'])||
      ['ecs','ec2','kms'].some(name=>typeof awsClients[name]?.send!=='function'))))throw fault();
 let state='new',service=null,signer=null,ownedClients=null,starting=null,cleaning=null,closing=null;
 let ownedRegistration=null,bootstrapOwner=null,certificateIssuer=null;
 const cancellation=new AbortController();
 const available=()=>state==='running'&&service?.available()===true&&
  bootstrapOwner?.available()===true;

 async function clients(){
  if(awsClients)return awsClients;
  const region=c.taskAuthority.clusterArn.split(':')[3];
  const [{ECSClient},{EC2Client},{KMSClient}]=await Promise.all([
   import('@aws-sdk/client-ecs'),import('@aws-sdk/client-ec2'),import('@aws-sdk/client-kms')]);
  checkSignal(cancellation.signal);
  const created={};
  try{
   created.ecs=new ECSClient({region});created.ec2=new EC2Client({region});
   created.kms=new KMSClient({region});
  }catch{
   for(const client of Object.values(created))try{client.destroy?.();}catch{}
   throw fault();
  }
  ownedClients=created;
  return ownedClients;
 }
 function cleanup(){
  if(cleaning)return cleaning;
  cleaning=(async()=>{
   cancellation.abort();
   let failure;
   try{signer?.close();}catch(error){failure=error;}
   const held=service;service=null;
   try{await held?.close();}catch(error){failure??=error;}
   try{bootstrapOwner?.close();}catch(error){failure??=error;}
   bootstrapOwner=null;
   try{certificateIssuer?.close();}catch(error){failure??=error;}
   certificateIssuer=null;
   try{ownedRegistration?.close();}catch(error){failure??=error;}
   ownedRegistration=null;
   const clientsToDestroy=ownedClients;ownedClients=null;
   if(clientsToDestroy)for(const client of Object.values(clientsToDestroy)){
    try{client.destroy?.();}catch(error){failure??=error;}
   }
   if(failure)throw failure;
  })().finally(()=>{cleaning=null;});
  return cleaning;
 }
 async function start(){
  if(state!=='new')throw fault();
  state='starting';
  const signal=cancellation.signal;
  let stop;
  const aborted=new Promise((_,reject)=>{
   stop=()=>reject(fault());signal.addEventListener('abort',stop,{once:true});
  });
  const deadline=setTimeout(()=>cancellation.abort(),c.startupTimeoutMs);
  const operation=(async()=>{
   const sdk=await clients();checkSignal(signal);
   signer=createTemporalIssuerKmsSigner({configuration:c.signer,kmsClient:sdk.kms,
    ...(kmsCommands===undefined?{}:{commands:kmsCommands}),now});
   // Actual GetPublicKey must match the pinned RSA JWK before reading any TLS
   // private material, constructing the listener, or accepting a request.
   await signer.initialize({signal});checkSignal(signal);
   const readers=createTemporalIssuerAwsReaders({ecsClient:sdk.ecs,ec2Client:sdk.ec2});
   const registration=registrationPool===undefined?serviceTaskRegistration:
    createTemporalIssuerServiceTaskRegistrationPg({pool:registrationPool,
     expectedRole:c.registrationRole});
   if(registrationPool!==undefined)ownedRegistration=registration;
   const readiness=await registration.probe({signal});checkSignal(signal);
   if(!exact(readiness,['schemaVersion','state'])||readiness.schemaVersion!==1||
      readiness.state!=='READY')throw fault();
   const authority=createTemporalIssuerTaskAuthority({configuration:c.taskAuthority,
    ...readers,bindings:registration,now});
   const tls={};let caKey=null,createdService=null;
   let listenStarted=false;
   const wipe=()=>{for(const value of Object.values(tls))value.fill(0);caKey?.fill(0);};
   signal.addEventListener('abort',wipe,{once:true});
   try{
    for(const [name,key,maxBytes] of [['key','keyFile',16384],['cert','certFile',32768],['ca','caFile',32768]]){
     tls[name]=await boundedMaterialRead(readMaterial,c.tls[key],maxBytes,signal);
     checkSignal(signal);
    }
    // The same pinned CA is used by the mTLS listener and the task-local CSR
    // signer. Check its DER fingerprint before reading any CA private material.
    let ca;
    try{
     const pem=tls.ca.toString('utf8');
     if(!/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]{1,64}\r?\n)+-----END CERTIFICATE-----\r?\n?$/u.test(pem))throw fault();
     ca=new X509Certificate(tls.ca);
    }catch{throw fault();}
    if(!ca.ca||createHash('sha256').update(ca.raw).digest('hex')!==c.bootstrap.caSha256)throw fault();
    caKey=await boundedMaterialRead(readMaterial,c.bootstrap.caKeyFile,32768,signal);
    checkSignal(signal);
    certificateIssuer=createTemporalServiceClientCertificateIssuerFromMaterial({
     caPem:tls.ca,keyPem:caKey,caSha256:c.bootstrap.caSha256,now});
    const taskProof=createTemporalIssuerAwsTaskProof({configuration:c.taskAuthority,...readers,now});
    bootstrapOwner=createTemporalIssuerBootstrapOwner({configuration:c.taskAuthority,
     taskProof,registration,certificateIssuer,now,
     maxRequestMs:c.service.bootstrapMaxRequestMs-1000});
    createdService=serviceFactory({configuration:c.service,taskAuthority:authority,
     sign:(input,context)=>signer.sign(input,context),publicJwk:c.signer.publicJwk,
     bootstrapOwner,now});
    if(typeof createdService?.listen!=='function'||typeof createdService?.close!=='function'||
       typeof createdService?.available!=='function')throw fault();
    service=createdService;
    listenStarted=true;
    await createdService.listen({tls,host:c.listen.host,port:c.listen.port});
    checkSignal(signal);
   }finally{
    signal.removeEventListener('abort',wipe);wipe();
    // Retain the local reference: timeout cleanup may have cleared `service`
    // before an uncooperative listen promise completed and opened its port.
    if(listenStarted&&(signal.aborted||state==='closed')){
     await Promise.resolve().then(()=>createdService.close()).catch(()=>{});
    }
   }
   if(state!=='starting'||createdService.available()!==true)throw fault();
   state='running';return Object.freeze({available:true});
  })();
  // Late completion after a timeout never transitions readiness, and gets one
  // more cleanup pass even if the HTTPS listen promise settled after abort.
  operation.catch(()=>{}).finally(()=>{if(state==='closed')cleanup().catch(()=>{});});
  starting=Promise.race([operation,aborted]);
  try{return await starting;}
  catch{state='closed';await cleanup().catch(()=>{});throw fault();}
  finally{clearTimeout(deadline);signal.removeEventListener('abort',stop);starting=null;}
 }
 function close(){
  if(closing)return closing;
  state='closed';cancellation.abort();signer?.close();
  closing=(async()=>{
   if(starting)try{await starting;}catch{}
   await cleanup();
  })();
  return closing;
 }
 return Object.freeze({start,close,available});
}
