/** Inert, network-free measurement of GNU native dependencies in the final image. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {swcBinding,inspectNativeImage} from './materialize-swc.mjs';

const applicationRoot=fileURLToPath(new URL('../../../',import.meta.url));
const need=value=>{if(!value)throw Error('RUNTIME_NATIVE_REFUSED');};
const contained=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
function nativeFile(root,file){
 need(!fs.lstatSync(file).isSymbolicLink());
 const resolved=fs.realpathSync(file),stat=fs.statSync(resolved);
 need(contained(root,resolved)&&stat.isFile()&&stat.size>0&&stat.size<=512*1024*1024);
 const bytes=fs.readFileSync(resolved);inspectNativeImage(bytes,'linux','x64');
 return {path:resolved,sha256:createHash('sha256').update(bytes).digest('hex')};
}

/** No worker/runtime/session is created. Native modules are loaded only on this call. */
export function measureRuntimeNative({rootDirectory=applicationRoot}={}){
 need(process.platform==='linux'&&process.arch==='x64'&&process.version==='v24.21.0');
 const glibcVersion=process.report.getReport().header.glibcVersionRuntime;
 need(typeof glibcVersion==='string'&&/^\d+\.\d+$/u.test(glibcVersion));
 const root=fs.realpathSync(rootDirectory),require=createRequire(path.join(root,'apps/runtime/package.json'));
 const binding=swcBinding(root),swcNative=nativeFile(root,binding.native);
 need(!fs.existsSync(path.join(root,'.build-native')));
 const swc=require('@swc/core');
 const transformed=swc.transformSync('const runtimeBaseProof: number = 7;',{
  jsc:{parser:{syntax:'typescript'}},sourceMaps:false,
 });
 need(typeof transformed?.code==='string'&&transformed.code.includes('7'));
 const swcTarget=swc.getBinaryMetadata().target;
 need(swcTarget==='x86_64-unknown-linux-gnu');

 const bridgeManifest=fs.realpathSync(require.resolve('@temporalio/core-bridge/package.json'));
 need(contained(root,bridgeManifest));
 const bridgeRoot=path.dirname(bridgeManifest),metadata=JSON.parse(fs.readFileSync(bridgeManifest,'utf8'));
 need(metadata.name==='@temporalio/core-bridge'&&metadata.version==='1.24.0');
 const temporalNative=nativeFile(bridgeRoot,path.join(bridgeRoot,'releases/x86_64-unknown-linux-gnu/index.node'));
 // Requiring the bridge loads its selected native binding without starting a
 // Temporal runtime, worker, connection, workflow or network listener.
 const bridge=require('@temporalio/core-bridge');
 need(bridge!==null&&typeof bridge==='object');
 const loaded=new Set(process.report.getReport().sharedObjects.filter(file=>file.endsWith('.node')).map(file=>fs.realpathSync(file)));
 need(loaded.has(swcNative.path)&&loaded.has(temporalNative.path));
 need([...loaded].every(file=>file===swcNative.path||file===temporalNative.path));
 need(!fs.existsSync(path.join(root,'.build-native')));
 return Object.freeze({schemaVersion:1,status:'RUNTIME_NATIVE_VERIFIED',nodeVersion:process.version,glibcVersion,
  swcTarget,swcNativeSha256:swcNative.sha256,temporalNativeSha256:temporalNative.sha256,
  swcCacheIndependent:true,temporalNativeLoaded:true});
}

const help='Final-image GNU native proof: node apps/runtime/build/runtime-base-probe.mjs --measure. Exit0 verified/help; exit2 refused. No services, credentials, runtime or network are created.';
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv.length===3&&process.argv[2]==='--help')console.log(help);
 else if(process.argv.length===3&&process.argv[2]==='--measure'){
  try{console.log(JSON.stringify(measureRuntimeNative()));}
  catch{console.error('RUNTIME_NATIVE_REFUSED');process.exitCode=2;}
 }else{console.error('RUNTIME_NATIVE_REFUSED');process.exitCode=2;}
}
