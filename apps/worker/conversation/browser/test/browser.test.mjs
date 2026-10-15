import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,symlink,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createBrowserCapability} from '../index.mjs';
import {validateBrowserPolicy,BROWSER_TOOLS,DEFAULT_BROWSER_POLICY} from '../policy.mjs';
import {outputReference} from '../receipts.mjs';
import {binding,enabledPolicy,recorders,clock} from './fixtures.mjs';
const workspace=async()=>{const root=await realpath(await mkdtemp(join(tmpdir(),'meri-browser-')));const cwd=join(root,binding.conversationId);await mkdir(join(cwd,'.browser','output'),{recursive:true});return {root,cwd};};
const capability=(cwd,policy=enabledPolicy(),r=recorders())=>({r,cap:createBrowserCapability({binding,cwd,policy,artifacts:r.artifactPort,receipts:r.receiptPort,now:clock})});
const post=(tool,{input={},response=[{type:'text',text:'### Result\nok'}],id='toolu_01'}={})=>({hook_event_name:'PostToolUse',session_id:'00000000-0000-4000-8000-0000000000aa',transcript_path:'/x',cwd:'/x',tool_name:`mcp__meri_browser__${tool}`,tool_input:input,tool_response:response,tool_use_id:id});
test('browser work is disabled by default and contributes no server, tool or hook',async()=>{
 const cwd=`/workspace/${binding.conversationId}`;
 for(const policy of [undefined,DEFAULT_BROWSER_POLICY,{enabled:false}]){const cap=createBrowserCapability({binding,cwd,policy,now:clock});
  assert.equal(cap.enabled,false);assert.deepEqual(cap.mcpServers,{});assert.deepEqual(cap.allowedTools,[]);assert.deepEqual(cap.hooks,{});
  await assert.rejects(cap.downloads.accept({filename:'a.pdf',url:'https://sam.gov/a.pdf'}),/BROWSER_DOWNLOADS_DISABLED/);}
 assert.throws(()=>createBrowserCapability({binding,cwd,policy:{enabled:false,tools:['browser_navigate']},now:clock}),/BROWSER_POLICY/);
});
test('policy validation refuses unknown keys, unbounded tools, insecure origins, wrong versions and foreign-tenant scopes',()=>{
 assert.equal(validateBrowserPolicy(enabledPolicy(),binding).enabled,true);
 const bad=[{enabled:'yes'},{...enabledPolicy(),extra:1},{...enabledPolicy(),tools:['browser_evaluate']},{...enabledPolicy(),tools:['browser_run_code_unsafe']},{...enabledPolicy(),tools:['browser_file_upload']},{...enabledPolicy(),tools:[]},
  {...enabledPolicy(),allowedOrigins:['http://sam.gov']},{...enabledPolicy(),allowedOrigins:['https://sam.gov/path']},{...enabledPolicy(),allowedOrigins:['*']},{...enabledPolicy(),allowedOrigins:[]},
  {...enabledPolicy(),installation:{...enabledPolicy().installation,version:'0.0.84'}},{...enabledPolicy(),installation:{...enabledPolicy().installation,cliPath:'cli.js'}},
  {...enabledPolicy(),timeouts:{actionMs:0,navigationMs:30000}},{...enabledPolicy(),downloads:{enabled:true,formats:['exe'],maxBytes:1024,maxFiles:1}},{...enabledPolicy(),downloads:{enabled:true,formats:['pdf'],maxBytes:10**9,maxFiles:1}},
  {...enabledPolicy(),sourceScopes:[{tenantId:'tenant-other',kind:'public',resourceId:'public-web',policyRevision:'policy1'}]},{...enabledPolicy(),sourceScopes:[{tenantId:binding.tenantId,kind:'any',resourceId:'x',policyRevision:'p'}]}];
 for(const policy of bad)assert.throws(()=>validateBrowserPolicy(policy,binding),/BROWSER_POLICY/,JSON.stringify(policy).slice(0,120));
 for(const forbidden of ['browser_evaluate','browser_run_code_unsafe','browser_file_upload','browser_cookie_set','browser_route','browser_set_storage_state','browser_pdf_save'])assert.ok(!BROWSER_TOOLS.includes(forbidden),forbidden);
});
test('the scripted Playwright MCP config pins the sandbox, a per-conversation profile under the workspace and no stored credentials',()=>{
 const cwd=`/workspace/${binding.conversationId}`,{cap}=capability(cwd),server=cap.mcpServers.meri_browser;
 assert.deepEqual(Object.keys(cap.mcpServers),['meri_browser']);assert.equal(server.type,'stdio');assert.equal(server.command,'/opt/scripted/node');
 const args=server.args;assert.equal(args[0],'/opt/scripted/@playwright/mcp/cli.js');assert.ok(args.includes('--sandbox'));assert.ok(args.includes('--headless'));assert.ok(args.includes('--no-webmcp'));assert.ok(args.includes('--block-service-workers'));
 assert.equal(args[args.indexOf('--user-data-dir')+1],`${cwd}/.browser/profile`);assert.equal(args[args.indexOf('--output-dir')+1],`${cwd}/.browser/output`);assert.equal(args[args.indexOf('--allowed-origins')+1],'https://www.congress.gov;https://sam.gov');
 for(const flag of ['--no-sandbox','--storage-state','--secrets','--extension','--cdp-endpoint','--isolated','--save-session','--caps','--allow-unrestricted-file-access','--shared-browser-context'])assert.ok(!args.some(a=>a===flag||a.startsWith(`${flag}=`)),flag);
 assert.deepEqual(server.env,{PLAYWRIGHT_BROWSERS_PATH:'/opt/scripted/browsers',HOME:`${cwd}/.browser/home`});
 assert.deepEqual(cap.allowedTools,['mcp__meri_browser__browser_navigate','mcp__meri_browser__browser_snapshot','mcp__meri_browser__browser_click','mcp__meri_browser__browser_take_screenshot']);
 assert.equal(cap.hooks.PostToolUse.length,1);assert.equal(cap.hooks.PostToolUse[0].matcher,'mcp__meri_browser__.*');
 const other=createBrowserCapability({binding:{...binding,conversationId:'00000021-b0a1-4000-8000-000000000000'},cwd:'/workspace/00000021-b0a1-4000-8000-000000000000',policy:enabledPolicy(),artifacts:recorders().artifactPort,receipts:recorders().receiptPort,now:clock});
 assert.notEqual(other.mcpServers.meri_browser.args[other.mcpServers.meri_browser.args.indexOf('--user-data-dir')+1],args[args.indexOf('--user-data-dir')+1]);
});
test('configuration refuses a workspace that is not this conversation, missing ports and an invalid binding',()=>{
 const r=recorders(),base={binding,policy:enabledPolicy(),artifacts:r.artifactPort,receipts:r.receiptPort,now:clock};
 for(const cwd of ['relative/'+binding.conversationId,'/workspace/other',`/workspace/../${binding.conversationId}`])assert.throws(()=>createBrowserCapability({...base,cwd}),/BROWSER_CONFIGURATION/);
 const cwd=`/workspace/${binding.conversationId}`;
 assert.throws(()=>createBrowserCapability({...base,cwd,receipts:undefined}),/BROWSER_CONFIGURATION/);assert.throws(()=>createBrowserCapability({...base,cwd,artifacts:{}}),/BROWSER_CONFIGURATION/);
 assert.throws(()=>createBrowserCapability({...base,cwd,binding:{...binding,writerFence:'1'}}),/BROWSER_CONFIGURATION/);assert.throws(()=>createBrowserCapability({...base,cwd,now:1}),/BROWSER_CONFIGURATION/);
 assert.equal(createBrowserCapability({...base,cwd,artifacts:undefined,policy:enabledPolicy({downloads:{enabled:false,formats:['pdf'],maxBytes:1,maxFiles:1}})}).enabled,true);
});
test('the PostToolUse hook records action, URL host, time and screenshot reference, never page contents',async()=>{
 const cwd=`/workspace/${binding.conversationId}`,{cap,r}=capability(cwd),hook=cap.hooks.PostToolUse[0].hooks[0];
 const page='### Result\nDone\n### Page\n- Page URL: https://www.congress.gov/bill/119th-congress/house-bill/1?secret=1\n- Page Title: SECRET-PAGE-TITLE\n### Snapshot\n- heading "SECRET-PAGE-BODY"';
 assert.deepEqual(await hook(post('browser_navigate',{input:{url:'https://www.congress.gov/x'},response:[{type:'text',text:page}]}),'toolu_01',{signal:new AbortController().signal}),{});
 assert.deepEqual(await hook(post('browser_take_screenshot',{id:'toolu_02',response:{content:[{type:'text',text:'### Result\nTook the screenshot and saved it as .browser/output/page-2026-10-15.png'},{type:'image',data:'SECRET-IMAGE'}]}}),undefined,{}),{});
 assert.equal(r.receipts.length,2);const [nav,shot]=r.receipts;
 assert.deepEqual(Object.keys(nav).sort(),['action','atMs','binding','kind','outcome','reference','schema','sessionId','toolUseId','urlHost']);
 assert.equal(nav.action,'browser_navigate');assert.equal(nav.urlHost,'www.congress.gov');assert.equal(nav.atMs,clock());assert.equal(nav.reference,null);assert.deepEqual(nav.binding,binding);
 assert.equal(shot.action,'browser_take_screenshot');assert.equal(shot.reference,'.browser/output/page-2026-10-15.png');assert.equal(shot.urlHost,null);
 const recorded=JSON.stringify(r.receipts);for(const secret of ['SECRET-PAGE-TITLE','SECRET-PAGE-BODY','SECRET-IMAGE','secret=1','house-bill'])assert.ok(!recorded.includes(secret),secret);
 assert.equal(outputReference('saved /etc/passwd.png and ../../escape.png',{cwd,output:`${cwd}/.browser/output`}),null);
 assert.equal(outputReference(`saved ${cwd}/.browser/output/trace-1.zip`,{cwd,output:`${cwd}/.browser/output`}),'.browser/output/trace-1.zip');
});
test('the hook stops browser work when a receipt cannot be recorded or the call is not an allowed browser tool',async()=>{
 const cwd=`/workspace/${binding.conversationId}`,stop={continue:false,stopReason:'Browser receipt unavailable; browser work stopped.'};
 const failing=createBrowserCapability({binding,cwd,policy:enabledPolicy(),artifacts:recorders().artifactPort,receipts:{async record(){throw new Error('store down');}},now:clock}).hooks.PostToolUse[0].hooks[0];
 assert.deepEqual(await failing(post('browser_navigate'),'toolu_01',{}),stop);
 const {cap,r}=capability(cwd),hook=cap.hooks.PostToolUse[0].hooks[0];
 assert.deepEqual(await hook(post('browser_evaluate'),'toolu_01',{}),stop);
 assert.deepEqual(await hook({...post('browser_navigate'),tool_name:'mcp__other__browser_navigate'},'toolu_01',{}),stop);
 assert.deepEqual(await hook(post('browser_navigate'),'toolu_other',{}),stop);
 assert.deepEqual(await hook({...post('browser_navigate'),hook_event_name:'PreToolUse'},'toolu_01',{}),stop);
 const aborted=new AbortController();aborted.abort();assert.deepEqual(await hook(post('browser_navigate'),'toolu_01',{signal:aborted.signal}),stop);
 assert.equal(r.receipts.length,0);
 assert.deepEqual(await hook(post('browser_click',{response:{isError:true,content:[{type:'text',text:'### Error\nnot found'}]}}),'toolu_01',{}),{});assert.equal(r.receipts[0].outcome,'error');
});
test('downloads reach the artifact owner with canonical MIME, checksum and source scopes, then leave the browser output directory',async()=>{
 const {root,cwd}=await workspace();try{
  const {cap,r}=capability(cwd),output=join(cwd,'.browser','output'),pdf=Buffer.from('%PDF-1.7\nsynthetic\n');await writeFile(join(output,'notice.pdf'),pdf);
  const stored=await cap.downloads.accept({filename:'notice.pdf',url:'https://sam.gov/opp/1/notice.pdf?token=SECRET'});
  assert.equal(stored.mimeType,'application/pdf');assert.equal(stored.bytes,pdf.length);assert.match(stored.versionId,/^00000099-/);
  assert.equal(r.ingested.length,1);const request=r.ingested[0];
  assert.deepEqual(request.scopes,enabledPolicy().sourceScopes);assert.deepEqual(request.binding,binding);assert.equal(request.format,'pdf');assert.equal(request.sha256,stored.sha256);assert.deepEqual(request.source,{kind:'browser-download',urlHost:'sam.gov'});
  assert.equal(r.receipts.at(-1).kind,'browser.download');assert.equal(r.receipts.at(-1).reference,stored.versionId);assert.ok(!JSON.stringify(r.receipts).includes('SECRET'));
  await assert.rejects(access(join(output,'notice.pdf')));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('downloads refuse wrong sources, types, content, sizes, names, symlinks and the file limit before any artifact effect',async()=>{
 const {root,cwd}=await workspace();try{
  const {cap,r}=capability(cwd),output=join(cwd,'.browser','output'),put=(name,bytes)=>writeFile(join(output,name),bytes);
  const refuse=(args,code)=>assert.rejects(cap.downloads.accept(args),e=>e.code===code,code);
  await put('ok.pdf','%PDF-1.4\n');await put('fake.pdf','<html>not a pdf</html>');await put('big.txt','x'.repeat(1025));await put('bad.txt',Buffer.from([0xff,0xfe]));await put('run.exe','MZ');
  await refuse({filename:'ok.pdf',url:'https://evil.example/ok.pdf'},'BROWSER_DOWNLOAD_SOURCE');await refuse({filename:'ok.pdf',url:'http://sam.gov/ok.pdf'},'BROWSER_DOWNLOAD_SOURCE');await refuse({filename:'ok.pdf',url:'not a url'},'BROWSER_DOWNLOAD_SOURCE');
  await refuse({filename:'run.exe',url:'https://sam.gov/run.exe'},'BROWSER_DOWNLOAD_TYPE');await refuse({filename:'fake.pdf',url:'https://sam.gov/fake.pdf'},'BROWSER_DOWNLOAD_TYPE');await refuse({filename:'bad.txt',url:'https://sam.gov/bad.txt'},'BROWSER_DOWNLOAD_TYPE');
  await refuse({filename:'big.txt',url:'https://sam.gov/big.txt'},'BROWSER_DOWNLOAD_SIZE');
  for(const filename of ['../ok.pdf','sub/ok.pdf','.hidden.pdf','a..pdf'])await refuse({filename,url:'https://sam.gov/x.pdf'},'BROWSER_DOWNLOAD_NAME');
  await refuse({filename:'missing.pdf',url:'https://sam.gov/missing.pdf'},'BROWSER_DOWNLOAD_MISSING');
  await writeFile(join(root,'outside.pdf'),'%PDF-1.4\n');await symlink(join(root,'outside.pdf'),join(output,'link.pdf'));await refuse({filename:'link.pdf',url:'https://sam.gov/link.pdf'},'BROWSER_DOWNLOAD_PATH');
  assert.equal(r.ingested.length,0);
  await put('two.pdf','%PDF-1.4\n');await cap.downloads.accept({filename:'ok.pdf',url:'https://sam.gov/ok.pdf'});await cap.downloads.accept({filename:'two.pdf',url:'https://sam.gov/two.pdf'});
  await put('three.pdf','%PDF-1.4\n');await refuse({filename:'three.pdf',url:'https://sam.gov/three.pdf'},'BROWSER_DOWNLOAD_LIMIT');
  const liar=createBrowserCapability({binding,cwd,policy:enabledPolicy(),artifacts:{async ingest(x){return {versionId:'v',sha256:'0'.repeat(64),bytes:x.bytes.length};}},receipts:recorders().receiptPort,now:clock});
  await assert.rejects(liar.downloads.accept({filename:'three.pdf',url:'https://sam.gov/three.pdf'}),e=>e.code==='BROWSER_DOWNLOAD_INGEST');
  const off=createBrowserCapability({binding,cwd,policy:enabledPolicy({downloads:{enabled:false,formats:['pdf'],maxBytes:1024,maxFiles:1}}),receipts:recorders().receiptPort,now:clock});
  await assert.rejects(off.downloads.accept({filename:'three.pdf',url:'https://sam.gov/three.pdf'}),e=>e.code==='BROWSER_DOWNLOADS_DISABLED');
 }finally{await rm(root,{recursive:true,force:true});}
});
