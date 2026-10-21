/** Bind the network owner's fixed local relay executable to the native pre-exec launcher's confined-process port.
 * The caller supplies reviewed image UID/GID and binary pins; no run/tool data can choose an executable or route. */
import {fileURLToPath} from 'node:url';

const ENTRY=fileURLToPath(new URL('./local-relay-entry.mjs',import.meta.url));
const fail=()=>{throw Object.assign(new Error('HOST_NETWORK_LOCAL_RELAY_CONFIGURATION'),{code:'HOST_NETWORK_LOCAL_RELAY_CONFIGURATION'});};
const uid=value=>Number.isSafeInteger(value)&&value>0&&value<65535;
const absolute=value=>typeof value==='string'&&value.startsWith('/')&&!value.includes('\0')&&!value.includes('/../');

/** @param {{allocation:unknown,binding:unknown,hostIdentity:unknown,helperPath:string,nodePath:string,cwd:string,relayUid:number,relayGid:number,toolUid:number,startConfinedLocalRelay:Function,authorize:Function,signal?:AbortSignal}} input */
export function createNativeLocalRelayPort({allocation,binding,hostIdentity,helperPath,nodePath,cwd,relayUid,relayGid,toolUid,startConfinedLocalRelay,authorize,signal}){
 if(!absolute(helperPath)||!absolute(nodePath)||!absolute(cwd)||!uid(relayUid)||!uid(relayGid)||!uid(toolUid)||relayUid===toolUid||typeof startConfinedLocalRelay!=='function'||typeof authorize!=='function'||signal!==undefined&&!(signal instanceof AbortSignal))fail();
 return async({plan,proof})=>{
  if(!['sdk','browser'].includes(plan?.kind)||proof?.verified!==true||proof.kind!==plan.kind||
   proof.namespacePath!==plan.namespacePath||!Array.isArray(proof.localRelays)||proof.localRelays.length!==plan.routes.length)fail();
  const config={namespaceDev:proof.namespaceDev,namespaceIno:proof.namespaceIno,hostAddress:plan.hostAddress,
   routes:proof.localRelays.map(r=>({name:r.name,localPort:r.localPort,hostAddress:r.hostAddress,hostRelayPort:r.hostRelayPort}))};
  const encoded=Buffer.from(JSON.stringify(config)).toString('base64url');
  if(encoded.length>4096)fail();
  return startConfinedLocalRelay({allocation,binding,hostIdentity,helperPath,networkProof:proof,kind:plan.kind,
   command:nodePath,args:[ENTRY,encoded],cwd,uid:relayUid,gid:relayGid,authorize,...(signal?{signal}:{})});
 };
}
