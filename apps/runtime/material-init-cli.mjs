/** Packaged one-shot init entrypoint. Secrets are accepted only in the init container's fixed environment slot. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {materializeStaticProductMaterial,parseStaticProductMaterialExpected} from './material-init.mjs';

export const materialInitEnvironment=Object.freeze({expected:'MERI_STATIC_MATERIAL_EXPECTED',bundle:'MERI_STATIC_MATERIAL_BUNDLE'});
const usage='Usage: node apps/runtime/material-init-cli.mjs write | --help\nExit codes: 0 success/help; 64 arguments; 78 missing/refused material; 1 cleanup/internal failure.\n';

/** Explicit environment dependency; importing this module neither reads the environment nor writes files. */
export async function runMaterialInitCli(argv,{environment=process.env,writeOut=text=>process.stdout.write(text),writeError=text=>process.stderr.write(text)}={}){
 if(argv.length===0||argv.length===1&&['--help','-h'].includes(argv[0])){writeOut(usage);return 0;}
 if(argv.length!==1||argv[0]!=='write'){writeError(usage);return 64;}
 let expectedText,bundleText;
 try{
  expectedText=environment[materialInitEnvironment.expected];bundleText=environment[materialInitEnvironment.bundle];
  // No child is spawned. The app container never receives this variable; init exits before its SUCCESS dependency is satisfied.
  delete environment[materialInitEnvironment.bundle];
  if(typeof expectedText!=='string'||Buffer.byteLength(expectedText,'utf8')>8192||typeof bundleText!=='string'||Buffer.byteLength(bundleText,'utf8')>65536)throw Error();
  const expected=parseStaticProductMaterialExpected(JSON.parse(expectedText));
  let consumed=false;
  const delivery={async fetch({signal}){
   signal.throwIfAborted();if(consumed)throw Error();consumed=true;
   const text=bundleText;bundleText=undefined;return JSON.parse(text);
  }};
  const result=await materializeStaticProductMaterial({expected,delivery});
  writeOut(JSON.stringify({ready:true,role:result.receipt.role,fileCount:result.receipt.fileCount})+'\n');return 0;
 }catch(error){
  const code=typeof error?.code==='string'&&/^STATIC_INIT_[A-Z_]+$/u.test(error.code)?error.code:'STATIC_INIT_REFUSED';
  writeError(code+'\n');return ['STATIC_INIT_CLEANUP_FAILED','STATIC_INIT_CLEANUP_REFUSED'].includes(code)?1:78;
 }finally{expectedText=undefined;bundleText=undefined;}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 runMaterialInitCli(process.argv.slice(2)).then(code=>{process.exitCode=code;},()=>{process.stderr.write('STATIC_INIT_REFUSED\n');process.exitCode=1;});
}
