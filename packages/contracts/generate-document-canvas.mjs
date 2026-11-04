/** Bundle the canvas receiver with its canonical browser validators. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const here=new URL('./',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generateDocumentCanvas({check=false}={}){
 const {build}=await import('esbuild');
 const bundle=await build({absWorkingDir:fileURLToPath(here),entryPoints:['document-canvas.mjs'],bundle:true,write:false,
  platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,preserveSymlinks:true});
 if(Object.values(bundle.metafile.outputs).some(output=>output.imports.length))throw Error('Canvas browser external import');
 const sources=[];
 for(const path of [...Object.keys(bundle.metafile.inputs),'document-canvas.d.ts','generate-document-canvas.mjs'].sort()){
  if(path.includes('..')||/^[A-Za-z]:|^\//u.test(path))throw Error('Canvas source outside package');
  const bytes=await readFile(new URL(path,here));sources.push({path,sha256:hash(bytes),bytes:bytes.length});
 }
 const files=new Map([
  ['document-canvas.mjs','// Generated canvas receiver; validation grants no authority.\n'+bundle.outputFiles[0].text],
  ['document-canvas.d.ts','// Generated from document-canvas.d.ts.\n'+await readFile(new URL('document-canvas.d.ts',here),'utf8')],
  ['document-canvas.metadata.json',JSON.stringify({schemaId:'meri.document-canvas/1',sources},null,2)+'\n'],
 ]);
 if(check){for(const [name,value]of files)if(await readFile(new URL('dist/'+name,here),'utf8')!==value)throw Error('Canvas generated drift: '+name);}
 else{await mkdir(new URL('dist/',here),{recursive:true});for(const [name,value]of files)await writeFile(new URL('dist/'+name,here),value);}
 return [...files].map(([path,value])=>({path,bytes:Buffer.byteLength(value),sha256:hash(value)}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.length>1||args.length&&args[0]!=='--check')throw Error('Usage: node generate-document-canvas.mjs [--check]');
 console.log(JSON.stringify(await generateDocumentCanvas({check:args[0]==='--check'})));
}
