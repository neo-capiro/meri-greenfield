/** Synchronous activity facade; first next prepares exactly one retained SDK Query. */
import {prepareNativeSdkQuery} from './sdk-query-preparation.mjs';
import {createRemoteSdkProcessClient} from './remote-task-client.mjs';
import {assertSdkOptions,assertSdkOptionsPin,assertSdkOptionsRestoration} from './sdk-option-template.mjs';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {executionFault} from './execution-broker.mjs';
/** `sdkOptions` is the run's pin (sdk-option-template.mjs sdkOptionsPin): the configured run-invariant template hash plus this run's
 * workspace, SDK config directory and authority digest. Every query's options must reduce to exactly that template. `restoration`
 * (sdk-option-template.mjs sdkOptionsRestoration) is the run's SDK session restoration source; without it a run is fresh and may carry
 * no SDK continuation field, with it the fields must be exactly the restoration's. */
export function createPreparedRunnerQuery(configuration){
 let c;try{c=own(configuration,['processClientFactory'],['prepare','sdkOptions','restoration']);}catch{throw executionFault('SDK_PREPARATION_CONFIGURATION');}
 const {processClientFactory,prepare=prepareNativeSdkQuery}=c,pin=c.sdkOptions===undefined?undefined:assertSdkOptionsPin(c.sdkOptions);
 if(c.restoration!==undefined&&pin===undefined)throw executionFault('SDK_PREPARATION_CONFIGURATION');const restoration=c.restoration===undefined?undefined:assertSdkOptionsRestoration(c.restoration);
 if(typeof processClientFactory!=='function'||typeof prepare!=='function')throw executionFault('SDK_PREPARATION_CONFIGURATION');
 let used=false;
 return function query({prompt,options}){
  if(pin!==undefined)assertSdkOptions(options,pin,restoration);
  if(used)throw executionFault('SDK_PREPARATION_REFUSED');used=true;
  const processClient=processClientFactory();let preparation,closed=false,closing,iterator;
  const ready=()=>{if(closed)throw executionFault('SDK_PREPARATION_REFUSED');return preparation??=prepare({prompt,options,bindLaunch:descriptor=>({process:processClient.spawnClaudeCodeProcess(descriptor),start:()=>processClient.startPreparedProcess(),close:()=>processClient.close()})});};
  const close=()=>closing??=(async()=>{closed=true;if(preparation){let prepared;try{prepared=await preparation;}catch{}if(prepared)return prepared.close();}return processClient.close();})();
  const stream={async interrupt(){const p=await ready();return p.query.interrupt();},close,[Symbol.asyncIterator](){if(iterator)throw executionFault('SDK_ITERATOR_REUSED');iterator={async next(){const p=await ready();return p.messages.next();},async return(){await close();return {done:true,value:undefined};},[Symbol.asyncIterator](){return this;}};return iterator;}};
  return Object.freeze(stream);
 };
}
/** The remote task path always pins its options: a missing pin is a configuration fault, never an unchecked query. */
export function createRemoteRunnerQuery(configuration){const {sdkOptions,restoration,...transport}=configuration;if(sdkOptions===undefined)throw executionFault('SDK_PREPARATION_CONFIGURATION');return createPreparedRunnerQuery({sdkOptions,...(restoration===undefined?{}:{restoration}),processClientFactory:()=>createRemoteSdkProcessClient(transport)});}
