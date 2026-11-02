/** The build-time bake: the same updater and store the hosts use, driven once into an image root and proved the way a
 * scan resolves it. No real freshclam, sigtool or network is exercised; the fixed program port is injected exactly as
 * the composition's own checks inject it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {bakeUploadDefinitions,main,UPLOAD_DEFINITIONS_BAKE_MS} from '../definitions-bake-cli.mjs';
import {createSignedDefinitionStore,UPLOAD_DEFINITIONS_MAX_AGE_MS} from '../native-definitions.mjs';
import {UPLOAD_BAKED_DEFINITIONS_ROOT,UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS} from '../native-sandbox.mjs';

/** A fixed-program port that publishes two signed containers and verifies anything it is asked to. */
function definitionPrograms(calls){
 return async(program,args,options={})=>{
  calls.push(program);
  if(program==='freshclam'){await writeFile(join(options.cwd,'database','main.cvd'),Buffer.from('fixture-main-cvd'));
   await writeFile(join(options.cwd,'database','daily.cvd'),Buffer.from('fixture-daily-cvd'));return {stdout:Buffer.alloc(0)};}
  if(program==='sigtool')return {stdout:Buffer.alloc(0)};
  throw Object.assign(new Error('UPLOAD_DEFINITIONS_PROGRAM_REFUSED'),{code:'UPLOAD_DEFINITIONS_PROGRAM_REFUSED'});
 };
}

test('the bake publishes one proved snapshot into the image root and prints its content-free provenance',async()=>{
 const root=await mkdtemp(join(tmpdir(),'meri-bake-')),calls=[],now=Date.now;
 const provenance=await bakeUploadDefinitions({root,now,run:definitionPrograms(calls)});
 assert.equal(provenance.root,root);
 assert.match(provenance.sha256,/^[a-f0-9]{64}$/u);
 assert.deepEqual(provenance.files,['daily.cvd','main.cvd']);
 assert.equal(provenance.maxAgeMs,UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS);
 assert.equal(typeof provenance.publishedAt,'string');
 assert.equal((await readFile(join(root,'current'),'utf8')).trim(),provenance.sha256,'`current` names the published snapshot');
 assert.equal(calls.filter(program=>program==='freshclam').length,1,'exactly one download');
 assert.ok(calls.filter(program=>program==='sigtool').length>=4,'every container is verified at publication and again at the proving resolve');
 // The published root resolves through a fresh read-only store with the image's own age bound and nothing else.
 const store=createSignedDefinitionStore({root,now,run:definitionPrograms([]),maxAgeMs:UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS});
 const resolved=await store.snapshot({deadlineMs:now()+5000});
 assert.equal(resolved.sha256,provenance.sha256);
 resolved.reader.release({completed:true});
 assert.deepEqual((await readdir(join(root,'snapshots',provenance.sha256,'database'))).sort(),['daily.cvd','main.cvd']);
 // Nothing is ever written to the shared image path by a check, and the image constants are the fixed ones.
 assert.equal(UPLOAD_BAKED_DEFINITIONS_ROOT,'/opt/meri/upload-definitions');
 assert.equal(UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS,7*24*60*60*1000);
 assert.ok(UPLOAD_BAKED_DEFINITIONS_MAX_AGE_MS>UPLOAD_DEFINITIONS_MAX_AGE_MS,'the baked snapshot may serve longer than a live-refreshed host root');
 assert.equal(UPLOAD_DEFINITIONS_BAKE_MS,600000);
});

test('a download that fails publishes nothing and the command exits 2 with the closed code only',async()=>{
 const root=await mkdtemp(join(tmpdir(),'meri-bake-fail-'));
 const failing=async program=>{if(program==='freshclam')throw Object.assign(new Error('exit 1'),{receipt:{exitCode:1}});return {stdout:Buffer.alloc(0)};};
 await assert.rejects(bakeUploadDefinitions({root,run:failing}),{code:'UPLOAD_DEFINITIONS_REFRESH_FAILED'});
 await assert.rejects(readFile(join(root,'current')),{code:'ENOENT'},'no partial pointer is left behind');
 const out=[],err=[];
 const stream=sink=>({write(text){sink.push(String(text));return true;}});
 assert.equal(await main(['relative-root'],{stdout:stream(out),stderr:stream(err)}),2,'the one argument must be an absolute root');
 assert.deepEqual(err,['UPLOAD_DEFINITIONS_BAKE_USAGE\n']);
 assert.equal(await main(['--help'],{stdout:stream(out),stderr:stream(err)}),0);
 assert.match(out[0],/definitions-bake-cli\.mjs \[root\]/u);
});
