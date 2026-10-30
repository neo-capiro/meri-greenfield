// @ts-check
/** Fixed-native upload processing through the prepared finite placement.
 *
 * This is an alternative `run(role, options)` implementation for `createUploadNativeInspection`: the same fixed bubblewrap
 * plan, program, argv, workspace and bounded-output contract as `runUploadSandbox`, executed by the processing launcher
 * inside the finite leaf instead of as an unpinned child of the runtime. It never accepts a command, environment, plugin
 * or configuration from a caller or an upload, and it does not observe or qualify the sandbox again — the accepted 549
 * qualifier keeps its own parser, allowlist and cleanup semantics.
 */
import {lstat,realpath} from 'node:fs/promises';
import {uploadFault,UPLOAD_IMAGE_PATHS,UPLOAD_ROLE_PREFIX,uploadSandboxArguments} from './native-sandbox.mjs';
import {runProcessingCommand} from '../../worker/conversation/host/launcher/supervisor.mjs';

const ROLES=Object.freeze(Object.keys(UPLOAD_ROLE_PREFIX));

/**
 * @param {{launcher:Function,run?:Function,paths?:object,platform?:string,uidOf?:Function,lstatImpl?:Function,realpathImpl?:Function}} input
 * @returns {(role:string, options:object)=>Promise<any>}
 */
export function createProcessingUploadRunner({launcher,run=runProcessingCommand,paths=UPLOAD_IMAGE_PATHS,
 platform=process.platform,uidOf=()=>process.getuid?.(),lstatImpl=lstat,realpathImpl=realpath}={}){
 if(typeof launcher!=='function'||typeof run!=='function')throw uploadFault('UPLOAD_PROCESSING_CONFIGURATION');
 /** Same host modality and workspace ownership checks `runUploadSandbox` applies; the placement does not relax them. */
 return async function runProcessingUpload(role,{cwd,definitionsRoot,extractorPath,format,mode,input=Buffer.alloc(0),signal,deadlineMs,maxOutput}={}){
  if(!ROLES.includes(role))throw uploadFault('UPLOAD_SANDBOX_REFUSED');
  const stat=await lstatImpl(cwd);
  if(platform!=='linux'||uidOf()!==1000||stat.isSymbolicLink()||!stat.isDirectory()||stat.uid!==1000||
   (stat.mode&0o777)!==0o700||await realpathImpl(cwd)!==cwd)throw uploadFault('UPLOAD_SANDBOX_REFUSED');
  const args=uploadSandboxArguments({role,cwd,definitionsRoot,extractorPath,format,mode});
  return run({launcher,command:paths.bwrap,args,cwd,input,signal,deadlineMs,maxOutput});
 };
}
