/** Ordinary startup composition of private storage, the fixed renderer, and current Core artifact authority. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {compileRuntimeArtifactsConfiguration} from './configuration.mjs';
import {createCoreArtifactAuthorityClient} from './core-authority-client.mjs';
import {createArtifactAuthorityCredentials} from './authority-credentials.mjs';
import {createCoreArtifactAuthority} from './core-authority.mjs';
import {createFixedRuntimeArtifactExecutor} from './composition.mjs';
import {documentsFamily,createDocumentsFamily} from '../product-ports/documents.mjs';
export async function composeDocumentsFamily(options){
 const c=own(options,['configuration'],['executor','fetchImpl','readSecret','now','nativeCredentials']),configuration=c.configuration,now=c.now??Date.now;
 const declared=compileRuntimeArtifactsConfiguration(configuration),missing=[];
 if(declared?.enabled!==true)missing.push('artifacts.enabled');else if(!declared.authority)missing.push('artifacts.authority');
 if(!c.nativeCredentials)missing.push('nativeCredentials');
 let executor=c.executor;
 if(executor===undefined){if(!declared?.executor)missing.push('artifacts.executor');else{const e=declared.executor;executor=createFixedRuntimeArtifactExecutor({...e,nodeExecutable:e.nodeExecutable??process.execPath});}}
 const disabled=()=>Object.freeze({family:createDocumentsFamily,authority:null,missing:Object.freeze([...missing])});
 if(missing.length)return disabled();
 let credentials;try{credentials=await createArtifactAuthorityCredentials({serviceSecretFile:declared.authority.serviceSecretFile,...(c.readSecret?{readSecret:c.readSecret}:{})});}
 catch{missing.push('artifacts.authority.serviceSecretFile');return disabled();}
 const client=createCoreArtifactAuthorityClient({origin:declared.authority.origin,fetchImpl:c.fetchImpl??globalThis.fetch,now});
 const authority=createCoreArtifactAuthority({client,credentials,now,maxOutputBytes:configuration.agentcore.maxOutputBytes,
  limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}});
 return Object.freeze({family:documentsFamily({authority,executor,nativeCredentials:c.nativeCredentials}),authority,missing:Object.freeze([])});
}
