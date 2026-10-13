/** Actual existing document/session owners. Sources may be the root's actual governed gateway fixture. */
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createDocumentApplication} from '../../index.mjs';
import {createActionSessionApplication} from '../../../action-host/session/http.mjs';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCommitmentsAuditCompiler} from '../compose.mjs';
import {bindPreparedCommitmentsAuditArtifactOptions} from '../binding.mjs';
import {makeInput,selection,sourcePage} from '../test/fixtures.mjs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
import {inspectCommitmentsAuditCopy} from './inspection.mjs';
export async function runLocalCommitmentsAuditFlow({fixture,readSource,sourceState,outputDirectory,pythonExecutable,sofficeExecutable}){
 const issuance=createActionSessionApplication({owner:fixture.sessions,now:fixture.now,maxRequestMs:3000});
 const req=(path,body,credential)=>new Request('https://meri.invalid'+path,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body)});
 const json=async response=>{const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;};
 const session=await json(await issuance.handle(req('/api/action-followthrough/session',{},fixture.nativeCredential)));
 let app;const send=(route,body,credential=session.credential)=>app.handle(req('/api/documents/'+route,body,credential));
 const reconfigure=p=>{app=createDocumentApplication({sessions:fixture.sessions,selectedClientId:fixture.selectedClientId,artifactOptions:bindPreparedCommitmentsAuditArtifactOptions(p,{...fixture.artifactOptions,context:p.context}),credential:fixture.credential,now:fixture.now,limits:fixture.limits,enabled:true});};
 const sourceReads=[],selected=selection(fixture.artifactOptions.context);
 const compiler=createCommitmentsAuditCompiler({now:fixture.now,async readSource(call){
  const authentication=await fixture.sessions.authenticateSession({credential:session.credential,deadlineMs:call.deadlineMs,signal:call.signal});await fixture.sessions.readCurrentState({authentication,deadlineMs:call.deadlineMs,signal:call.signal});
  const result=readSource?await readSource(call):sourcePage(call);sourceReads.push({operation:call.operation,requestSha256:v.hash(call.request),resultSha256:v.hash(result)});return result;
 },async readBase({versionId,signal}){const inspected=await json(await send('inspect',{versionId}));const saved=await fixture.artifactOptions.versions.read(versionId,signal);assert.deepEqual(saved.version,inspected.version);return saved;}});
 const initialInput=makeInput(new Date(fixture.now()).toISOString()),first=await compiler.prepare(initialInput,fixture.artifactOptions.context,{selection:selected});reconfigure(first);
 const changed=structuredClone(first.request);changed.content.blocks[0].runs[0].text='Substituted export';assert.equal((await send('create',{deliveryId:'substituted',request:changed})).status,403);assert.equal(fixture.stats().generations,0);
 assert.equal((await send('create',{deliveryId:'injected-context',request:first.request,context:first.context})).status,400);
 const original=await json(await send('create',{deliveryId:'commitments-audit-original',request:first.request}));const replay=await json(await send('create',{deliveryId:'commitments-audit-original',request:first.request}));assert.deepEqual(replay.version,original.version);assert.equal(replay.execution.budgetTicketId,original.execution.budgetTicketId);assert.equal(fixture.stats().generations,1);
 const base=await fixture.artifactOptions.versions.read(original.version.versionId);const originalResponse=await send('download',{versionId:original.version.versionId});assert.equal(originalResponse.status,200);const initialBytes=Buffer.from(await originalResponse.arrayBuffer());assert.equal(sha(initialBytes),original.version.object.sha256);
 const revisedInput=makeInput(new Date(fixture.now()).toISOString());revisedInput.title='Synthetic Commitments Audit revision';revisedInput.observations[0].owner=null;
 await assert.rejects(compiler.prepare(revisedInput,fixture.artifactOptions.context,{selection:selected,base:{versionId:original.version.versionId,specSha256:'a'.repeat(64)}}));
 const second=await compiler.prepare(revisedInput,fixture.artifactOptions.context,{selection:selected,base:{versionId:original.version.versionId,specSha256:base.specSha256}});reconfigure(second);
 assert.equal((await send('revise',{deliveryId:'wrong-parent',baseVersionId:'71000000-0000-4000-8000-000000000999',request:second.request})).status,403);
 const revision=await json(await send('revise',{deliveryId:'commitments-audit-revision',baseVersionId:original.version.versionId,request:second.request}));
 assert.equal(revision.version.parentVersionId,original.version.versionId);assert.equal(revision.version.artifactId,original.version.artifactId);assert.notEqual(revision.version.versionId,original.version.versionId);assert.equal(second.provenance.parent.objectSha256,original.version.object.sha256);
 const revisedReplay=await json(await send('revise',{deliveryId:'commitments-audit-revision',baseVersionId:original.version.versionId,request:second.request}));assert.deepEqual(revisedReplay.version,revision.version);assert.equal(revisedReplay.execution.budgetTicketId,revision.execution.budgetTicketId);
 const copies=[];for(const version of [original.version,revision.version]){const inspected=await json(await send('inspect',{versionId:version.versionId}));assert.deepEqual(inspected.version,version);assert.equal(inspected.inspection.currentBytesVerified,true);const response=await send('download',{versionId:version.versionId});assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),version.object.sha256);assert.equal(bytes.length,version.object.bytes);copies.push(bytes);}
 assert.deepEqual(copies[0],initialBytes);assert.notEqual((await send('download',{versionId:original.version.versionId},'foreign-session')).status,200);
 fixture.revoke();if(sourceState)sourceState.revoked=true;
 for(const version of [original.version,revision.version])for(const route of ['inspect','download'])assert.notEqual((await send(route,{versionId:version.versionId})).status,200);
 assert.notEqual((await send('revise',{deliveryId:'revoked',baseVersionId:original.version.versionId,request:second.request})).status,200);await assert.rejects(compiler.prepare(revisedInput,fixture.artifactOptions.context,{selection:selected}));
 const stats=fixture.stats();assert.equal(stats.generations,2);assert.equal(stats.settled,2);assert.equal(stats.unknown,0);assert.equal(stats.consumedMicroUsd,'20');
 await mkdir(outputDirectory,{recursive:true});await writeFile(join(outputDirectory,'provenance.json'),JSON.stringify({versions:[original.version,revision.version],preparations:[first,second],sourceReads},null,2)+'\n');
 const rendered=[],deadlineMs=Date.now()+90000;for(const [index,label]of ['original','revision'].entries())rendered.push(await inspectCommitmentsAuditCopy({bytes:copies[index],label,pythonExecutable,sofficeExecutable,tempRoot:fixture.directory,outputDirectory,deadlineMs}));
 assert(rendered[0].content.paragraphs.includes('Commitment ledger'));assert(rendered[1].content.paragraphs.includes(revisedInput.title));
 return {versions:[original.version,revision.version],provenance:[first.provenance,second.provenance],sourceReads,rendered,stats,invariants:{originalPreserved:true,exactImmutableParent:true,createReviseReplayNoDuplicateEffects:true,fullBodyHashAndScopesBound:true,semanticClaimsUnverified:true,coverageVisible:true,inspectDownloadVerified:true,foreignSessionRefused:true,revocationRefused:true}};
}
