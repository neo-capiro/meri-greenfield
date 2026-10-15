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
 const sources={};for(const p of ['shapes.mjs','schema.mjs','application-binding.mjs','receipts.mjs','graph.mjs','draft-context.mjs','validate.mjs','fixture-source.mjs','generate.mjs'])sources[p]=digest(await readFile(new URL('./'+p,import.meta.url)));
 const localDependencies={};for(const p of ['../meri.schema.json','../validate.mjs','../commands-0.2/execution-boundary.mjs','../retrieval-0.2/operation-contracts.mjs','../package.json','../package-lock.json'])localDependencies[p]=digest(await readFile(new URL(p,import.meta.url)));
 const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
 const externalDependencies=Object.fromEntries(Object.entries(lock.packages).filter(([p,v])=>p&&!v.dev).map(([p,v])=>[p,{version:v.version,resolved:v.resolved,integrity:v.integrity,dependencies:v.dependencies??{}}]));
 outputs.set('distribution.json',{candidateVersion,status:'CANDIDATE_RUNTIME_UNIMPLEMENTED',schemaId:candidateSchema().$id,definitions:Object.keys(candidateSchema().$defs),sources,localDependencies,externalDependencies,applicationTargetSource:{status:'LOCAL_SOURCE_REFERENCE_NOT_WIRE_FREEZE',commit:'9eb3dd0253bb9080097432f462fa529eac5f60a7',tree:'995aac2991d4ebb59a41ccaa79f4f403b56e13a5',canonicalPlanSourceSha256:'27d802b454fd8bbd4ed912bd91ade4eb354979b2334f97753db2913033e95661',canonicalTokenFields:12},artifacts,standalone:{layout:'Preserve candidate and all relative localDependencies beneath packages/contracts',runtime:'Node24',entrypoint:'validate.mjs',dependencyLock:'../package-lock.json',packageExportImplemented:false},publicPackageExported:false,routesImplemented:false,resultStoreImplemented:false});
 if(!check)await mkdir(new URL('./fixtures/',import.meta.url),{recursive:true});
 for(const [p,v] of outputs){const bytes=JSON.stringify(v,null,2)+'\n',url=new URL('./'+p,import.meta.url);if(check){if(await readFile(url,'utf8')!==bytes)throw Error('CANDIDATE_GENERATED_DRIFT');}else await writeFile(url,bytes);}
 return {candidateVersion,status:'CANDIDATE_RUNTIME_UNIMPLEMENTED',outputs:outputs.size};
}
export async function main(args){if(args.length===1&&args[0]==='--help'){process.stdout.write('Usage: node generate.mjs [--check|--help]\nExit0 success;2 invalid/drift. Writes candidate schema/synthetic fixtures only.\n');return 0;}if(args.length>1||args.length===1&&args[0]!=='--check')return 2;try{process.stdout.write(JSON.stringify(await generate({check:args[0]==='--check'}))+'\n');return 0;}catch{return 2;}}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main(process.argv.slice(2));
