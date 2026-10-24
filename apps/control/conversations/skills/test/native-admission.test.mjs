import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginalSkillAdmissionOwner} from '../admission.mjs';
import {assertSelectionAdmission,assertSkillRun} from '../../../../../packages/contracts/selected-skills/validate.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {runtimeFixture} from '../../../../worker/conversation/skills/test/runtime-fixture.mjs';
function fixture(){
 const f=runtimeFixture(),c=f.configuration,binding=c.binding,scopes=c.scopes,now=c.now;
 const state={loads:0,current:0,selections:0,run:{binding,scopes,state:'running'},request:c.request,selection:f.selection,onSelection:null,expiry:now()+60000,changedContext:false};
 const owner=createOriginalSkillAdmissionOwner({binding,now,loadConversation:async()=>{state.loads++;return structuredClone({run:state.run,request:state.request});},
  readSelection:async()=>{state.selections++;state.onSelection?.();return structuredClone(state.selection);},
  readCurrentContext:async()=>{state.current++;return {binding,scopes:state.changedContext?[]:scopes,selectedClientId:f.selection.subject.entityIds[0],checkedAtMs:now(),expiresAtMs:state.expiry};}});
 const input={binding,request:c.request,scopes,selectedClientId:f.selection.subject.entityIds[0],deadlineMs:now()+2000};
 const current={binding,skill:c.request.skill,requestSha256:hash(c.request),selectionSha256:hash(f.selection)};
 return {f,c,state,owner,input,current};
}
test('pre-persistence selection uses supplied session bounds without a run, allocation or installation lookup',async()=>{
 const x=fixture();x.state.run=null;const receipt=await x.owner.admitSelection(x.input);
 assertSelectionAdmission(receipt,{...x.input,selected:x.f.selected,started:x.c.now(),now:x.c.now});
 assert.equal(receipt.expiresAtMs,x.input.deadlineMs);assert.equal(x.state.loads,0);assert.equal(x.state.current,0);assert.equal(x.state.selections,1);
 for(const field of ['allocationSha256','installationId','executionCatalogSha256'])assert.equal(Object.hasOwn(receipt,field),false);
});
test('runtime selection binds actual canonical run and immutable expiry without clipping it to the read timeout',async()=>{
 const x=fixture(),result=await x.owner.currentSkillRun(x.current);let expiry;
 assertSkillRun(result,{input:x.current,selected:x.f.selected,scopes:x.c.scopes,started:x.c.now(),now:x.c.now,life:{limitDeadline(value){expiry=value;}}});
 assert.equal(expiry,x.state.expiry);assert.equal(x.state.loads,2);assert.equal(x.state.current,1);
});
for(const kind of ['scope','client','window','expired','missing-deadline','foreign-binding','stale-pin'])test(`session selection refuses ${kind} before durable admission`,async()=>{
 const x=fixture(),input=structuredClone(x.input);
 if(kind==='scope')input.scopes=[{...input.scopes[0],policyRevision:'other'}];
 if(kind==='client')input.selectedClientId=null;
 if(kind==='window')x.state.selection.window={...x.state.selection.window,basis:'calendar'};
 if(kind==='expired')input.deadlineMs=x.c.now();
 if(kind==='missing-deadline')delete input.deadlineMs;
 if(kind==='foreign-binding')input.binding.workerId='71000000-0000-4000-8000-000000000099';
 if(kind==='stale-pin')input.request.skill.proseSha256='a'.repeat(64);
 await assert.rejects(x.owner.admitSelection(input));assert.equal(x.state.loads,0);assert.equal(x.state.current,0);
});
for(const kind of ['cancelled','completed','waiting-for-approval','foreign-writer','changed-request','changed-scopes','expired','cancel-after-selection'])test(`runtime current selection refuses ${kind}`,async()=>{
 const x=fixture();
 if(['cancelled','completed','waiting-for-approval'].includes(kind))x.state.run.state=kind;
 if(kind==='foreign-writer')x.state.run.binding={...x.c.binding,writerFence:x.c.binding.writerFence+1};
 if(kind==='changed-request')x.state.request={...x.c.request,prompt:'Different accepted request'};
 if(kind==='changed-scopes')x.state.changedContext=true;
 if(kind==='expired')x.state.expiry=x.c.now();
 if(kind==='cancel-after-selection')x.state.onSelection=()=>{x.state.run.state='cancelled';};
 await assert.rejects(x.owner.currentSkillRun(x.current));
});
