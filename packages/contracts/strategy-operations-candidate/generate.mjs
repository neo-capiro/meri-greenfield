/** Only generates this candidate's schema and synthetic fixtures; never publishes or deploys. */
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {candidateSchema,candidateVersion} from './schema.mjs';
import {allFixtures} from './fixture-source.mjs';
export async function generate({check=false}={}){
 const outputs=new Map([['candidate.schema.json',candidateSchema()],...Object.entries(allFixtures()).map(([n,v])=>['fixtures/'+n+'.json',v])]);
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 const artifacts=Object.fromEntries([...outputs].map(([p,v])=>[p,digest(JSON.stringify(v,null,2)+'\n')]));
 const sources={};for(const p of ['shapes.mjs','schema.mjs','graph.mjs','validate.mjs','fixture-source.mjs','generate.mjs'])sources[p]=digest(await readFile(new URL('./'+p,import.meta.url)));
 outputs.set('distribution.json',{candidateVersion,status:'CANDIDATE_RUNTIME_UNIMPLEMENTED',schemaId:candidateSchema().$id,definitions:['Request','ModelOutcome','Result','WorkloadDecision'],canonicalDependency:{path:'../meri.schema.json',sha256:digest(await readFile(new URL('../meri.schema.json',import.meta.url)))},sources,artifacts,publicPackageExported:false,routesImplemented:false,resultStoreImplemented:false});
 if(!check)await mkdir(new URL('./fixtures/',import.meta.url),{recursive:true});
 for(const [p,v] of outputs){const bytes=JSON.stringify(v,null,2)+'\n',url=new URL('./'+p,import.meta.url);if(check){if(await readFile(url,'utf8')!==bytes)throw Error('CANDIDATE_GENERATED_DRIFT');}else await writeFile(url,bytes);}
 return {candidateVersion,status:'CANDIDATE_RUNTIME_UNIMPLEMENTED',outputs:outputs.size};
}
export async function main(args){if(args.length===1&&args[0]==='--help'){process.stdout.write('Usage: node generate.mjs [--check|--help]\nExit0 success;2 invalid/drift. Writes candidate schema/synthetic fixtures only.\n');return 0;}if(args.length>1||args.length===1&&args[0]!=='--check')return 2;try{process.stdout.write(JSON.stringify(await generate({check:args[0]==='--check'}))+'\n');return 0;}catch{return 2;}}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main(process.argv.slice(2));
