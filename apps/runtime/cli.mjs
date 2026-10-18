/** Executable ownership only. Importing this file does not allocate resources. */
import {pathToFileURL} from 'node:url';
import {loadConfiguration} from './config.mjs';
import {assertProductRunnerMeasurement} from './native-authority/ecs-prepared-task-proof.mjs';
/** The product worker reaches control's private origin with global fetch, so Node's default store must also trust the one Meri
 * preview server CA. That anchor is exactly its pinned issuer server CA file (same CA; serverCaSha256 pinned, written by
 * material-init before this process starts), never another path. NODE_EXTRA_CA_CERTS is read once at process start. */
export function productWorkerTrustsPinnedServerCa(c,environment=process.env){const file=c.temporal?.issuerBootstrap?.serverCaFile;return typeof file==='string'&&/^\/run\/meri\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.pem$/u.test(file)&&environment.NODE_EXTRA_CA_CERTS===file;}
export async function main(argv=process.argv.slice(2),{poststartTls,nativeFetch}={}){
 if(argv.length===1&&['--help','-h'].includes(argv[0])){process.stdout.write('Usage: node apps/runtime/cli.mjs <control|temporal-worker|conversation-runner|schedule-worker> --config /absolute/config.json\nExit: 0 graceful completion; 2 configuration/startup timeout; 3 runtime/startup failure/shutdown timeout.\n');return 0;}
 if(argv.length!==3||argv[1]!=='--config'){process.stderr.write('RUNTIME_ARGUMENTS\n');return 2;}const [role,,path]=argv;let c;try{c=await loadConfiguration(path,role);
  if((poststartTls===undefined)!==(nativeFetch===undefined)||poststartTls!==undefined&&
     (role!=='conversation-runner'||process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||c.bootstrap?.remote!==true||c.remoteTask!==undefined||typeof nativeFetch!=='function'))throw Error('PRODUCT_POSTSTART_REFUSED');
  if(role==='control'&&process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&
     (process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||c.privateHttp===undefined||c.nativeCandidate===undefined||c.taskRouter?.enabled!==true||c.taskRouter.poststart?.enabled!==true||c.temporal.authorization===undefined||c.temporal.tokenWriter?.enabled!==true||c.temporal.issuerDelivery===undefined||c.temporal.issuerBootstrap?.enabled!==true))throw Error('PRODUCT_LISTENER_REFUSED');
  if(role==='temporal-worker'&&process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&
     (process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||c.native.preparedKickoff!==true||c.native.loopback!==false||
      !c.native.origin.startsWith('https://')||c.http.port!==8081||c.temporal.authorization===undefined||c.temporal.tokenWriter?.enabled!==true||c.temporal.issuerDelivery===undefined||c.temporal.issuerBootstrap?.enabled!==true||!productWorkerTrustsPinnedServerCa(c)))throw Error('PRODUCT_WORKER_REFUSED');
  // Routines have no approved preview activation: the product preview never starts the schedule worker.
  if(role==='schedule-worker'&&process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined)throw Error('PRODUCT_SCHEDULE_WORKER_REFUSED');
  if(role==='conversation-runner'&&process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&
     (process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||c.bootstrap?.remote!==true||c.remoteTask!==undefined||poststartTls===undefined||typeof nativeFetch!=='function'))throw Error('PRODUCT_RUNNER_TLS_REFUSED');
  if(role==='conversation-runner'&&(c.remoteTask!==undefined||c.bootstrap?.remote===true)){
   const measured=await assertProductRunnerMeasurement({expectedSha256:process.env.MERI_RUNNER_SHA256});
   if(c.remoteTask!==undefined&&measured.runnerSha256!==c.remoteTask.preparationIntent.runnerSha256)throw Error('RUNNER_PIN_REFUSED');
  }
 }catch{process.stderr.write('RUNTIME_CONFIGURATION\n');return 2;}
 const controller=new AbortController();let runtime,shutdownTimer,cleanupUnknown=false;const retire=()=>{shutdownTimer??=setTimeout(()=>{process.stderr.write('RUNTIME_SHUTDOWN_TIMEOUT\n');process.exit(3);},c.limits.shutdownMs+1000);};const stop=()=>{controller.abort();retire();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 const startupTimer=setTimeout(()=>{process.stderr.write('RUNTIME_STARTUP_TIMEOUT\n');process.exit(2);},c.limits.startupMs);startupTimer.unref();
 try{if(role==='conversation-runner'){const {runConversation}=await import('./conversation-runner.mjs');clearTimeout(startupTimer);await runConversation(c,{signal:controller.signal,...(poststartTls===undefined?{}:{poststartTls,nativeFetch})});return 0;}
  // The schedule service refuses before secret reads unless trusted in-process owners are supplied; the bare CLI supplies none.
  const [file,start]={control:['./control.mjs','startControl'],'temporal-worker':['./temporal-worker.mjs','startTemporalWorker'],'schedule-worker':['./schedule-service.mjs','startScheduleWorker']}[role];
  const module=await import(file);
  // Control receives the production product-port composition (G4); the other roles take no product ports.
  const productPorts=role==='control'?{productPortsFactory:(await import('./product-ports/index.mjs')).createProductPortsFactory()}:{};
  runtime=await module[start](c,{signal:controller.signal,...productPorts});clearTimeout(startupTimer);if(controller.signal.aborted){retire();await runtime.close();}else{process.stdout.write(JSON.stringify({event:'runtime.listening',role,address:runtime.address,profile:c.profile,...(runtime.downloads?{downloads:runtime.downloads.reason}:{})})+'\n');await Promise.race([new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true})),...(runtime.completion?[runtime.completion]:[])]);retire();await runtime.close();}return 0;
 }catch(error){process.stderr.write('RUNTIME_UNAVAILABLE\n');retire();controller.abort();cleanupUnknown=error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN';
  try{await runtime?.close();}catch{cleanupUnknown=true;}
  if(cleanupUnknown)process.stderr.write('RUNTIME_CLEANUP_UNKNOWN\n');return 3;
 }finally{clearTimeout(startupTimer);if(!cleanupUnknown)clearTimeout(shutdownTimer);process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
