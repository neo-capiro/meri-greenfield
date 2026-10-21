import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionSessionOwner,createSessionRefusalDiagnostics} from './owner.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
const uuid=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,NOW=1791840000000;
const refused=(message,fields)=>Object.assign(Error(message),fields);

test('a refusal line carries only a fixed step and an owned code, at most a burst per window',()=>{
 const lines=[];let now=0;const report=createSessionRefusalDiagnostics({write:line=>lines.push(line),now:()=>now,burst:3,windowMs:1000});
 report('context',refused('APPLICATION_CONTEXT_REFUSED',{step:'initial-binding',reason:'INITIAL_BINDING_VERSIONS_CHANGED'}));
 report('identity',refused(`secret native denial for ${uuid(9)}`,{code:`INITIAL_BINDING_${uuid(9)}`}));   // neither message nor a foreign-shaped code is written
 report(`step-${uuid(9)}`,refused('NATIVE_AUTHORITY_UNAVAILABLE',{code:'NATIVE_AUTHORITY_UNAVAILABLE',step:'context-preflight'}));
 report('capacity',refused('SESSION_CAPACITY',{code:'SESSION_CAPACITY'}));report('capacity',refused('SESSION_CAPACITY',{code:'SESSION_CAPACITY'}));
 assert.deepEqual(lines,['CONTROL_SESSION_REFUSED step=initial-binding code=INITIAL_BINDING_VERSIONS_CHANGED\n','CONTROL_SESSION_REFUSED step=identity code=REFUSED\n',
  'CONTROL_SESSION_REFUSED step=context-preflight code=NATIVE_AUTHORITY_UNAVAILABLE\n','CONTROL_SESSION_DIAGNOSTICS_SUPPRESSED\n'],'the window suppresses once, then stays silent');
 now=1000;report(`step-${uuid(9)}`,null);assert.equal(lines.at(-1),'CONTROL_SESSION_REFUSED step=input code=REFUSED\n','a new window reports again; an unknown step is never echoed');
 assert.doesNotThrow(()=>createSessionRefusalDiagnostics({burst:20,windowMs:60000,write(){throw Error('closed stderr');}})('identity',Error('x')),'a failed write never changes the refusal');
 let traps=0;const hostile=new Proxy({},{get(){traps++;throw Error('SECRET');},getPrototypeOf(){traps++;throw Error('SECRET');},ownKeys(){traps++;throw Error('SECRET');}});
 now=5000;report('identity',hostile);assert.equal(lines.at(-1),'CONTROL_SESSION_REFUSED step=identity code=REFUSED\n');assert.equal(traps,0,'a hostile rejection is never read');
});

function fixture(){
 const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:uuid(1),runId:uuid(2),attemptId:uuid(3),workerId:uuid(4),writerFence:1},clientId=uuid(5);
 const state={context:null},lines=[],clock=()=>NOW;
 const owner=createActionSessionOwner({mode:'process-local',now:clock,limits:{maxSessions:1,maxRequestMs:500,maxTtlMs:1000,maxFactBytes:65536},refusals:(step,error)=>lines.push({step,error}),
  async verifyIdentity(call){if(call.credential!=='native-opaque')throw Error('secret native denial');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'identity-1',checkedAtMs:clock(),expiresAtMs:NOW+10000};},
  async resolveContext(call){if(state.context)throw state.context;return {identitySha256:canonicalSha256(call.identity),binding:{...binding},scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'revision-1'}],selectedClientId:clientId,contextRevision:'context-1',checkedAtMs:clock(),expiresAtMs:NOW+10000};}});
 const written=()=>{const out=[],format=createSessionRefusalDiagnostics({burst:20,windowMs:60000,write:line=>out.push(line)});for(const l of lines)format(l.step,l.error);return out;};
 return {owner,state,lines,written,issue:(extra={})=>owner.issue({identityCredential:'native-opaque',...extra})};
}

test('the session owner reports each refused issuance and recheck at the step it reached, never a cancelled request',async()=>{
 const f=fixture();try{
  await assert.rejects(f.owner.issue({identityCredential:'foreign-opaque'}));
  f.state.context=refused('NATIVE_AUTHORITY_UNAVAILABLE',{step:'initial-binding',reason:'INITIAL_BINDING_POLICY_CHANGED'});await assert.rejects(f.issue());
  f.state.context=null;const issued=await f.issue();await assert.rejects(f.issue(),{code:'SESSION_CAPACITY'});
  f.state.context=refused('NATIVE_AUTHORITY_UNAVAILABLE',{step:'run-select',reason:'NEXT_RUN_SOURCE_NOT_TERMINAL'});await assert.rejects(f.owner.authenticateSession({credential:issued.credential}));
  const controller=new AbortController();controller.abort();f.state.context=null;await assert.rejects(f.issue({signal:controller.signal}));
  assert.deepEqual(f.written(),['CONTROL_SESSION_REFUSED step=identity code=REFUSED\n','CONTROL_SESSION_REFUSED step=initial-binding code=INITIAL_BINDING_POLICY_CHANGED\n',
   'CONTROL_SESSION_REFUSED step=capacity code=SESSION_CAPACITY\n','CONTROL_SESSION_REFUSED step=run-select code=NEXT_RUN_SOURCE_NOT_TERMINAL\n']);
 }finally{f.owner.close();}
});

test('a refusals port must be callable',()=>{assert.throws(()=>createActionSessionOwner({mode:'process-local',limits:{maxSessions:1,maxRequestMs:500,maxTtlMs:1000,maxFactBytes:65536},verifyIdentity(){},resolveContext(){},refusals:'stderr'}),{code:'SESSION_CONFIGURATION'});});
