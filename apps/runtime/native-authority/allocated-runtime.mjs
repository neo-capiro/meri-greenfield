/** Stable original-run HTTP surface; canonical allocation/admission precedes broker release. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createNativeExecutionApplication} from './execution-http.mjs';
import {executionFault} from './execution-broker.mjs';
export function createAllocatedNativeRuntime(configuration){
 const c=own(configuration,['allocator','assemble','original','controlCapabilitySha256','taskCapabilitySha256'],['enabled','now','maxRequestMs']);
 const original=data(c.original);const allocate=storageMethod(c.allocator,'allocate'),stop=storageMethod(c.allocator,'stop');if(typeof c.assemble!=='function'||types.isProxy(c.assemble)||types.isAsyncFunction(c.assemble))throw executionFault('ALLOCATION_CONFIGURATION');let assembly,preparing,closed=false;
 const required=()=>{if(closed||!assembly)throw executionFault('ALLOCATION_UNAVAILABLE');return assembly;};
 async function prepare(signal){if(closed)throw executionFault('ALLOCATION_UNAVAILABLE');if(assembly)return assembly;if(preparing)throw executionFault('ALLOCATION_UNAVAILABLE');preparing=true;
  try{const admitted=await allocate({signal});if(signal?.aborted||closed)throw executionFault('ALLOCATION_UNAVAILABLE');const value=c.assemble(admitted);if(types.isPromise(value)){void Promise.prototype.then.call(value,late=>{try{return storageMethod(late,'close')();}catch{}},()=>{}).catch(()=>{});throw executionFault('ALLOCATION_CONFIGURATION');}if(value===undefined)throw executionFault('ALLOCATION_CONFIGURATION');own(value,['broker','runtime','application','close'],['store','tasks','plan','productPorts','original','continuation','restorer']);if(closed||signal?.aborted){await value.close();throw executionFault('ALLOCATION_UNAVAILABLE');}assembly=value;return value;
  }catch(error){try{await stop();}catch{}throw error;}finally{preparing=false;}
 }
 const broker={async start(value){const input=own(value,['binding','executionKey'],['signal']);if(hash(input.binding)!==hash(original.binding)||input.executionKey!==original.executionKey)throw executionFault('REFUSED');return (await prepare(input.signal)).broker.start(input);},poll:value=>required().broker.poll(value)};
 const runtime={taskCapabilitySha256:c.taskCapabilitySha256,runtime:value=>required().runtime.runtime(value)};
 const execution=createNativeExecutionApplication({broker,runtime,controlCapabilitySha256:c.controlCapabilitySha256,taskCapabilitySha256:c.taskCapabilitySha256,enabled:c.enabled??false,now:c.now??Date.now,maxRequestMs:c.maxRequestMs??30000});
 return Object.freeze({broker,runtime,application:{async handle(request){const result=await execution.handle(request);if(result!==null)return result;if(closed||!assembly)return Response.json({error:{code:'NATIVE_EXECUTION_UNAVAILABLE'}},{status:503});return assembly.application.handle(request);}},async close(){closed=true;try{await assembly?.close();}finally{await stop();}},status:()=>({prepared:assembly!==undefined,preparing,closed})});
}
