/** Internal trusted supervisor entry; SDK worker receives only separate byte pipes. */
import {fileURLToPath} from 'node:url';
import {createReadStream,createWriteStream} from 'node:fs';
import {createNativeSessionLauncher} from './session-launcher.mjs';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createSupervisorWorkspace} from './supervisor-workspace.mjs';
export function runSupervisorProcess(){
 if(typeof process.send!=='function')throw Error('SUPERVISOR_IPC_REQUIRED');
 let launcher,configuration,workspace,child,closed=false;const send=value=>{if(process.connected)process.send(value);};
 const input=createReadStream(null,{fd:5}),output=createWriteStream(null,{fd:4});
 input.on('error',()=>{void close();});output.on('error',()=>{void close();});
 async function close(){if(closed)return;closed=true;try{await launcher?.close();send({type:'stopped',status:launcher?.status()??null});}catch{send({type:'cleanup-unknown'});}finally{input.destroy();output.end();process.disconnect?.();}}
 process.on('disconnect',()=>{void close();});
 process.on('message',async value=>{let id;try{
  const message=own(value,['type'],['configuration','id','request']);id=message.id;
  if(message.type==='boot'){
   if(launcher||closed)throw Error();configuration=message.configuration;launcher=createNativeSessionLauncher({...configuration,now:Date.now});workspace=createSupervisorWorkspace({binding:configuration.binding,workspace:configuration.workspace,expiresAtMs:configuration.expiresAtMs});send({type:'ready'});return;
  }
  if(!launcher||closed)throw Error();
  if(message.type==='launch'){
   if(child)throw Error();child=launcher.spawnClaudeCodeProcess({...configuration.launch,cwd:configuration.workspace});
   child.stdin.on('error',()=>{void close();});input.pipe(child.stdin);child.stdout.pipe(output);
   child.stderr.on('data',()=>{});child.once('close',async(code,signal)=>{const outcome=await launcher.completion();if(outcome.physicalStopProven)send({type:'exit',code,signal});else send({type:'cleanup-unknown'});});send({type:'launched',pid:child.pid});return;
  }
  if(message.type==='read'){const receipt=await launcher.registration.read(message.request);send({type:'reply',id,value:receipt});return;}
  if(message.type==='workspace-restore'){if(child)throw Error();send({type:'reply',id,value:workspace.restore(message.request)});return;}
  if(message.type==='workspace-verify'){send({type:'reply',id,value:workspace.verify(message.request)});return;}
  if(message.type==='inspect'){send({type:'reply',id,value:{pid:child?.pid??null,status:launcher.status()}});return;}
  if(message.type==='stop'){await close();return;}
  throw Error();
 }catch{send({type:'refused',id});}});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--help'))process.stdout.write('Internal Meri native supervisor: inherited IPC and stream FDs required. Exit0 help; exit2 invalid binding.\n');
 else try{runSupervisorProcess();}catch{process.stderr.write('SUPERVISOR_BINDING_REQUIRED\n');process.exitCode=2;}
}
