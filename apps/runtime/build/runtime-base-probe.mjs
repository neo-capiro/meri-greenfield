/** Offline final-image import and filesystem smoke; no launch descriptor or model query. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inspectNativeFile,swcBinding} from './materialize-swc.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));

export async function probeRuntimeImage() {
  assert.equal(process.platform,'linux'); assert.equal(process.arch,'arm64');
  assert.equal(process.version,'v24.22.1'); assert.equal(process.getuid(),1000); assert.equal(process.getgid(),1000);
  assert.equal(execFileSync('npm',['--version'],{encoding:'utf8',timeout:15000,maxBuffer:65536}).trim(),'12.2.1');
  assert.equal(execFileSync('npx',['--version'],{encoding:'utf8',timeout:15000,maxBuffer:65536}).trim(),'12.2.1');
  const rootMount=fs.readFileSync('/proc/self/mountinfo','utf8').split('\n').map(line=>line.split(' ')).find(fields=>fields[4]==='/');
  assert(rootMount?.[5].split(',').includes('ro'),'Qualification requires a read-only root mount');
  for(const parent of ['/tmp','/workspace','/run/meri','/run/meri-temporal']){
    const directory=fs.mkdtempSync(path.join(parent,'image-smoke-'));
    try{fs.writeFileSync(path.join(directory,'fixture'),'ok');}finally{fs.rmSync(directory,{recursive:true});}
  }
  const require=createRequire(path.join(root,'apps/runtime/package.json'));
  const binding=swcBinding(root),swc=require('@swc/core');
  assert(swc.transformSync('const value: number = 7;',{jsc:{parser:{syntax:'typescript'}}}).code.includes('7'));
  assert.equal(swc.getBinaryMetadata().target,'aarch64-unknown-linux-gnu');
  assert(!fs.existsSync(path.join(root,'.build-native')));
  const bridgePackage=require.resolve('@temporalio/core-bridge/package.json');
  assert.equal(JSON.parse(fs.readFileSync(bridgePackage,'utf8')).version,'1.24.0');
  const bridge=path.join(path.dirname(bridgePackage),'releases/aarch64-unknown-linux-gnu/index.node');
  inspectNativeFile(bridge); require('@temporalio/core-bridge');
  const workerRequire=createRequire(path.join(root,'apps/worker/conversation/package.json'));
  const sdkFile=workerRequire.resolve('@anthropic-ai/claude-agent-sdk');
  const sdkPackage=JSON.parse(fs.readFileSync(path.join(path.dirname(sdkFile),'package.json'),'utf8'));
  assert.equal(sdkPackage.version,'0.3.295'); assert.equal(sdkPackage.claudeCodeVersion,'2.1.295');
  assert.equal(typeof (await import(pathToFileURL(sdkFile).href)).query,'function');
  const sdkRequire=createRequire(sdkFile);
  const cli=path.join(path.dirname(sdkRequire.resolve('@anthropic-ai/claude-agent-sdk-linux-arm64/package.json')),'claude');
  inspectNativeFile(cli);
  assert.match(execFileSync(cli,['--version'],{encoding:'utf8',timeout:15000,maxBuffer:65536}),/^2\.1\.295\b/);
  const python=String.raw`
import importlib,importlib.metadata,json,platform,ssl,sys,sysconfig
assert platform.machine()=='aarch64'
assert sys.version_info[:3]==(3,13,16)
with open(sys.argv[1]) as stream: lock=json.load(stream)
assert sysconfig.get_path('purelib')==lock['sitePackages']
import pip
assert pip.__version__=='26.2.2'
for row in lock['wheels']:
 assert importlib.metadata.version(row['name'])==row['version'],row['name']
 importlib.import_module(row['importName'])
assert len(ssl.create_default_context().get_ca_certs())>50
import numpy,pandas
assert int(numpy.dot([1,2],[3,4]))==11
assert int(pandas.DataFrame({'value':[1,2]}).value.sum())==3
print(json.dumps({'python':platform.python_version(),'imports':len(lock['wheels']),'nativeComputation':True,'caTrust':True}))
`;
  const directory=fs.mkdtempSync('/tmp/python-smoke-');
  let pythonResult;
  try {pythonResult=JSON.parse(execFileSync('/usr/bin/python3.13',['-I','-B','-c',python,path.join(root,'infra/product-preview/runtime-wheels.lock.json')],{
    env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:directory,MPLCONFIGDIR:directory,OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1'},
    encoding:'utf8',timeout:30000,maxBuffer:65536,
  }));}finally{fs.rmSync(directory,{recursive:true});}
  return {platform:'linux/arm64',node:process.version,uid:process.getuid(),readOnlyRoot:true,writableTaskPaths:true,
    swc:binding.version,temporal:'1.24.0',sdk:sdkPackage.version,cli:sdkPackage.claudeCodeVersion,python:pythonResult};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(process.argv.length===3&&process.argv[2]==='--help')console.log('Native ARM64 image smoke: --check under UID1000/read-only root with writable task mounts. No model, service or database calls.');
  else if(process.argv.length===3&&process.argv[2]==='--check'){
    try{console.log(JSON.stringify(await probeRuntimeImage()));}catch(error){console.error('RUNTIME_IMAGE_REFUSED: '+error.message);process.exitCode=2;}
  }else{console.error('RUNTIME_IMAGE_REFUSED');process.exitCode=2;}
}
