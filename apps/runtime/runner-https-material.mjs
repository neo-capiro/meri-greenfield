/** Task-local HTTPS material. The runner cannot listen until the original, task metadata,
 * network candidate, certificate chain and private key have been joined. These files must
 * be delivered by a separately authenticated poststart owner; this module never issues one. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret} from './config.mjs';
import {compileRunnerTlsServerMaterial} from './native-authority/runner-tls-server.mjs';
import {taskRouterFault} from './native-authority/task-router-boundary.mjs';

function parseJson(bytes){
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw taskRouterFault();}
}

export async function loadRunnerHttpsMaterial({original,taskArn,tls,read=readSecret,now=Date.now}){
 const t=own(tls,['zone','caFile','certFile','keyFile','candidateFile','metadataFile']);
 if(typeof read!=='function'||typeof now!=='function')throw taskRouterFault();
 try{
  const [ca,cert,key,candidateBytes,metadataBytes]=await Promise.all(
   [t.caFile,t.certFile,t.keyFile,t.candidateFile,t.metadataFile].map(path=>read(path)));
  const candidate=parseJson(candidateBytes),metadata=parseJson(metadataBytes);
  if(candidate.taskArn!==taskArn)throw taskRouterFault();
  return compileRunnerTlsServerMaterial({original,candidate,metadata,ca,cert,key,zone:t.zone,now});
 }catch{throw taskRouterFault();}
}
