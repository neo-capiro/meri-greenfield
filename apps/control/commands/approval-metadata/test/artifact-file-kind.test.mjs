import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {artifactFileKind} from '../artifact-file-kind.mjs';
import {fixture,id} from '../../../test/commands-fixture.mjs';

test('attachment codec preserves exact immutable objects and the trusted client destination',()=>{
 const f=fixture('artifact.file'),kind=artifactFileKind('artifact.file');
 const raw={...f.context.destination,objects:f.command.attachments};
 assert.deepEqual(kind.operation,{id:'save_chat_attachments',version:'0.2.0'});
 assert.equal(kind.contextShape,'ArtifactFileContext');assert.equal(kind.contractVersion,'0.1.0');
 assert.deepEqual(kind.normalizeCommandInput(raw,f.context),{arguments:f.context.destination,attachments:f.command.attachments});
 assert.deepEqual(kind.normalize(raw,f.context),f.context.destination);
 kind.assertCommand(f.command,f.context);kind.assertProposal(f.proposal,f.context);
 assert.equal(Object.isFrozen(kind),true);assert.equal(Object.isFrozen(kind.operation),true);
});

test('attachment codec rejects model source URLs, filenames, paths and foreign destination/ref mutations',()=>{
 const f=fixture('artifact.file'),kind=artifactFileKind('artifact.file'),raw={...f.context.destination,objects:f.command.attachments};
 for(const key of ['path','url','filename','mimeType','attachmentIds'])
  assert.throws(()=>kind.normalizeCommandInput({...raw,[key]:'model'},f.context));
 assert.throws(()=>kind.normalizeCommandInput({...raw,clientId:id(99)},f.context));
 assert.throws(()=>kind.normalizeCommandInput({...raw,conversationId:id(99)},f.context));
 assert.throws(()=>kind.normalizeCommandInput({...raw,objects:[{...raw.objects[0],scopes:[{...f.scopes[0],tenantId:'foreign'}]}]},f.context));
 assert.throws(()=>kind.normalizeCommandInput({...raw,objects:[raw.objects[0],raw.objects[0]]},f.context));
 const changed=structuredClone(f.proposal);changed.command.attachments[0].sha256='f'.repeat(64);
 assert.throws(()=>kind.assertProposal(changed,f.context));
 changed.commandSha256=canonicalSha256(changed.command);changed.command.arguments.clientId=id(99);
 assert.throws(()=>kind.assertProposal(changed,f.context));
 for(const action of ['task.create','memory.propose','artifact.file ',undefined])assert.throws(()=>artifactFileKind(action));
});
