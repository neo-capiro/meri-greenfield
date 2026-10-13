/** Review-only ESM resolution to already installed pinned dependencies; no install/source edits. */
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const installed=createRequire('/workspace/meri-greenfield/package.json');
export async function resolve(specifier,context,next){
 try{return await next(specifier,context);}catch(error){
  if(error.code!=='ERR_MODULE_NOT_FOUND'||!['ajv/','ajv-formats','canonicalize'].some(prefix=>specifier.startsWith(prefix)))throw error;
  return {url:pathToFileURL(installed.resolve(specifier)).href,shortCircuit:true};
 }
}
