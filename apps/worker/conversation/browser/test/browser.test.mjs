import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,symlink,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createBrowserCapability} from '../index.mjs';
import {DEFAULT_BROWSER_POLICY,INTERACTION_TOOLS,BROWSER_TOOLS} from '../policy.mjs';
import {BROWSER_ACTIVATION,EGRESS_REQUIREMENTS,activationOpen} from '../activation.mjs';
import {PLATFORM_BLOCKED_ORIGINS} from '../public-web.mjs';
import {NO_DESTINATION_ORIGIN} from '../server.mjs';
import {buildOpenBrowserFragment} from '../fragment.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
import {outputReference} from '../receipts.mjs';
import {binding,enabledPolicy,recorders,clock,installation,sourceScopes,openFragment,APPROVED} from './fixtures.mjs';
const cwd=`/workspace/${binding.conversationId}`;
const workspace=async()=>{const root=await realpath(await mkdtemp(join(tmpdir(),'meri-browser-')));const dir=join(root,binding.conversationId);await mkdir(join(dir,'.browser','output'),{recursive:true});return {root,cwd:dir};};
const post=(tool,{input={},response=[{type:'text',text:'### Result\nok'}],id='toolu_01'}={})=>({hook_event_name:'PostToolUse',session_id:'00000000-0000-4000-8000-0000000000aa',transcript_path:'/x',cwd:'/x',tool_name:`mcp__meri_browser__${tool}`,tool_input:input,tool_response:response,tool_use_id:id});
test('the capability is on by default with no destinations; the held activation gate contributes no server, tool, hook or download path',async()=>{
 assert.equal(DEFAULT_BROWSER_POLICY.enabled,true);assert.deepEqual(DEFAULT_BROWSER_POLICY.allowedOrigins,[]);
 const r=recorders();
 for(const policy of [undefined,DEFAULT_BROWSER_POLICY,{enabled:true},enabledPolicy()]){
  const cap=createBrowserCapability({binding,cwd,policy,installation,sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,approvals:r.approvals('approve'),now:clock});
  assert.equal(cap.enabled,false);assert.equal(cap.activation,'held');assert.equal(cap.reason,'BROWSER_EGRESS_UNQUALIFIED');assert.equal(cap.policy.enabled,true);
  assert.equal(cap.status.capability,'enabled');assert.equal(cap.status.activation,'held');
  assert.deepEqual(cap.mcpServers,{});assert.deepEqual(cap.allowedTools,[]);assert.deepEqual(cap.hooks,{});assert.equal(cap.canUseTool,undefined);
  await assert.rejects(cap.downloads.accept({filename:'a.pdf',url:`${APPROVED[0]}/a.pdf`}),e=>e.code==='BROWSER_ACTIVATION_HELD');}
 const def=createBrowserCapability({binding,cwd,now:clock});
 assert.deepEqual(def.policy.allowedOrigins,[]);assert.deepEqual(def.status,{capability:'enabled',destinations:'none',allowedOriginCount:0,notice:'BROWSER_NO_ALLOWED_DESTINATIONS',activation:'held'});
 assert.deepEqual(createBrowserCapability({binding,cwd,policy:enabledPolicy(),now:clock}).status,{capability:'enabled',destinations:'allowlisted',allowedOriginCount:2,activation:'held'});
 assert.equal(r.receipts.length+r.ingested.length+r.approvalRequests.length,0);
});
test('a tenant-disabled policy contributes nothing; a partial disabled shape refuses',async()=>{
 const cap=createBrowserCapability({binding,cwd,policy:{enabled:false},now:clock});
 assert.equal(cap.enabled,false);assert.equal(cap.activation,'not-applicable');assert.deepEqual(cap.mcpServers,{});assert.equal(cap.status.capability,'disabled');
 await assert.rejects(cap.downloads.accept({filename:'a.pdf',url:'https://records.example/a.pdf'}),/BROWSER_DOWNLOADS_DISABLED/);
 assert.throws(()=>createBrowserCapability({binding,cwd,policy:{enabled:false,tools:['browser_navigate']},now:clock}),/BROWSER_POLICY/);
});
test('the shipped activation record is held and only an evidence-bearing open record of the exact requirements opens',()=>{
 assert.equal(BROWSER_ACTIVATION.state,'held');assert.equal(BROWSER_ACTIVATION.evidence,null);assert.equal(activationOpen(),false);assert.equal(activationOpen(BROWSER_ACTIVATION),false);
 assert.ok(Object.isFrozen(BROWSER_ACTIVATION)&&Object.isFrozen(EGRESS_REQUIREMENTS));
 for(const id of ['deny-non-public-destinations','enforce-on-resolved-address','dns-rebinding','redirects','no-proxy-bypass','evidence'])assert.ok(EGRESS_REQUIREMENTS.some(r=>r.startsWith(`${id}:`)),id);
 for(const range of ['169.254','10/8','172.16/12','192.168/16','127/8','fc00::/7','fe80::/10','2000::/3'])assert.ok(EGRESS_REQUIREMENTS[0].includes(range),range);
 assert.equal(activationOpen({state:'open',evidence:null,requirements:EGRESS_REQUIREMENTS}),false);
 assert.equal(activationOpen({state:'open',evidence:'docs/x',requirements:[...EGRESS_REQUIREMENTS]}),false);
 assert.equal(activationOpen({state:'open',evidence:'docs/qualification/egress-record',requirements:EGRESS_REQUIREMENTS}),true);
 assert.equal(createBrowserCapability.length,1,'no activation argument');
});
test('the scripted Playwright MCP config pins the sandbox, per-conversation profile, the egress proxy, the destination allowlist and platform blocked origins',()=>{
 const r=recorders(),open=policy=>buildOpenBrowserFragment({binding,cwd,policy:validateBrowserPolicy(policy),installation,sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,now:clock});
 const def=open(DEFAULT_BROWSER_POLICY).mcpServers.meri_browser.args;
 assert.equal(def[def.indexOf('--allowed-origins')+1],NO_DESTINATION_ORIGIN,'an empty allowlist must not become upstream allow-all');assert.equal(def[def.indexOf('--blocked-origins')+1],PLATFORM_BLOCKED_ORIGINS.join(';'));
 for(const entry of ['localhost','http://localhost:*','169.254.169.254','http://169.254.169.254:*','https://169.254.170.2:*','metadata.google.internal','http://[::1]','http://[fd00:ec2::254]'])assert.ok(PLATFORM_BLOCKED_ORIGINS.includes(entry),entry);
 const cap=open(enabledPolicy()),server=cap.mcpServers.meri_browser,args=server.args;
 assert.deepEqual(Object.keys(cap.mcpServers),['meri_browser']);assert.equal(server.type,'stdio');assert.equal(server.command,'/opt/scripted/node');
 assert.equal(args[0],'/opt/scripted/@playwright/mcp/cli.js');for(const flag of ['--sandbox','--headless','--no-webmcp','--block-service-workers'])assert.ok(args.includes(flag),flag);
 assert.equal(args[args.indexOf('--user-data-dir')+1],`${cwd}/.browser/profile`);assert.equal(args[args.indexOf('--output-dir')+1],`${cwd}/.browser/output`);
 assert.equal(args[args.indexOf('--allowed-origins')+1],'https://records.example;https://notices.example');
 assert.equal(args[args.indexOf('--proxy-server')+1],installation.egressProxy,'every browser request goes to the host egress control');
 assert.ok(!args.some(a=>a.startsWith('--proxy-bypass')),'no bypass: Playwright then proxies loopback too');
 assert.ok(!Object.keys(server.env).some(k=>k.startsWith('PLAYWRIGHT_DISABLE')),'forced loopback proxying is not disabled');
 assert.equal(args[args.indexOf('--blocked-origins')+1],PLATFORM_BLOCKED_ORIGINS.join(';'));assert.equal(args.filter(a=>a==='--allowed-origins').length,1);
 for(const flag of ['--no-sandbox','--storage-state','--secrets','--extension','--cdp-endpoint','--save-session','--caps','--allow-unrestricted-file-access','--shared-browser-context','--config','--init-script'])assert.ok(!args.some(a=>a===flag||a.startsWith(`${flag}=`)),flag);
 assert.deepEqual(server.env,{PLAYWRIGHT_BROWSERS_PATH:'/opt/scripted/browsers',HOME:`${cwd}/.browser/home`});
 const other=buildOpenBrowserFragment({binding:{...binding,conversationId:'00000021-b0a1-4000-8000-000000000000'},cwd:'/workspace/00000021-b0a1-4000-8000-000000000000',policy:validateBrowserPolicy(enabledPolicy()),installation,sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,now:clock}).mcpServers.meri_browser.args;
 assert.notEqual(other[other.indexOf('--user-data-dir')+1],args[args.indexOf('--user-data-dir')+1]);
});
test('interaction tools are never pre-approved; unadmitted exposed tools are removed from the model context; both permission hooks are installed',()=>{
 const {cap}=openFragment({cwd,policy:DEFAULT_BROWSER_POLICY});
 for(const t of INTERACTION_TOOLS)assert.ok(!cap.allowedTools.includes(`mcp__meri_browser__${t}`),t);
 assert.deepEqual(cap.allowedTools,BROWSER_TOOLS.filter(t=>!INTERACTION_TOOLS.includes(t)).map(t=>`mcp__meri_browser__${t}`));
 for(const t of ['browser_evaluate','browser_run_code_unsafe','browser_file_upload','browser_network_requests','browser_drag'])assert.ok(cap.disallowedTools.includes(`mcp__meri_browser__${t}`),t);
 assert.equal(typeof cap.canUseTool,'function');assert.deepEqual(Object.keys(cap.hooks),['PreToolUse','PostToolUse','PostToolUseFailure']);
 for(const event of ['PreToolUse','PostToolUse','PostToolUseFailure'])assert.equal(cap.hooks[event][0].matcher,'mcp__meri_browser__.*');
 const narrow=openFragment({cwd}).cap;assert.deepEqual(narrow.allowedTools,['mcp__meri_browser__browser_navigate','mcp__meri_browser__browser_snapshot','mcp__meri_browser__browser_take_screenshot']);
 assert.ok(narrow.disallowedTools.includes('mcp__meri_browser__browser_type'));assert.ok(!narrow.disallowedTools.includes('mcp__meri_browser__browser_click'));
});
test('configuration refuses a workspace that is not this conversation, missing ports or facts and an invalid binding',()=>{
 const r=recorders(),base={binding,policy:enabledPolicy(),installation,sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,now:clock};
 for(const dir of ['relative/'+binding.conversationId,'/workspace/other',`/workspace/../${binding.conversationId}`])assert.throws(()=>createBrowserCapability({...base,cwd:dir}),/BROWSER_CONFIGURATION/);
 assert.throws(()=>createBrowserCapability({...base,cwd,binding:{...binding,writerFence:'1'}}),/BROWSER_CONFIGURATION/);assert.throws(()=>createBrowserCapability({...base,cwd,now:1}),/BROWSER_CONFIGURATION/);
 const open=over=>buildOpenBrowserFragment({...base,cwd,policy:validateBrowserPolicy(enabledPolicy()),...over});
 assert.throws(()=>open({receipts:undefined}),/BROWSER_CONFIGURATION/);assert.throws(()=>open({artifacts:{}}),/BROWSER_CONFIGURATION/);
 assert.throws(()=>open({installation:{...installation,version:'0.0.84'}}),/BROWSER_CONFIGURATION/);assert.throws(()=>open({installation:{...installation,cliPath:'cli.js'}}),/BROWSER_CONFIGURATION/);
 for(const egressProxy of [undefined,'','http://127.0.0.1','https://127.0.0.1:3128','socks5://127.0.0.1:1080','http://u:p@127.0.0.1:3128','http://127.0.0.1:3128/path','http://127.0.0.1:3128/','http://127.0.0.1:3128?x=1','http://proxy.example:3128','http://169.254.169.254:3128','http://localhost:3128'])
  assert.throws(()=>open({installation:{...installation,egressProxy}}),/BROWSER_CONFIGURATION/,String(egressProxy));
 assert.equal(open({installation:{...installation,egressProxy:'http://[::1]:3128'}}).enabled,true,'a literal IPv6 loopback listener is valid');
 assert.throws(()=>open({sourceScopes:[{...sourceScopes[0],tenantId:'tenant-other'}]}),/BROWSER_CONFIGURATION/);assert.throws(()=>open({sourceScopes:[{tenantId:binding.tenantId,kind:'any',resourceId:'x',policyRevision:'p'}]}),/BROWSER_CONFIGURATION/);
 assert.throws(()=>open({sourceScopes:undefined}),/BROWSER_CONFIGURATION/);
 assert.equal(open({artifacts:undefined,sourceScopes:undefined,policy:validateBrowserPolicy(enabledPolicy({downloads:{enabled:false,formats:['pdf'],maxBytes:1,maxFiles:1}}))}).enabled,true);
});
test('the PostToolUse hook records action, URL host, time and screenshot reference, never page contents',async()=>{
 const {cap,r}=openFragment({cwd}),hook=cap.hooks.PostToolUse[0].hooks[0];
 const page='### Result\nDone\n### Page\n- Page URL: https://records.example/bill/119th-congress/house-bill/1?secret=1\n- Page Title: SECRET-PAGE-TITLE\n### Snapshot\n- heading "SECRET-PAGE-BODY"';
 assert.deepEqual(await hook(post('browser_navigate',{input:{url:'https://records.example/x'},response:[{type:'text',text:page}]}),'toolu_01',{signal:new AbortController().signal}),{});
 assert.deepEqual(await hook(post('browser_take_screenshot',{id:'toolu_02',response:{content:[{type:'text',text:'### Result\nTook the screenshot and saved it as .browser/output/page-2026-10-15.png'},{type:'image',data:'SECRET-IMAGE'}]}}),undefined,{}),{});
 assert.equal(r.receipts.length,2);const [nav,shot]=r.receipts;
 assert.deepEqual(Object.keys(nav).sort(),['action','atMs','binding','kind','outcome','reference','schema','sessionId','toolUseId','urlHost']);
 assert.equal(nav.action,'browser_navigate');assert.equal(nav.urlHost,'records.example');assert.equal(nav.atMs,clock());assert.equal(nav.reference,null);assert.deepEqual(nav.binding,binding);
 assert.equal(shot.action,'browser_take_screenshot');assert.equal(shot.reference,'.browser/output/page-2026-10-15.png');assert.equal(shot.urlHost,null);
 const recorded=JSON.stringify(r.receipts);for(const secret of ['SECRET-PAGE-TITLE','SECRET-PAGE-BODY','SECRET-IMAGE','secret=1','house-bill'])assert.ok(!recorded.includes(secret),secret);
 assert.equal(outputReference('saved /etc/passwd.png and ../../escape.png',{cwd,output:`${cwd}/.browser/output`}),null);
 assert.equal(outputReference(`saved ${cwd}/.browser/output/trace-1.zip`,{cwd,output:`${cwd}/.browser/output`}),'.browser/output/trace-1.zip');
});
test('the PostToolUse hook stops browser work when a receipt cannot be recorded or the call is not an allowed browser tool',async()=>{
 const stop={continue:false,stopReason:'Browser receipt unavailable; browser work stopped.'};
 const failing=openFragment({cwd,receipts:{async record(){throw new Error('store down');}}}).cap.hooks.PostToolUse[0].hooks[0];
 assert.deepEqual(await failing(post('browser_navigate'),'toolu_01',{}),stop);
 const {cap,r}=openFragment({cwd}),hook=cap.hooks.PostToolUse[0].hooks[0];
 assert.deepEqual(await hook(post('browser_evaluate'),'toolu_01',{}),stop);
 assert.deepEqual(await hook({...post('browser_navigate'),tool_name:'mcp__other__browser_navigate'},'toolu_01',{}),stop);
 assert.deepEqual(await hook(post('browser_navigate'),'toolu_other',{}),stop);
 assert.deepEqual(await hook({...post('browser_navigate'),hook_event_name:'PreToolUse'},'toolu_01',{}),stop);
 const aborted=new AbortController();aborted.abort();assert.deepEqual(await hook(post('browser_navigate'),'toolu_01',{signal:aborted.signal}),stop);
 assert.equal(r.receipts.length,0);
 assert.deepEqual(await hook(post('browser_click',{response:{isError:true,content:[{type:'text',text:'### Error\nnot found'}]}}),'toolu_01',{}),{});assert.equal(r.receipts[0].outcome,'error');
});
test('the per-conversation profile holds session state until disposal, which removes it and verifies absence',async()=>{
 const {root,cwd:dir}=await workspace();try{
  const {cap}=openFragment({cwd:dir}),{profile,home,output}=cap.paths;
  await mkdir(join(profile,'Default'),{recursive:true});await writeFile(join(profile,'Default','Cookies'),'synthetic-session-cookie');await mkdir(home,{recursive:true});await writeFile(join(output,'left.pdf'),'%PDF-1.4');
  assert.deepEqual(await cap.dispose(),{disposed:true});
  for(const p of [profile,home,output,cap.paths.root])await assert.rejects(access(p));
  assert.deepEqual(await cap.dispose(),{disposed:true},'idempotent once absent');
  const aborted=new AbortController();aborted.abort();await assert.rejects(cap.dispose({signal:aborted.signal}),e=>e.code==='BROWSER_DISPOSE_CANCELLED');
  await mkdir(join(root,'elsewhere'),{recursive:true});await writeFile(join(root,'elsewhere','keep'),'x');await symlink(join(root,'elsewhere'),cap.paths.root);
  await assert.rejects(cap.dispose(),e=>e.code==='BROWSER_DISPOSE_PATH');await access(join(root,'elsewhere','keep'));
 }finally{await rm(root,{recursive:true,force:true});}
});
