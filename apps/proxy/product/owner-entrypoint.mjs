/** Explicit executable ownership for the one product model budget owner.
 * The SHA-pinned whole control snapshot is original startup custody, including
 * router VPC (which the prepared-run configuration digest does not cover).
 * Retain/pin-route that service for its originals on configuration rollover.
 * Importing this module loads no material, dependency client or listener. */
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readSecret,validateConfiguration} from '../../runtime/config.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {createProductProxyPersistedFacts} from './product-owner-facts.mjs';
import {createProductOwnerPlacement} from './product-owner-placement.mjs';
import {createProductOwnerNativeCurrentness} from './owner-native-currentness.mjs';
import {createProductServiceTaskLeaseReader} from './service-task-leases.mjs';
import {createProductOwnerServiceGate} from './owner-channel.mjs';
import {createProductOwnerHttpsServer} from './owner-https.mjs';

const fail=()=>{throw Error('PRODUCT_OWNER_STARTUP_UNAVAILABLE');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const slot=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/u.test(v);
const integer=(v,max)=>Number.isSafeInteger(v)&&v>=1&&v<=max;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v);
const file=v=>typeof v==='string'&&v.length<=4096&&isAbsolute(v)&&!v.split(/[\\/]/u).includes('..');
const prefix='arn:aws:ecs:us-east-1:967807252336:';
const runtimeRequire=createRequire(new URL('../../runtime/package.json',import.meta.url));
const frozenDisabled=()=>Object.freeze({available:false,async start(){fail();},async close(){}});

function servicePin(v){
 const p=own(v,['clusterArn','taskArn','taskDefinitionArn','serviceName','containerName','imageDigest','createdAtMs','vpcId','subnetId','securityGroupIds']);
 const cluster=typeof p.clusterArn==='string'?p.clusterArn.slice((prefix+'cluster/').length):'';
 if(p.clusterArn!==prefix+'cluster/'+cluster||! /^[A-Za-z0-9_-]{1,255}$/u.test(cluster)||
    p.taskArn!==prefix+'task/'+cluster+'/'+String(p.taskArn).split('/').at(-1)||! /^[a-f0-9]{32}$/u.test(String(p.taskArn).split('/').at(-1))||
    typeof p.taskDefinitionArn!=='string'||!p.taskDefinitionArn.startsWith(prefix)||! /^task-definition\/[A-Za-z0-9_-]+:[1-9][0-9]*$/u.test(p.taskDefinitionArn.slice(prefix.length))||
    ![p.serviceName,p.containerName].every(n=>typeof n==='string'&&/^[A-Za-z0-9_-]{1,255}$/u.test(n))||
    typeof p.imageDigest!=='string'||! /^sha256:[a-f0-9]{64}$/u.test(p.imageDigest)||!integer(p.createdAtMs,Number.MAX_SAFE_INTEGER)||
    ! /^vpc-[a-f0-9]{8,17}$/u.test(p.vpcId)||! /^subnet-[a-f0-9]{8,17}$/u.test(p.subnetId)||
    !Array.isArray(p.securityGroupIds)||p.securityGroupIds.length<1||p.securityGroupIds.length>5||
    p.securityGroupIds.some(n=>typeof n!=='string'||! /^sg-[a-f0-9]{8,17}$/u.test(n))||new Set(p.securityGroupIds).size!==p.securityGroupIds.length)fail();
 return p;
}

/** Closed data only. An omitted enabled flag is false, before any material IO. */
export function validateProductOwnerConfiguration(raw){
 try{
  const c=data(own(raw,['schemaVersion','sourceEnabled','controlConfigurationFile','controlConfigurationSha256','nativeCredentialFileSha256',
   'tls','clientPolicy','serviceTasks','pricing','limits'],['enabled']));
  const t=own(c.tls,['origin','serverName','caFile','certFile','keyFile','certSha256','issuerSha256']),
   p=own(c.clientPolicy,['clientCertSha256','clientSubject','deploymentRevision','issuerSha256','selectedClientId','ownerTaskArn','proxyTaskArn']),
   s=own(c.serviceTasks,['schemaVersion','deploymentRevision','expiresAtMs','ownerCertSha256','proxyCertSha256','owner','proxy']),
   l=own(c.limits,['maxRequestMs','maxFactBytes','maxLeaseMs']),
   price=own(c.pricing,['modelId','profileId','revision','validUntilMs','actualInputMicroUSDPerK','reserveInputMicroUSDPerK','outputMicroUSDPerK','maxInputTokens','maxOutputTokens']);
  if(c.schemaVersion!==1||c.sourceEnabled!==false||typeof(c.enabled??false)!=='boolean'||
     !file(c.controlConfigurationFile)||!digest(c.controlConfigurationSha256)||!digest(c.nativeCredentialFileSha256)||
     typeof t.serverName!=='string'||! /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(t.serverName)||
     t.origin!==`https://${t.serverName}:8444`||![t.caFile,t.certFile,t.keyFile].every(file)||
     ![t.certSha256,t.issuerSha256,p.clientCertSha256,p.issuerSha256,s.ownerCertSha256,s.proxyCertSha256].every(digest)||
     t.certSha256===p.clientCertSha256||t.issuerSha256!==p.issuerSha256||
     !slot(p.clientSubject)||!slot(p.deploymentRevision)||!uuid(p.selectedClientId)||s.schemaVersion!==1||
     s.deploymentRevision!==p.deploymentRevision||s.ownerCertSha256!==t.certSha256||s.proxyCertSha256!==p.clientCertSha256||
     !integer(s.expiresAtMs,Number.MAX_SAFE_INTEGER)||!integer(l.maxRequestMs,3000)||!integer(l.maxFactBytes,131072)||!integer(l.maxLeaseMs,30000)||
     price.modelId!=='anthropic.claude-sonnet-4-6'||price.profileId!=='us.anthropic.claude-sonnet-4-6'||!digest(price.revision)||
     !integer(price.validUntilMs,Number.MAX_SAFE_INTEGER)||
     ![price.actualInputMicroUSDPerK,price.reserveInputMicroUSDPerK,price.outputMicroUSDPerK].every(n=>integer(n,1_000_000_000))||
     price.actualInputMicroUSDPerK>price.reserveInputMicroUSDPerK||!integer(price.maxInputTokens,8192)||!integer(price.maxOutputTokens,256))fail();
  const owner=servicePin(s.owner),proxy=servicePin(s.proxy);
  if(owner.taskArn!==p.ownerTaskArn||proxy.taskArn!==p.proxyTaskArn||owner.taskArn===proxy.taskArn||owner.serviceName===proxy.serviceName||
     owner.clusterArn!==proxy.clusterArn||owner.vpcId!==proxy.vpcId||owner.createdAtMs>=s.expiresAtMs||proxy.createdAtMs>=s.expiresAtMs)fail();
  return data({...c,enabled:c.enabled??false});
 }catch{fail();}
}

function databaseOptions(bytes,maxRequestMs){
 const connectionString=new TextDecoder('utf-8',{fatal:true}).decode(bytes).trim();let u;
 try{u=new URL(connectionString);}catch{fail();}
 // pg may adopt a different duplicate than URL.get: no other/duplicate query
 // option, fragment or alternate authority is allowed to replace verify-full.
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||u.hash||
    u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='verify-full'||
    [...u.searchParams.keys()].some(k=>k!=='sslmode'))fail();
 return {connectionString,max:10,connectionTimeoutMillis:maxRequestMs,idleTimeoutMillis:10000,query_timeout:maxRequestMs};
}
function defaultPool(options){const {Pool}=runtimeRequire('pg');return new Pool(options);}
const awsOptions=data({
 ecs:{region:'us-east-1',maxAttempts:1,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false,endpoint:'https://ecs.us-east-1.amazonaws.com'},
 ec2:{region:'us-east-1',maxAttempts:1,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false,endpoint:'https://ec2.us-east-1.amazonaws.com'},
});
function defaultClients(options){
 const {ECSClient}=runtimeRequire('@aws-sdk/client-ecs'),{EC2Client}=runtimeRequire('@aws-sdk/client-ec2');
 // Explicit official endpoints defeat SDK environment endpoint redirects.
 const ecsClient=new ECSClient(options.ecs);
 try{return {ecsClient,ec2Client:new EC2Client(options.ec2)};}
 catch{ecsClient.destroy();fail();}
}

/** Trusted tests can replace infrastructure constructors/material reads only.
 * Canonical facts/currentness/placement/journal and the single service gate are
 * always assembled here. No module names, credentials or callbacks are JSON.
 * Available means local assembly, not remote DB/Core/TLS/AWS qualification. */
export async function startProductOwner(raw,dependencies={}){
 let server,nativeCurrentness,pool,clients,closing,closed=false,started=false,life,closeMs=3000;
 const serviceGate=createProductOwnerServiceGate(),buffers=new Set();
 const close=()=>closing??=(async()=>{
  closed=true;serviceGate.poison();let timer;
  const pending=Promise.allSettled([()=>server?.close(),()=>nativeCurrentness?.close(),()=>pool?.end(),
   ()=>clients?.ecsClient.destroy(),()=>clients?.ec2Client.destroy()].map(action=>Promise.resolve().then(action)));
  let outcome;
  try{outcome=await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),closeMs);})]);}
  finally{clearTimeout(timer);for(const bytes of buffers)bytes.fill(0);buffers.clear();}
  let listenerStopped=!server;
  if(server&&outcome?.[0]?.status==='fulfilled')try{
   const receipt=own(outcome[0].value,['listenerStopped','pendingRequests'],['physicalStopProven']);
   listenerStopped=receipt.listenerStopped===true&&receipt.pendingRequests===0;
  }catch{}
  if(outcome===null||!listenerStopped||outcome.some(value=>value.status==='rejected'))throw Error('PRODUCT_OWNER_CLEANUP_UNKNOWN');
 })();
 try{
  const c=validateProductOwnerConfiguration(raw);
  if(!c.enabled)return frozenDisabled();
  closeMs=c.limits.maxRequestMs;
  const d=own(dependencies,[],['readMaterial','createPool','createAwsClients','createServer','now','fetchImpl']),
   readMaterial=d.readMaterial??readSecret,createPool=d.createPool??defaultPool,
   createAwsClients=d.createAwsClients??defaultClients,createServer=d.createServer??createProductOwnerHttpsServer,
   now=d.now??Date.now,fetchImpl=d.fetchImpl??fetch;
  if(![readMaterial,createPool,createAwsClients,createServer,now,fetchImpl].every(v=>typeof v==='function'))fail();
  const at=now();if(!Number.isSafeInteger(at)||at<0||c.serviceTasks.expiresAtMs<=at||c.pricing.validUntilMs<=at)fail();
  life=createOperationLifetime({now,deadlineMs:at+c.limits.maxRequestMs,errorFactory:()=>Error('PRODUCT_OWNER_STARTUP_UNAVAILABLE')});
  async function material(path){
   // Own every returned buffer before the lifetime can reject its completion.
   // Rejected sizes and late reads still require erasure of the received bytes.
   const pending=Promise.resolve().then(()=>readMaterial(path)).then(bytes=>{
    if(Buffer.isBuffer(bytes)){if(closed)bytes.fill(0);else buffers.add(bytes);}return bytes;
   });
   const bytes=await life.run(()=>pending);life.check();
   if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>32768)fail();return bytes;
  }
  const controlBytes=await material(c.controlConfigurationFile);
  if(sha(controlBytes)!==c.controlConfigurationSha256)fail();
  const control=validateConfiguration(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(controlBytes)),'control'),candidate=control.nativeCandidate;
  if(candidate?.multiRun?.dynamicInitialRuns!==true||candidate.identity.commandContext.clientResolution.clientId!==c.clientPolicy.selectedClientId)fail();
  const connectionBytes=await material(control.database.connectionFile),options=databaseOptions(connectionBytes,c.limits.maxRequestMs);
  pool=createPool(options);if(typeof pool?.connect!=='function'||typeof pool?.end!=='function')fail();
  clients=createAwsClients(awsOptions);own(clients,['ecsClient','ec2Client']);
  if([clients.ecsClient,clients.ec2Client].some(client=>typeof client?.send!=='function'||typeof client?.destroy!=='function'))fail();
  const limits={maxRequestMs:c.limits.maxRequestMs,maxFactBytes:c.limits.maxFactBytes},
   persistedFacts=createProductProxyPersistedFacts({pool,selectedClientId:c.clientPolicy.selectedClientId,now,limits,enabled:true}),
   initialBindings=createInitialRunBindingJournal({pool,now}),
   placement=createProductOwnerPlacement({configuration:control,pool,persistedFacts,initialBindings,now,limits,enabled:true});
  nativeCurrentness=createProductOwnerNativeCurrentness({configuration:control,pool,credentialFileSha256:c.nativeCredentialFileSha256,
   now,limits,fetchImpl,enabled:true},{readMaterial});
  const taskLeaseReader=await life.run(()=>createProductServiceTaskLeaseReader({ecsClient:clients.ecsClient,ec2Client:clients.ec2Client,
   configuration:c.serviceTasks,now,limits:{maxRequestMs:c.limits.maxRequestMs,maxLeaseMs:c.limits.maxLeaseMs},enabled:true}));
  const ca=await material(c.tls.caFile),cert=await material(c.tls.certFile),key=await material(c.tls.keyFile);
  server=createServer({enabled:true,tlsMaterial:{origin:c.tls.origin,serverName:c.tls.serverName,ca,cert,key,
   certSha256:c.tls.certSha256,issuerSha256:c.tls.issuerSha256},clientPolicy:c.clientPolicy,persistedFacts,
   ownerPorts:{pool,pricing:c.pricing,limits,checkCurrentConversation:nativeCurrentness.checkCurrentConversation},placement,taskLeaseReader,
   serviceGate,now,maxRequestMs:c.limits.maxRequestMs,nativeCurrentness});
  life.check();if(server?.available!==true||typeof server.listen!=='function'||typeof server.close!=='function')fail();
  return Object.freeze({get available(){return !closed&&server.available&&nativeCurrentness.available&&serviceGate.available;},
   async start(){let startup;try{if(closed||started||!server.available)fail();started=true;
     startup=createOperationLifetime({now,deadlineMs:now()+c.limits.maxRequestMs,errorFactory:()=>Error('PRODUCT_OWNER_STARTUP_UNAVAILABLE')});
     await startup.run(()=>server.listen({host:'0.0.0.0',port:8444}));startup.check();if(closed)fail();}
    catch{await close();fail();}finally{if(startup?.close().unsettledOperations>0)serviceGate.poison();}},close});
 }catch{try{await close();}catch{throw Error('PRODUCT_OWNER_CLEANUP_UNKNOWN');}fail();}
 finally{life?.close();for(const bytes of buffers)bytes.fill(0);buffers.clear();}
}

/** Actual executable: explicit enablement and a separately pinned runtime file.
 * Emits constant status codes only; no caught error, DSN or material is logged. */
export async function runProductOwnerMain(argv=process.argv.slice(2),env=process.env,dependencies={}){
 let runtime,stop,stopped=false,startupTimer,shutdownTimer;
 const watchdog=(code,ms)=>{const timer=setTimeout(()=>{process.stderr.write(code+'\n');process.exit(3);},ms);timer.unref();return timer;};
 try{
  if(argv.length!==2||argv[0]!=='--config'||!file(argv[1])||env.MERI_PRODUCT_OWNER_REQUIRED!=='1'||!digest(env.MERI_PRODUCT_OWNER_CONFIG_SHA256))fail();
  startupTimer=watchdog('PRODUCT_OWNER_STARTUP_TIMEOUT',10000);
  const readMaterial=dependencies.readMaterial??readSecret,bytes=await readMaterial(argv[1]);let c;
  try{if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>32768||sha(bytes)!==env.MERI_PRODUCT_OWNER_CONFIG_SHA256)fail();
   c=validateProductOwnerConfiguration(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}
  finally{if(Buffer.isBuffer(bytes))bytes.fill(0);}
  if(!c.enabled)fail();
  const completion=new Promise(resolve=>{stop=()=>{stopped=true;shutdownTimer??=watchdog('PRODUCT_OWNER_SHUTDOWN_TIMEOUT',c.limits.maxRequestMs+1000);resolve();};});
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  runtime=await startProductOwner(c,dependencies);if(!stopped)await runtime.start();clearTimeout(startupTimer);await completion;await runtime.close();clearTimeout(shutdownTimer);return 0;
 }catch(error){let cleanupUnknown=error?.message==='PRODUCT_OWNER_CLEANUP_UNKNOWN';
  try{await runtime?.close();}catch{cleanupUnknown=true;}
  if(cleanupUnknown)shutdownTimer??=watchdog('PRODUCT_OWNER_SHUTDOWN_TIMEOUT',1000);else clearTimeout(shutdownTimer);
  process.stderr.write('PRODUCT_OWNER_UNAVAILABLE\n');return 3;}
 finally{clearTimeout(startupTimer);if(stop){process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await runProductOwnerMain();
