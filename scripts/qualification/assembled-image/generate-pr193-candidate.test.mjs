import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CANDIDATE_FILE,SOURCE_COMMIT,PREVIOUS_SOURCE_COMMIT,generateCandidate} from './generate-pr193-candidate.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=name=>readFileSync(new URL('./'+name,import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:8*1024*1024});
const cli=fileURLToPath(new URL('./generate-pr193-candidate.mjs',import.meta.url));

test('exact Git objects regenerate the byte-frozen m receipt independently of working production files',()=>{
 const generated=generateCandidate();
 assert.deepEqual(generated,read(CANDIDATE_FILE));
 assert.equal(createHash('sha256').update(generated).digest('hex'),'9350fb7a077d42369a5a2dc14f598dd228c67a21de76cd6791465581db6d381c');
});

test('an unreviewed non-doc source delta fails before generation',()=>{
 assert.throws(()=>generateCandidate({git:(...args)=>args[0]==='diff'?Buffer.concat([git(...args),Buffer.from('apps/runtime/unreviewed.mjs\n')]):git(...args)}),/UNREVIEWED_SOURCE_DELTA/u);
});

test('an unreviewed change since the superseded l source also refuses generation',()=>{
 assert.throws(()=>generateCandidate({git:(...args)=>args[0]==='diff'&&args[3]===PREVIOUS_SOURCE_COMMIT?Buffer.concat([git(...args),Buffer.from('apps/runtime/unreviewed.mjs\n')]):git(...args)}),/UNREVIEWED_PREDECESSOR_DELTA/u);
});

test('predecessor or original manifest edits refuse before any Git read',()=>{
 for(const target of ['candidate-manifest-fable-20261015l.json','source-manifest.json']){
  assert.throws(()=>generateCandidate({read:name=>name===target?Buffer.concat([read(name),Buffer.from('\n')]):read(name),git:()=>assert.fail('Git should not be consulted')}),target.startsWith('candidate')?/PREDECESSOR_BYTES_CHANGED/u:/HISTORICAL_BYTES_CHANGED/u);
 }
});

test('unexpected changes to a historical proof row require a separately reviewed successor',()=>{
 const file='apps/control/conversations/execution-journal.mjs';
 assert.throws(()=>generateCandidate({git:(...args)=>args[0]==='show'&&args[1]===`${SOURCE_COMMIT}:${file}`?Buffer.from('unreviewed drift'):git(...args)}),/UNREVIEWED_HISTORICAL_ROW_DELTA/u);
});

test('the bounded CLI documents its modes and rejects missing or extra arguments',()=>{
 const help=spawnSync(process.execPath,[cli,'--help'],{cwd:root,encoding:'utf8'});
 assert.equal(help.status,0);assert.match(help.stdout,/--check\|--write/u);assert.match(help.stdout,/Exit codes:/u);
 for(const args of [[],['--write','extra'],['--source','HEAD']]){
  const result=spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,2);assert.match(result.stderr,/Use --help/u);
 }
});
