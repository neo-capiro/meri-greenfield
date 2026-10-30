/** CAP-owned root bootstrap: finite no-egress placement + the ONE fixed image-pinned UID1000 inspection child.
 *
 * Root privilege lives here only. Given the exact allocation/binding/host identity produced by Parent's canonical custody
 * validator (which is not implemented yet and is therefore an explicit unbound dependency), this module opens the finite
 * processing placement and its closed network, then launches ONLY the fixed Node child executable with fixed arguments.
 * The request crosses as data on stdin; no command, argv, cwd, environment, program or path is accepted from a caller.
 */
import {createProcessingPlacement} from '../../worker/conversation/host/cgroup/processing-placement.mjs';
import {prepareProcessingCompartment} from '../../worker/conversation/host/network/confinement.mjs';
import {UPLOAD_INSPECTION_WIRE_BYTES,UPLOAD_INSPECTION_RESULT_BYTES} from '../uploads/agentcore-contract.mjs';
import {uploadInspectionFault} from '../uploads/agentcore-contract.mjs';

export const CHILD_ENTRY='apps/runtime/native-processing-host/child-cli.mjs';
const fault=code=>Object.assign(new Error(code),{code});

/** Fixed child program and argv: the pinned Node runtime from the host image and this one entrypoint. Nothing else. */
export function childInvocation(config){
 if(config?.paths?.nodePath===undefined||!config.paths.nodePath.startsWith('/'))throw fault('NATIVE_PROCESSING_CONFIGURATION');
 return Object.freeze({command:config.paths.nodePath,args:Object.freeze([CHILD_ENTRY])});
}

export async function openNativeProcessingHost({config,allocation,binding,hostIdentity,authority,signal,
 openCompartment=prepareProcessingCompartment,openPlacement=createProcessingPlacement}={}){
 if(!allocation||!binding||!hostIdentity||typeof authority?.readCurrent!=='function')
  throw fault('NATIVE_PROCESSING_AUTHORITY_UNBOUND');
 const compartment=await openCompartment({allocation,binding});
 const placement=await openPlacement({allocation,binding,hostIdentity,authority:authority,
  limits:config.limits,network:compartment,helperPath:config.paths.helperPath,home:config.paths.home,
  browsersPath:config.paths.home,uid:config.paths.runtimeUid,gid:config.paths.runtimeGid,signal});
 const {command,args}=childInvocation(config);
 let closing=null;
 return Object.freeze({placement,compartment,
  async runRequest({requestDocument,deadlineMs,signal:callSignal}){
   const input=Buffer.from(JSON.stringify({request:requestDocument,deadlineMs}));
   if(input.length>UPLOAD_INSPECTION_WIRE_BYTES+65536)throw fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
   return placement.run(command,args,{cwd:config.paths.home,input,signal:callSignal,deadlineMs,
    maxOutput:UPLOAD_INSPECTION_RESULT_BYTES});
  },
  close:()=>closing??=(async()=>{
   let bad=null;try{await placement.close();}catch(error){bad=error?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
   let net=null;try{net=await compartment.close();}catch{net={closed:false,code:'HOST_NETWORK_CLEANUP_UNKNOWN'};}
   if(bad||net?.closed!==true)return Object.freeze({closed:false,code:bad??net?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN'});
   return Object.freeze({closed:true});
  })});
}
