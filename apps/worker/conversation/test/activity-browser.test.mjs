import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,realpath,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createConversationActivity} from '../activity.mjs';
import {applicationFixture,binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {installation,sourceScopes,recorders} from '../browser/test/fixtures.mjs';
const frames=[{type:'assistant',parent_tool_use_id:null,message:{id:'msg_1',content:[{type:'text',text:'Hello'}]}},{type:'result',subtype:'success',is_error:false}];
/** Activity with a trusted browser runtime port over a real temporary conversation workspace. The shipped activation
 * gate is held, so the browser contributes no server, tool or hook; its run cleanup must still run on every outcome. */
async function setup({selected=frames,policy=async()=>undefined}={}){
 const root=await realpath(await mkdtemp(join(tmpdir(),'meri-activity-browser-'))),cwd=join(root,binding.conversationId);
 await mkdir(join(cwd,'.browser','profile'),{recursive:true});
 const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});
 let n=300,seen;const policyCalls=[];
 const r=recorders(),browser={async policy(request){policyCalls.push(request);return policy();},installation,sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort};
 const query=args=>{seen=args.options;return {async *[Symbol.asyncIterator](){for(const frame of selected)yield frame;},close(){}};};
 const execute=createConversationActivity({runOwner:f.runOwner,query,newId:()=>id(n++),browser,
  prepareRuntime:async()=>({binding,versions,cwd,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+2000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024})});
 return {...f,cwd,execute,policyCalls,options:()=>seen,close:async()=>{f.close();await rm(root,{recursive:true,force:true});}};
}
const gone=async path=>{try{await access(path);return false;}catch{return true;}};
test('a configured browser port is asked for the run policy, composes nothing while held, and its cleanup runs after a completed run',async()=>{
 const f=await setup();
 try{
  assert.deepEqual(await f.execute({binding}),{state:'completed'});
  assert.deepEqual(f.policyCalls.map(c=>c.binding),[binding]);
  const o=f.options();assert.equal(o.mcpServers,undefined);assert.deepEqual(o.allowedTools,[]);assert.equal(o.permissionMode,'default');
  assert.equal(await gone(join(f.cwd,'.browser')),true,'browser state removed at run end');
 }finally{await f.close();}
});
test('browser cleanup also runs when the run fails, and a refused browser policy fails the run before any query',async()=>{
 const failing=await setup({selected:[{type:'result',subtype:'error_during_execution',errors:['PRIVATE']}]});
 try{await assert.rejects(failing.execute({binding}),/EXECUTION_FAILED/);assert.equal(await gone(join(failing.cwd,'.browser')),true);}finally{await failing.close();}
 const refused=await setup({policy:async()=>({enabled:true,allowedOrigins:['http://10.0.0.1']})});
 try{await assert.rejects(refused.execute({binding}),/EXECUTION_FAILED/);assert.equal(refused.options(),undefined,'no query started');const h=await refused.service.history({credential:refused.credential});assert.equal(h.run.state,'failed');}finally{await refused.close();}
});
test('a browser cleanup that cannot be verified surfaces as SDK_CLEANUP_UNKNOWN instead of a clean completion',async()=>{
 const f=await setup();
 try{
  await rm(join(f.cwd,'.browser'),{recursive:true,force:true});
  const {symlink}=await import('node:fs/promises');await symlink(tmpdir(),join(f.cwd,'.browser'));
  await assert.rejects(f.execute({binding}),/SDK_CLEANUP_UNKNOWN/);
  assert.equal(await gone(join(tmpdir())),false,'disposal never followed the link');
 }finally{await f.close();}
});
test('activity configuration refuses a browser port without a policy source',()=>{
 assert.throws(()=>createConversationActivity({runOwner:{load(){},append(){}},prepareRuntime(){},browser:{}}),/BROWSER_ACTIVITY_CONFIGURATION/);
});
