/** Startup composition of the documents family with the Core artifact authority (control only; called by trusted startup, never by
 * configuration or a request). Composed DISABLED unless every input exists: `artifacts.enabled`, a declared `artifacts.authority`
 * (Core origin + service-secret file), the marked candidate credentials (`nativeCandidate`) to refuse as bearers, a readable service
 * secret, and the two Meri-local owners only startup can supply: `runOptions` (the run allocation/capability side of
 * `artifactOptions`) and `executor` (`createFixedRuntimeArtifactExecutor`). Anything missing leaves the production registration
 * (private store only, `/api/documents/*` 503) and is named in `missing` by key, never by value; control still starts.
 *
 * Returns `{family, authority, missing}`. `family` is the `documents` entry for `createProductPortsFactory({families})`. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {compileRuntimeArtifactsConfiguration} from './configuration.mjs';
import {createCoreArtifactAuthorityClient} from './core-authority-client.mjs';
import {createArtifactAuthorityCredentials} from './authority-credentials.mjs';
import {createCoreArtifactAuthority} from './core-authority.mjs';
import {refuse} from './core-authority-wire.mjs';
import {documentsFamily,createDocumentsFamily} from '../product-ports/documents.mjs';

export async function composeDocumentsFamily(options){
 let c;try{c=own(options,['configuration'],['runOptions','executor','fetchImpl','readSecret','now']);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const now=c.now??Date.now,fetchImpl=c.fetchImpl??globalThis.fetch,configuration=c.configuration;
 if(typeof now!=='function'||typeof fetchImpl!=='function'||types.isProxy(fetchImpl))refuse('ARTIFACT_AUTHORITY_CONFIGURATION');
 let declared;try{declared=compileRuntimeArtifactsConfiguration(configuration);}catch{refuse('ARTIFACT_AUTHORITY_CONFIGURATION');}
 const missing=[];
 if(declared?.enabled!==true)missing.push('artifacts.enabled');else if(declared.authority===undefined)missing.push('artifacts.authority');
 if(configuration?.nativeCandidate===undefined)missing.push('nativeCandidate');
 if(c.runOptions===undefined)missing.push('runOptions');
 if(c.executor===undefined)missing.push('executor');
 const disabled=()=>Object.freeze({family:createDocumentsFamily,authority:null,missing:Object.freeze([...missing])});
 if(missing.length)return disabled();
 let credentials;
 try{credentials=await createArtifactAuthorityCredentials({configuration,serviceSecretFile:declared.authority.serviceSecretFile,...(c.readSecret===undefined?{}:{readSecret:c.readSecret})});}
 catch{missing.push('artifacts.authority.serviceSecretFile');return disabled();}
 const client=createCoreArtifactAuthorityClient({origin:declared.authority.origin,fetchImpl,now});
 const authority=createCoreArtifactAuthority({client,credentials,runOptions:c.runOptions,now,
  limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}});
 return Object.freeze({family:documentsFamily({authority,executor:c.executor}),authority,missing:Object.freeze([])});
}
