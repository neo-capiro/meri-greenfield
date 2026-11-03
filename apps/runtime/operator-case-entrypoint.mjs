/** Fixed operator command only. No ordinary entrypoint inspects operator environment data. */
import {pathToFileURL} from 'node:url';
import {readSecret} from './config.mjs';
import {runOperatorMaterialInit,runOperatorAgentCoreMaterial,operatorMaterialEnvironment,operatorMaterialExpected,OPERATOR_PATHS} from './operator-material.mjs';
export async function main(argv=process.argv.slice(2)){
 try{
  if(argv.length===1&&argv[0]==='material-init'){await runOperatorMaterialInit();return 0;}
  if(argv.length===1&&argv[0]==='agentcore'){
   // AgentCore has no ECS init container/mount/command override. Its config-only image
   // has this fixed CMD and receives only the public callback descriptor, not a Control secret.
   const expected=operatorMaterialExpected(JSON.parse(process.env[operatorMaterialEnvironment.expected]));
   if(expected.role!=='agentcore'||expected.sourceCommit!==process.env.MERI_SOURCE_COMMIT||expected.imageDigest!==process.env.MERI_RENDERER_IMAGE_DIGEST)throw Error();
   await runOperatorAgentCoreMaterial();
   return await (await import('./operator-callback-entrypoint.mjs')).main(['agentcore']);
  }
  if(argv.length!==3||argv[1]!=='--config'||!['control','temporal-worker'].includes(argv[0]))return 2;
  if(argv[2]!==`/run/meri/${argv[0]==='control'?'control':'worker'}.json`)return 2;
  if(argv[0]==='temporal-worker')return await (await import('./operator-callback-entrypoint.mjs')).main(argv);
  const descriptor=JSON.parse((await readSecret(OPERATOR_PATHS.control)).toString('utf8'));
  return await (await import('./cli.mjs')).mainOperatorBrowserControl(descriptor,argv);
 }catch{process.stderr.write('OPERATOR_CASE_STARTUP_REFUSED\n');return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
