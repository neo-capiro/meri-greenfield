import {pathToFileURL,fileURLToPath} from 'node:url';
export async function main(args=process.argv.slice(2),write=value=>process.stdout.write(value)){
 if(args.length===0||(args.length===1&&args[0]==='--help')){write('Usage: node evals/action-followthrough/local-baseline/cli.mjs --run\nRuns six synthetic local route cases; no model, provider, SQL engine or approval.\n');return 0;}
 if(args.length!==1||args[0]!=='--run'){write('BASELINE_ARGUMENTS\n');return 2;}
 try{process.env.MERI_REVIEW_SOURCE_ROOT=fileURLToPath(new URL('../../../',import.meta.url));const {runLocalPilotBaseline}=await import('./run.mjs');const result=await runLocalPilotBaseline({mode:'synthetic-local'});write(JSON.stringify(result)+'\n');return result.status==='PASS'?0:1;}
 catch{write('{"status":"FAIL","code":"BASELINE_FAILED"}\n');return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
