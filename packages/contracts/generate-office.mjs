/** Offline additive receiving-boundary distribution. Existing frozen generators,
 * catalog, schemas, package exports and consumer pins are untouched. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=b=>createHash('sha256').update(b).digest('hex');
export async function generateOfficeContracts({check=false}={}){
 const {build}=await import('esbuild');
 const bundled=await build({absWorkingDir:dir,entryPoints:['office-application/receive.mjs'],bundle:true,write:false,
  platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,preserveSymlinks:true});
 if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Office browser external import');
 const sources=[];
 for(const path of [...Object.keys(bundled.metafile.inputs),'office-application/api.d.ts','generate-office.mjs'].sort()){
  if(path.includes('..')||/^[A-Za-z]:|^\//u.test(path))throw Error('Office source outside package');
  const bytes=await readFile(new URL(path,HERE));sources.push({path,sha256:hash(bytes),bytes:bytes.length});
 }
 const code='// Generated Office receiving boundary; no authority.\n'+bundled.outputFiles[0].text;
 if(/^(?:\/\/ |\s+")[^\n]*(?:\.\.\/|(?<![A-Za-z0-9])[A-Za-z]:[\\/](?!\/)|\/(?:home|Users)\/)/mu.test(code))throw Error('Office bundle embeds checkout layout');
 const api=await readFile(new URL('office-application/api.d.ts',HERE),'utf8');
 const files=new Map([['office-application.mjs',code],['office-application.d.ts','// Generated from office-application/api.d.ts.\n'+api],
  ['office-application.metadata.json',JSON.stringify({contractVersion:'1.0.0',schemaId:'meri.office-application/1',sources,semantics:{
   save:'WOPI private draft only; never publication',publish:'explicit exact draft sequence and hash',authority:'current Core/native session; browser validation grants none',
   formulaCache:'edited XLSX preserves editor-provided/unverified label',tokens:'launch and renew only; POST form; never persist'}},null,2)+'\n']]);
 if(check){for(const[name,value]of files)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==value)throw Error('Office generated drift: '+name);}
 else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,value]of files)await writeFile(new URL('dist/'+name,HERE),value);}
 return [...files].map(([path,value])=>({path,bytes:Buffer.byteLength(value),sha256:hash(value)}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.length>1||args.length&&args[0]!=='--check')throw Error('Usage: node generate-office.mjs [--check]');
 await generateOfficeContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result)));
}
