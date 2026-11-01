/** Preflight only: invalid XML must not create a workspace or launch an interpreter. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {createLocalArtifactExecutor} from '../local-executor.mjs';

test('XML preflight refuses malformed text and mismatched or malformed parents before workspace allocation',async()=>{
 const absent=join(tmpdir(),'meri-xml-absent-'+randomUUID());
 const executor=createLocalArtifactExecutor({pythonExecutable:join(absent,'python'),nodeExecutable:join(absent,'node'),pptxModulePath:join(absent,'pptx'),tempRoot:absent});
 const run=(text,base=null)=>executor.execute({request:{operation:'create_word',format:'xml',title:'XML',content:{text}},assets:[],base,deadlineMs:Date.now()+10000,maxBytes:1048576});
 for(const text of ['', ' ', '<a>', '<a/><b/>', '<a>&unknown;</a>', '<!DOCTYPE a SYSTEM "file:///no-read"><a/>', '\ud800'])await assert.rejects(run(text),e=>e.code==='ARTIFACT_FORMAT');
 await assert.rejects(run('<new/>',{request:{format:'txt'},bytes:Buffer.from('<old/>')}),e=>e.code==='ARTIFACT_REVISION_FORMAT');
 await assert.rejects(run('<new/>',{request:{format:'xml'},bytes:Buffer.from('malformed')}),e=>e.code==='ARTIFACT_FORMAT');
 assert.equal(existsSync(absent),false);
});
