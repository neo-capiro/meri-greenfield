/** Executable ownership only. Importing this file does not allocate resources. */
import {pathToFileURL} from 'node:url';
import {loadConfiguration} from './config.mjs';
import {createTurnTelemetry} from './telemetry/turn-context.mjs';
import {countingFetch} from './telemetry/counting.mjs';
import {verifyControlCaBundle,productControlTrustsCompositeCa} from './control-ca-bundle.mjs';
/** Private control trust is delivered before Node starts, separately from Temporal's native mTLS. */
export function productWorkerTrustsPinnedServerCa(c,environment=process.env){const file=c.native?.serverCaFile;return typeof file==='string'&&/^\/run\/meri\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.pem$/u.test(file)&&environment.NODE_EXTRA_CA_CERTS===file;}
export async function main(argv=process.argv.slice(2)){
 if(argv.length===1&&['--help','-h'].includes(argv[0])){process.stdout.write('Usage: node apps/runtime/cli.mjs <control|temporal-worker|schedule-worker> --config /absolute/config.json\nExit: 0 graceful completion; 2 configuration/startup timeout; 3 runtime/startup failure/shutdown timeout.\n');return 0;}
 if(argv.length!==3||argv[1]!=='--config'){process.stderr.write('RUNTIME_ARGUMENTS\n');return 2;}const [role,,path]=argv;let c;try{c=await loadConfiguration(path,role);
  if(role==='control'&&process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&
     (process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||c.privateHttp===undefined||c.agentcore===undefined))throw Error('PRODUCT_LISTENER_REFUSED');
  if((role==='control'||role==='schedule-worker')&&process.env.MERI_PRODUCT_PREVIEW_REQUIRED==='1')await verifyControlCaBundle(c);
  if(role==='temporal-worker'&&process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&
     (process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||c.native.preparedKickoff!==true||c.native.loopback!==false||
      !c.native.origin.startsWith('https://')||c.http.port!==8081||!productWorkerTrustsPinnedServerCa(c)))throw Error('PRODUCT_WORKER_REFUSED');
  // Routines (D016-A #5, lane B3): the product preview starts the schedule worker only under Core's unattended-firing pin, with its
  // native client to control's private occurrence operations (HTTPS) and its own database file; its owners compose at startup below.
  if(role==='schedule-worker'&&process.env.MERI_PRODUCT_PREVIEW_REQUIRED!==undefined&&
     (process.env.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||c.routines?.enabled!==true||c.routines.core?.unattendedGrant===undefined||c.native===undefined||c.native.loopback!==false||
      !c.native.origin.startsWith('https://')||c.database===undefined||c.http.port!==8083||!productControlTrustsCompositeCa()))throw Error('PRODUCT_SCHEDULE_WORKER_REFUSED');
 }catch{process.stderr.write('RUNTIME_CONFIGURATION\n');return 2;}
 const controller=new AbortController();let runtime,shutdownTimer,controlTurnTelemetry,cleanupUnknown=false;const retire=()=>{shutdownTimer??=setTimeout(()=>{process.stderr.write('RUNTIME_SHUTDOWN_TIMEOUT\n');process.exit(3);},c.limits.shutdownMs+1000);};const stop=()=>{controller.abort();retire();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 const startupTimer=setTimeout(()=>{process.stderr.write('RUNTIME_STARTUP_TIMEOUT\n');process.exit(2);},c.limits.startupMs);startupTimer.unref();
 try{
  // The schedule service refuses before secret reads unless trusted owners are supplied; without `routines.enabled` the bare CLI supplies none.
  const [file,start]={control:['./control.mjs','startControl'],'temporal-worker':['./temporal-worker.mjs','startTemporalWorker'],'schedule-worker':['./schedule-service.mjs','startScheduleWorker']}[role];
  const module=await import(file);
  // Control receives the production product-port composition (G4); the other roles take no product ports.
  let productPorts={},routinesOwners=null,readDelegationConsents;
  // The live-session relay (RC1 option A) serves reads and the memory run path; startControl binds it to its own session owner.
  const relay=role==='control'?(await import('./read-credential-relay.mjs')).createReadCredentialRelay():null;
  // The schedule worker's owners (lane B3): the service calls this factory once it owns its pool, Temporal client and native client;
  // the factory composes Core's firing authority and unattended stop (B2) plus the admission/retirement ports over control's operations.
  if(role==='schedule-worker'&&c.routines?.enabled===true){const {composeRoutinesWorkerRuntimePorts}=await import('./schedule-service-owners.mjs');productPorts={runtimePortsFactory:composeRoutinesWorkerRuntimePorts};}
  if(role==='control'){
   controlTurnTelemetry=createTurnTelemetry({service:'control',environment:c.telemetry?.environment});
   const {createMemoryFamilyWith}=await import('./product-ports/memory.mjs');
   const memoryFamily=createMemoryFamilyWith(relay?{nativeCredentials:relay.port}:{});
   // Documents (D31): the Core artifact authority composes only with every input present; otherwise the store-only family stays
   // and `missing` names absent declared bindings by key. Actual executor/image qualification remains separate.
   const [{createProductPortsFactory,PRODUCT_FAMILIES},{composeDocumentsFamily}]=await Promise.all([import('./product-ports/index.mjs'),import('./artifacts/authority-composition.mjs')]);
   // Existing business families retain their own readiness. Replaced task-grant authority is not a fallback.
   const coreFetch=countingFetch(globalThis.fetch,controlTurnTelemetry,{origin:c.agentcore.identity.origin});
   const documents=await composeDocumentsFamily({configuration:c,fetchImpl:coreFetch,nativeCredentials:relay.port});
   if(c.artifacts?.enabled===true&&documents.missing.length)process.stderr.write(JSON.stringify({event:'runtime.documents.unavailable',missing:documents.missing})+'\n');
   productPorts={turnTelemetry:controlTurnTelemetry,productPortsFactory:createProductPortsFactory({families:PRODUCT_FAMILIES.map(([name,factory])=>[name,name==='documents'?documents.family:name==='memory'?memoryFamily:name==='routines'?context=>routinesOwners?.family(context)??factory(context):factory])}),...(relay?{readCredentialRelay:relay}:{})};
  }
  // Read transport is constructed with the actual execution owner by the candidate, after control startup.
  if(role==='control'&&c.reads?.enabled===true){
   const [{createControlReadsComposer},{readSecret},{createConfiguredRunCapabilityPolicy},{createMemoryContextRelay}]=await Promise.all([
    import('./reads-composer.mjs'),import('./config.mjs'),import('./product-ports/capability-policy.mjs'),import('./memory-context-relay.mjs')]);
   const memoryContextRelay=createMemoryContextRelay();
   const reads=await createControlReadsComposer({coreOrigin:c.agentcore.identity.origin,nativeCredentials:relay.port,readSecret,
    serviceSecretFile:c.reads.serviceSecretFile,...(c.reads.readModeServiceSecretFile===undefined?{}:{readModeServiceSecretFile:c.reads.readModeServiceSecretFile}),
    capabilityPolicy:createConfiguredRunCapabilityPolicy(c),memoryContexts:memoryContextRelay,...(c.reads.defaultCongress===undefined?{}:{defaultCongress:c.reads.defaultCongress}),
    fetchImpl:countingFetch(globalThis.fetch,controlTurnTelemetry,{origin:c.agentcore.identity.origin})});
   if(reads.missing.length)process.stderr.write(JSON.stringify({event:'runtime.reads.unavailable',missing:reads.missing})+'\n');
   Object.assign(productPorts,{createReadsRuntime:reads.createReadsRuntime,memoryContextRelay});
  }
  if(role==='control'&&c.routines?.enabled===true){
   const {createAttendedRoutinesOwnerComposition}=await import('./native-authority/routines-owner-composition.mjs');
   routinesOwners=createAttendedRoutinesOwnerComposition({configuration:c,workflow:c.routines.workflow,readConsents:readDelegationConsents});
   productPorts.routinesCandidateBinder=candidate=>{routinesOwners.bindCandidate(candidate);if(routinesOwners.state()==='owners-unavailable')process.stderr.write(JSON.stringify({event:'runtime.routines.attended.unavailable'})+'\n');};
  }
  runtime=await module[start](c,{signal:controller.signal,...productPorts});clearTimeout(startupTimer);if(controller.signal.aborted){retire();await runtime.close();}else{process.stdout.write(JSON.stringify({event:'runtime.listening',role,address:runtime.address,profile:c.profile,...(runtime.downloads?{downloads:runtime.downloads.reason}:{})})+'\n');await Promise.race([new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true})),...(runtime.completion?[runtime.completion]:[])]);retire();await runtime.close();}return 0;
 }catch(error){process.stderr.write('RUNTIME_UNAVAILABLE\n');retire();controller.abort();cleanupUnknown=error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN';
  try{await runtime?.close();}catch{cleanupUnknown=true;}
  if(cleanupUnknown)process.stderr.write('RUNTIME_CLEANUP_UNKNOWN\n');return 3;
 }finally{controlTurnTelemetry?.close();clearTimeout(startupTimer);if(!cleanupUnknown)clearTimeout(shutdownTimer);process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
