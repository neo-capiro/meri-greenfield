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
  let productPorts={};
  // The live-session relay (RC1 option A) serves reads and the memory run path; startControl binds it to its own session owner.
  const relay=role==='control'&&(c.reads?.enabled===true||c.memory?.enabled===true)?(await import('./read-credential-relay.mjs')).createReadCredentialRelay():null;
  if(role==='control'){
   const {createMemoryFamilyWith}=await import('./product-ports/memory.mjs');
   const memoryFamily=createMemoryFamilyWith(relay?{nativeCredentials:relay.port}:{});
   // Documents (D31): the Core artifact authority composes only with every input present; otherwise the store-only family stays
   // and `missing` names the gaps by key (runOptions and executor are Meri-local owners not yet composed).
   const [{createProductPortsFactory,PRODUCT_FAMILIES},{composeDocumentsFamily}]=await Promise.all([import('./product-ports/index.mjs'),import('./artifacts/authority-composition.mjs')]);
   const documents=await composeDocumentsFamily({configuration:c});
   if(c.artifacts?.enabled===true&&documents.missing.length)process.stderr.write(JSON.stringify({event:'runtime.documents.unavailable',missing:documents.missing})+'\n');
   // Write-intent execution (lane E): the intents family and the per-run intent mount share one composition; both stay inert
   // unless control declares intents.execution and its Core owners exist.
   const [{createControlIntentExecution},{readSecret}]=await Promise.all([import('./native-authority/execution-composition.mjs'),import('./config.mjs')]);
   const execution=createControlIntentExecution({readSecret});
   productPorts={productPortsFactory:createProductPortsFactory({families:PRODUCT_FAMILIES.map(([name,factory])=>[name,name==='documents'?documents.family:name==='intents'?execution.family:name==='memory'?memoryFamily:factory])}),intentMountFor:execution.intentMountFor,...(relay?{readCredentialRelay:relay}:{})};
  }
  // General reads (lane 2), only when declared: the composer is built before control (it prepares and measures handlers) and
  // gets the live-session relay, which startControl binds to this control's own action-session owner (RC1 option A).
  if(role==='control'&&c.reads?.enabled===true){
   const [{createControlReadsComposer},{readSecret},{canonicalSha256}]=await Promise.all([import('./native-authority/reads-composer.mjs'),import('./config.mjs'),import('../../packages/contracts/validate.mjs')]);
   // P2: the pinned installation measurement comes from its byte-pinned material file (brotli JSON; material-init verified the digest, the
   // decompression is bounded) and must still hash to the configured pin here; the composer's issuer then refuses it unless it matches this
   // image's catalog and contracts (fail closed).
   // P1: discovery runs only with the trusted platform record (G2 producer, capability-policy.mjs); without `capabilityPlatform` it stays disabled.
   let installation,discovery;
   if(c.reads.installation!==undefined){const i=c.reads.installation;
    if(!i.enabled)installation={enabled:false};
    else{let measurement;try{const {brotliDecompressSync}=await import('node:zlib');measurement=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(brotliDecompressSync(await readSecret(i.measurementFile),{maxOutputLength:262144})));}catch{throw Error('READS_INSTALLATION_MATERIAL_REFUSED');}
     if(canonicalSha256(measurement)!==i.measurementSha256)throw Error('READS_INSTALLATION_PIN_REFUSED');
     installation={enabled:true,measurement,measurementSha256:i.measurementSha256,...(i.revokedOperations===undefined?{}:{revokedOperations:structuredClone(i.revokedOperations)})};}}
   if(c.reads.discovery!==undefined)discovery=c.reads.discovery.enabled===true&&c.capabilityPlatform!==undefined?{enabled:true,capabilityPolicy:(await import('./product-ports/capability-policy.mjs')).createConfiguredRunCapabilityPolicy(c)}:{enabled:false};
   const reads=await createControlReadsComposer({configuration:c,secretFiles:{serviceSecret:c.reads.serviceSecretFile,...(c.reads.readModeServiceSecretFile===undefined?{}:{readModeServiceSecret:c.reads.readModeServiceSecretFile})},nativeCredentials:relay.port,...(c.reads.defaultCongress===undefined?{}:{defaultCongress:c.reads.defaultCongress}),
    ...(installation===undefined?{}:{installation}),...(discovery===undefined?{}:{discovery})});
   if(reads.missing.length)process.stderr.write(JSON.stringify({event:'runtime.reads.unavailable',missing:reads.missing})+'\n');
   Object.assign(productPorts,{createReadsRuntime:reads.createReadsRuntime});
  }
  runtime=await module[start](c,{signal:controller.signal,...productPorts});clearTimeout(startupTimer);if(controller.signal.aborted){retire();await runtime.close();}else{process.stdout.write(JSON.stringify({event:'runtime.listening',role,address:runtime.address,profile:c.profile,...(runtime.downloads?{downloads:runtime.downloads.reason}:{})})+'\n');await Promise.race([new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true})),...(runtime.completion?[runtime.completion]:[])]);retire();await runtime.close();}return 0;
 }catch(error){process.stderr.write('RUNTIME_UNAVAILABLE\n');retire();controller.abort();cleanupUnknown=error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN';
  try{await runtime?.close();}catch{cleanupUnknown=true;}
  if(cleanupUnknown)process.stderr.write('RUNTIME_CLEANUP_UNKNOWN\n');return 3;
 }finally{clearTimeout(startupTimer);if(!cleanupUnknown)clearTimeout(shutdownTimer);process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
