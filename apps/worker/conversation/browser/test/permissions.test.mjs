import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_BROWSER_POLICY,INTERACTION_TOOLS,BROWSER_TOOLS,validateBrowserPolicy} from '../policy.mjs';
import {binding,enabledPolicy,recorders,openFragment,APPROVED,clock,approvalReceipt,runHooks,pageResponse,startFrom} from './fixtures.mjs';
import {APPROVAL_DEADLINE_MS,APPROVAL_REQUEST_SCHEMA} from '../permissions.mjs';
import {APPROVAL_SUBJECT_SCHEMA} from '../approval-binding.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
const cwd=`/workspace/${binding.conversationId}`,T=t=>`mcp__meri_browser__${t}`,PAGE=`${APPROVED[0]}/form`;
/** The allowed call ran and reported `page`: closes it in the page tracker. */
const finish=(cap,tool,id,page=PAGE)=>runHooks(cap,'PostToolUse',tool,{},id,{tool_response:pageResponse(page)});
const interactive=(over={})=>enabledPolicy({tools:BROWSER_TOOLS,...over});
const pre=(tool,input={},id='toolu_01')=>({hook_event_name:'PreToolUse',session_id:'00000000-0000-4000-8000-0000000000aa',transcript_path:'/x',cwd:'/x',tool_name:T(tool),tool_input:input,tool_use_id:id});
const decisionOf=out=>out?.hookSpecificOutput?.permissionDecision??'none';
/** Scripted model of the SDK's documented permission order (sdk.d.ts 0.3.295): disallowed tools are unavailable;
 * PreToolUse hooks run first and a `deny` ends the call; an `ask`, or a tool that no `allowedTools` entry pre-approves,
 * goes to `canUseTool`, whose `deny` ends the call; only then does the tool execute and PostToolUse hooks run with a
 * response that reports the page. It is evidence about this fragment's decisions under that order, not live SDK
 * delivery. */
function scriptedSdk(cap,{extraAllowed=[]}={}){
 const executed=[];let page='about:blank',sequence=0;
 async function call(tool,input,id=`toolu_auto_${++sequence}`){
  const name=T(tool);
  if(cap.disallowedTools.includes(name))return 'unavailable';
  let askRequired=false;
  for(const m of cap.hooks.PreToolUse)for(const hook of m.hooks){const d=decisionOf(await hook(pre(tool,input,id),id,{signal:new AbortController().signal}));if(d==='deny')return 'denied-by-hook';if(d==='ask')askRequired=true;}
  if(askRequired||![...cap.allowedTools,...extraAllowed].includes(name)){const r=await cap.canUseTool(name,input,{signal:new AbortController().signal,toolUseID:id,requestId:'req-1'});if(r?.behavior!=='allow')return 'denied-by-permission';}
  executed.push({tool,input});if(tool==='browser_navigate')page=input.url;
  await runHooks(cap,'PostToolUse',tool,input,id,{tool_response:pageResponse(page)});
  return 'executed';
 }
 return {call,executed};
}
test('a denied interaction never executes; an approved one executes once, after a request bound to the page it acts on',async()=>{
 const denying=recorders(),{cap:denyCap}=openFragment({cwd,policy:interactive(),r:denying,approvals:denying.approvals('deny')}),sdk=scriptedSdk(denyCap,{extraAllowed:INTERACTION_TOOLS.map(T)});
 assert.equal(await sdk.call('browser_navigate',{url:PAGE},'toolu_00'),'executed');
 for(const [i,tool] of INTERACTION_TOOLS.entries())assert.equal(await sdk.call(tool,{element:'Submit',target:'e1',text:'x'},`toolu_1${i}`),'denied-by-permission',tool);
 assert.deepEqual(sdk.executed.map(e=>e.tool),['browser_navigate'],'no interaction ran even though another rule pre-approved it: the PreToolUse ask forced the decision');
 assert.equal(denying.approvalRequests.length,INTERACTION_TOOLS.length,'a refused call restores the page, so every later interaction is still bound to it');
 const noPort=scriptedSdk(openFragment({cwd,policy:interactive()}).cap);
 await noPort.call('browser_navigate',{url:PAGE},'toolu_00');
 assert.equal(await noPort.call('browser_click',{element:'Buy',target:'e2'}),'denied-by-permission');assert.equal(noPort.executed.length,1);
 const approving=recorders(),ok=scriptedSdk(openFragment({cwd,policy:interactive(),r:approving,approvals:approving.approvals('approve')}).cap);
 await ok.call('browser_navigate',{url:PAGE},'toolu_08');
 assert.equal(await ok.call('browser_click',{element:'Next page',target:'e3'},'toolu_09'),'executed');assert.equal(ok.executed.length,2);
 const [request]=approving.approvalRequests,policySha256=canonicalSha256(validateBrowserPolicy(interactive()));
 const subject={schema:APPROVAL_SUBJECT_SCHEMA,binding,server:'meri_browser',tool:'browser_click',toolUseId:'toolu_09',inputSha256:canonicalSha256({element:'Next page',target:'e3'}),pageOrigin:APPROVED[0],policySha256};
 assert.deepEqual(request,{schema:APPROVAL_REQUEST_SCHEMA,subject,subjectSha256:canonicalSha256(subject),input:{element:'Next page',target:'e3'},requestedAtMs:clock(),expiresAtMs:clock()+APPROVAL_DEADLINE_MS.default});
 assert.equal(APPROVAL_REQUEST_SCHEMA,'meri-browser-approval-request/3');
});
test('navigations outside the allowlist or the platform limits are denied before execution; the default allowlist opens nothing external',async()=>{
 const sdk=scriptedSdk(openFragment({cwd,policy:enabledPolicy({tools:['browser_navigate','browser_tabs','browser_snapshot']})}).cap);
 for(const url of ['http://169.254.169.254/latest/meta-data/','http://localhost:8080/','http://[::1]/','http://10.0.0.1/','file:///etc/passwd','javascript:alert(1)','data:text/html,x','https://u:p@records.example/','https://archive.example/','https://unlisted.example/'])
  assert.equal(await sdk.call('browser_navigate',{url}),'denied-by-hook',url);
 assert.equal(await sdk.call('browser_tabs',{action:'new',url:'http://127.0.0.1/'}),'denied-by-hook');
 assert.equal(await sdk.call('browser_navigate',{url:`${APPROVED[0]}/notice/1`}),'executed');assert.equal(await sdk.call('browser_tabs',{action:'new'}),'executed');assert.equal(await sdk.call('browser_navigate',{url:'about:blank'}),'executed');
 assert.equal(sdk.executed.length,3);
 const empty=scriptedSdk(openFragment({cwd,policy:DEFAULT_BROWSER_POLICY}).cap);
 assert.equal(await empty.call('browser_navigate',{url:`${APPROVED[0]}/`}),'denied-by-hook');assert.equal(await empty.call('browser_snapshot',{}),'executed');
});
test('unadmitted and excluded tools are unavailable or denied before execution',async()=>{
 const {cap}=openFragment({cwd}),sdk=scriptedSdk(cap);
 for(const tool of ['browser_evaluate','browser_run_code_unsafe','browser_file_upload','browser_type'])assert.equal(await sdk.call(tool,{}),'unavailable',tool);
 const hook=cap.hooks.PreToolUse[0].hooks[0];
 assert.equal(decisionOf(await hook(pre('browser_evaluate'),'toolu_01',{})),'deny');assert.equal(decisionOf(await hook(pre('browser_set_storage_state'),'toolu_01',{})),'deny');
 assert.equal((await cap.canUseTool(T('browser_evaluate'),{},{toolUseID:'toolu_01'})).behavior,'deny');
 assert.deepEqual(sdk.executed,[]);
});
test('the PreToolUse gate fails closed on malformed input and the canUseTool gate only answers for this server',async()=>{
 const r=recorders(),{cap}=openFragment({cwd,policy:interactive(),r,approvals:r.approvals('approve')}),hook=cap.hooks.PreToolUse[0].hooks[0];
 const aborted=new AbortController();aborted.abort();
 for(const [input,id,opts] of [[{...pre('browser_snapshot'),hook_event_name:'PostToolUse'},'toolu_01',{}],[pre('browser_snapshot'),'toolu_other',{}],[{...pre('browser_snapshot'),tool_name:'mcp__other__browser_snapshot'},'toolu_01',{}],[pre('browser_snapshot'),'toolu_01',{signal:aborted.signal}],[null,'toolu_01',{}],[pre('browser_navigate',{url:42}),'toolu_01',{}]])
  assert.equal(decisionOf(await hook(input,id,opts)),'deny');
 assert.equal(decisionOf(await hook(pre('browser_click',{element:'x',target:'e1'}),'toolu_01',{})),'ask');assert.equal(decisionOf(await hook(pre('browser_snapshot',{},'toolu_02'),'toolu_02',{})),'deny','a competing call invalidates the pending interaction');
 for(const [tool,id] of [['browser_click','toolu_01'],['browser_snapshot','toolu_02']])await runHooks(cap,'PostToolUseFailure',tool,{},id);
 assert.equal(await cap.canUseTool('Read',{file_path:'/x'},{toolUseID:'toolu_01'}),undefined,'not this server: defers to the chain (default deny)');
 const ask=async(id,over={})=>{await startFrom(cap,PAGE,'browser_click',{element:'x',target:'e1'},id);return cap.canUseTool(T('browser_click'),{element:'x',target:'e1'},{toolUseID:id,signal:new AbortController().signal,...over});};
 assert.equal((await ask('toolu_05')).behavior,'allow');await finish(cap,'browser_click','toolu_05');assert.equal((await ask('toolu_06',{mcpServer:{name:'other',source:'user'}})).message,'BROWSER_SERVER_MISMATCH');
 assert.equal((await cap.canUseTool(T('browser_click'),{},{signal:new AbortController().signal})).message,'BROWSER_APPROVAL_UNAVAILABLE');assert.equal((await ask('toolu_07',{signal:aborted.signal})).message,'BROWSER_APPROVAL_UNAVAILABLE');
 const throwing=openFragment({cwd,policy:interactive(),approvals:{async decide(){throw new Error('ui down');}}}).cap;
 await startFrom(throwing,PAGE,'browser_click',{},'toolu_05');
 assert.equal((await throwing.canUseTool(T('browser_click'),{},{toolUseID:'toolu_05'})).message,'BROWSER_APPROVAL_UNAVAILABLE');
 await startFrom(cap,PAGE,'browser_type',{text:'x'},'toolu_08');
 assert.equal((await cap.canUseTool(T('browser_type'),{text:'x'.repeat(20000)},{toolUseID:'toolu_08'})).message,'BROWSER_APPROVAL_INPUT_LIMIT');
 assert.equal((await openFragment({cwd,policy:enabledPolicy({tools:['browser_navigate']})}).cap.canUseTool(T('browser_navigate'),{url:'https://unlisted.example/'},{toolUseID:'toolu_09'})).message,'BROWSER_ORIGIN_NOT_ALLOWED');
});
const click={element:'Submit',target:'e1'};
/** Port that never answers on its own; `answer(value)` settles it later. Records the signal it was given. */
function pendingPort(){
 let settle;const seen={};
 return {seen,answer:v=>settle(v),approvals:{decide(request,{signal}){seen.request=request;seen.signal=signal;return new Promise(r=>{settle=r;});}}};
}
const settledWithin=async(promise,flush=3)=>{let done=false;promise.then(()=>{done=true;},()=>{done=true;});for(let i=0;i<flush;i++)await new Promise(r=>setImmediate(r));return done;};
test('H5: a non-responsive approval port is completed by abort: the call denies at once and a late approval is ignored',async()=>{
 const port=pendingPort(),{cap}=openFragment({cwd,policy:interactive(),approvals:port.approvals}),run=new AbortController();
 await startFrom(cap,PAGE,'browser_click',click,'toolu_20');
 const decision=cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_20',signal:run.signal});
 assert.equal(await settledWithin(decision),false,'still waiting for a decision');
 run.abort();
 assert.deepEqual(await decision,{behavior:'deny',message:'BROWSER_APPROVAL_UNAVAILABLE',toolUseID:'toolu_20'});
 assert.equal(port.seen.signal.aborted,true,'the port is told to stop presenting the request');
 port.answer(approvalReceipt(port.seen.request));
 assert.deepEqual(await decision,{behavior:'deny',message:'BROWSER_APPROVAL_UNAVAILABLE',toolUseID:'toolu_20'},'late approve after abort is still denied');
});
test('H5: a non-responsive approval port is completed by the bounded deadline, and a late approval is ignored',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const port=pendingPort(),{cap}=openFragment({cwd,policy:interactive(),approvals:port.approvals,approvalDeadlineMs:APPROVAL_DEADLINE_MS.min});
 await startFrom(cap,PAGE,'browser_click',click,'toolu_21');
 const decision=cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_21',signal:new AbortController().signal});
 assert.equal(await settledWithin(decision),false);assert.equal(port.seen.request.expiresAtMs,clock()+APPROVAL_DEADLINE_MS.min);
 t.mock.timers.tick(APPROVAL_DEADLINE_MS.min-1);assert.equal(await settledWithin(decision),false,'not expired one millisecond early');
 t.mock.timers.tick(1);
 assert.deepEqual(await decision,{behavior:'deny',message:'BROWSER_APPROVAL_EXPIRED',toolUseID:'toolu_21'});
 assert.equal(port.seen.signal.aborted,true);
 port.answer(approvalReceipt(port.seen.request));
 assert.equal((await decision).behavior,'deny','late approve after expiry is still denied');
 const def=pendingPort(),{cap:defaultCap}=openFragment({cwd,policy:interactive(),approvals:def.approvals});
 await startFrom(defaultCap,PAGE,'browser_click',click,'toolu_22');
 const pending=defaultCap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_22'});
 await settledWithin(pending);
 t.mock.timers.tick(APPROVAL_DEADLINE_MS.default-1);assert.equal(await settledWithin(pending),false);t.mock.timers.tick(1);
 assert.equal((await pending).message,'BROWSER_APPROVAL_EXPIRED','the default deadline applies without a run signal');
 for(const approvalDeadlineMs of [0,APPROVAL_DEADLINE_MS.min-1,APPROVAL_DEADLINE_MS.max+1,1.5,'1000'])
  assert.throws(()=>openFragment({cwd,policy:interactive(),approvalDeadlineMs}),e=>e.code==='BROWSER_CONFIGURATION',String(approvalDeadlineMs));
});
test('an approval binds the canonical digest of the exact input that runs; a receipt for any other subject denies',async()=>{
 const r=recorders(),{cap}=openFragment({cwd,policy:interactive(),r,approvals:r.approvals('approve')});
 const typed={element:'Search',target:'e4',text:'synthetic'};
 await startFrom(cap,PAGE,'browser_type',typed,'toolu_30');
 const allowed=await cap.canUseTool(T('browser_type'),typed,{toolUseID:'toolu_30'});
 assert.equal(allowed.behavior,'allow');assert.deepEqual(allowed.updatedInput,typed);
 assert.equal(r.approvalRequests[0].subject.inputSha256,canonicalSha256({target:'e4',text:'synthetic',element:'Search'}),'canonical: key order does not matter');
 // The owner approved the first input's subject; the second call, same tool-use id, different input, gets that receipt.
 let first;const replaying={async decide(request){first??=request;return approvalReceipt(first);}};
 const {cap:replay}=openFragment({cwd,policy:interactive(),approvals:replaying});
 await startFrom(replay,PAGE,'browser_type',{...typed,text:'first'},'toolu_31');
 assert.equal((await replay.canUseTool(T('browser_type'),{...typed,text:'first'},{toolUseID:'toolu_31'})).behavior,'allow');await finish(replay,'browser_type','toolu_31');
 await startFrom(replay,PAGE,'browser_type',{...typed,text:'second'},'toolu_32');
 assert.equal((await replay.canUseTool(T('browser_type'),{...typed,text:'second'},{toolUseID:'toolu_32'})).message,'BROWSER_APPROVAL_MISMATCH','an approval for other input does not authorize this one');
 const mutating={async decide(request){const receipt=approvalReceipt(request);request.input.text='changed';request.subject.inputSha256='0'.repeat(64);return receipt;}};
 const {cap:m}=openFragment({cwd,policy:interactive(),approvals:mutating});
 await startFrom(m,PAGE,'browser_type',typed,'toolu_33');
 assert.deepEqual((await m.canUseTool(T('browser_type'),typed,{toolUseID:'toolu_33'})).updatedInput,typed,'the port cannot change what runs');
 const rewriting={async decide(request){const other={...request.subject,pageOrigin:APPROVED[1]};const receipt=approvalReceipt({...request,subject:other,subjectSha256:canonicalSha256(other)});
  request.subject=other;request.subjectSha256=receipt.subjectSha256;return receipt;}};
 const {cap:w}=openFragment({cwd,policy:interactive(),approvals:rewriting});
 await startFrom(w,PAGE,'browser_type',typed,'toolu_34');
 assert.equal((await w.canUseTool(T('browser_type'),typed,{toolUseID:'toolu_34'})).message,'BROWSER_APPROVAL_MISMATCH','the port cannot rewrite the subject it is checked against');
});
/** One interaction against a port answering with `make(request)`; returns the canUseTool decision. */
async function decideWith(make,{id='toolu_40',page=PAGE,policy=interactive()}={}){
 const {cap}=openFragment({cwd,policy,approvals:{async decide(request){return make(request);}}});
 await startFrom(cap,page,'browser_click',click,id);
 return cap.canUseTool(T('browser_click'),click,{toolUseID:id});
}
test('canonical approval correlation: rejected, wrong subject, wrong proposal/tool-use, other tenant, stale, expired and unconsumed receipts deny',async()=>{
 const later=new Date(clock()+1).toISOString(),earlier=new Date(clock()-1).toISOString();
 const cases={
  BROWSER_APPROVAL_DENIED:[r=>approvalReceipt(r,{decision:'rejected'}),r=>({decision:'approve',toolUseId:r.subject.toolUseId,inputDigest:r.subject.inputSha256}),()=>null,r=>approvalReceipt(r,{receipt:{schema:'meri-browser-approval-receipt/0'}}),r=>approvalReceipt(r,{decisionFields:{approver:{tenantId:binding.tenantId}}})],
  BROWSER_APPROVAL_MISMATCH:[r=>approvalReceipt(r,{receipt:{subjectSha256:'0'.repeat(64)}}),r=>approvalReceipt(r,{decisionFields:{commandSha256:'0'.repeat(64)}}),r=>approvalReceipt(r,{receipt:{toolUseId:'toolu_other'}}),r=>approvalReceipt(r,{receipt:{proposalId:'00000031-b0a1-4000-8000-ffffffffffff'}}),r=>approvalReceipt(r,{approver:{tenantId:'tenant-other',actorId:'approver-synthetic'}})],
  BROWSER_APPROVAL_EXPIRED:[r=>approvalReceipt(r,{decisionFields:{decidedAt:earlier}}),r=>approvalReceipt(r,{decisionFields:{decidedAt:later}}),r=>approvalReceipt(r,{decisionFields:{expiresAt:new Date(clock()).toISOString()}})],
  BROWSER_APPROVAL_UNCONSUMED:[r=>approvalReceipt(r,{receipt:{consumption:undefined}}),r=>approvalReceipt(r,{receipt:{consumption:{consumed:false,consumptionId:'00000032-b0a1-4000-8000-000000000001',consumedAtMs:clock()}}}),r=>approvalReceipt(r,{receipt:{consumption:{consumed:true,consumptionId:'not-a-uuid',consumedAtMs:clock()}}}),r=>approvalReceipt(r,{receipt:{consumption:{consumed:true,consumptionId:'00000032-b0a1-4000-8000-000000000002',consumedAtMs:clock()+1}}})]};
 for(const [code,makers] of Object.entries(cases))for(const [i,make] of makers.entries())assert.equal((await decideWith(make)).message,code,`${code} #${i}`);
 assert.equal((await decideWith(r=>approvalReceipt(r))).behavior,'allow','the unmodified receipt allows');
});
test('replay: one canonical proposal, consumption or tool-use authorizes at most one execution in the run',async()=>{
 let kept;const {cap}=openFragment({cwd,policy:interactive(),approvals:{async decide(request){const fresh=approvalReceipt(request);if(!kept){kept=fresh;return fresh;}return {...fresh,proposalId:kept.proposalId,decision:{...fresh.decision,proposalId:kept.proposalId}};}}});
 await startFrom(cap,PAGE,'browser_click',click,'toolu_50');assert.equal((await cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_50'})).behavior,'allow');await finish(cap,'browser_click','toolu_50');
 await startFrom(cap,PAGE,'browser_click',click,'toolu_51');assert.equal((await cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_51'})).message,'BROWSER_APPROVAL_REPLAY','reused proposal');
 const sameConsumption=openFragment({cwd,policy:interactive(),approvals:{async decide(request){const fresh=approvalReceipt(request);return {...fresh,consumption:{...fresh.consumption,consumptionId:'00000032-b0a1-4000-8000-00000000abcd'}};}}}).cap;
 await startFrom(sameConsumption,PAGE,'browser_click',click,'toolu_52');assert.equal((await sameConsumption.canUseTool(T('browser_click'),click,{toolUseID:'toolu_52'})).behavior,'allow');await finish(sameConsumption,'browser_click','toolu_52');
 await startFrom(sameConsumption,PAGE,'browser_click',click,'toolu_53');assert.equal((await sameConsumption.canUseTool(T('browser_click'),click,{toolUseID:'toolu_53'})).message,'BROWSER_APPROVAL_REPLAY','reused consumption');
 const r=recorders(),again=openFragment({cwd,policy:interactive(),r,approvals:r.approvals('approve')}).cap;
 await startFrom(again,PAGE,'browser_click',click,'toolu_54');assert.equal((await again.canUseTool(T('browser_click'),click,{toolUseID:'toolu_54'})).behavior,'allow');
 assert.equal((await again.canUseTool(T('browser_click'),click,{toolUseID:'toolu_54'})).message,'BROWSER_APPROVAL_REPLAY','a fresh owner approval for the same tool-use cannot authorize it twice');
});
test('page binding: an interaction needs a known, allowlisted starting page; unknown, overlapping, failed and narrowed pages deny',async()=>{
 const r=recorders(),{cap}=openFragment({cwd,policy:interactive(),r,approvals:r.approvals('approve')});
 await runHooks(cap,'PreToolUse','browser_click',click,'toolu_60');
 assert.equal((await cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_60'})).message,'BROWSER_APPROVAL_PAGE_UNKNOWN','nothing observed yet');
 await startFrom(cap,PAGE,'browser_snapshot',{},'toolu_61');await runHooks(cap,'PreToolUse','browser_click',click,'toolu_62');
 assert.equal((await cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_62'})).message,'BROWSER_APPROVAL_PAGE_UNKNOWN','another call in flight: page unknown');
 await runHooks(cap,'PostToolUseFailure','browser_snapshot',{},'toolu_61');
 await runHooks(cap,'PreToolUse','browser_click',click,'toolu_63');
 assert.equal((await cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_63'})).message,'BROWSER_APPROVAL_PAGE_UNKNOWN','a failed call leaves the page unknown');
 await runHooks(cap,'PreToolUse','browser_navigate',{url:PAGE},'toolu_64a');await runHooks(cap,'PostToolUse','browser_navigate',{url:PAGE},'toolu_64a',{tool_response:pageResponse(PAGE)});
 await runHooks(cap,'PreToolUse','browser_navigate',{url:PAGE},'toolu_64');await runHooks(cap,'PostToolUseFailure','browser_navigate',{url:PAGE},'toolu_64');
 await runHooks(cap,'PreToolUse','browser_click',click,'toolu_65');
 assert.equal((await cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_65'})).message,'BROWSER_APPROVAL_PAGE_UNKNOWN','a failed navigation leaves the page unknown');
 await startFrom(cap,PAGE,'browser_click',click,'toolu_66');
 assert.equal((await cap.canUseTool(T('browser_click'),click,{toolUseID:'toolu_66'})).behavior,'allow');
 assert.equal(r.approvalRequests.at(-1).subject.pageOrigin,APPROVED[0]);
 // The page reports an origin the effective policy does not admit (e.g. reached before a narrowing or by a scripted
 // redirect the egress control later refused): no approval is requested for it.
 const narrowed=recorders(),{cap:n}=openFragment({cwd,policy:interactive(),r:narrowed,approvals:narrowed.approvals('approve')});
 await runHooks(n,'PreToolUse','browser_snapshot',{},'toolu_70');await runHooks(n,'PostToolUse','browser_snapshot',{},'toolu_70',{tool_response:pageResponse('https://unlisted.example/after-redirect')});
 await runHooks(n,'PreToolUse','browser_click',click,'toolu_71');
 assert.equal((await n.canUseTool(T('browser_click'),click,{toolUseID:'toolu_71'})).message,'BROWSER_ORIGIN_NOT_ALLOWED');
 await runHooks(n,'PreToolUse','browser_snapshot',{},'toolu_72');await runHooks(n,'PostToolUse','browser_snapshot',{},'toolu_72',{tool_response:pageResponse('about:blank')});
 await runHooks(n,'PreToolUse','browser_click',click,'toolu_73');
 assert.equal((await n.canUseTool(T('browser_click'),click,{toolUseID:'toolu_73'})).message,'BROWSER_APPROVAL_PAGE_UNKNOWN','about:blank has no origin to approve');
 assert.equal(narrowed.approvalRequests.length,0);
});
