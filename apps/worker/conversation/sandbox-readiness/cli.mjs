// @ts-check
/** Executable entry for the worker-host Bash sandbox readiness check. Importing this file allocates nothing. */
import {pathToFileURL} from 'node:url';
import {isAbsolute} from 'node:path';
import {checkSandboxReadiness,toBashSandboxAttestation} from './readiness.mjs';
export const USAGE=`Usage: node apps/worker/conversation/sandbox-readiness/cli.mjs [--outer-isolation-boundary] [--sdk-config-directory /abs --sdk-secure-storage-directory /abs] [--broker-socket-directory /run/meri-launch] [--timeout-ms 1000-120000]
Measures bubblewrap/socat presence, bubblewrap namespaces and the Claude Agent SDK's own sandbox startup (failIfUnavailable)
with the product settings and NO model request. Prints {report, attestation} JSON. --outer-isolation-boundary is the runtime
preparation owner's assertion that the disposable worker is the isolation boundary; it is not measured.
Exit: 0 ready (attestation available); 1 not ready; 2 usage/configuration; 3 the check could not complete.
`;
/** @param {string[]} argv */
export function parseArguments(argv){
 /** @type {{outerIsolationBoundary:boolean,protectedPaths:Record<string,string>,deadlineMs:number}} */
 const out={outerIsolationBoundary:false,protectedPaths:{},deadlineMs:30000};const seen=new Set();
 for(let i=0;i<argv.length;i++){const flag=String(argv[i]);if(seen.has(flag))return undefined;seen.add(flag);
  if(flag==='--outer-isolation-boundary')out.outerIsolationBoundary=true;
  else if(flag==='--sdk-config-directory'||flag==='--sdk-secure-storage-directory'){const value=argv[++i];if(typeof value!=='string'||!isAbsolute(value)||value.endsWith('/')||value.includes('\0'))return undefined;out.protectedPaths[flag==='--sdk-config-directory'?'sdkConfigDirectory':'sdkSecureStorageDirectory']=value;}
  else if(flag==='--broker-socket-directory'){const value=argv[++i];if(value!=='/run/meri-launch')return undefined;out.protectedPaths.brokerSocketDirectory=value;}
  else if(flag==='--timeout-ms'){const n=Number(argv[++i]);if(!Number.isSafeInteger(n)||n<1000||n>120000)return undefined;out.deadlineMs=n;}
  else return undefined;}
 if(seen.has('--sdk-config-directory')!==seen.has('--sdk-secure-storage-directory'))return undefined;
 return out;
}
/** @param {string[]} argv @param {{createPorts?:(input:{pathEnv:string})=>Promise<any>,write?:(text:string)=>void,error?:(text:string)=>void}} [deps] */
export async function main(argv=process.argv.slice(2),{createPorts,write=t=>process.stdout.write(t),error=t=>process.stderr.write(t)}={}){
 if(argv.length===1&&['--help','-h'].includes(String(argv[0]))){write(USAGE);return 0;}
 const options=parseArguments(argv);if(!options){error('READINESS_ARGUMENTS\n');return 2;}
 let ports;
 try{ports=await (createPorts??(await import('./host-probes.mjs')).createHostPorts)({pathEnv:process.env.PATH??''});
  const report=await checkSandboxReadiness(ports,{protectedPaths:options.protectedPaths,deadlineMs:options.deadlineMs});
  const attestation=toBashSandboxAttestation(report,{outerIsolationBoundary:options.outerIsolationBoundary});
  write(JSON.stringify({report,attestation})+'\n');return attestation.available?0:1;
 }catch(e){error(`READINESS_INCOMPLETE ${/** @type {{code?:string}} */(e)?.code??'UNEXPECTED'}\n`);return 3;}
 finally{try{ports?.close?.();}catch{}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
