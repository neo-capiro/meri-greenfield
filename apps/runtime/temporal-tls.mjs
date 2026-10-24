/** Native Temporal mTLS. ECS material delivery owns credentials; Temporal owns permissions. */
import {X509Certificate,createPrivateKey,createPublicKey} from 'node:crypto';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret,fault} from './config.mjs';

export async function readRuntimeTemporalTls(configuration,{readMaterial=readSecret,now=Date.now}={}){
 const c=own(configuration,['caFile','certFile','keyFile']);
 const [serverRootCACertificate,crt,key]=await Promise.all([c.caFile,c.certFile,c.keyFile].map(file=>readMaterial(file)));
 try{
  const ca=new X509Certificate(serverRootCACertificate),certificate=new X509Certificate(crt),privateKey=createPrivateKey(key),at=now();
  if(!ca.ca||certificate.ca||[ca,certificate].some(v=>at<Date.parse(v.validFrom)||at>=Date.parse(v.validTo))||
   !certificate.publicKey.export({type:'spki',format:'der'}).equals(createPublicKey(privateKey).export({type:'spki',format:'der'})))throw Error();
  return {serverRootCACertificate,clientCertPair:{crt,key}};
 }catch{throw fault('TEMPORAL_TLS_MATERIAL_REFUSED');}
}
