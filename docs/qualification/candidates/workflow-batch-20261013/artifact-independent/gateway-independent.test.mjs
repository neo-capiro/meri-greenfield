import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createLocalDocumentFixture} from '../../../../../apps/control/document-application/local/fixture.mjs';
import {createMailHistoryCompiler} from '../../../../../apps/control/document-application/mail-history/compose.mjs';
import {mailboxId,selected,makeInput} from '../../../../../apps/control/document-application/mail-history/test/fixtures.mjs';
import {mailHistorySourceFixture} from '../../../../../apps/gateway/test/mail-history-source-fixture.mjs';
const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
async function setup(t){
 const previous=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;
 const fixture=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,mailboxIds:[mailboxId]});
 t.after(async()=>{await fixture.close();assert.equal(fixture.stats().cleanup.executorDirectoriesAbsent,true);assert.equal(fixture.stats().cleanup.storeRemoved,true);await assert.rejects(access(fixture.directory));if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;});
 const selection=selected(fixture.artifactOptions.context),source=mailHistorySourceFixture(fixture,selection);
 const prepare=()=>createMailHistoryCompiler({readSource:source.readSource,now:fixture.now,defaultCongress:119}).prepare(makeInput(new Date(fixture.now()).toISOString()),fixture.artifactOptions.context,{selection});
 return {fixture,source,prepare};
}
test('actual adapters and current dispatcher preserve canonical five-operation reads and body evidence',async t=>{
 const {fixture,source,prepare}=await setup(t),p=await prepare();assert.equal(p.quotes[0].status,'bound-source-excerpt');
 assert.deepEqual([...new Set(source.wire.map(row=>row.operation.id))].sort(),['find_contacts','mail.list_messages','mail.read_thread','mail.search_messages','resolve_entity']);
 assert.equal(source.wire.filter(row=>row.operation.id==='mail.read_thread').length,2);assert.equal(source.calls.filter(x=>x==='reserve').length,source.wire.length);assert.equal(source.calls.filter(x=>x==='settle').length,source.wire.length);assert(!source.calls.includes('uncertain'));
 for(const row of source.wire){assert.deepEqual(Object.keys(row.body).sort(),['input','metadata']);if(row.operation.id==='resolve_entity')assert.equal(row.body.metadata.defaultCongress,119);else assert.equal(row.body.metadata,null);if(row.operation.id.startsWith('mail.'))assert.deepEqual(row.body.input.subject,{kind:'client',entityId:fixture.selectedClientId});}
 assert.deepEqual(source.wire.filter(row=>row.operation.id==='mail.read_thread').map(row=>row.body.input.bodyOffset),[0,1999]);
 assert.equal(fixture.stats().generations,0);assert.equal(fixture.stats().versionCharges,0);
});
test('actual current authority revoked immediately after HTTP response cannot release compiled body evidence',async t=>{
 const {fixture,source,prepare}=await setup(t);source.state.afterFetch=()=>{source.state.revoked=true;};await assert.rejects(prepare());assert.equal(source.wire.length,1);assert.equal(fixture.stats().generations,0);assert.equal(fixture.stats().versionCharges,0);
});
test('actual configured body page with changed source kind refuses instead of marking a quoted claim verified',async t=>{
 const {fixture,source,prepare}=await setup(t);source.state.changePage=page=>{if(page.kind==='mail-thread-source-page')page.sources[0].authority='derived';};await assert.rejects(prepare());assert.equal(fixture.stats().generations,0);assert.equal(fixture.stats().versionCharges,0);
});
test('actual configured body page with a substituted SHA refuses before any document mutation',async t=>{
 const {fixture,source,prepare}=await setup(t);source.state.changePage=page=>{if(page.kind==='mail-thread-source-page')page.messages[0].contentSha256='a'.repeat(64);};await assert.rejects(prepare());assert.equal(fixture.stats().generations,0);assert.equal(fixture.stats().versionCharges,0);
});
