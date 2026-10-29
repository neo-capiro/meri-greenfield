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
