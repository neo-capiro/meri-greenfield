import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {setup} from '../../../docs/qualification/candidates/vertical-source-20261012/command-tool-review/fixture.mjs';
const root=process.env.MERI_TOOL_INTERFACE_ROOT;
const {createCommandToolInterface}=await import(root?pathToFileURL(root+'/apps/control/commands/tool-interface.mjs'):new URL('../commands/tool-interface.mjs',import.meta.url));

test('direct tool interface refuses absent executor result rather than exposing it as execution',async()=>{
 const t=setup(),service=createCommandToolInterface({...t.base,executor:{async execute(){return {status:'absent',outcome:null};}}}),p=await service.prepare(t.raw);
 await assert.rejects(service.executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.f.state.effects,0);
});
test('direct interface correlates actual returned receipt to original command',async()=>{
 const t=setup(),actual=t.f.make(),service=createCommandToolInterface({...t.base,executor:{async execute(...args){const result=structuredClone(await actual.execute(...args));result.outcome.receipt.commandSha256='f'.repeat(64);return result;}}}),p=await service.prepare(t.raw);
 await assert.rejects(service.executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.f.state.effects,1);
});
