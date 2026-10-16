/** Synthetic SDK-boundary calls and canonical approval receipts; no browser, provider or SDK process. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPageContext} from '../page-context.mjs';
import {createPermissionGate} from '../permissions.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding,enabledPolicy,approvalReceipt,clock,pageResponse,APPROVED} from './fixtures.mjs';
const click={element:'Submit',target:'e1'},name=t=>'mcp__meri_browser__'+t;
function setup(decide=async r=>approvalReceipt(r)){
 const pages=createPageContext(),policy=validateBrowserPolicy(enabledPolicy({tools:['browser_navigate','browser_click','browser_snapshot','browser_tabs']}));
 pages.begin('initial');pages.end('initial',pageResponse(APPROVED[0]+'/form'));
 const gate=createPermissionGate({binding,policy,policySha256:canonicalSha256(policy),server:'meri_browser',pages,now:clock,approvals:{decide}});
 const pre=(tool,id,input={})=>gate.preToolUse({hook_event_name:'PreToolUse',tool_name:name(tool),tool_use_id:id,tool_input:input},id,{});
 const approve=id=>gate.canUseTool(name('browser_click'),click,{toolUseID:id});
 return {pages,gate,pre,approve};
}
test('synthetic: both first and competing interactions are invalid after overlap',async()=>{
 let requests=0;const a=setup(async r=>{requests++;return approvalReceipt(r);});
 await a.pre('browser_click','first',click);
 assert.equal((await a.pre('browser_click','second',click)).hookSpecificOutput.permissionDecision,'deny');
 assert.equal(a.pages.originFor('first'),null);assert.equal(a.pages.originFor('second'),null);
 assert.equal((await a.approve('first')).behavior,'deny');assert.equal((await a.approve('second')).behavior,'deny');assert.equal(requests,0);
 a.pages.cancel('first');assert.equal(a.pages.current(),null,'cancel never revives invalidated origin');
});
test('synthetic: navigation invalidates and cancels a pending approval before its late receipt',async()=>{
 let answer,request,portSignal;const a=setup((r,{signal})=>{request=r;portSignal=signal;return new Promise(resolve=>{answer=resolve;});});
 await a.pre('browser_click','pending',click);const pending=a.approve('pending');await new Promise(r=>setImmediate(r));
 const navigation=await a.pre('browser_navigate','later',{url:APPROVED[1]+'/changed'});
 // Even a stray completion report cannot revive the invalidated pending subject.
 a.pages.end('later',pageResponse(APPROVED[1]+'/changed'));
 let cancelled=false;pending.then(()=>{cancelled=true;});await new Promise(r=>setImmediate(r));
 answer(approvalReceipt(request));const result=await pending;
 assert.equal(navigation.hookSpecificOutput.permissionDecision,'deny','no competing navigation executes');
 assert.equal(cancelled,true,'invalidation settles a pending approval without waiting for its answer');
 assert.equal(result.message,'BROWSER_APPROVAL_PAGE_CHANGED');assert.equal(portSignal.aborted,true);
 assert.equal(result.behavior,'deny');assert.equal(a.pages.current(),null);
});
test('synthetic: duplicate IDs invalidate pending context and are denied by PreToolUse',async()=>{
 const a=setup();await a.pre('browser_click','same',click);
 assert.equal((await a.pre('browser_click','same',click)).hookSpecificOutput.permissionDecision,'deny');
 assert.equal(a.pages.originFor('same'),null);assert.equal((await a.approve('same')).behavior,'deny');
 a.pages.cancel('same');assert.equal(a.pages.begin('same'),false,'completed IDs cannot be reused');
});
test('synthetic: tab changes fence an approved operation until its completion, then a fresh observation can bind',async()=>{
 const a=setup();await a.pre('browser_click','executing',click);assert.equal((await a.approve('executing')).behavior,'allow');
 assert.equal((await a.pre('browser_tabs','switch',{action:'select',index:1})).hookSpecificOutput.permissionDecision,'deny');
 assert.equal(a.pages.originFor('executing'),null);a.pages.end('executing',pageResponse(APPROVED[1]));assert.equal(a.pages.current(),null);
 await a.pre('browser_snapshot','observed');a.pages.end('observed',pageResponse(APPROVED[1]));
 await a.pre('browser_click','fresh',click);assert.equal((await a.approve('fresh')).behavior,'allow');
});
test('synthetic: reentrant page invalidation during receipt validation cannot release execution',async()=>{
 let a;a=setup(async request=>Object.defineProperty(approvalReceipt(request),'subjectSha256',{enumerable:true,get(){a.pages.begin('receipt-reentry');return request.subjectSha256;}}));
 await a.pre('browser_click','validate',click);assert.equal((await a.approve('validate')).message,'BROWSER_APPROVAL_PAGE_CHANGED');
});
