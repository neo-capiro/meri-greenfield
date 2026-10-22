/** Synthetic AWS observations plus a real mTLS owner listener. No AWS or provider calls.
 * Callers supply canonical facts/SQL/currentness ports for composed budget tests. */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {X509Certificate,createHash} from 'node:crypto';
import {Agent,request as httpsRequest} from 'node:https';
import {performance} from 'node:perf_hooks';
import {productFixture} from '../../../gateway/budget/product-scripted-fixture.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createOwnerPairLease,pairFailure} from '../owner-pair-lease.mjs';
import {createProductOwnerServiceGate} from '../owner-channel.mjs';
import {createProductOwnerHttpsServer} from '../owner-https.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function createP2OwnerFixture({persistedFacts,ownerPorts,placement,now=Date.now,
 monotonicNow=()=>performance.now(),maxRequestMs=1000,telemetry,pairIdentities,afterPlacement,afterFacts,readiness}={}){
 const directory=mkdtempSync(join(tmpdir(),'meri-p2-owner-'));
 const run=args=>execFileSync('openssl',args,{cwd:directory,stdio:'ignore'});
 const events=[],health=[],counts={pairProofs:0,placement:0,facts:0};let unavailable=false,hook=null;
 let server,reader;
 const agents=new Set();
 try{
  run(['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout','ca.key','-out','ca.pem','-days','3650',
   '-subj','/CN=synthetic-p2-ca','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
  for(const [name,subject,usage]of [['owner','owner.synthetic.invalid','serverAuth'],['proxy','proxy-task-v1','clientAuth']]){
   run(['req','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout',name+'.key','-out',name+'.csr','-subj','/CN='+subject]);
   writeFileSync(join(directory,name+'.ext'),`basicConstraints=CA:FALSE\nextendedKeyUsage=${usage}\n`+(name==='owner'?`subjectAltName=DNS:${subject}\n`:''));
   run(['x509','-req','-in',name+'.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-out',name+'.pem','-days','3650','-extfile',name+'.ext']);
  }
  const material=file=>readFileSync(join(directory,file)),cert=material('owner.pem'),ca=material('ca.pem'),clientCert=material('proxy.pem');
  const pins={deploymentRevision:'synthetic-p2-v1',expiresAtMs:now()+3600000,
   ownerCertSha256:hash(new X509Certificate(cert).raw),proxyCertSha256:hash(new X509Certificate(clientCert).raw)};
  const pair={owner:{taskArn:'synthetic-owner',privateIpv4Address:'127.0.0.1',networkInterfaceId:'eni-11111111',createdAtMs:now()-10000,...pairIdentities?.owner},
   proxy:{taskArn:'synthetic-proxy',privateIpv4Address:'127.0.0.2',networkInterfaceId:'eni-22222222',createdAtMs:now()-10000,...pairIdentities?.proxy}};
  const clientPolicy={ownerTaskArn:pair.owner.taskArn,proxyTaskArn:pair.proxy.taskArn,clientCertSha256:pins.proxyCertSha256,
   clientSubject:'proxy-task-v1',deploymentRevision:pins.deploymentRevision,issuerSha256:hash(new X509Certificate(ca).raw),
   selectedClientId:'11111111-1111-4111-8111-111111111111'};
  const tlsMaterial={origin:'https://owner.synthetic.invalid:8444',serverName:'owner.synthetic.invalid',ca,cert,key:material('owner.key'),
   certSha256:pins.ownerCertSha256,issuerSha256:clientPolicy.issuerSha256};
  reader=await createOwnerPairLease({pins,now,monotonicNow,maxRequestMs,
   telemetry:telemetry??{health:(...args)=>health.push(args)},writeDiagnostic:()=>{},
   createDiscovery:async()=>({available:true,async read(){counts.pairProofs++;events.push(['proof',monotonicNow()]);if(hook)await hook();if(unavailable)throw pairFailure();
    return structuredClone({...pair,checkedAtMs:now(),expiresAtMs:Math.min(pins.expiresAtMs,now()+30000)});}})});
  await reader.read({deadlineMs:now()+maxRequestMs});
  const serviceGate=createProductOwnerServiceGate({telemetry});
  const seed=productFixture(),grant=seed.context(),binding=grant.binding;
  grant.capabilitySha256='a'.repeat(64);
  const expiry=now()+60000,execution=canonicalSha256(binding),clientId=clientPolicy.selectedClientId;
  const resource={taskArn:grant.qualificationBinding.workerArn,createdAtMs:now()-1000,
   clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',
   taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker'};
  const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
  const facts=persistedFacts??{available:true,resolve:async()=>({binding,allocationJson:JSON.stringify(seed.allocation),grantFactsJsons:[JSON.stringify(grant)],
   modelGrantId:grant.grantId,selectedClientId:clientId,original:{binding,executionKey:execution,executionId:execution,planSha256:'d'.repeat(64),expiresAtMs:expiry,versions},
   resource,requestSha256:'e'.repeat(64),expiresAtMs:expiry})};
  const ports=ownerPorts??{pool:{connect:async()=>{throw Error('SYNTHETIC_SQL_NOT_CONFIGURED');}},pricing:{},limits:{},
   checkCurrentConversation:async()=>({identitySha256:'a'.repeat(64),binding,
    scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,policyRevision:grant.qualificationBinding.policyRevision}],
    selectedClientId:clientId,contextRevision:'b'.repeat(64),checkedAtMs:now(),expiresAtMs:expiry})};
  const suppliedPlacement=placement??{available:true,resolve:async value=>({issuedTaskNetwork:{
   binding:{run_id:binding.runId,attempt:1,worker_arn:resource.taskArn,fence:binding.writerFence,policy_revision:grant.qualificationBinding.policyRevision},
   grant_id:grant.grantId,cluster_arn:resource.clusterArn,task_definition_arn:resource.taskDefinitionArn,container_name:resource.containerName,image_digest:versions.imageDigest,
   execution_binding:binding,started_by:execution,group:'meri:'+execution,created_at_ms:resource.createdAtMs,expires_at_ms:expiry,
   vpc_id:'vpc-aaaaaaaaaaaaaaaaa',subnet_id:'subnet-bbbbbbbbbbbbbbbbb',security_group_ids:['sg-ccccccccccccccccc'],
   tags:[['meri:execution-id',execution],['meri:binding-sha256',execution],['meri:plan-sha256','d'.repeat(64)],['meri:expires-at-ms',String(expiry)]]},
   checkedAtMs:now(),effectiveExpiresAtMs:Math.min(value.deadlineMs,expiry)})};
  const wrappedPlacement={get available(){return suppliedPlacement.available;},async resolve(value){
   counts.placement++;const result=await suppliedPlacement.resolve(value);await afterPlacement?.(result);return result;
  }};
  // Readiness can be tested independently of socket-bound authority. All proof,
  // generation and monotonic lease checks still use the real holder above.
  const taskLeaseReader=readiness?Object.create(reader,{ready:{get:readiness}}):reader;
  const wrappedFacts={get available(){return facts.available;},async resolve(value){
   counts.facts++;const result=await facts.resolve(value);await afterFacts?.(result,counts.facts);return result;
  }};
  const create=()=>createProductOwnerHttpsServer({enabled:true,tlsMaterial,clientPolicy,persistedFacts:wrappedFacts,ownerPorts:ports,
   placement:wrappedPlacement,taskLeaseReader,serviceGate,now,maxRequestMs});
  server=telemetry?telemetry.provisional(create):create();await server.listen();
  const clientTls={ca,cert:clientCert,key:material('proxy.key'),minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1'],servername:'owner.synthetic.invalid'};
  const agent=()=>{const value=new Agent({...clientTls,keepAlive:true,maxSockets:1,maxFreeSockets:1});agents.add(value);return value;};
  const defaultAgent=agent();
  const request=(path,frame,{using=defaultAgent,localAddress='127.0.0.2',method=frame===undefined?'GET':'POST',onSocket}={})=>new Promise((resolve,reject)=>{
   const body=frame===undefined?null:Buffer.isBuffer(frame)?frame:Buffer.from(JSON.stringify(frame));
   const req=httpsRequest({host:'127.0.0.1',port:8444,servername:'owner.synthetic.invalid',localAddress,agent:using,path,method,
    headers:body?{'content-type':'application/json','content-length':String(body.length)}:{}},res=>{
     const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks),headers:res.headers,socket:req.socket}));
   });
   req.on('socket',socket=>{events.push(['client-socket',monotonicNow()]);onSocket?.(socket);});req.on('error',reject);req.end(body??undefined);
  });
  return {server,reader,serviceGate,pins,clientPolicy,tlsMaterial,clientTls,directory,agent,request,counts,events,health,
   clientFiles:{caFile:join(directory,'ca.pem'),certFile:join(directory,'proxy.pem'),keyFile:join(directory,'proxy.key')},
   ownerFiles:{caFile:join(directory,'ca.pem'),certFile:join(directory,'owner.pem'),keyFile:join(directory,'owner.key')},
   setUnavailable:value=>{unavailable=value;},proofHook:value=>{hook=value;},
   replaceProxy:(id='synthetic-proxy-new',ip='127.0.0.3')=>{pair.proxy={taskArn:id,privateIpv4Address:ip,networkInterfaceId:'eni-33333333',createdAtMs:now()};},
   mutatePair:fn=>fn(pair),
   async close(){for(const value of agents)value.destroy();await server.close();await reader.close();rmSync(directory,{recursive:true,force:true});},
  };
 }catch(error){for(const value of agents)value.destroy();await server?.close();await reader?.close();rmSync(directory,{recursive:true,force:true});throw error;}
}
