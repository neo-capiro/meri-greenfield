/** Synthetic AWS observations plus a real mTLS owner listener. No AWS or provider calls.
 * Callers supply canonical facts/SQL/currentness ports for composed budget tests. */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {X509Certificate,createHash} from 'node:crypto';
import {Agent,request as httpsRequest} from 'node:https';
import {performance} from 'node:perf_hooks';
import {createOwnerPairLease,pairFailure} from '../owner-pair-lease.mjs';
import {createProductOwnerServiceGate} from '../owner-channel.mjs';
import {createProductOwnerHttpsServer} from '../owner-https.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function createP2OwnerFixture({persistedFacts,ownerPorts,placement,now=Date.now,
 monotonicNow=()=>performance.now(),maxRequestMs=1000,telemetry,pairIdentities}={}){
 const directory=mkdtempSync(join(tmpdir(),'meri-p2-owner-'));
 const run=args=>execFileSync('openssl',args,{cwd:directory,stdio:'ignore'});
 const events=[],health=[],counts={pairProofs:0,placement:0};let unavailable=false,hook=null;
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
  const facts=persistedFacts??{available:true,resolve:async()=>{throw Error('SYNTHETIC_FACTS_NOT_CONFIGURED');}};
  const ports=ownerPorts??{pool:{connect:async()=>{throw Error('SYNTHETIC_SQL_NOT_CONFIGURED');}},pricing:{},limits:{},checkCurrentConversation:async()=>{throw Error('SYNTHETIC_CURRENTNESS_NOT_CONFIGURED');}};
  const suppliedPlacement=placement??{available:true,resolve:async value=>{
   const binding={run_id:'run',attempt:1,worker_arn:'worker',fence:1,policy_revision:'policy'};
   return {issuedTaskNetwork:{binding,grant_id:'grant',cluster_arn:'cluster',task_definition_arn:'definition',container_name:'worker',image_digest:'sha256:image',
    execution_binding:{tenantId:'tenant',actorId:'actor',conversationId:'conversation',runId:'run',attemptId:'attempt',workerId:'worker',writerFence:1},
    started_by:'started',group:'group',created_at_ms:now()-1000,expires_at_ms:now()+60000,vpc_id:'vpc',subnet_id:'subnet',security_group_ids:['sg'],tags:[]},
    checkedAtMs:now(),effectiveExpiresAtMs:Math.min(value.deadlineMs,now()+1000)};
  }};
  const wrappedPlacement={get available(){return suppliedPlacement.available;},resolve:value=>{counts.placement++;return suppliedPlacement.resolve(value);}};
  const create=()=>createProductOwnerHttpsServer({enabled:true,tlsMaterial,clientPolicy,persistedFacts:facts,ownerPorts:ports,
   placement:wrappedPlacement,taskLeaseReader:reader,serviceGate,now,maxRequestMs});
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
