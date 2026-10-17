#!/usr/bin/env node
/** Documentation fixture only: restore four exact historical Git commit objects, never refs or source. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const help='Usage: node docs/coordination/handoffs/meri-read-lane-20261017/restore-history-fixture.mjs [--check|--restore|--help]\nRun at repository root after fetching the published equivalents and hydrating the four required paths. Default --check writes nothing. --restore writes only four commit objects. No refs, index, worktree or network changes. Exit0=success,1=verification failure,2=usage.\n';
const args=process.argv.slice(2),mode=args[0]??'--check';
if(args.length>1||!['--check','--restore','--help'].includes(mode)){process.stderr.write(help);process.exitCode=2;}
else if(mode==='--help')process.stdout.write(help);
else try{
 const fixture=JSON.parse(readFileSync(new URL('./baseline-commit-objects.json',import.meta.url),'utf8'));
 if(fixture.schemaVersion!=='meri-read-historical-commit-fixture/1'||fixture.objects.length!==4||fixture.requiredPaths.length!==4)throw Error('Invalid historical fixture');
 const env={...process.env,GIT_NO_LAZY_FETCH:'1',GIT_OPTIONAL_LOCKS:'0'};
 const git=(args,input)=>execFileSync('git',args,{env,input,encoding:input?'buffer':'utf8',maxBuffer:2*1024*1024,stdio:['pipe','pipe','pipe']});
 if(resolve(git(['rev-parse','--show-toplevel']).trim())!==resolve(process.cwd()))throw Error('Run from repository root');
 const verified=[];
 for(const item of fixture.objects){
  if(![item.sha,item.tree,item.publishedEquivalent].every(v=>/^[a-f0-9]{40}$/.test(v))||item.encoding!=='base64')throw Error('Invalid fixture identity');
  const raw=Buffer.from(item.payload,'base64');
  if(raw.toString('base64')!==item.payload||raw.length!==item.bytes)throw Error('Invalid fixture encoding');
  const actual=createHash('sha1').update(Buffer.concat([Buffer.from(`commit ${raw.length}\0`),raw])).digest('hex');
  if(actual!==item.sha||!raw.toString('utf8').startsWith('tree '+item.tree+'\n'))throw Error('Historical payload hash/tree mismatch');
  if(git(['rev-parse',item.publishedEquivalent+'^{tree}']).trim()!==item.tree)throw Error('Published equivalent tree mismatch; fetch documented pins first');
  git(['cat-file','-e',item.tree]);
  for(const path of fixture.requiredPaths){
   if(!/^docs\/[a-zA-Z0-9_./-]+$/.test(path))throw Error('Invalid historical path');
   git(['cat-file','-e',item.publishedEquivalent+':'+path]);
  }
  verified.push({item,raw});
 }
 if(mode==='--restore')for(const {item,raw} of verified){
  const written=git(['hash-object','-t','commit','-w','--stdin'],raw).toString('utf8').trim();
  if(written!==item.sha)throw Error('Git wrote an unexpected object');
 }
 process.stdout.write(JSON.stringify({mode,verifiedCommitObjects:verified.length,requiredHistoricalFiles:16,objectsWritten:mode==='--restore'?4:0,refsChanged:0,sourceChanged:false,network:false})+'\n');
}catch(error){process.stderr.write('Historical fixture verification failed: '+error.message+'\n');process.exitCode=1;}
