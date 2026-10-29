import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {prepareCurrentSiteWorkflow} from '../current.mjs';
import {prepareBrowserRun} from '../../runtime.mjs';
import {createPermissionGate} from '../../permissions.mjs';
import {createPageContext} from '../../page-context.mjs';
import {createDownloadPort} from '../../downloads.mjs';
import {binding,enabledPolicy,approvalReceipt,clock,pageResponse,recorders,sourceScopes} from '../../test/fixtures.mjs';
import {workflowCurrent,workflowSelection} from '../../../../../../packages/contracts/test/site-workflow.fixture.mjs';
import {canonicalSha256} from '../../../../../../packages/contracts/validate.mjs';
const name=t=>'mcp__meri_browser__'+t;
async function fixture(){
 let answer=workflowCurrent(),reads=0;
 const resolve=async()=>{reads++;return answer;};
 const prepared=await prepareCurrentSiteWorkflow({binding,selection:workflowSelection,resolve,policy:enabledPolicy()});
 return {prepared,resolve,reads:()=>reads,change:value=>{answer=value;}};
}
test('current workflow narrows policy and every recheck resolves exact revision again',async()=>{
 const f=await fixture();assert.deepEqual(f.prepared.policy.allowedOrigins,['https://records.example']);
 assert.deepEqual(f.prepared.policy.downloads.formats,['txt']);assert.equal(f.prepared.policy.downloads.maxFiles,1);
 await f.prepared.assertCurrent();assert.equal(f.reads(),2);
 f.change({...workflowCurrent(),manifest:{...workflowCurrent().manifest,version:2}});await assert.rejects(f.prepared.assertCurrent());
 f.change({...workflowCurrent(),enabled:false});await assert.rejects(f.prepared.assertCurrent());
});
test('Core enablement cannot open the shipped gates and failed preparation retires stale profile state',async()=>{
 const f=await fixture(),temp=await realpath(tmpdir()),root=await mkdtemp(join(temp,'meri-site-held-'));
 const cwd=join(root,binding.conversationId).replaceAll('\\','/');let granted=false;
 try{
  await mkdir(join(cwd,'.browser','profile'),{recursive:true});
  await assert.rejects(prepareBrowserRun({port:{policy:async()=>enabledPolicy(),egress:{grant(){granted=true;}}},binding,
   cwd,deadlineMs:clock()+60000,now:clock,siteWorkflow:workflowSelection,siteWorkflows:{resolve:f.resolve}}),{code:'SITE_WORKFLOWS_HELD'});
  assert.equal(granted,false);await assert.rejects(access(join(cwd,'.browser')),{code:'ENOENT'});
 }finally{if(relative(temp,root).startsWith('..'))throw Error('fixture path escaped temp');await rm(root,{recursive:true,force:true});}
});
test('PreToolUse refuses disabled reads and approval rechecks after its awaited answer',async()=>{
 const f=await fixture(),pages=createPageContext();pages.begin('initial');pages.end('initial',pageResponse('https://records.example/form'));
 const gate=createPermissionGate({binding,policy:f.prepared.policy,policySha256:canonicalSha256(f.prepared.policy),server:'meri_browser',pages,now:clock,
  assertCurrent:f.prepared.assertCurrent,approvals:{async decide(request){f.change({...workflowCurrent(),enabled:false});return approvalReceipt(request);}}});
 const pre=(tool,id)=>gate.preToolUse({hook_event_name:'PreToolUse',tool_name:name(tool),tool_use_id:id,tool_input:{}},id,{});
 assert.equal((await pre('browser_click','click')).hookSpecificOutput.permissionDecision,'ask');
 assert.equal((await gate.canUseTool(name('browser_click'),{element:'Submit',target:'e1'},{toolUseID:'click'})).behavior,'deny');
 assert.equal((await pre('browser_snapshot','read')).hookSpecificOutput.permissionDecision,'deny');
 assert.equal((await gate.canUseTool(name('browser_snapshot'),{},{toolUseID:'read'})).behavior,'deny');
});
test('revoked configuration prevents download ingest and releases its unspent slot',async()=>{
 const f=await fixture(),r=recorders(),temp=await realpath(tmpdir()),root=await mkdtemp(join(temp,'meri-site-current-')),output=join(root,'output');
 try{
  await mkdir(output);await writeFile(join(output,'record.txt'),'Synthetic filing');
  const port=createDownloadPort({binding,policy:f.prepared.policy,policySha256:canonicalSha256(f.prepared.policy),sourceScopes,
   paths:{output},artifacts:r.artifactPort,receipts:r.receiptPort,now:clock,assertCurrent:f.prepared.assertCurrent});
  f.change({...workflowCurrent(),enabled:false});await assert.rejects(port.accept({filename:'record.txt',url:'https://records.example/filing'}));
  assert.equal(r.ingested.length,0);
  f.change(workflowCurrent());await port.accept({filename:'record.txt',url:'https://records.example/filing'});assert.equal(r.ingested.length,1);
 }finally{if(relative(temp,root).startsWith('..'))throw Error('fixture path escaped temp');await rm(root,{recursive:true,force:true});}
});
