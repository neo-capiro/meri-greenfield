import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createMailHistoryCompiler} from '../../../../../apps/control/document-application/mail-history/compose.mjs';
import {selected,makeInput,sourcePage,corpus} from '../../../../../apps/control/document-application/mail-history/test/fixtures.mjs';
const retained=JSON.parse(await readFile(new URL('./retained-base.json',import.meta.url),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
async function prepare(changed,newVersion=false){
 const context=structuredClone(retained.preparation.context);context.evidence=[];const now=Date.parse(retained.preparation.provenance.asOf)+1000;context.deadlineMs=now+10000;
 const input=makeInput(retained.preparation.provenance.asOf);if(newVersion)input.quotes[0].sourceVersionId='independent-message-v3';let sourceCalls=0,baseCalls=0;
 const modified='Z'+corpus.slice(1);assert.notEqual(sha(modified),sha(corpus));
 const compiler=createMailHistoryCompiler({now:()=>now,defaultCongress:119,async readBase(){baseCalls++;return retained.snapshot;},async readSource(call){sourceCalls++;const page=sourcePage(call);if(changed&&call.operation.id==='mail.read_thread'){
  const row=page.messages[0];row.contentSha256=sha(modified);if(newVersion)row.recordVersionId='independent-message-v3';if(row.section.start===0)row.section.text='Z'+row.section.text.slice(1);
 }return page;}});
 const result=await compiler.prepare(input,context,{selection:selected(context),base:{versionId:retained.snapshot.version.versionId,specSha256:retained.snapshot.specSha256}});
 return {result,sourceCalls,baseCalls};
}
test('real retained DOCX base with unchanged source version/hash retains exact original provenance',async()=>{
 const {result,baseCalls}=await prepare(false);assert.equal(baseCalls,1);assert.equal(result.provenance.parent.versionId,retained.snapshot.version.versionId);assert.equal(result.provenance.parent.objectSha256,retained.realOriginalSha256);
 assert.equal(result.quotes[0].status,'bound-source-excerpt');assert.equal(result.context.evidence[0].sourceVersionId,retained.snapshot.version.evidence[0].sourceVersionId);assert.equal(result.context.evidence[0].contentSha256,retained.snapshot.version.evidence[0].contentSha256);
});
test('same immutable source ID/record/version with changed body hash refuses preparation against the actual base',async()=>{
 await assert.rejects(prepare(true),{code:'MAIL_HISTORY_SOURCE_VERSION_CONFLICT'});
});
test('a distinct source version can revise the exact retained artifact base while preserving original lineage',async()=>{
 const {result}=await prepare(true,true);assert.equal(result.provenance.parent.versionId,retained.snapshot.version.versionId);assert.equal(result.provenance.parent.objectSha256,retained.realOriginalSha256);assert.equal(result.context.evidence[0].sourceVersionId,'independent-message-v3');assert.notEqual(result.context.evidence[0].contentSha256,retained.snapshot.version.evidence[0].contentSha256);assert.equal(result.quotes[0].status,'bound-source-excerpt');
});
