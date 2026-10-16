/** Inert runner TLS options compiler; startup owns owner-only file reads and the HTTPS listener. */
import {X509Certificate,createPrivateKey,createPublicKey,timingSafeEqual} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {remoteOriginal} from './remote-task-boundary.mjs';
import {runnerTaskServername,assertRunnerPeerCertificate} from './runner-tls-client.mjs';
import {taskRouterFault} from './task-router-boundary.mjs';
const refuse=()=>{throw taskRouterFault();};
function certificates(value){
 if(!(typeof value==='string'||Buffer.isBuffer(value))||Buffer.byteLength(value)>65536)refuse();const text=Buffer.isBuffer(value)?value.toString('utf8'):value;
 const matches=[...text.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu)].map(match=>match[0]);
 if(!matches.length||matches.length>4||text.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu,'').trim())refuse();return matches.map(pem=>new X509Certificate(pem));
}
export function compileRunnerTlsServerMaterial(configuration){
 try{
  const c=own(configuration,['original','candidate','metadata','ca','cert','key','zone'],['now']),now=(c.now??Date.now)(),original=remoteOriginal(c.original),candidate=data(c.candidate),metadata=data(c.metadata);
  if(!Number.isSafeInteger(now)||now>=original.expiresAtMs||candidate.executionKey!==original.executionKey||candidate.bindingSha256!==hash(original.binding)||candidate.expiresAtMs!==original.expiresAtMs||candidate.port!==8080||metadata.TaskARN!==candidate.taskArn||metadata.Cluster!==candidate.clusterArn||!Array.isArray(metadata.Containers)||metadata.Containers.length!==1)refuse();
  const worker=metadata.Containers[0];if(worker.Name!==candidate.containerName||!Array.isArray(worker.Networks)||worker.Networks.length!==1)refuse();
  const network=worker.Networks[0];if(network.NetworkMode!=='awsvpc'||!Array.isArray(network.IPv4Addresses)||network.IPv4Addresses.length!==1||network.IPv4Addresses[0]!==candidate.privateIPv4Address||network.IPv6Addresses?.length)refuse();
  const roots=certificates(c.ca),chain=certificates(c.cert);if(roots.length!==1||!roots[0].ca)refuse();
  const leaf=chain[0],taskName=runnerTaskServername({taskArn:candidate.taskArn,zone:c.zone});assertRunnerPeerCertificate({certificate:leaf,taskName,nowMs:now,expiresAtMs:original.expiresAtMs});
  if(!leaf.keyUsage?.includes('1.3.6.1.5.5.7.3.1'))refuse();
  if(chain.at(-1).fingerprint256!==roots[0].fingerprint256)chain.push(roots[0]);
  for(let i=0;i<chain.length;i++){
   const certificate=chain[i];if(Date.parse(certificate.validFrom)>now||Date.parse(certificate.validTo)<=now)refuse();
   if(i<chain.length-1&&(!chain[i+1].ca||!certificate.checkIssued(chain[i+1])||!certificate.verify(chain[i+1].publicKey)))refuse();
  }
  if(!(typeof c.key==='string'||Buffer.isBuffer(c.key))||Buffer.byteLength(c.key)>65536)refuse();
  const privateKey=createPrivateKey(c.key),publicKey=createPublicKey(privateKey),spki=publicKey.export({type:'spki',format:'der'}),expected=leaf.publicKey.export({type:'spki',format:'der'});
  if(spki.length!==expected.length||!timingSafeEqual(spki,expected))refuse();
  const details=publicKey.asymmetricKeyDetails,type=publicKey.asymmetricKeyType;
  if(!['rsa','rsa-pss','ec','ed25519'].includes(type)||['rsa','rsa-pss'].includes(type)&&details.modulusLength<2048||type==='ec'&&!['prime256v1','secp384r1','secp521r1'].includes(details.namedCurve))refuse();
  return Object.freeze({key:privateKey,cert:Buffer.isBuffer(c.cert)?Buffer.from(c.cert):c.cert,ca:Buffer.isBuffer(c.ca)?Buffer.from(c.ca):c.ca,minVersion:'TLSv1.3',honorCipherOrder:true,requestCert:false});
 }catch{refuse();}
}
