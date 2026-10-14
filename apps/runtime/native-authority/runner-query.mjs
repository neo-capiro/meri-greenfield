/** Synchronous activity facade; first next prepares exactly one retained SDK Query. */
import {prepareNativeSdkQuery} from './sdk-query-preparation.mjs';
import {createRemoteSdkProcessClient} from './remote-task-client.mjs';
import {projectNativeSdkOptions} from './sdk-option-projection.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {executionFault} from './execution-broker.mjs';
export function createPreparedRunnerQuery({processClientFactory,prepare=prepareNativeSdkQuery,sdkOptionsSha256}){
 if(typeof processClientFactory!=='function'||typeof prepare!=='function')throw executionFault('SDK_PREPARATION_CONFIGURATION');
 let used=false;
 return function query({prompt,options}){
  if(sdkOptionsSha256!==undefined&&hash(projectNativeSdkOptions(options))!==sdkOptionsSha256)throw executionFault('SDK_OPTIONS_REFUSED');
  if(used)throw executionFault('SDK_PREPARATION_REFUSED');used=true;
  const processClient=processClientFactory();let preparation,closed=false,closing,iterator;
  const ready=()=>{if(closed)throw executionFault('SDK_PREPARATION_REFUSED');return preparation??=prepare({prompt,options,bindLaunch:descriptor=>({process:processClient.spawnClaudeCodeProcess(descriptor),start:()=>processClient.startPreparedProcess(),close:()=>processClient.close()})});};
  const close=()=>closing??=(async()=>{closed=true;if(preparation){let prepared;try{prepared=await preparation;}catch{}if(prepared)return prepared.close();}return processClient.close();})();
  const stream={async interrupt(){const p=await ready();return p.query.interrupt();},close,[Symbol.asyncIterator](){if(iterator)throw executionFault('SDK_ITERATOR_REUSED');iterator={async next(){const p=await ready();return p.messages.next();},async return(){await close();return {done:true,value:undefined};},[Symbol.asyncIterator](){return this;}};return iterator;}};
  return Object.freeze(stream);
 };
}
export function createRemoteRunnerQuery(configuration){const {sdkOptionsSha256,...transport}=configuration;return createPreparedRunnerQuery({sdkOptionsSha256,processClientFactory:()=>createRemoteSdkProcessClient(transport)});}
