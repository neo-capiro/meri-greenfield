/** Five actual configured source adapters/current dispatcher -> real editable DOCX lifecycle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createLocalDocumentFixture} from '../../control/document-application/local/fixture.mjs';
import {runLocalMailHistoryFlow} from '../../control/document-application/mail-history/local/flow.mjs';
import {mailboxId,selected} from '../../control/document-application/mail-history/test/fixtures.mjs';
import {mailHistorySourceFixture} from './mail-history-source-fixture.mjs';
const pythonExecutable='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const sofficeExecutable='/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
test('five current-authority HTTP reads feed an exact evidence-linked editable original and revision', {timeout:120000},async()=>{
 const root=fileURLToPath(new URL('../../../',import.meta.url)),previous=process.env.MERI_REVIEW_SOURCE_ROOT;
 process.env.MERI_REVIEW_SOURCE_ROOT=root;let fixture,directory;
 try {
  fixture=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable,mailboxIds:[mailboxId]});
  directory=process.env.MERI_MAIL_HISTORY_GATEWAY_OUTPUT??await mkdtemp(join(tmpdir(),'meri-mail-history-gateway-'));
  const source=mailHistorySourceFixture(fixture,selected(fixture.artifactOptions.context));
  const result=await runLocalMailHistoryFlow({fixture,readSource:source.readSource,sourceState:source.state,outputDirectory:directory,pythonExecutable,sofficeExecutable});
  assert.deepEqual([...new Set(source.wire.map(x=>x.operation.id))].sort(),['find_contacts','mail.list_messages','mail.read_thread','mail.search_messages','resolve_entity']);
  assert.equal(source.calls.filter(x=>x==='reserve').length,source.wire.length);
  assert.equal(source.calls.filter(x=>x==='settle').length,source.wire.length);
  assert.equal(source.calls.includes('uncertain'),false);assert.equal(source.state.revoked,true);
  assert.equal(result.stats.generations,2);assert.equal(result.stats.consumedMicroUsd,'20');
  assert.equal(result.versions[1].parentVersionId,result.versions[0].versionId);
  for(const r of result.rendered)assert(r.visual.pages.length>0);
  await fixture.close();
  await writeFile(join(directory,'gateway-flow-receipt.json'),JSON.stringify({status:'PASS',result,wire:source.wire,calls:source.calls,cleanup:fixture.stats().cleanup},null,2)+'\n');
 }finally {
  if(fixture)await fixture.close();if(directory&&!process.env.MERI_MAIL_HISTORY_GATEWAY_OUTPUT)await rm(directory,{recursive:true,force:true});
  if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;
 }
});
