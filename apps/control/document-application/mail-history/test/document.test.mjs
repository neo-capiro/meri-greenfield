import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';
import {createLocalDocumentFixture} from '../../local/fixture.mjs';import {runLocalMailHistoryFlow} from '../local/flow.mjs';import {mailboxId} from './fixtures.mjs';
const pythonExecutable='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',sofficeExecutable='/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
test('real existing DOCX create/revise/inspect/download/replay and every-page render preserve source/evidence/authority', {timeout:120000},async()=>{
 const root=fileURLToPath(new URL('../../../../../',import.meta.url)),previous=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;
 let fixture,directory;try{
  fixture=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable,mailboxIds:[mailboxId]});directory=process.env.MERI_MAIL_HISTORY_OUTPUT??await mkdtemp(join(tmpdir(),'meri-mail-history-review-'));
  const result=await runLocalMailHistoryFlow({fixture,outputDirectory:directory,pythonExecutable,sofficeExecutable});
  assert.equal(result.versions.length,2);assert.equal(result.stats.generations,2);for(const rendered of result.rendered)for(const process of rendered.processes){assert.equal(process.exitCode,0);assert.equal(process.leaderClosed,true);assert.equal(process.groupAbsent,true);}
  await fixture.close();await writeFile(join(directory,'flow-receipt.json'),JSON.stringify({status:'PASS',result,cleanup:fixture.stats().cleanup},null,2)+'\n');
 }finally{if(fixture)await fixture.close();if(directory&&!process.env.MERI_MAIL_HISTORY_OUTPUT)await rm(directory,{recursive:true,force:true});if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}
});
