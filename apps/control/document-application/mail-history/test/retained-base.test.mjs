import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createMailHistoryCompiler} from '../compose.mjs';
import {selected,makeInput,sourcePage,corpus,sourceVersionId} from './fixtures.mjs';
// Actual saved original DOCX snapshot supplied by the independent artifact owner.
const retained=JSON.parse(await readFile(new URL('./retained-base-v2.json',import.meta.url),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
async function prepare(mode){
 const context=structuredClone(retained.preparation.context);context.evidence=[];const now=Date.parse(retained.preparation.provenance.asOf)+1000;context.deadlineMs=now+10000;
 const input=makeInput(retained.preparation.provenance.asOf),modified='Z'+corpus.slice(1);let sourceCalls=0,baseCalls=0;
 if(mode==='new-version')input.quotes[0].sourceVersionId='synthetic-message-utf16-v3';
 const compiler=createMailHistoryCompiler({now:()=>now,defaultCongress:119,async readBase(){baseCalls++;return retained.snapshot;},async readSource(call){sourceCalls++;const page=sourcePage(call);if(mode!=='unchanged'&&call.operation.id==='mail.read_thread'){
  const row=page.messages[0];row.contentSha256=sha(modified);if(row.section.start===0)row.section.text='Z'+row.section.text.slice(1);if(mode==='new-version')row.recordVersionId='synthetic-message-utf16-v3';
 }return page;}});
 const result=await compiler.prepare(input,context,{selection:selected(context),base:{versionId:retained.snapshot.version.versionId,specSha256:retained.snapshot.specSha256}});
 return {result,sourceCalls,baseCalls};
}
test('actual retained DOCX base admits unchanged immutable source bytes and exact parent provenance',async()=>{
 const {result,baseCalls}=await prepare('unchanged');assert.equal(baseCalls,1);assert.equal(result.provenance.parent.versionId,retained.snapshot.version.versionId);assert.equal(result.provenance.parent.objectSha256,retained.realOriginalSha256);assert.equal(result.quotes[0].status,'bound-source-excerpt');assert.equal(result.context.evidence[0].sourceVersionId,sourceVersionId);assert.equal(result.context.evidence[0].contentSha256,retained.snapshot.version.evidence[0].contentSha256);
});
test('changed self-consistent body hash cannot reuse a source version retained by the exact base',async()=>{
 await assert.rejects(prepare('changed-same-version'),{code:'MAIL_HISTORY_SOURCE_VERSION_CONFLICT'});
});
test('changed self-consistent body under a new immutable source version remains admissible',async()=>{
 const {result,baseCalls}=await prepare('new-version');assert.equal(baseCalls,1);assert.equal(result.provenance.parent.objectSha256,retained.realOriginalSha256);assert.equal(result.quotes[0].status,'bound-source-excerpt');assert.equal(result.context.evidence[0].sourceVersionId,'synthetic-message-utf16-v3');assert.equal(result.context.evidence[0].contentSha256,sha('Z'+corpus.slice(1)));assert.notEqual(result.context.evidence[0].contentSha256,retained.snapshot.version.evidence[0].contentSha256);
});
