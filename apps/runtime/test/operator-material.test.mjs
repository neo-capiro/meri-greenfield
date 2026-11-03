import test,{mock,after} from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
const {descriptor}=await import('./operator-callback.fixture.mjs');
const saved=Object.fromEntries(['platform','getuid','getgid'].map(k=>[k,Object.getOwnPropertyDescriptor(process,k)]));
Object.defineProperties(process,{platform:{value:'linux',configurable:true},getuid:{value:()=>1000,configurable:true},getgid:{value:()=>1000,configurable:true}});
after(()=>{for(const [k,d] of Object.entries(saved))if(d)Object.defineProperty(process,k,d);else delete process[k];});
let entries,dir,file,unlinks,writes,replace;
const stat=(kind,ino,mode)=>({dev:1,ino,uid:1000,gid:1000,mode,nlink:1,size:0,isFile:()=>kind==='file',isDirectory:()=>kind==='dir',isSymbolicLink:()=>false});
const root='/run/meri-operator',path=root+'/callback.json';
function reset(){entries=[];dir=stat('dir',1,0o700);file=null;unlinks=0;writes=0;replace=false;}
mock.module('node:fs/promises',{namedExports:{
 lstat:async p=>{assert([root,path].includes(p));if(p===root)return {...dir};if(!file)throw Error('absent');return {...file};},
 realpath:async p=>p,readdir:async()=>[...entries],unlink:async p=>{assert.equal(p,path);unlinks++;file=null;entries=[];},
 open:async(p,flags,mode)=>{assert.equal(p,path);assert.equal(flags,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW);assert.equal(mode,0o600);assert.equal(file,null);
  file=stat('file',2,0o600);entries=['callback.json'];const opened=file;
  return {stat:async()=>({...opened}),writeFile:async b=>{writes++;opened.size=b.length;if(replace)file={...opened,ino:99};},sync:async()=>{},close:async()=>{}};}
}});
const {composeOperatorMaterial,validateOperatorMaterial,materializeOperatorMaterial,runOperatorMaterialInit,operatorAgentCoreEnvironment,runOperatorAgentCoreMaterial}=await import('../operator-material.mjs');
const delivery=()=>composeOperatorMaterial({role:'temporal-worker',sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),descriptor:descriptor()});
test('closed operator descriptor inventory cannot add ordinary paths, arbitrary files or wrong pins',()=>{
 for(const change of [d=>d.bundle.files[0].path='/run/meri/callback.json',d=>d.expected.sha256ByPath[path]='0'.repeat(64),d=>d.bundle.files.push({...d.bundle.files[0]}),d=>d.expected.testOwners={}]){
  const d=structuredClone(delivery());change(d);assert.throws(()=>validateOperatorMaterial(d));
 }
});
test('one-shot init writes only fixed same-UID0600 file and consumes bundle environment',async()=>{
 reset();const d=delivery(),environment={MERI_OPERATOR_MATERIAL_EXPECTED:JSON.stringify(d.expected),MERI_OPERATOR_MATERIAL_BUNDLE:JSON.stringify(d.bundle)};
 assert.deepEqual(await runOperatorMaterialInit(environment),{ready:true,role:'temporal-worker',fileCount:1});assert.equal(environment.MERI_OPERATOR_MATERIAL_BUNDLE,undefined);assert.equal(writes,1);assert.equal(unlinks,0);
 await assert.rejects(materializeOperatorMaterial(d));assert.equal(writes,1,'never replace/reinitialize an existing descriptor');
});
test('wrong root owner/mode and foreign contents refuse before writes; changed owned file stays unknown',async()=>{
 for(const mutate of [()=>dir.uid=0,()=>dir.mode=0o777,()=>entries.push('foreign')]){reset();mutate();await assert.rejects(materializeOperatorMaterial(delivery()));assert.equal(writes,0);assert.equal(unlinks,0);}
 reset();replace=true;await assert.rejects(materializeOperatorMaterial(delivery()),/CLEANUP_UNKNOWN/u);assert.equal(unlinks,0);
});
test('AgentCore public descriptor uses bounded environment values and fails a missing or changed piece',async()=>{
 const d=composeOperatorMaterial({role:'agentcore',sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),descriptor:descriptor()});
 const e=operatorAgentCoreEnvironment(d);assert(Object.values(e).every(v=>v.length<=2048));assert(Object.keys(e).length<50);
 reset();await runOperatorAgentCoreMaterial({...e});assert.equal(writes,1);
 for(const mutate of [x=>delete x.MERI_OPERATOR_MATERIAL_PART_0,x=>x.MERI_OPERATOR_MATERIAL_PART_0='corrupt',x=>x.MERI_OPERATOR_MATERIAL_PART_24='foreign']){
  reset();const wrong={...e};mutate(wrong);await assert.rejects(runOperatorAgentCoreMaterial(wrong));assert.equal(writes,0);
 }
});
