/** One observable user workflow through actual Fetch/HTTP and actual DOCX bytes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {runArtifactProcess} from '../../../artifacts/process.mjs';

export const draft = () => ({operation: 'create_word',format: 'docx',title: 'Synthetic meeting brief',content: {blocks: [
  {kind: 'paragraph',style: 'Title',runs: [{text: 'Synthetic meeting brief'}]},
  {kind: 'paragraph',runs: [{text: 'Discuss the proposed internal research milestone.'}]},
  {kind: 'table',rows: [['Topic','Status'],['Research milestone','Proposed']]},
]}});
export async function runLocalDocumentFlow({fixture,send,pythonExecutable,reconstruct}) {
  const checkJson = async response => {const body = await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
  const bootstrap = await checkJson(await send('/api/action-followthrough/session',{},fixture.nativeCredential));
  assert.notEqual(bootstrap.credential,fixture.nativeCredential);
  assert.notEqual(bootstrap.credential,fixture.credential);
  const call = (route,body) => send('/api/documents/'+route,body,bootstrap.credential);
  // Caller-supplied authority never becomes an artifact request.
  const forbidden = await call('create',{deliveryId: 'forged-context',request: draft(),context: fixture.artifactOptions.context});
  assert.notEqual(forbidden.status,200);assert.equal(fixture.stats().generations,0);
  const first = await checkJson(await call('create',{deliveryId: 'document-original',request: draft()}));
  assert.equal(first.version.generationStatus,'draft');assert.equal(first.version.previewStatus,'pending');
  assert.equal(first.version.parentVersionId,null);assert.equal(first.execution.nativeQualified,false);
  const revision = draft();revision.content.blocks[1].runs[0].text = 'Discuss the approved internal research milestone and assign a reviewer.';
  revision.content.blocks[2].rows[1][1] = 'Approved for discussion';
  const second = await checkJson(await call('revise',{deliveryId: 'document-revision',baseVersionId: first.version.versionId,request: revision}));
  assert.equal(second.version.artifactId,first.version.artifactId);assert.equal(second.version.parentVersionId,first.version.versionId);
  assert.notEqual(second.version.versionId,first.version.versionId);
  assert.equal(fixture.stats().generations,2);
  await reconstruct(); // New application/service graph reads the same retained versions and allocation.
  const inspections = [], receipts = [];
  for (const version of [first.version,second.version]) {
    const inspected = await checkJson(await call('inspect',{versionId: version.versionId}));
    assert.equal(inspected.inspection.currentBytesVerified,true);assert.equal(inspected.version.object.sha256,version.object.sha256);
    const response = await call('download',{versionId: version.versionId});assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),version.mimeType);
    assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.match(response.headers.get('content-disposition'),/^attachment;/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length,version.object.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),version.object.sha256);
    const verified = await runArtifactProcess(pythonExecutable,['-I','-B',fileURLToPath(new URL('./inspect_docx.py',import.meta.url))],
      {cwd: fixture.directory,input: bytes,deadlineMs: fixture.artifactOptions.context.deadlineMs});
    inspections.push(JSON.parse(verified.stdout));receipts.push(verified.receipt);
  }
  assert.equal(inspections[0].paragraphs[1],draft().content.blocks[1].runs[0].text);
  assert.equal(inspections[1].paragraphs[1],revision.content.blocks[1].runs[0].text);
  assert.deepEqual(inspections[0].tables[0],[['Topic','Status'],['Research milestone','Proposed']]);
  assert.deepEqual(inspections[1].tables[0],[['Topic','Status'],['Research milestone','Approved for discussion']]);
  const replay = await call('create',{deliveryId: 'document-original',request: draft()});
  const recovered=await checkJson(replay);assert.deepEqual(recovered.version,first.version);assert.equal(recovered.execution.budgetTicketId,first.execution.budgetTicketId);
  assert.equal(fixture.stats().generations,2);assert.equal(fixture.stats().versionCharges,2);assert.equal(fixture.stats().settled,2);
  assert.equal(fixture.stats().consumedMicroUsd,'20');assert.equal(fixture.stats().unknown,0);
  fixture.revoke();
  for (const version of [first.version,second.version]) assert.notEqual((await call('download',{versionId: version.versionId})).status,200);
  assert.notEqual((await call('create',{deliveryId: 'after-revocation',request: draft()})).status,200);
  assert.equal(fixture.stats().generations,2);
  return {versions: [first.version,second.version],inspections,inspectionProcessReceipts: receipts,replayStatus: replay.status,
    invariants: {originalPreserved: true,revisionParentExact: true,downloadsVerified: true,sharedAllocationChargedOncePerVersion: true,
      reconstructedGraphReadRetainedVersions: true,revokedVersionsDenied: true,callerAuthorityRefused: true},stats: fixture.stats()};
}
