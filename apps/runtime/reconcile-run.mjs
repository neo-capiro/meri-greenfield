/** Operator re-entry for original-attempt reconciliation after the workflow's finite reconcile budget is exhausted: one bounded,
 * idempotent execution/kickoff/stop for one exact binding through the trusted native capability, the same call the workflow's reconcile
 * activity makes. The control owner retires the original (stop-only, also after a restart) and settles the run from durable state. It
 * never starts, kicks off, loops or redispatches. Exit 0: retirement proven and the run settled; 3: still UNKNOWN (a barrier; nothing
 * written); 2: arguments or configuration. Usage: node apps/runtime/reconcile-run.mjs --config <temporal-worker config> --binding <file> */
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {loadConfiguration,readSecret} from './config.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {createReconcileActivity} from './temporal-worker.mjs';
export function reconcileRun({configuration,credential,binding,fetch:transport}){return createReconcileActivity({native:createNativeCapabilityClient({configuration:configuration.native,credential,...(transport?{fetch:transport}:{})})})({binding});}
export async function main(argv=process.argv.slice(2),{fetch:transport}={}){
 if(argv.length!==4||argv[0]!=='--config'||argv[2]!=='--binding'){process.stderr.write('RECONCILE_ARGUMENTS\n');return 2;}
 let configuration,binding,credential;try{configuration=await loadConfiguration(argv[1],'temporal-worker');binding=JSON.parse(await readFile(argv[3],'utf8'));credential=(await readSecret(configuration.native.capabilityFile)).toString('utf8').trim();}catch{process.stderr.write('RECONCILE_CONFIGURATION\n');return 2;}
 try{await reconcileRun({configuration,credential,binding,...(transport?{fetch:transport}:{})});process.stdout.write(JSON.stringify({event:'run.reconciled'})+'\n');return 0;}catch{process.stderr.write('RECONCILE_UNKNOWN\n');return 3;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
