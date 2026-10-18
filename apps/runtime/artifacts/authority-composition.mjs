/** Startup composition of the documents family with the Core artifact authority (control only; called by trusted startup, never by
 * configuration or a request). Composed DISABLED unless every input exists: `artifacts.enabled`, a declared `artifacts.authority`
 * (Core origin + service-secret file), the marked candidate credentials (`nativeCandidate`) to refuse as bearers, a readable service
 * secret, and the two Meri-local owners: `runOptions` (the run allocation/capability side of `artifactOptions`) and `executor`
 * (`createFixedRuntimeArtifactExecutor`). Both are composed here from existing owners when startup does not supply them (lane X):
 *  - `executor` from the declared `artifacts.executor` image paths (`./configuration.mjs`); nothing is spawned at composition and
 *    PDF stays fail-closed without a qualified renderer port;
 *  - `runOptions` from `./run-options.mjs` over Core's current tool authority ports (`authorityPorts`: `verifyCapability`,
 *    `authorizeBusiness`, `authorizeSources`, the decision-gated owners the general-reads gateway and write-intent execution also
 *    wait for) and the per-run tuple the prepared-run registry registers (`runOptions.register`, the `createReadsRuntime` tuple).
 * Anything missing leaves the production registration (private store only, `/api/documents/*` 503) and is named in `missing` by
 * key, never by value; control still starts. The production CLI supplies neither `authorityPorts` nor registers runs today, so it
 * reports `runOptions.authorityPorts` (and `artifacts.executor` until the control image carries the generator paths).
 *
 * Returns `{family, authority, missing, runOptions}`. `family` is the `documents` entry for `createProductPortsFactory({families})`;
 * `runOptions` (when composed here) is the owner whose `register(tuple)` the registry calls per prepared run. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {compileRuntimeArtifactsConfiguration} from './configuration.mjs';
import {createCoreArtifactAuthorityClient} from './core-authority-client.mjs';
import {createArtifactAuthorityCredentials} from './authority-credentials.mjs';
import {createCoreArtifactAuthority} from './core-authority.mjs';
import {refuse} from './core-authority-wire.mjs';
import {createFixedRuntimeArtifactExecutor} from './composition.mjs';
import {createRuntimeDocumentRunOptions} from './run-options.mjs';
import {documentsFamily,createDocumentsFamily} from '../product-ports/documents.mjs';

export async function composeDocumentsFamily(options){
 let c;try{c=own(options,['configuration'],['runOptions','executor','authorityPorts','fetchImpl','readSecret','now']);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const now=c.now??Date.now,fetchImpl=c.fetchImpl??globalThis.fetch,configuration=c.configuration;
 if(typeof now!=='function'||typeof fetchImpl!=='function'||types.isProxy(fetchImpl))refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 let declared;try{declared=compileRuntimeArtifactsConfiguration(configuration);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const missing=[];
 if(declared?.enabled!==true)missing.push('artifacts.enabled');else if(declared.authority===undefined)missing.push('artifacts.authority');
 if(configuration?.nativeCandidate===undefined)missing.push('nativeCandidate');
 // The Meri-local owners: supplied by startup, or composed here from the declaration and Core's authority ports.
 let runOptions=c.runOptions,executor=c.executor,composedRunOptions=null;
 if(runOptions===undefined){
  if(c.authorityPorts===undefined)missing.push('runOptions.authorityPorts');
  else{
   try{composedRunOptions=createRuntimeDocumentRunOptions({now,limits:{maxRequestMs:configuration.limits.requestMs,maxFactBytes:131072},authorityPorts:c.authorityPorts});}
   catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
   runOptions=composedRunOptions;
  }
 }
 if(executor===undefined){
  if(declared?.executor===undefined)missing.push('artifacts.executor');
  else{
   const e=declared.executor;
   try{executor=createFixedRuntimeArtifactExecutor({pythonExecutable:e.pythonExecutable,nodeExecutable:e.nodeExecutable??process.execPath,pptxModulePath:e.pptxModulePath,tempRoot:e.tempRoot,...(e.timeoutMs===undefined?{}:{timeoutMs:e.timeoutMs})});}
   catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
  }
 }
 const disabled=()=>Object.freeze({family:createDocumentsFamily,authority:null,missing:Object.freeze([...missing]),runOptions:composedRunOptions});
 if(missing.length)return disabled();
 let credentials;
 try{credentials=await createArtifactAuthorityCredentials({configuration,serviceSecretFile:declared.authority.serviceSecretFile,...(c.readSecret===undefined?{}:{readSecret:c.readSecret})});}
  catch{missing.push('artifacts.authority.serviceSecretFile');return disabled();}
 const client=createCoreArtifactAuthorityClient({origin:declared.authority.origin,fetchImpl,now});
 const authority=createCoreArtifactAuthority({client,credentials,runOptions,now,
  limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}});
 return Object.freeze({family:documentsFamily({authority,executor}),authority,missing:Object.freeze([]),runOptions:composedRunOptions});
}
