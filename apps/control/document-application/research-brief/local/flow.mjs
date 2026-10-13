/** Actual unchanged HTTP routes + canonical immutable artifact owners; only sources/identity/SQL are synthetic. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCongressionalBriefCompiler} from '../compose.mjs';
import {syntheticInput,syntheticRead} from './synthetic.mjs';
import {sha} from '../evidence.mjs';
import {inspectBriefCopies} from './inspection.mjs';

export async function runLocalResearchBriefFlow({fixture,send,reconfigure,checkIsolation,pythonExecutable,sofficeExecutable,outputDirectory}){
  const json=async response=>{const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
  const session=await json(await send('/api/action-followthrough/session',{},fixture.nativeCredential));
  const call=(route,body)=>send('/api/documents/'+route,body,session.credential);
  const sourceReads=[];
  const compiler=createCongressionalBriefCompiler({now:fixture.now,
    async readSource(call){
      // Existing session/current-context owners supply synthetic current authority.
      const admitted=await fixture.sessions.authenticateSession({credential:session.credential,deadlineMs:call.deadlineMs,signal:call.signal});
      await fixture.sessions.readCurrentState({authentication:admitted,deadlineMs:call.deadlineMs,signal:call.signal});
      const result=syntheticRead(call);sourceReads.push({sourceId:call.sourceId,selectorSha256:v.hash(call.selector),resultSha256:v.hash(result)});return result;
    },
    async readBase({versionId,signal}){
      const inspected=await json(await call('inspect',{versionId}));
      const snapshot=await fixture.artifactOptions.versions.read(versionId,signal);assert.deepEqual(snapshot.version,inspected.version);return snapshot;
    },
  });
  const input=syntheticInput(new Date(fixture.now()).toISOString()),first=await compiler.prepare(input,fixture.artifactOptions.context);await reconfigure(first);
  const forged=await call('create',{deliveryId:'brief-forged-context',request:first.request,context:first.context});assert.equal(forged.status,400);
  const changed=structuredClone(first.request);changed.content.blocks[0].runs[0].text='Substituted draft';
  assert.equal((await call('create',{deliveryId:'brief-substitution',request:changed})).status,400);assert.equal(fixture.stats().generations,0);
  const original=await json(await call('create',{deliveryId:'brief-original',request:first.request}));
  assert.equal(original.execution.nativeQualified,false);assert.equal(original.version.parentVersionId,null);assert.deepEqual(original.version.evidence,first.context.evidence);
  const baseSnapshot=await fixture.artifactOptions.versions.read(original.version.versionId);
  const initialResponse=await call('download',{versionId:original.version.versionId});assert.equal(initialResponse.status,200);const initialBytes=Buffer.from(await initialResponse.arrayBuffer());assert.equal(sha(initialBytes),original.version.object.sha256);
  const next=syntheticInput(new Date(fixture.now()).toISOString());next.proposedLanguage=['Revised proposal: Require independent confirmation of the authorization and appropriations basis before seeking a congressional research demonstration.'];
  await assert.rejects(compiler.prepare(next,first.context,{base:{versionId:original.version.versionId,specSha256:'a'.repeat(64)}}));
  const second=await compiler.prepare(next,first.context,{base:{versionId:original.version.versionId,specSha256:baseSnapshot.specSha256}});await reconfigure(second);
  assert.equal((await call('revise',{deliveryId:'wrong-base',baseVersionId:'00000000-0000-4000-8000-000000000077',request:second.request})).status,400);
  const revision=await json(await call('revise',{deliveryId:'brief-revision',baseVersionId:original.version.versionId,request:second.request}));
  assert.equal(revision.version.artifactId,original.version.artifactId);assert.equal(revision.version.parentVersionId,original.version.versionId);assert.notEqual(revision.version.versionId,original.version.versionId);
  assert.equal(second.provenance.parent.objectSha256,original.version.object.sha256);assert.deepEqual(revision.version.evidence,second.context.evidence);
  await reconfigure(second); // Reconstruct over retained stores/allocation.
  const downloads=[];
  for(const version of [original.version,revision.version]){
    const inspected=await json(await call('inspect',{versionId:version.versionId}));assert.deepEqual(inspected.version,version);assert.equal(inspected.inspection.currentBytesVerified,true);
    const response=await call('download',{versionId:version.versionId});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),version.mimeType);
    assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(response.headers.get('content-disposition'),`attachment; filename="${version.filename}"`);
    const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,version.object.bytes);assert.equal(sha(bytes),version.object.sha256);downloads.push(bytes);
  }
  assert.deepEqual(downloads[0],initialBytes);await checkIsolation({versionId:original.version.versionId,credential:session.credential});
  const replay=await call('revise',{deliveryId:'brief-revision',baseVersionId:original.version.versionId,request:second.request});assert.notEqual(replay.status,200);assert.equal(fixture.stats().generations,2);
  fixture.revoke();
  for(const version of [original.version,revision.version])for(const route of ['inspect','download'])assert.notEqual((await call(route,{versionId:version.versionId})).status,200);
  assert.notEqual((await call('revise',{deliveryId:'revoked',baseVersionId:original.version.versionId,request:second.request})).status,200);
  await assert.rejects(compiler.prepare(next,second.context));assert.equal(fixture.stats().generations,2);
  assert.equal(fixture.stats().settled,2);assert.equal(fixture.stats().unknown,0);assert.equal(fixture.stats().consumedMicroUsd,'20');
  const prepared=[first,second];
  await writeFile(join(outputDirectory,'provenance.json'),JSON.stringify({versions:[original.version,revision.version],
    preparations:prepared.map(p=>({request:p.request,provenance:p.provenance,facts:p.facts,reads:p.reads})),sourceReads},null,2)+'\n',{flag:'wx',mode:0o600});
  const rendered=[],deadlineMs=Date.now()+90000;
  for(const [index,label]of ['original','revision'].entries())rendered.push(await inspectBriefCopies({bytes:downloads[index],label,pythonExecutable,sofficeExecutable,tempRoot:fixture.directory,outputDirectory,deadlineMs}));
  assert.ok(rendered[0].content.paragraphs.includes(input.proposedLanguage[0]));assert.ok(rendered[1].content.paragraphs.includes(next.proposedLanguage[0]));
  assert.ok(!rendered[0].content.paragraphs.includes(next.proposedLanguage[0]));
  return {versions:[original.version,revision.version],provenance:prepared.map(p=>p.provenance),sourceReads,rendered,
    replayStatus:replay.status,invariants:{originalPreserved:true,exactImmutableParent:true,sourcePassagesReadAndBound:true,citedFreeFormClaimUnverified:true,
      missingAndConflictingEvidenceDisclosed:true,reconstructedGraph:true,sessionAndStoreIsolation:true,revokedInspectDownloadAndPreparationDenied:true},stats:fixture.stats()};
}
