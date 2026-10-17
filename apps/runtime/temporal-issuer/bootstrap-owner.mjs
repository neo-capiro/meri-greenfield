/** Private post-placement service certificate bootstrap. A claimed task ARN only
 * selects a fresh AWS task/ENI proof; the peer IP always comes from the TLS socket.
 * The challenge map is short-lived transport state, never a revocation authority.
 * registerCurrent is the ONE durable service-task registration owner and must
 * atomically compare its deployment revision/revocation before returning CURRENT. */
import {X509Certificate, createHash, randomBytes, randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {parseRunnerPoststartCsr, verifyRunnerPoststartProof} from '../native-authority/runner-poststart-csr.mjs';
import {parseTemporalIssuerTaskAuthorityConfiguration} from './task-authority.mjs';

const ROLE_KEYS=['control','temporal-worker'];
const CHALLENGE_KEYS=['schemaVersion','role','taskArn','csrPem'];
const REDEEM_KEYS=[...CHALLENGE_KEYS,'challengeId','proofBase64'];
const FACT_KEYS=['state','role','taskArn','peerIPv4','revision','serviceArn',
 'taskDefinitionArn','imageUri','taskRoleArn','executionRoleArn','observedAtMs','validUntilMs'];
const SNAPSHOT_KEYS=FACT_KEYS.filter(key=>!['state','observedAtMs','validUntilMs'].includes(key));
const RECEIPT_KEYS=['schemaVersion','state','certificateSha256','role','peerSanUri',
 'taskArn','revision','expiresAtMs'];
const ABSENT_KEYS=['schemaVersion','state','certificateSha256'];
const SHA256=/^[a-f0-9]{64}$/u;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const refused=()=>Object.assign(Error('TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'),{code:'TEMPORAL_ISSUER_BOOTSTRAP_REFUSED'});
const unavailable=()=>Object.assign(Error('TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'),{code:'TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE'});
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===keys.length&&
 keys.every(key=>Object.hasOwn(value,key));
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const sha256=value=>createHash('sha256').update(value).digest('hex');
function taskArnFor(clusterArn,value){
 const [,region,account,cluster]=/^arn:aws:ecs:([a-z0-9-]+):([0-9]{12}):cluster\/([A-Za-z0-9_-]{1,255})$/u.exec(clusterArn)??[];
 return typeof value==='string'&&new RegExp(`^arn:aws:ecs:${region}:${account}:task/${cluster}/[a-f0-9]{32}$`,'u').test(value);
}
function peerIPv4(socket){
 if(socket?.encrypted!==true||isIP(socket.remoteAddress)!==4)throw refused();
 return socket.remoteAddress;
}
function snapshot(fact){return Object.freeze(Object.fromEntries(SNAPSHOT_KEYS.map(key=>[key,fact[key]])));}
function sameSnapshot(left,right){return SNAPSHOT_KEYS.every(key=>left[key]===right[key]);}
function factNow(fact,{configuration,role,taskArn,peerIPv4:ip,startedAtMs,nowMs}){
 if(!exact(fact,FACT_KEYS))throw unavailable();
 if(fact.state==='UNAVAILABLE')throw unavailable();
 if(fact.state!=='CURRENT')throw refused();
 const pin=configuration.roles[role];
 if(fact.role!==role||fact.taskArn!==taskArn||fact.peerIPv4!==ip||
    fact.revision!==pin.revision||fact.serviceArn!==pin.serviceArn||
    fact.taskDefinitionArn!==pin.taskDefinitionArn||fact.imageUri!==pin.imageUri||
    fact.taskRoleArn!==pin.taskRoleArn||fact.executionRoleArn!==pin.executionRoleArn||
    !integer(fact.observedAtMs,startedAtMs,nowMs)||
    !integer(fact.validUntilMs,nowMs+1,fact.observedAtMs+configuration.maxLeaseMs))throw refused();
 return snapshot(fact);
}
function receiptNow(receipt,{certificateSha256,role,peerSanUri,taskArn,revision,expiresAtMs}){
 if(!exact(receipt,RECEIPT_KEYS)||receipt.schemaVersion!==1||receipt.state!=='CURRENT'||
    receipt.certificateSha256!==certificateSha256||receipt.role!==role||
    receipt.peerSanUri!==peerSanUri||receipt.taskArn!==taskArn||
    receipt.revision!==revision||receipt.expiresAtMs!==expiresAtMs)throw unavailable();
 return Object.freeze({...receipt});
}
function previousCertificate(value,{role,taskArn,peerSanUri,revision}){
 if(exact(value,ABSENT_KEYS)&&value.schemaVersion===1&&value.state==='ABSENT'&&
    value.certificateSha256===null)return null;
 if(exact(value,RECEIPT_KEYS)&&value.schemaVersion===1&&value.state==='CURRENT'&&
    SHA256.test(value.certificateSha256)&&value.role===role&&value.taskArn===taskArn&&
    value.peerSanUri===peerSanUri&&value.revision===revision&&
    integer(value.expiresAtMs,0,Number.MAX_SAFE_INTEGER))return value.certificateSha256;
 throw unavailable();
}

/** The caller must pass the actual private HTTPS request socket. CSR subject and
 * request fields never supply peer/task authority. No certificate is released
 * until one canonical durable registerCurrent transaction returns an exact row. */
export function createTemporalIssuerBootstrapOwner({configuration,taskProof,registration,
 certificateIssuer,now=Date.now,maxRequestMs=3000,maxChallenges=128,
 challengeLifetimeMs=15000,certificateLifetimeMs=300000}={}){
 const c=parseTemporalIssuerTaskAuthorityConfiguration(configuration);
 if(typeof taskProof?.readCurrent!=='function'||typeof registration?.readTaskCurrent!=='function'||
    typeof registration?.registerCurrent!=='function'||typeof registration?.readCurrent!=='function'||
    typeof certificateIssuer?.issue!=='function'||typeof now!=='function'||
    !integer(maxRequestMs,1,30000)||!integer(maxChallenges,1,4096)||
    !integer(challengeLifetimeMs,1000,15000)||!integer(certificateLifetimeMs,30000,3600000))throw refused();
 let closed=false,closeReceipt=null;const challenges=new Map(),active=new Set(),physical=new Set();
 const check=signal=>{if(closed||signal?.aborted)throw unavailable();};
 function trackPhysical(work){
  const pending=Promise.resolve().then(work);
  physical.add(pending);
  pending.finally(()=>physical.delete(pending)).catch(()=>{});
  return pending;
 }
 async function bounded(external,operation){
  if(closed||external?.aborted)throw unavailable();
  const controller=new AbortController();active.add(controller);
  const abort=()=>controller.abort();external?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,maxRequestMs);timer.unref?.();
  let interrupt;
  const stopped=new Promise((_,reject)=>{
   interrupt=()=>reject(unavailable());controller.signal.addEventListener('abort',interrupt,{once:true});
  });
  try{check(controller.signal);return await Promise.race([
   trackPhysical(()=>{check(controller.signal);return operation(controller.signal);}),stopped]);}
  finally{clearTimeout(timer);external?.removeEventListener('abort',abort);
   controller.signal.removeEventListener('abort',interrupt);active.delete(controller);}
 }
 async function current({role,taskArn,ip,signal}){
  check(signal);const startedAtMs=now();
  if(!integer(startedAtMs,0,Number.MAX_SAFE_INTEGER))throw unavailable();
  const fact=await taskProof.readCurrent({role,taskArn,peerIPv4:ip,signal});
  check(signal);const observedAtMs=now();
  if(!integer(observedAtMs,startedAtMs,Number.MAX_SAFE_INTEGER))throw unavailable();
  const saved=snapshot(factNow(fact,{configuration:c,role,taskArn,peerIPv4:ip,startedAtMs,nowMs:observedAtMs}));
  return {saved,observedAtMs:fact.observedAtMs,validUntilMs:fact.validUntilMs};
 }
 function request(value,keys,socket){
  if(!exact(value,keys)||value.schemaVersion!==1||!ROLE_KEYS.includes(value.role)||
     !taskArnFor(c.clusterArn,value.taskArn)||typeof value.csrPem!=='string'||
     value.csrPem.length<1||value.csrPem.length>8192)throw refused();
  return peerIPv4(socket);
 }
 async function challenge(value,{socket,signal}={}){
  return bounded(signal,async held=>{
   const ip=request(value,CHALLENGE_KEYS,socket);parseRunnerPoststartCsr(value.csrPem);
   const proof=await current({role:value.role,taskArn:value.taskArn,ip,signal:held});
   check(held);
   const at=now();for(const [id,row] of challenges)if(row.expiresAtMs<=at)challenges.delete(id);
   if(challenges.size>=maxChallenges)throw unavailable();
   const expiresAtMs=Math.min(at+challengeLifetimeMs,proof.validUntilMs);
   if(expiresAtMs<=at+1000)throw unavailable();
   const challengeId=randomUUID(),csrSha256=sha256(Buffer.from(value.csrPem,'utf8'));
   const taskFactSha256=sha256(Buffer.from(JSON.stringify(proof.saved),'utf8'));
   const proofMessage=Buffer.from(JSON.stringify({schemaVersion:1,
    purpose:'meri-temporal-service-client-cert-bootstrap',challengeId,
    nonce:randomBytes(32).toString('base64url'),role:value.role,taskArn:value.taskArn,
    peerIPv4:ip,revision:proof.saved.revision,taskFactSha256,csrSha256,expiresAtMs}),'utf8');
   challenges.set(challengeId,{role:value.role,taskArn:value.taskArn,peerIPv4:ip,
    csrSha256,saved:proof.saved,proofMessage,expiresAtMs});
   return Object.freeze({schemaVersion:1,challengeId,proofMessage:proofMessage.toString('base64'),expiresAtMs});
  });
 }
 async function redeem(value,{socket,signal}={}){
  return bounded(signal,async held=>{
   // Consume before CSR parsing, signature validation, or any network/storage I/O.
   const challengeId=value?.challengeId;
   const entry=challenges.get(challengeId);challenges.delete(challengeId);
   const ip=request(value,REDEEM_KEYS,socket);
   if(!entry||!UUID.test(challengeId)||entry.role!==value.role||
      entry.taskArn!==value.taskArn||entry.peerIPv4!==ip||entry.expiresAtMs<=now()||
      entry.csrSha256!==sha256(Buffer.from(value.csrPem,'utf8')))throw refused();
   const csr=verifyRunnerPoststartProof({csrPem:value.csrPem,message:entry.proofMessage,
    proofBase64:value.proofBase64});
   const before=await current({role:value.role,taskArn:value.taskArn,ip,signal:held});
   if(!sameSnapshot(entry.saved,before.saved)||entry.expiresAtMs<=now())throw refused();
   check(held);
   const pin=c.roles[value.role],notAfterMs=now()+certificateLifetimeMs;
   const expectedSan=pin.peerUriBase+encodeURIComponent(value.taskArn);
   const prior=await registration.readTaskCurrent({role:value.role,taskArn:value.taskArn,signal:held});
   check(held);
   const expectedCertificateSha256=previousCertificate(prior,{role:value.role,
    taskArn:value.taskArn,peerSanUri:expectedSan,revision:before.saved.revision});
   if(!integer(notAfterMs,0,Number.MAX_SAFE_INTEGER))throw unavailable();
   const certificate=await certificateIssuer.issue({csrPem:value.csrPem,
    proofMessage:entry.proofMessage,proofBase64:value.proofBase64,
    taskArn:value.taskArn,peerSubjectCn:pin.peerSubjectCn,
    peerUriBase:pin.peerUriBase,notAfterMs,signal:held});
   check(held);
   if(!certificate||typeof certificate.certPem!=='string'||certificate.certPem.length<1||
      certificate.certPem.length>16384||!SHA256.test(certificate.certificateSha256)||
      certificate.peerSanUri!==expectedSan||
      !integer(certificate.expiresAtMs,now()+1000,notAfterMs))throw unavailable();
   let leaf;
   try{leaf=new X509Certificate(certificate.certPem);}catch{throw unavailable();}
   if(sha256(leaf.raw)!==certificate.certificateSha256||
      leaf.subject!==`CN=${pin.peerSubjectCn}`||leaf.subjectAltName!==`URI:${expectedSan}`||
      leaf.ca!==false||leaf.keyUsage?.length!==1||
      leaf.keyUsage[0]!=='1.3.6.1.5.5.7.3.2'||
      !leaf.publicKey.export({type:'spki',format:'der'}).equals(csr.spki)||
      Date.parse(leaf.validFrom)>now()||Date.parse(leaf.validTo)!==certificate.expiresAtMs)throw unavailable();
   const after=await current({role:value.role,taskArn:value.taskArn,ip,signal:held});
   if(!sameSnapshot(entry.saved,after.saved)||entry.expiresAtMs<=now()||
      after.validUntilMs<=now())throw refused();
   check(held);
   const persisted=await registration.registerCurrent({schemaVersion:1,role:value.role,
    taskArn:value.taskArn,peerIPv4:ip,revision:after.saved.revision,
    serviceArn:after.saved.serviceArn,taskDefinitionArn:after.saved.taskDefinitionArn,
    imageUri:after.saved.imageUri,taskRoleArn:after.saved.taskRoleArn,
    executionRoleArn:after.saved.executionRoleArn,
    certificateSha256:certificate.certificateSha256,peerSanUri:certificate.peerSanUri,
    expectedCertificateSha256,
    expiresAtMs:certificate.expiresAtMs,proofObservedAtMs:after.observedAtMs,
    proofValidUntilMs:after.validUntilMs,signal:held});
   check(held);
   receiptNow(persisted,{certificateSha256:certificate.certificateSha256,
    role:value.role,peerSanUri:expectedSan,taskArn:value.taskArn,
    revision:after.saved.revision,expiresAtMs:certificate.expiresAtMs});
   const primary=await registration.readCurrent({certificateSha256:certificate.certificateSha256,
    role:value.role,signal:held});
   check(held);
   const receipt=receiptNow(primary,{certificateSha256:certificate.certificateSha256,
    role:value.role,peerSanUri:expectedSan,taskArn:value.taskArn,
    revision:after.saved.revision,expiresAtMs:certificate.expiresAtMs});
   const final=await current({role:value.role,taskArn:value.taskArn,ip,signal:held});
   if(!sameSnapshot(entry.saved,final.saved)||entry.expiresAtMs<=now()||
      final.validUntilMs<=now()||
      certificate.expiresAtMs<=now())throw unavailable();
   return Object.freeze({schemaVersion:1,certPem:certificate.certPem,registration:receipt});
  });
 }
 function close(){
  // A late registration completion may have committed. Preserve the first
  // UNKNOWN receipt until the durable owner explicitly reconciles that task.
  if(closeReceipt)return closeReceipt;
  closed=true;challenges.clear();for(const controller of active)controller.abort();
  const pendingOperations=physical.size+active.size;
  closeReceipt=Object.freeze({schemaVersion:1,
   state:pendingOperations===0?'CLEAN':'CLEANUP_UNKNOWN',pendingOperations});
  return closeReceipt;
 }
 return Object.freeze({challenge,redeem,close,available:()=>!closed});
}
