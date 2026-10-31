#!/usr/bin/env node
/** Offline Lambda ZIP preparation from an exact Git commit and Release's extracted runtime image dependencies. */
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const fail=()=>{throw Error('NATIVE_OBSERVER_PACKAGE_REFUSED');};
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtimeFiles=['apps/runtime/native-observer-entrypoint.mjs','apps/runtime/native-observer-bridge.mjs','apps/runtime/native-observer-http.mjs',
 'packages/runtime/operation-lifetime.mjs'];
const entry='apps/runtime/native-observer-entrypoint.mjs';
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{maxBuffer:32*1024*1024,windowsHide:true});
const safe=p=>typeof p==='string'&&p.length<1024&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').some(x=>!x||x==='.'||x==='..');
function packageAt(root,name){
 const req=createRequire(pathToFileURL(join(root,'package.json')));let path=dirname(req.resolve(name));
 for(let n=0;n<25;n++){
  try{const data=JSON.parse(readFileSync(join(path,'package.json')));if(data.name===name)return {root:path,data};}catch{}
  const next=dirname(path);if(next===path)break;path=next;
 }
 fail();
}
export function prepareNativeObserverPackage({sourceRoot,commit,runtimeRoot,contractsRoot,imageDigest,out,python='python'}){
 if(!/^[a-f0-9]{40}$/u.test(commit??'')||!/^sha256:[a-f0-9]{64}$/u.test(imageDigest??'')||
  [sourceRoot,runtimeRoot,contractsRoot,out].some(p=>typeof p!=='string'||!isAbsolute(p)))fail();
 sourceRoot=resolve(sourceRoot);out=resolve(out);
 for(const root of [sourceRoot,runtimeRoot,contractsRoot]){const rel=relative(resolve(root),out);if(!rel||!(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)))fail();}
 if(git(sourceRoot,'rev-parse',`${commit}^{commit}`).toString().trim()!==commit)fail();
 const sourcePaths=git(sourceRoot,'ls-tree','-r','--name-only',commit,'--','packages/contracts').toString().trim().split(/\r?\n/u)
  .filter(p=>p&&!/(?:^|\/)(?:test|tests|fixtures)(?:\/|$)|\.test\./u.test(p));
 const paths=[...new Set([...runtimeFiles,...sourcePaths])].sort();
 if(!paths.length||paths.some(p=>!safe(p)))fail();
 const locks=['apps/runtime/package-lock.json','packages/contracts/package-lock.json'].map(p=>JSON.parse(git(sourceRoot,'show',`${commit}:${p}`).toString()));
 const known=new Set(locks.flatMap(l=>Object.entries(l.packages).filter(([p,v])=>p.includes('node_modules/')&&v.version)
  .map(([p,v])=>`${p.split('node_modules/').at(-1)}@${v.version}`)));
 const direct={runtime:JSON.parse(git(sourceRoot,'show',`${commit}:apps/runtime/package.json`)).dependencies,
  contracts:JSON.parse(git(sourceRoot,'show',`${commit}:packages/contracts/package.json`)).dependencies};
 mkdirSync(out,{recursive:false,mode:0o700});const stage=join(out,'package');mkdirSync(stage,{mode:0o700});
 const members=[],dependencies=[],placed=new Map(),visited=new Set();let bytes=0;
 function put(path,body,origin){
  if(!safe(path)||members.some(v=>v.path===path)||members.length>=10000||(bytes+=body.length)>75*1024*1024)fail();
  const dest=join(stage,...path.split('/'));mkdirSync(dirname(dest),{recursive:true,mode:0o700});writeFileSync(dest,body,{flag:'wx',mode:0o644});
  members.push({path,bytes:body.length,sha256:sha(body),origin});
 }
 put('package.json',Buffer.from('{"private":true,"type":"module"}\n'),'generated-lambda-module-root');
 const objects=execFileSync('git',['-C',sourceRoot,'cat-file','--batch'],{input:paths.map(p=>`${commit}:${p}\n`).join(''),maxBuffer:64*1024*1024,windowsHide:true});
 let offset=0;
 for(const p of paths){
  const end=objects.indexOf(10,offset);if(end<0)fail();const header=/^[a-f0-9]{40} blob ([0-9]+)$/u.exec(objects.subarray(offset,end).toString());
  if(!header)fail();const length=Number(header[1]),start=end+1;if(start+length>=objects.length||objects[start+length]!==10)fail();
  put(p,objects.subarray(start,start+length),'git');offset=start+length+1;
 }
 if(offset!==objects.length)fail();
 function dependency(name,from,parentDestination=''){
  const found=packageAt(from,name),identity=`${name}@${found.data.version}`;
  if(!known.has(identity))fail();
  const prior=placed.get(name);
  if(prior?.identity===identity)return;
  const destination=prior?`${parentDestination}/node_modules/${name}`:`node_modules/${name}`;
  if(!safe(destination))fail();const visit=destination+'@'+identity;if(visited.has(visit))return;visited.add(visit);
  if(!prior)placed.set(name,{identity,destination});
  dependencies.push({name,version:found.data.version,path:destination});
  const walk=(dir,prefix='')=>{
   for(const file of readdirSync(dir).sort()){
    if(file==='node_modules')continue;
    const path=join(dir,file),stat=lstatSync(path),suffix=prefix?prefix+'/'+file:file;
    if(stat.isSymbolicLink())fail();
    if(stat.isDirectory())walk(path,suffix);else if(stat.isFile())put(`${destination}/${suffix}`,readFileSync(path),identity);else fail();
   }
  };walk(found.root);
  const all={...found.data.dependencies,...found.data.optionalDependencies};
  for(const child of Object.keys(all).sort()){
   // Optional packages absent from the qualified image remain absent; required dependencies never fall back to the Lambda SDK.
   try{packageAt(found.root,child);}catch{if(Object.hasOwn(found.data.optionalDependencies??{},child))continue;throw Error('NATIVE_OBSERVER_PACKAGE_REFUSED');}
   dependency(child,found.root,destination);
  }
 }
 for(const [name,root,expected] of [['@aws-sdk/client-secrets-manager',runtimeRoot,direct.runtime['@aws-sdk/client-secrets-manager']],
  ...['ajv','ajv-formats','canonicalize'].map(name=>[name,contractsRoot,direct.contracts[name]])]){
  if(packageAt(root,name).data.version!==expected)fail();dependency(name,root);
 }
 const manifest={schema:'meri-native-observer-package/1',sourceCommit:commit,dependencyImageDigest:imageDigest,
  handler:'apps/runtime/native-observer-entrypoint.handler',platform:'linux/arm64',runtime:'nodejs24.x',dependencies,members};
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');writeFileSync(join(out,'manifest.json'),manifestBytes,{flag:'wx',mode:0o600});
 // Actual packaged import, without package hooks or dependency fallbacks. Import creates no SDK client or network request.
 execFileSync(process.execPath,['--input-type=module','-e',
  "await import(process.argv[1]); const sdk=await import('@aws-sdk/client-secrets-manager'); if(typeof sdk.SecretsManagerClient!=='function'||typeof sdk.GetSecretValueCommand!=='function')throw Error('PACKAGE_IMPORT_REFUSED');",
  pathToFileURL(join(stage,entry)).href],
  {cwd:stage,timeout:30000,maxBuffer:1024*1024,windowsHide:true,env:{...process.env,NODE_PATH:'',NODE_OPTIONS:''}});
 const archive=join(out,'observer.zip');
 const zipProgram='import sys,json,zipfile,pathlib,hashlib\nm=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))\nwith zipfile.ZipFile(sys.argv[3],"x",compression=zipfile.ZIP_DEFLATED) as z:\n for r in m["members"]:\n  p=pathlib.Path(sys.argv[1])/r["path"]; b=p.read_bytes(); assert len(b)==r["bytes"] and hashlib.sha256(b).hexdigest()==r["sha256"]; i=zipfile.ZipInfo(r["path"],(1980,1,1,0,0,0)); i.external_attr=0o100644<<16; i.compress_type=zipfile.ZIP_DEFLATED; z.writestr(i,b)\n';
 execFileSync(python,['-I','-c',zipProgram,stage,join(out,'manifest.json'),archive],{timeout:60000,maxBuffer:1024*1024,windowsHide:true});
 const zip=readFileSync(archive),receipt={schema:'meri-native-observer-package-receipt/1',sourceCommit:commit,dependencyImageDigest:imageDigest,
  manifestSha256:sha(manifestBytes),zipSha256:sha(zip),zipBytes:zip.length,files:members.length,importPassed:true,
  qualifiedServingImage:false,cloudPublished:false};
 writeFileSync(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2);if(args.includes('--help')){process.stdout.write('Offline: --source-root --commit --runtime-root --contracts-root --image-digest --out [--python]. No install, build, upload or deployment.\n');}
  else{const values={};for(let i=0;i<args.length;i+=2){if(!['--source-root','--commit','--runtime-root','--contracts-root','--image-digest','--out','--python'].includes(args[i])||args[i+1]===undefined||Object.hasOwn(values,args[i]))fail();values[args[i]]=args[i+1];}
   process.stdout.write(JSON.stringify(prepareNativeObserverPackage({sourceRoot:values['--source-root'],commit:values['--commit'],runtimeRoot:values['--runtime-root'],contractsRoot:values['--contracts-root'],imageDigest:values['--image-digest'],out:values['--out'],python:values['--python']}))+'\n');}
 }catch{process.stderr.write('NATIVE_OBSERVER_PACKAGE_REFUSED\n');process.exitCode=2;}
}
