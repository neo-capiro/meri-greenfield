import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
const events=[],policy={enabled:true},mcpServers={meri_browser:{type:'stdio',command:'synthetic-shim',args:[]}};
let activation='open';
mock.module('../index.mjs',{namedExports:{createBrowserCapability:()=>({activation,policy,policySha256:canonicalSha256(policy),mcpServers,status:{activation}})}});
mock.module('../egress-control.mjs',{namedExports:{createEgressGrant:({binding,policy,expiresAtMs})=>({binding,policySha256:canonicalSha256(policy),expiresAtMs})}});
mock.module('../lifecycle.mjs',{namedExports:{createBrowserRunLifecycle:()=>({async settle(){events.push('lifecycle');return {done:true};}})}});
const {prepareBrowserRun}=await import('../runtime.mjs');
function options(sessions){return {port:{policy:async()=>policy,sessions,egress:{async grant(grant){events.push('grant');return {granted:true,policySha256:grant.policySha256};}}},binding:{runId:'synthetic'},cwd:'/synthetic',deadlineMs:Date.now()+30000,now:Date.now};}
test('activity preparation opens the composed host session after egress and tears it down before final lifecycle proof',async()=>{
 events.length=0;activation='open';
 const run=await prepareBrowserRun(options({async open(input){assert.equal(input.manifest,null);events.push('open');return {mcpServers,async destroy(){events.push('destroy');}};}}));
 assert.deepEqual(events,['grant','open']);await run.settle({outcome:'ended'});await run.settle({outcome:'ended'});
 assert.deepEqual(events,['grant','open','destroy','lifecycle']);
});
test('an open fragment cannot fall back to an unfiltered upstream launch',async()=>{
 events.length=0;activation='open';await assert.rejects(prepareBrowserRun(options()),/SESSION_OWNER_REQUIRED/);
 assert.deepEqual(events,['lifecycle']);
});
test('held preparation never creates a browser session or grants egress',async()=>{
 events.length=0;activation='held';const run=await prepareBrowserRun(options({async open(){assert.fail('held');}}));
 assert.deepEqual(events,[]);await run.settle({outcome:'ended'});assert.deepEqual(events,['lifecycle']);
});
test('a different model relay descriptor is destroyed and not released',async()=>{
 events.length=0;activation='open';
 await assert.rejects(prepareBrowserRun(options({async open(){return {mcpServers:{},async destroy(){events.push('destroy');}};}})),/SESSION_OWNER_REQUIRED/);
 assert.deepEqual(events,['grant','destroy','lifecycle']);
});

test('successor preparation delivers only the exact retained snapshot and cannot silently open a fresh browser',async()=>{
 events.length=0;activation='open';const snapshot={content:[{type:'text',text:'retained page'}]},browserHandoff={returned:{snapshotSha256:canonicalSha256(snapshot)}};
 const inputs=options({async open(){assert.fail('fresh context');},async adopt(input){assert.equal(input.handoff,browserHandoff);events.push('adopt');return {mcpServers,resumeSnapshot:snapshot,async destroy(){events.push('destroy');}};}});
 const run=await prepareBrowserRun({...inputs,browserHandoff});assert.deepEqual(run.fragment.resumeSnapshot,snapshot);assert.notEqual(run.fragment.resumeSnapshot,snapshot);
 assert.deepEqual(events,['grant','adopt']);await run.settle({outcome:'ended'});
 const bad=options({async open(){assert.fail('fresh context');},async adopt(){return {mcpServers,resumeSnapshot:{content:[]},async destroy(){}};}});
 await assert.rejects(prepareBrowserRun({...bad,browserHandoff}),/BROWSER_CUSTODY_REFUSED/);
 await assert.rejects(prepareBrowserRun({...options({async open(){assert.fail('fresh context');}}),browserHandoff}),/BROWSER_CUSTODY_UNAVAILABLE/);
});
