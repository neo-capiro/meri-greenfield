/** Executable ownership only. Importing this file does not allocate resources. */
import {pathToFileURL} from 'node:url';
import {loadConfiguration} from './config.mjs';
export async function main(argv=process.argv.slice(2)){
 if(argv.length===1&&['--help','-h'].includes(argv[0])){process.stdout.write('Usage: node apps/runtime/cli.mjs <control|temporal-worker|conversation-runner> --config /absolute/config.json\nExit: 0 graceful completion; 2 configuration/startup; 3 runtime failure.\n');return 0;}
 if(argv.length!==3||argv[1]!=='--config'){process.stderr.write('RUNTIME_ARGUMENTS\n');return 2;}const [role,,path]=argv;let c;try{c=await loadConfiguration(path,role);}catch{process.stderr.write('RUNTIME_CONFIGURATION\n');return 2;}
 const controller=new AbortController();let runtime,shutdownTimer;const stop=()=>{controller.abort();shutdownTimer??=setTimeout(()=>{process.stderr.write('RUNTIME_SHUTDOWN_TIMEOUT\n');process.exit(3);},c.limits.shutdownMs+1000);shutdownTimer.unref();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 const startupTimer=setTimeout(()=>{process.stderr.write('RUNTIME_STARTUP_TIMEOUT\n');process.exit(2);},c.limits.startupMs);startupTimer.unref();
 try{if(role==='conversation-runner'){const {runConversation}=await import('./conversation-runner.mjs');clearTimeout(startupTimer);await runConversation(c,{signal:controller.signal});return 0;}
  const module=await import(role==='control'?'./control.mjs':'./temporal-worker.mjs');runtime=await (role==='control'?module.startControl:module.startTemporalWorker)(c,{signal:controller.signal});clearTimeout(startupTimer);if(controller.signal.aborted)await runtime.close();else{process.stdout.write(JSON.stringify({event:'runtime.listening',role,address:runtime.address,profile:c.profile})+'\n');await Promise.race([new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true})),...(runtime.completion?[runtime.completion]:[])]);await runtime.close();}return 0;
 }catch{process.stderr.write('RUNTIME_UNAVAILABLE\n');await runtime?.close();return 3;}finally{clearTimeout(startupTimer);clearTimeout(shutdownTimer);process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
