import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateShape, canonicalSha256, assertWorkspacePaths, assertProposalIntegrity, assertCommandExecution } from '../validate.mjs';

const binding = () => ({tenantId:'synthetic-a',actorId:'actor-a',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1});
const scope = () => ({tenantId:'synthetic-a',kind:'client',resourceId:'client-a',policyRevision:'policy-1'});
const object = () => ({objectId:randomUUID(),versionId:'v1',sha256:'a'.repeat(64),bytes:8,scopes:[scope()]});
const manifest = () => ({contractVersion:'0.1.0',manifestId:randomUUID(),binding:binding(),logicalCwd:'/workspace/conversation',entries:[{path:'outputs/brief.txt',kind:'file',object:object(),executable:false}],scopes:[scope()],createdAt:'2026-10-09T18:00:00Z'});
const proposal = () => {
  const command={contractVersion:'0.1.0',commandId:randomUUID(),binding:binding(),action:'task.create',arguments:{title:'Synthetic fixture'},attachments:[object()],scopes:[scope()],idempotencyKey:'fixture-1'};
  return {proposalId:randomUUID(),command,commandSha256:canonicalSha256(command),createdAt:'2026-10-09T18:00:00Z',expiresAt:'2026-10-09T18:10:00Z',requiredApprover:{tenantId:'synthetic-a',actorId:'actor-a'}};
};

test('accepts portable manifests and immutable proposals', () => {
  assertWorkspacePaths(manifest()); assertProposalIntegrity(proposal());
});
test('rejects unsafe workspace paths before restoration', () => {
  for (const path of ['../secret','/etc/passwd','C:/secret','out\\secret','a//b','a/./b','a/../b','a\u0000b','outputs/']) {
    const fixture=manifest(); fixture.entries[0].path=path;
    assert.throws(()=>assertWorkspacePaths(fixture),/Unsafe/);
  }
});
test('rejects duplicate paths and unsupported symlinks', () => {
  const fixture=manifest(); fixture.entries.push(structuredClone(fixture.entries[0]));
  assert.throws(()=>assertWorkspacePaths(fixture),/Conflicting/);
  fixture.entries.pop(); fixture.entries[0].kind='symlink';
  assert.throws(()=>assertWorkspacePaths(fixture),/constant/);
});
test('rejects changed approved arguments, input versions and tenant approvers', () => {
  for (const mutate of [p=>p.command.arguments.title='Changed', p=>p.command.attachments[0].versionId='v2']) {
    const fixture=proposal(); mutate(fixture); assert.throws(()=>assertProposalIntegrity(fixture),/hash mismatch/);
  }
  const fixture=proposal(); fixture.requiredApprover.tenantId='synthetic-b';
  assert.throws(()=>assertProposalIntegrity(fixture),/Cross-tenant/);
});
test('rejects unknown protocol versions, loose identity fields and unsafe integers', () => {
  const fixture=manifest(); fixture.contractVersion='0.2.0'; assert.throws(()=>validateShape('WorkspaceManifest',fixture));
  const run=binding(); run.admin=true; assert.throws(()=>validateShape('RunBinding',run));
  delete run.admin; run.writerFence=Number.MAX_SAFE_INTEGER+1; assert.throws(()=>validateShape('RunBinding',run));
});
test('canonical hashes are key-order independent and bind every command input', () => {
  assert.equal(canonicalSha256({b:2,a:1}),canonicalSha256({a:1,b:2}));
  assert.notEqual(canonicalSha256({a:1}),canonicalSha256({a:2}));
});
test('event envelope requires typed payload, scopes and positive durable sequence', () => {
  const event={contractVersion:'0.1.0',eventId:randomUUID(),binding:binding(),sequence:1,createdAt:'2026-10-09T18:00:00Z',scopes:[scope()],type:'run.status',data:{state:'running',reasonCode:null}};
  validateShape('UIEvent',event);
  event.data={text:'wrong payload'}; assert.throws(()=>validateShape('UIEvent',event));
  event.data={state:'running',reasonCode:null}; event.sequence=0; assert.throws(()=>validateShape('UIEvent',event));
});
test('rejects file ancestors regardless of manifest insertion order', () => {
  for (const paths of [['outputs','outputs/brief.txt'],['outputs/brief.txt','outputs']]) {
    const fixture=manifest(); fixture.entries=paths.map(path=>({...fixture.entries[0],path}));
    assert.throws(()=>assertWorkspacePaths(fixture),/ancestor/);
  }
});
test('truncated scans cannot claim complete coverage', () => {
  const fixture={completeness:'complete',limitations:[],asOf:'2026-10-09T18:00:00Z',historySupport:'supported',truncated:true};
  assert.throws(()=>validateShape('Coverage',fixture));
  fixture.completeness='partial'; validateShape('Coverage',fixture);
});
test('approval survives executor replacement while approved intent stays immutable', () => {
  const approved=proposal(); const originalHash=approved.commandSha256;
  const execution={contractVersion:'0.1.0',requestId:randomUUID(),capabilityId:randomUUID(),executorBinding:{...approved.command.binding,attemptId:randomUUID(),workerId:randomUUID(),writerFence:2},proposalId:approved.proposalId,commandSha256:originalHash,idempotencyKey:approved.command.idempotencyKey};
  assertCommandExecution(approved,execution);
  assert.equal(canonicalSha256(approved.command),originalHash);
  execution.executorBinding.tenantId='synthetic-b'; assert.throws(()=>assertCommandExecution(approved,execution),/binding mismatch/);
});
