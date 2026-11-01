/** Offline mount/module closure only. Linking does not evaluate the probe or qualify a native sandbox. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {SourceTextModule,SyntheticModule} from 'node:vm';
import {rendererSandboxArguments,RENDERER_IMAGE_PATHS} from '../renderer-sandbox.mjs';
import {RENDERER_PROBE_PATH} from '../../../artifacts/renderer-qualification.mjs';
import {officeTransformArguments} from '../../../artifacts/office-transform.mjs';

const observationPath=join(dirname(RENDERER_PROBE_PATH),'renderer-probe-observation.mjs');
const probeCall={executable:RENDERER_IMAGE_PATHS.nodeExecutable,args:[RENDERER_PROBE_PATH],cwd:'/tmp/meri-renderer-probe-abcdef'};
function mounts(plan){
 const out=[];
 for(let i=0;i<plan.length;i++)if(['--bind','--ro-bind','--ro-bind-try'].includes(plan[i])){
  out.push({kind:plan[i],source:plan[i+1],target:plan[i+2]});i+=2;
 }
 return out;
}
const sourceMounts=plan=>mounts(plan).filter(m=>m.target.endsWith('.mjs'));
async function linkProbe(mounted){
 const files=new Map(mounted.map(m=>[m.target,m.source])),loaded=new Map();
 async function load(path){
  if(loaded.has(path))return loaded.get(path);
  if(!files.has(path))throw Object.assign(Error('Probe import has no explicit file mount'),{code:'SANDBOX_MODULE_MISSING'});
  const module=new SourceTextModule(await readFile(files.get(path),'utf8'),{identifier:path});loaded.set(path,module);return module;
 }
 const root=await load(RENDERER_PROBE_PATH);
 await root.link(async(specifier,parent)=>{
  if(['node:fs','node:path'].includes(specifier)){
   const builtin=await import(specifier),names=Object.keys(builtin);
   return new SyntheticModule(names,function(){for(const name of names)this.setExport(name,builtin[name]);});
  }
  assert.ok(specifier.startsWith('./'),'no package, absolute or parent import admitted to this probe closure');
  return load(resolve(dirname(parent.identifier),specifier));
 });
 return {root,loaded};
}

test('fixed sandbox supplies the complete probe ESM graph through two exact read-only files',async()=>{
 const files=sourceMounts(rendererSandboxArguments(probeCall));
 assert.deepEqual(files,[RENDERER_PROBE_PATH,observationPath].map(path=>({kind:'--ro-bind',source:path,target:path})));
 const {root,loaded}=await linkProbe(files);
 assert.equal(root.status,'linked');
 assert.deepEqual([...loaded.keys()],[RENDERER_PROBE_PATH,observationPath]);
 assert.ok([...loaded.values()].every(module=>module.status==='linked'),'no probe module was evaluated');
});

test('omitting the observation file reproduces the unresolved import despite a mounted probe',async()=>{
 const files=sourceMounts(rendererSandboxArguments(probeCall)).filter(m=>m.target!==observationPath);
 await assert.rejects(linkProbe(files),{code:'SANDBOX_MODULE_MISSING'});
});

test('probe, version and conversions retain the closed mounts, identity and resource command',()=>{
 const cwd='/tmp/meri-office-abcdef';
 const calls=[probeCall,{executable:RENDERER_IMAGE_PATHS.executable,args:['--version'],cwd},
  ...['docx','xlsx','pptx'].map(format=>({executable:RENDERER_IMAGE_PATHS.executable,args:officeTransformArguments({workspace:cwd,format,target:'pdf'}),cwd}))];
 for(const call of calls){
  const plan=rendererSandboxArguments(call);
  assert.deepEqual(plan.slice(0,12),['--unshare-all','--die-with-parent','--new-session','--uid','1000','--gid','1000','--cap-drop','ALL','--tmpfs','/','--ro-bind']);
  assert.deepEqual(mounts(plan).filter(m=>!m.target.endsWith('.mjs')),[
   ...['/usr'].map(path=>({kind:'--ro-bind',source:path,target:path})),
   ...['/lib','/lib64','/bin'].map(path=>({kind:'--ro-bind-try',source:path,target:path})),
   {kind:'--ro-bind',source:'/etc/fonts',target:'/etc/fonts'},
   {kind:'--ro-bind-try',source:'/etc/ld.so.cache',target:'/etc/ld.so.cache'},
   {kind:'--ro-bind',source:'/sys/fs/cgroup',target:'/sys/fs/cgroup'},
   {kind:'--bind',source:call.cwd,target:call.cwd}]);
  assert.deepEqual(plan.slice(plan.indexOf('--chdir')),['--chdir',call.cwd,'--remount-ro','/',
   '--',RENDERER_IMAGE_PATHS.prlimit,'--fsize=16777216:16777216','--nofile=128:128','--nproc=64:64','--',call.executable,...call.args]);
 }
});

test('arbitrary commands, injected probe arguments and non-private paths still refuse',()=>{
 for(const change of [{executable:'/bin/sh'},{args:[RENDERER_PROBE_PATH,'--eval','anything']},
  {args:[observationPath]},{cwd:'/workspace/shared'},{cwd:'/tmp/../run/meri-renderer-probe-abcdef'}]){
  assert.throws(()=>rendererSandboxArguments({...probeCall,...change}),{code:'RENDERER_SANDBOX_REFUSED'});
 }
});
