/** Pre-CLI runner startup. ECS v4 metadata selects the task; only the private
 * control owner can return a durable, peer-checked original and issued material.
 * No task capability or TLS key is passed in RunTask overrides or environment. */
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {remoteOriginal} from './native-authority/remote-task-boundary.mjs';
import {createRunnerPoststartCsr} from './native-authority/runner-poststart-csr.mjs';
import {materializeRunnerBootstrap,parseExpectedBootstrap} from './runner-bootstrap-files.mjs';
import {createRunnerPoststartTransport,readRunnerPoststartCa,readRunnerPoststartMetadata} from './runner-poststart-transport.mjs';
import {createRunnerPoststartDirectory,writeRunnerPoststartTls,releaseRunnerPoststart} from './runner-poststart-files.mjs';
const fail=()=>{throw Object.assign(Error('RUNNER_POSTSTART_REFUSED'),{code:'RUNNER_POSTSTART_REFUSED'});};
const arn=/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[a-f0-9]{32}$/u;
function message(value,now){const c=own(value,['schemaVersion','challengeId','proofMessage','expiresAtMs']);if(c.schemaVersion!==1||typeof c.challengeId!=='string'||!/^[a-f0-9-]{36}$/u.test(c.challengeId)||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now()||c.expiresAtMs>now()+15000||typeof c.proofMessage!=='string'||c.proofMessage.length>2732)fail();const bytes=Buffer.from(c.proofMessage,'base64');if(bytes.length<32||bytes.length>2048||bytes.toString('base64')!==c.proofMessage)fail();return bytes;}
/** Named seams permit inert fixture checks. Production defaults use direct HTTPS,
 * image-pinned CA, ECS link-local metadata and owner-only filesystem writers. */
export async function runRunnerPoststart(configuration,dependencies={}){
 const c=own(configuration,['origin','controlCaSha256','metadataUri','directory'],['controlCaFile','controlCaBase64','now','signal','maxStartupMs']),d=own(dependencies,[],['readCa','readMetadata','createTransport','createCsr','createDirectory','writeTls','materialize','release']),now=c.now??Date.now,maxStartupMs=c.maxStartupMs??20000;
 nativeSignal(c.signal);if(typeof now!=='function'||c.signal?.aborted||!Number.isSafeInteger(maxStartupMs)||maxStartupMs<1000||maxStartupMs>30000||(c.controlCaFile===undefined)===(c.controlCaBase64===undefined))fail();const stopAt=now()+maxStartupMs,remaining=()=>{const left=stopAt-now();if(!Number.isSafeInteger(left)||left<1)fail();return Math.min(3000,left);};
 const readCa=d.readCa??readRunnerPoststartCa,readMetadata=d.readMetadata??readRunnerPoststartMetadata,transportFactory=d.createTransport??createRunnerPoststartTransport,csrFactory=d.createCsr??createRunnerPoststartCsr,createDirectory=d.createDirectory??createRunnerPoststartDirectory,writeTls=d.writeTls??writeRunnerPoststartTls,materialize=d.materialize??materializeRunnerBootstrap,release=d.release??releaseRunnerPoststart;
 let ca;if(c.controlCaFile!==undefined)ca=await readCa({path:c.controlCaFile,sha256:c.controlCaSha256});else{if(typeof c.controlCaBase64!=='string'||c.controlCaBase64.length>21848)fail();ca=Buffer.from(c.controlCaBase64,'base64');if(ca.length<1||ca.length>16384||ca.toString('base64')!==c.controlCaBase64)fail();}
 const metadata=await readMetadata({uri:c.metadataUri,signal:c.signal});
 if(!Buffer.isBuffer(ca)||createHash('sha256').update(ca).digest('hex')!==c.controlCaSha256||!arn.test(metadata?.TaskARN)||typeof metadata?.Cluster!=='string'||!Array.isArray(metadata.Containers)||metadata.Containers.length!==1)fail();
 const transport=transportFactory({origin:c.origin,ca}),post=own(transport,['post']).post,csr=csrFactory();
 if(typeof csr?.csrPem!=='string'||typeof csr?.keyPem!=='string'||typeof csr?.signProof!=='function')fail();
 let challenge;for(;;){if(c.signal?.aborted)fail();try{challenge=await post('challenge',{schemaVersion:1,taskArn:metadata.TaskARN,csrPem:csr.csrPem},{signal:c.signal,deadlineMs:remaining()});break;}catch(error){if(error?.code!=='RUNNER_POSTSTART_PENDING'||now()+250>=stopAt)throw error;await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);c.signal?.removeEventListener('abort',abort);reject(Object.assign(Error('RUNNER_POSTSTART_REFUSED'),{code:'RUNNER_POSTSTART_REFUSED'}));},timer=setTimeout(()=>{c.signal?.removeEventListener('abort',abort);resolve();},250);c.signal?.addEventListener('abort',abort,{once:true});if(c.signal?.aborted)abort();});}}
 const proofMessage=message(challenge,now);
 const response=own(await post('redeem',{schemaVersion:1,taskArn:metadata.TaskARN,csrPem:csr.csrPem,challengeId:challenge.challengeId,proofBase64:csr.signProof(proofMessage)},{signal:c.signal,deadlineMs:remaining()}),['schemaVersion','original','expected','delivery','tls']);
 remaining();if(response.schemaVersion!==1)fail();const original=remoteOriginal(response.original),expected=parseExpectedBootstrap(response.expected),tls=own(response.tls,['zone','ca','cert','candidate']);
 if(expected.taskArn!==metadata.TaskARN||hash(expected.binding)!==original.executionKey||hash(expected.versions)!==hash(original.versions)||expected.expiresAtMs!==original.expiresAtMs||expected.caSha256!==c.controlCaSha256||expected.origin!==c.origin||tls.candidate?.taskArn!==metadata.TaskARN||tls.candidate.executionKey!==original.executionKey||tls.candidate.bindingSha256!==hash(original.binding)||tls.candidate.expiresAtMs!==original.expiresAtMs||now()>=original.expiresAtMs)fail();
 let rootId,tlsWritten,bootstrap;
 try{
  rootId=await createDirectory(c.directory);
  tlsWritten=await writeTls({directory:c.directory,original,tls,keyPem:csr.keyPem,metadata,now});
  bootstrap=await materialize({directory:join(c.directory,'bootstrap'),delivery:{fetch:async()=>response.delivery},expected,now,signal:c.signal});
  return Object.freeze({configFile:bootstrap.configFile,controlCaFile:bootstrap.caFile,tls:tlsWritten.descriptor,original,taskArn:metadata.TaskARN,receipt:Object.freeze({root:{path:c.directory,...rootId},tls:tlsWritten.receipt,bootstrap:bootstrap.receipt})});
 }catch(error){if(rootId){try{await release({directory:c.directory,receipt:{root:{path:c.directory,...rootId},tls:tlsWritten?.receipt??null,bootstrap:bootstrap?.receipt??null}});}catch{throw Object.assign(Error('RUNNER_POSTSTART_CLEANUP_UNKNOWN'),{code:'RUNNER_POSTSTART_CLEANUP_UNKNOWN'});}}throw error;}
}
export {releaseRunnerPoststart};
