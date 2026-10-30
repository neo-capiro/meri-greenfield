import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const HERE=new URL('./',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export async function generateBrowserViewerContracts({check=false}={}){
 const {build}=await import('esbuild');
 const bundle=await build({absWorkingDir:fileURLToPath(HERE),entryPoints:['browser-viewer/receive.mjs'],
  bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,preserveSymlinks:true});
 if(Object.values(bundle.metafile.outputs).some(o=>o.imports.length))throw Error('Browser viewer external import');
 const sources=[];
 for(const path of [...Object.keys(bundle.metafile.inputs),'browser-viewer/api.d.ts','generate-browser-viewer.mjs'].sort()){
  if(path.includes('..')||/^[A-Za-z]:|^\//u.test(path))throw Error('Browser viewer source outside package');
  const bytes=await readFile(new URL(path,HERE));sources.push({path,sha256:hash(bytes),bytes:bytes.length});
 }
 const files=new Map([
  ['browser-viewer.mjs','// Generated browser viewer receiving boundary; no account authority.\n'+bundle.outputFiles[0].text],
  ['browser-viewer.d.ts','// Generated from browser-viewer/api.d.ts.\n'+await readFile(new URL('browser-viewer/api.d.ts',HERE),'utf8')],
  ['browser-viewer.metadata.json',JSON.stringify({contractVersion:'1.0.0',schemaId:'meri.browser-viewer/1',sources},null,2)+'\n'],
 ]);
 if(check){for(const[name,bytes]of files)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==bytes)throw Error('Browser viewer generated drift');}
 else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,bytes]of files)await writeFile(new URL('dist/'+name,HERE),bytes);}
 return [...files].map(([path,bytes])=>({path,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.length>1||args.length&&args[0]!=='--check')throw Error('Usage: node generate-browser-viewer.mjs [--check]');
 console.log(JSON.stringify(await generateBrowserViewerContracts({check:args[0]==='--check'})));
}
