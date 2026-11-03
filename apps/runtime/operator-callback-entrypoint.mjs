/** Separate executable selected by protected deployment command, never a production flag. */
import {pathToFileURL} from 'node:url';
import {readSecret} from './config.mjs';
import {operatorCallbackConfiguration} from './operator-callback-configuration.mjs';
export async function main(argv=process.argv.slice(2)){
 if(!(argv.length===1&&argv[0]==='agentcore')&&!(argv.length===3&&argv[0]==='temporal-worker'&&argv[1]==='--config'))return 2;
 try{
  // Separate protected deployment mount: the canonical /run/meri inventory remains closed.
  const callback=operatorCallbackConfiguration(JSON.parse((await readSecret('/run/meri-operator/callback.json')).toString('utf8')));
  if(argv[0]==='agentcore')return await (await import('./agentcore-entrypoint.mjs')).mainOperatorAgentCore(callback);
  return await (await import('./cli.mjs')).mainOperatorTemporalWorker(callback,argv);
 }catch{process.stderr.write('OPERATOR_CALLBACK_STARTUP_REFUSED\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
