import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
import {realpath} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';import {tmpdir} from 'node:os';
import {createNativeFiles,prepareNativeTaskDirectory} from '../native-files.mjs';
import {withRunnerDiagnostics,markRunnerStage} from '../../runner-runtime-diagnostics.mjs';
import {createTurnTelemetry} from '../../telemetry/turn-context.mjs';
import {safeCode} from '../../telemetry/turn-lines.mjs';
import {identifyWorkspaceCaptureRoot,workspaceCaptureDiagnosticCause,WORKSPACE_CAPTURE_DIAGNOSTIC_CODES} from '../../../../packages/runtime/workspace-capture-diagnostics.mjs';
const binding={runId:'11111111-1111-4111-8111-111111111111',attemptId:'22222222-2222-4222-8222-222222222222'};
const canary='PRIVATE_CAPTURE_NAME_CONTENT';
async function fixture(t){
 const temp=await realpath(tmpdir()),root=await realpath(fs.mkdtempSync(join(temp,'meri-capture-diagnostic-')));
 t.after(()=>{assert.ok(resolve(root).startsWith(resolve(temp)+sep));assert.ok(root.includes('meri-capture-diagnostic-'));fs.rmSync(root,{recursive:true,force:true});});
 const workspace=join(root,'cwd'),sdkConfigDirectory=join(root,'sdk');fs.mkdirSync(workspace);fs.mkdirSync(sdkConfigDirectory);
 const tasks=await prepareNativeTaskDirectory(sdkConfigDirectory),owner=createNativeFiles({workspace,sdkConfigDirectory,expiresAtMs:2000,now:()=>1000});
 return {root,workspace,tasks,owner};
}
function intercept(t,name,method){const original=fs[name];fs[name]=method(original);syncBuiltinESMExports();t.after(()=>{fs[name]=original;syncBuiltinESMExports();});}
function poisonEntry(t,f,root,reason){
 const dir=root==='CWD'?f.workspace:f.tasks,p=join(dir,root==='CWD'?canary:'1.json');fs.writeFileSync(p,canary);
 if(reason==='TYPE'||reason==='SYMLINK')intercept(t,'lstatSync',original=>(name,...args)=>{const stat=original(name,...args);return name===p?{...stat,isDirectory:()=>false,isFile:()=>false,isSymbolicLink:()=>reason==='SYMLINK'}:stat;});
 if(reason==='LINK_COUNT')fs.linkSync(p,join(f.root,'outside-hardlink'));
 if(reason==='CANONICAL_PATH')intercept(t,'realpathSync',original=>(name,...args)=>name===p?join(f.root,canary):original(name,...args));
 if(reason==='FILE_COUNT'){fs.unlinkSync(p);for(let n=1;n<=257;n++)fs.writeFileSync(join(dir,`${n}.json`),'');}
 if(reason==='FILE_SIZE'){const fd=fs.openSync(p,'w');try{fs.ftruncateSync(fd,8*1024*1024+1);}finally{fs.closeSync(fd);}}
 if(reason==='TOTAL_BYTES'){fs.unlinkSync(p);for(let n=1;n<=5;n++){const fd=fs.openSync(join(dir,`${n}.json`),'w');try{fs.ftruncateSync(fd,n===5?1:8*1024*1024);}finally{fs.closeSync(fd);}}}
}
for(const root of ['CWD','SDK_TASKS'])for(const reason of ['TYPE','SYMLINK','LINK_COUNT','CANONICAL_PATH','FILE_COUNT','FILE_SIZE','TOTAL_BYTES']){
 test(`real native capture preserves refusal and reports only ${root}/${reason}`,async t=>{
  const f=await fixture(t);poisonEntry(t,f,root,reason);const raw=[],structured=[];
  const telemetry=createTurnTelemetry({service:'runner',write:line=>structured.push(JSON.parse(line)),rollupMs:0});t.after(()=>telemetry.close());
  let refused;
  await assert.rejects(withRunnerDiagnostics(async()=>{markRunnerStage('activity-complete');try{f.owner.capture();}catch(error){refused=error;throw error;}},
   {binding,write:line=>raw.push(line),turnTelemetry:telemetry}),error=>error===refused&&error.message==='WORKSPACE_CAPTURE_REFUSED');
  assert.equal(refused.name,'Error');assert.equal(Object.hasOwn(refused,'code'),false);assert.equal(Object.hasOwn(refused,'cause'),false);assert.deepEqual(Object.keys(refused),[]);
  const code=`WORKSPACE_CAPTURE_${root}_${reason}`;assert.equal(workspaceCaptureDiagnosticCause(refused),code);
  assert.match(raw[0],new RegExp(`stage=activity-complete code=ERROR class=ERROR exit=none signal=none cause=${code} `));
  const event=structured.find(v=>v.event==='meri.turn.failure');assert.equal(event.cause,code);assert.equal(event.code,'ERROR');assert.equal(event.timeoutClass,'none');
  const serialized=JSON.stringify({raw,structured});assert.equal(serialized.includes(canary),false);assert.equal(serialized.includes(f.root),false);
 });
}
test('successful bytes, task anchor and empty roots are unchanged and emit no refusal',async t=>{
 const f=await fixture(t);assert.deepEqual(f.owner.capture(),{files:[],taskFiles:[]});fs.writeFileSync(join(f.workspace,'answer'),'answer');fs.writeFileSync(join(f.tasks,'.lock'),'');
 const upload=f.owner.capture();assert.equal(upload.files[0].path,'answer');assert.equal(Buffer.from(upload.files[0].base64,'base64').toString(),'answer');assert.equal(upload.taskFiles[0].path,'.lock');assert.equal(upload.taskFiles[0].bytes,0);
 assert.deepEqual(f.owner.capture(),upload);
});
test('unrelated, forged and private failure data cannot manufacture capture diagnostics',async t=>{
 const error=Error(canary);let reads=0;Object.defineProperty(error,'captureRoot',{get(){reads++;throw Error(canary);}});
 assert.equal(identifyWorkspaceCaptureRoot(error,'CWD'),error);assert.equal(workspaceCaptureDiagnosticCause(error),undefined);assert.equal(reads,0);
 assert.equal(workspaceCaptureDiagnosticCause(new Proxy(error,{})),undefined);assert.equal(workspaceCaptureDiagnosticCause(null),undefined);
 assert.equal(safeCode('WORKSPACE_CAPTURE_CWD_'+canary),'other');assert.equal(WORKSPACE_CAPTURE_DIAGNOSTIC_CODES.length,14);
 for(const code of WORKSPACE_CAPTURE_DIAGNOSTIC_CODES)assert.equal(safeCode(code),code);
 const f=await fixture(t),abort=new AbortController();abort.abort();let stopped;try{f.owner.capture({signal:abort.signal});}catch(e){stopped=e;}
 assert.equal(stopped.message,'NATIVE_FILES_REFUSED');assert.equal(workspaceCaptureDiagnosticCause(stopped),undefined);
});
