/** Private poststart owner. A task ARN and CSR are selectors, never authority.
 * Every challenge and redemption joins current issuance, allocation, admission,
 * running ECS task and ENI peer before any issued capability is read. */
import {randomBytes,randomUUID,createHash,X509Certificate} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {remoteOriginal,exactOriginal,digest} from './remote-task-boundary.mjs';
import {assertEcsOwnedTask,assertEcsRunningTask,compileEcsTaskBinding} from './ecs-task-binding.mjs';
import {runnerTaskServername,assertRunnerPeerCertificate} from './runner-tls-client.mjs';
import {parseRunnerPoststartCsr,verifyRunnerPoststartProof} from './runner-poststart-csr.mjs';
import {taskRouterFault} from './task-router-boundary.mjs';
const fail=()=>{throw taskRouterFault();};
const pending=()=>{throw Object.assign(Error('RUNNER_POSTSTART_PENDING'),{code:'RUNNER_POSTSTART_PENDING'});};
const arn=/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u;
const pin=v=>hash({original:v.original,resource:v.resource,issued:v.issued,allocationSha256:v.allocationSha256,network:Object.fromEntries(Object.entries(v.candidate).filter(([k])=>k!=='checkedAtMs'))});
function singleCertificate(pem){if(typeof pem!=='string'||pem.length>16384||!/^-----BEGIN CERTIFICATE-----\r?\n[\s\S]+-----END CERTIFICATE-----\r?\n?$/u.test(pem)||[...pem.matchAll(/-----BEGIN CERTIFICATE-----/gu)].length!==1)fail();return new X509Certificate(pem);}
function certificate(csr,certificatePem,caPem,taskName,nowMs,expiresAtMs){
 const leaf=singleCertificate(certificatePem),ca=singleCertificate(caPem);
 assertRunnerPeerCertificate({certificate:leaf,taskName,nowMs,expiresAtMs});
 if(!ca.ca||!leaf.checkIssued(ca)||!leaf.verify(ca.publicKey)||!leaf.publicKey.export({type:'spki',format:'der'}).equals(csr.spki))fail();
 return certificatePem;
}
export function createRunnerPoststartAuthority(configuration){
 const c=own(configuration,['issuanceStore','allocations','admissionForBinding','taskReader','networkReader','issuer','runnerConfiguration','certificateIssuer','controlCa','runnerCa','zone','controlCapabilitySha256','operations','transport'],['approvedReads','now','maxRequestMs','maxChallenges','objectiveFacts','objectiveExecutionSelection']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000,maxChallenges=c.maxChallenges??1024;
 const readIssuance=storageMethod(c.issuanceStore,'read'),readAllocation=storageMethod(c.allocations,'read'),readTask=storageMethod(c.taskReader,'read'),observe=storageMethod(c.networkReader,'observe'),resolve=storageMethod(c.issuer,'resolve'),configFor=storageMethod(c.runnerConfiguration,'forOriginal'),issueCert=storageMethod(c.certificateIssuer,'issue');
 if(typeof c.admissionForBinding!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxChallenges)||maxChallenges<1||maxChallenges>4096||!digest(c.controlCapabilitySha256)||!Array.isArray(c.operations)||!c.operations.length||new Set(c.operations).size!==c.operations.length||!Buffer.isBuffer(c.controlCa)||!Buffer.isBuffer(c.runnerCa)||c.controlCa.length>16384||c.runnerCa.length>16384)fail();
 const runnerCa=singleCertificate(c.runnerCa.toString('utf8'));if(!runnerCa.ca)fail();
 const controlCa=singleCertificate(c.controlCa.toString('utf8'));if(!controlCa.ca)fail();
 const challenges=new Map();let closed=false;
 function check(life){life.check();if(closed)fail();}
 async function current({taskArn,peerIPv4,life}){
  if(!arn.test(taskArn)||typeof peerIPv4!=='string')fail();check(life);const began=now();
  const task=await life.run(signal=>readTask({taskArn,signal}));check(life);
  if(task?.taskArn!==taskArn||!digest(task.startedBy))fail();
  const issued=await life.run(signal=>readIssuance({issuanceKey:task.startedBy,signal}));check(life);
  if(issued?.state!=='ISSUED'||issued.issuanceKey!==task.startedBy||hash(issued.binding)!==task.startedBy||!digest(issued.factsSha256)||!digest(issued.capabilitySha256)||!digest(issued.requestSha256)||typeof issued.materialRef!=='string'||issued.materialRef.length<1||issued.materialRef.length>1024)fail();
  const saved=await life.run(()=>readAllocation({binding:issued.binding,allocationKey:issued.issuanceKey},()=>check(life)));check(life);
  const record=saved?.record,original=remoteOriginal(record?.original);
  if(!['ALLOCATED','ADMITTED'].includes(record.state)||!['queued','starting','running'].includes(saved.run?.state)||hash(saved.run.binding)!==issued.issuanceKey||hash(record.binding)!==issued.issuanceKey||record.allocationKey!==issued.issuanceKey||record.expiresAtMs!==issued.expiresAtMs||original.executionKey!==issued.issuanceKey||original.expiresAtMs!==issued.expiresAtMs||record.resource?.taskArn!==taskArn||!Array.isArray(record.grantIntents))fail();
  const grant=record.grantIntents.find(g=>g.grantId===issued.grantId);
  if(!grant||grant.capabilitySha256!==issued.capabilitySha256||grant.expiresAtMs!==issued.expiresAtMs||issued.capabilitySha256===c.controlCapabilitySha256)fail();
  const facts={original,allocationSha256:record.allocationSha256,taskRequestSha256:record.taskRequestSha256,qualification:record.qualification,grantIntents:record.grantIntents,grantId:issued.grantId,operations:c.operations,controlCapabilitySha256:c.controlCapabilitySha256,transport:c.transport,...(c.approvedReads===undefined?{}:{approvedReads:c.approvedReads})};
  if((c.objectiveFacts===undefined)!==(c.objectiveExecutionSelection===undefined))fail();
  const pair=c.objectiveFacts===undefined?null:await life.run(signal=>c.objectiveFacts.pairFor({binding:issued.binding,executionSelection:c.objectiveExecutionSelection,signal}));check(life);
  if(hash(pair?{...facts,...pair}:facts)!==issued.factsSha256)fail();
  const resource=data(Object.fromEntries(['taskArn','createdAtMs','clusterArn','taskDefinitionArn','containerName'].map(k=>[k,record.resource[k]])));
  const binding=compileEcsTaskBinding({original,...resource,enabled:true,now});assertEcsOwnedTask(task,binding);assertEcsRunningTask(task,binding);
  const candidate=await life.run(signal=>observe({original,resource,signal,check:()=>check(life)}));check(life);
  if(candidate?.taskArn!==taskArn||candidate.privateIPv4Address!==peerIPv4||candidate.executionKey!==original.executionKey||candidate.bindingSha256!==hash(original.binding)||candidate.expiresAtMs!==original.expiresAtMs||candidate.port!==8080||!Number.isSafeInteger(candidate.checkedAtMs)||candidate.checkedAtMs<began)fail();
  // A RUNNING task may start its pre-CLI bootstrap before canonical admission
  // advances ALLOCATED to ADMITTED. Only this fully matched peer gets a bounded
  // pending answer; every other failure remains a refusal.
  if(record.state==='ALLOCATED')pending();
  const admissionRecord=Object.fromEntries(['state','original','grantIntents','resource','qualification','allocationSha256','taskRequestSha256','allocationKey'].map(k=>[k,record[k]]));
  const admission=await life.run(()=>c.admissionForBinding({binding:original.binding,record:admissionRecord}));check(life);
  const admitted=await life.run(signal=>storageMethod(admission,'read')({taskArn,signal}));check(life);
  if(admitted?.state!=='ADMITTED'||hash(admitted.grantFactsJsons)!==hash(record.resource.grantFactsJsons)||typeof admitted.currentAllocationJson!=='string'||Buffer.byteLength(admitted.currentAllocationJson)>131072)fail();
  const state=data(JSON.parse(admitted.currentAllocationJson));own(state,['binding','policyRevision','deadlineMs','checkedAtMs','allocation','allocationSha256']);
  if(hash(state.binding)!==original.executionKey||state.policyRevision!==record.qualification.policyRevision||state.allocationSha256!==record.allocationSha256||hash(state.allocation)!==record.allocationSha256||!Number.isSafeInteger(state.checkedAtMs)||state.checkedAtMs<began||state.checkedAtMs>now()||!Number.isSafeInteger(state.deadlineMs)||state.deadlineMs<=now())fail();
  life.limitDeadline(Math.min(original.expiresAtMs,state.deadlineMs));
  return Object.freeze({original,issued,resource,candidate,allocationSha256:record.allocationSha256});
 }
 function life(signal){nativeSignal(signal);if(signal?.aborted||closed)fail();return createOperationLifetime({now,signal,deadlineMs:now()+maxRequestMs,errorFactory:taskRouterFault});}
 async function challenge(value){const v=own(value,['taskArn','peerIPv4','csrPem'],['signal']);const l=life(v.signal);try{
  parseRunnerPoststartCsr(v.csrPem);const currentState=await current({...v,life:l});check(l);
  for(const [id,row]of challenges)if(row.expiresAtMs<=now())challenges.delete(id);
  if(challenges.size>=maxChallenges)fail();const id=randomUUID(),expiresAtMs=Math.min(now()+15000,currentState.original.expiresAtMs),nonce=randomBytes(32).toString('base64url');
  const message=Buffer.from(JSON.stringify({schemaVersion:1,purpose:'meri-runner-poststart-proof',challengeId:id,nonce,taskArn:v.taskArn,executionKey:currentState.original.executionKey,csrSha256:createHash('sha256').update(v.csrPem).digest('hex'),peerIPv4:v.peerIPv4,expiresAtMs}));
  challenges.set(id,{taskArn:v.taskArn,peerIPv4:v.peerIPv4,csrSha256:createHash('sha256').update(v.csrPem).digest('hex'),pin:pin(currentState),message,expiresAtMs});
  return Object.freeze({schemaVersion:1,challengeId:id,proofMessage:message.toString('base64'),expiresAtMs});
 }finally{l.close();}}
 async function redeem(value){const v=own(value,['taskArn','peerIPv4','csrPem','challengeId','proofBase64'],['signal']);const l=life(v.signal);try{
  const entry=challenges.get(v.challengeId);challenges.delete(v.challengeId); // atomic single use, including failed proofs
  if(!entry||entry.taskArn!==v.taskArn||entry.peerIPv4!==v.peerIPv4||entry.expiresAtMs<=now()||entry.csrSha256!==createHash('sha256').update(v.csrPem).digest('hex'))fail();
  const csr=verifyRunnerPoststartProof({csrPem:v.csrPem,message:entry.message,proofBase64:v.proofBase64});
  const before=await current({...v,life:l});if(pin(before)!==entry.pin)fail();check(l);
  const issued=before.issued,original=before.original,taskName=runnerTaskServername({taskArn:v.taskArn,zone:c.zone});
  const capability=await l.run(signal=>resolve({issuanceKey:issued.issuanceKey,binding:issued.binding,requestSha256:issued.requestSha256,expiresAtMs:issued.expiresAtMs,grantId:issued.grantId,capabilitySha256:issued.capabilitySha256,factsSha256:issued.factsSha256,signal}));check(l);
  const config=await l.run(signal=>configFor({original,resource:before.resource,signal}));check(l);
  const result=await l.run(signal=>issueCert({csrPem:v.csrPem,taskName,notAfterMs:original.expiresAtMs,signal}));check(l);
  const certPem=own(result,['certPem']).certPem;
  certificate(csr,certPem,c.runnerCa.toString('utf8'),taskName,now(),original.expiresAtMs);
  const after=await current({...v,life:l});if(pin(after)!==entry.pin||entry.expiresAtMs<=now())fail();check(l);
  const origin=new URL(c.transport.origin),taskRevision=Number(before.resource.taskDefinitionArn.split(':').at(-1));
  const deliveryFields={binding:original.binding,taskArn:v.taskArn,taskRevision,expiresAtMs:original.expiresAtMs,versions:original.versions,origin:origin.origin,san:[origin.hostname],capabilitySha256:issued.capabilitySha256,materialRef:issued.materialRef,bootstrapRef:hash({schemaVersion:1,executionKey:original.executionKey,taskArn:v.taskArn,factsSha256:issued.factsSha256,resource:before.resource})};
  const expected={...deliveryFields,caSha256:createHash('sha256').update(c.controlCa).digest('hex')};
  if(!Number.isSafeInteger(taskRevision)||taskRevision<1||typeof capability!=='string'||!/^\S{1,8192}$/u.test(capability)||createHash('sha256').update(capability).digest('hex')!==issued.capabilitySha256)fail();
  return Object.freeze({schemaVersion:1,original,expected,delivery:{...deliveryFields,capability,config,ca:c.controlCa.toString('base64')},tls:{zone:c.zone,ca:c.runnerCa.toString('base64'),cert:Buffer.from(certPem).toString('base64'),candidate:before.candidate}});
 }finally{l.close();}}
 return Object.freeze({challenge,redeem,close(){closed=true;challenges.clear();}});
}
