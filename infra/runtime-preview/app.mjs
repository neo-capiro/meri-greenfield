/** Offline synthesis only. No AWS SDK, credential, subprocess, network or deployment entry point. */
import {mkdir,lstat,realpath,writeFile} from 'node:fs/promises';
import {resolve,isAbsolute,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {buildFoundations} from './foundations.mjs';
import {buildData} from './data.mjs';
import {buildServices} from './services.mjs';
import {templateBytes} from './common.mjs';
export function buildTemplates(){return {'MeriRuntime-Preview-Foundations':buildFoundations(),'MeriRuntime-Preview-Data':buildData(),'MeriRuntime-Preview-Services':buildServices()};}
export async function synthesize(output){
  if(typeof output!=='string'||!isAbsolute(output)||output.split(/[\\/]/u).some(p=>p==='..'||p==='.'))throw Error('FRESH_ABSOLUTE_OUTPUT_REQUIRED');
  output=resolve(output);
  const parent=dirname(output),stat=await lstat(parent);if(!stat.isDirectory()||stat.isSymbolicLink()||await realpath(parent)!==parent)throw Error('PLAIN_PARENT_REQUIRED');
  const templates=buildTemplates();await mkdir(output); // Exclusive: no overwrite, repair or recursive removal.
  const records=[];
  for(const [name,value] of Object.entries(templates)){const bytes=templateBytes(value),path=name+'.json';await writeFile(join(output,path),bytes,{flag:'wx'});records.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  const manifest={status:'SOURCE_ONLY_ACTIONS_UNAPPROVED',P0:'APPROVED_24H_25USD_ONLY',deploymentPerformed:false,templates:records};
  await writeFile(join(output,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
export async function main(args=process.argv.slice(2)){
  if(args.length===1&&args[0]==='--help'){process.stdout.write('Usage: node infra/runtime-preview/app.mjs --output <fresh-absolute-directory>\nOffline synthesis only. Exit0 success;2 invalid input/synthesis failure. Never deploys.\n');return 0;}
  if(args.length!==2||args[0]!=='--output'){process.stderr.write('PREVIEW_SYNTH_ARGUMENTS\n');return 2;}
  try{const result=await synthesize(args[1]);process.stdout.write(JSON.stringify({status:result.status,templates:result.templates})+'\n');return 0;}catch{process.stderr.write('PREVIEW_SYNTH_REFUSED; exclusive partial output, if any, is retained\n');return 2;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)process.exitCode=await main();
