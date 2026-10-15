#!/usr/bin/env node
/** Reproducible local source-check runner. Records every suite outcome; failures are retained, never hidden. */
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,realpathSync,writeFileSync} from 'node:fs';
import {userInfo} from 'node:os';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSuites,suiteFiles} from './inventory.mjs';
import {parseSpecOutput,sha256,suiteReceipt,writeChecksums,writeSuiteReceipt} from './receipt.mjs';
export {parseSpecOutput};
const here=dirname(fileURLToPath(import.meta.url)),defaultRoot=resolve(here,'../../..');
const usage='Usage: node scripts/qualification/local-baseline/run-suites.mjs --out DIR [--repo DIR] [--only name,name] [--name-pattern REGEX] [--source-commit SHA] [--allow-root] [--no-subreaper]\nDIR must be outside the checkout. --name-pattern reruns only matching tests of node-test suites (targeted reruns). --source-commit records the commit an exported checkout was archived from.\nExit: 0 every suite passed; 1 at least one suite failed (results written); 2 usage/configuration.\n';
const refuse=message=>Object.assign(Error(message),{code:'USAGE'});
export function parseArguments(argv){
 const options={repo:defaultRoot,out:null,only:null,namePattern:null,sourceCommit:null,allowRoot:false,subreaper:true};
 for(let i=0;i<argv.length;i++){const a=argv[i];
  if(a==='--help'||a==='-h')return {help:true};
  if(a==='--repo')options.repo=resolve(argv[++i]??'');else if(a==='--out')options.out=resolve(argv[++i]??'');else if(a==='--only')options.only=new Set((argv[++i]??'').split(',').filter(Boolean));
  else if(a==='--name-pattern'){options.namePattern=argv[++i]??'';try{new RegExp(options.namePattern,'u');}catch{throw refuse('invalid --name-pattern');}if(!options.namePattern)throw refuse('invalid --name-pattern');}
  else if(a==='--source-commit'){options.sourceCommit=argv[++i]??'';if(!/^[0-9a-f]{40}$/u.test(options.sourceCommit))throw refuse('--source-commit must be a full 40-hex commit');}
  else if(a==='--allow-root')options.allowRoot=true;else if(a==='--no-subreaper')options.subreaper=false;else throw refuse('unknown argument: '+a);}
 if(!options.out)throw refuse('--out is required');
 return options;
}
/** Receipts stay outside the checkout under test: they must not change its inventory, hashes or git status. */
export function outsideRepository(out,repo){
 const real=path=>{let p=path;while(!existsSync(p))p=dirname(p);return join(realpathSync(p),relative(p,path));};
 const o=real(out),r=real(repo);return o!==r&&!o.startsWith(r.endsWith(sep)?r:r+sep);
}
/** Ambient credentials and host overrides are removed; the runtime refuses several of them outright. */
const scrubbedPrefixes=['AWS_','ANTHROPIC_','CLAUDE','CCR_','TEMPORAL_','PG','NPM_CONFIG_','GH_','GITHUB_','CLOUDSDK_','GIT_CONFIG_','GIT_ASKPASS','GLOBAL_AGENT_'];
const scrubbedKeys=new Set(['DATABASE_URL','NODE_OPTIONS','NODE_PATH','NODE_EXTRA_CA_CERTS','NODE_TEST_CONTEXT','MERI_NATIVE_ADMIN_TOKEN','HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy','NO_PROXY','no_proxy']);
// Any credential-shaped key is removed regardless of prefix; test processes receive no host tokens.
const scrubbedSuffix=/(TOKEN|SECRET|PASSWORD|PASSPHRASE|CREDENTIALS?|API_KEY|ACCESS_KEY|_PROXY)$/iu;
const isScrubbed=key=>scrubbedKeys.has(key)||scrubbedSuffix.test(key)||scrubbedPrefixes.some(p=>key.startsWith(p));
/** Writable artifact roots: the skill pipeline tests require them without a default, and the selected-output lifecycle test
 * otherwise writes run artifacts into the checkout (where the scope-ledger check later refuses them). */
const scratchSelectors=['MERI_PIPELINE_ARTIFACT_ROOT','MERI_ASSOCIATION_ARTIFACT_ROOT','MERI_SELECTED_OUTPUT_ARTIFACT_ROOT'];
const selectorKeys=['MERI_REVIEW_SOURCE_ROOT','MERI_INSPECTION_TEST_SOCKET','MERI_INSPECTION_TEST_DATABASE','MERI_PREPARED_LAUNCH_DATABASE',...scratchSelectors,'MERI_DOCUMENT_PYTHON','MERI_PYTHON','MERI_SOFFICE','MERI_TENANT_BUDGET_PG_SOCKET','MERI_PPTXGENJS'];
export function scrubbedEnvironment(source,root,{scratchRoot,python3,soffice}={}){
 const env={};for(const [key,value] of Object.entries(source)){if(isScrubbed(key))continue;env[key]=value;}
 env.MERI_REVIEW_SOURCE_ROOT=root;
 // Canonical local fixture selectors used by the existing PostgreSQL-backed tests (see provision-postgres.sh).
 env.MERI_INSPECTION_TEST_SOCKET??='/tmp/meri-prepared-kickoff-pg-20261014/socket';env.MERI_INSPECTION_TEST_DATABASE??='meri_inspection_final';env.MERI_PREPARED_LAUNCH_DATABASE??='meri_prepared_launch';
 if(scratchRoot)for(const key of scratchSelectors)env[key]??=join(scratchRoot,key.toLowerCase());
 // Only the tests that already honor these selectors use them; the others keep their hard-coded host paths.
 if(python3){env.MERI_DOCUMENT_PYTHON??=python3;env.MERI_PYTHON??=python3;}if(soffice)env.MERI_SOFFICE??=soffice;
 return env;
}
function locate(name){try{return execFileSync('sh',['-c','command -v '+name],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).trim()||null;}catch{return null;}}
function command(root,suite,{namePattern}={}){
 if(suite.kind==='npm')return {cwd:root,files:[],argv:['npm','run',suite.script,'--prefix',suite.prefix??'.','--silent']};
 const cwd=resolve(root,suite.cwd??'.'),files=suiteFiles(root,suite);
 if(!files.length)throw refuse('no test files for suite '+suite.name);
 return {cwd,files,argv:[process.execPath,...(suite.nodeFlags??[]),'--test','--test-reporter=spec','--test-reporter-destination=stdout',...(suite.concurrency?['--test-concurrency='+suite.concurrency]:[]),...(namePattern?['--test-name-pattern='+namePattern]:[]),...files]};
}
function version(argv){try{return execFileSync(argv[0],argv.slice(1),{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim().split('\n')[0];}catch{return null;}}
// Read-only; the safe.directory override only lets a differently owned checkout be read, never written.
function git(root,args){try{return execFileSync('git',['-c','safe.directory='+root,'-C',root,...args],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim();}catch{return null;}}
export function run(options,{definitions=loadSuites()}={}){
 const root=options.repo;
 if(!outsideRepository(options.out,root))throw refuse('--out must be outside the checkout under test: '+options.out);
 const uid=typeof process.getuid==='function'?process.getuid():null,gid=typeof process.getgid==='function'?process.getgid():null;
 if(uid===0&&!options.allowRoot)throw refuse('refusing to run as root: runner workspace checks require a non-root UID (pass --allow-root to record root results anyway)');
 const selected=definitions.suites.filter(s=>!options.only||options.only.has(s.name));
 if(options.only&&selected.length!==options.only.size)throw refuse('unknown suite name in --only');
 if(options.namePattern&&selected.some(s=>s.kind==='npm'))throw refuse('--name-pattern applies to node-test suites only; select them with --only');
 const python=options.subreaper?version(['python3','--version'])?'python3':null:null;
 mkdirSync(options.out,{recursive:true});
 // Only the parent exists: the association control creates its own directory and refuses an existing one.
 const scratchRoot=join(options.out,'scratch'),tools={python3:locate('python3'),soffice:locate('soffice')};mkdirSync(scratchRoot,{recursive:true});
 const env=scrubbedEnvironment(process.env,root,{scratchRoot,...tools});
 // A checkout without its own .git (an archive export) records no head, even when nested inside another repository.
 const top=git(root,['rev-parse','--show-toplevel']),head=top&&realpathSync(top)===realpathSync(root)?git(root,['rev-parse','HEAD']):null;
 const source={root,head,tree:head?git(root,['rev-parse','HEAD^{tree}']):null,branch:head?git(root,['branch','--show-current']):null,uncommittedPaths:head?(git(root,['status','--porcelain'])??'').split('\n').filter(Boolean).length:null,declaredSourceCommit:options.sourceCommit,declaredSourceCommitVerified:Boolean(head&&options.sourceCommit&&head===options.sourceCommit)};
 const host={node:process.version,nodeExecPath:process.execPath,npm:version(['npm','--version']),platform:process.platform,kernel:version(['uname','-r']),uid,gid,user:(()=>{try{return userInfo().username;}catch{return null;}})()};
 const environmentSelectors=Object.fromEntries(selectorKeys.map(k=>[k,env[k]??null])),scrubbedNames=Object.keys(process.env).filter(isScrubbed).sort();
 const results=[];const startedAt=new Date().toISOString();
 for(const suite of selected){
  const c=command(root,suite,options),wrapped=python?['python3','-I',join(here,'subreaper.py'),'--',...c.argv]:c.argv,began=Date.now(),suiteStarted=new Date().toISOString();
  process.stderr.write(`[local-baseline] ${suite.name}\n`);
  const r=spawnSync(wrapped[0],wrapped.slice(1),{cwd:c.cwd,env,encoding:'buffer',maxBuffer:256*1024*1024,timeout:suite.timeoutMs??1800000});
  const stdout=r.stdout??Buffer.alloc(0),stderr=r.stderr??Buffer.alloc(0),parsed=parseSpecOutput(stdout.toString('utf8'));
  writeFileSync(join(options.out,suite.name+'.stdout.txt'),stdout);writeFileSync(join(options.out,suite.name+'.stderr.txt'),stderr);
  const outcome={exitCode:r.status,signal:r.signal??null,timedOut:Boolean(r.error&&r.error.code==='ETIMEDOUT'),spawnError:r.error&&r.error.code!=='ETIMEDOUT'?r.error.code??String(r.error.message):null,startedAt:suiteStarted,durationMs:Date.now()-began,...parsed};
  const outputs={stdout:{path:suite.name+'.stdout.txt',bytes:stdout.length,sha256:sha256(stdout)},stderr:{path:suite.name+'.stderr.txt',bytes:stderr.length,sha256:sha256(stderr)}};
  const selectors={only:options.only?[...options.only]:null,namePattern:options.namePattern,files:c.files,nodeFlags:suite.nodeFlags??[],concurrency:suite.concurrency??null,npmScript:suite.kind==='npm'?{prefix:suite.prefix??'.',script:suite.script}:null,environment:environmentSelectors,scrubbedVariableNames:scrubbedNames};
  const invocation={argv:c.argv,wrappedArgv:wrapped,cwd:c.cwd,cwdRelative:relative(root,c.cwd)||'.',subreaper:Boolean(python),timeoutMs:suite.timeoutMs??1800000};
  writeSuiteReceipt(options.out,suiteReceipt({suite,source,host,selectors,invocation,outcome,outputs}));
  results.push({name:suite.name,purpose:suite.purpose??null,kind:suite.kind??'node-test',cwd:invocation.cwdRelative,command:c.argv.map(a=>a===process.execPath?'node':a),subreaper:Boolean(python),exitCode:r.status,signal:outcome.signal,timedOut:outcome.timedOut,durationMs:outcome.durationMs,...parsed,stdout:{bytes:stdout.length,sha256:outputs.stdout.sha256},stderr:{bytes:stderr.length,sha256:outputs.stderr.sha256},receipt:'receipts/'+suite.name+'.json',knownHostRequirements:suite.knownHostRequirements??[]});
  process.stderr.write(`[local-baseline] ${suite.name}: exit ${r.status}${parsed.counts.tests!==undefined?` tests ${parsed.counts.tests} pass ${parsed.counts.pass} fail ${parsed.counts.fail}`:''}\n`);
 }
 const totals=results.reduce((t,s)=>({suites:t.suites+1,passedSuites:t.passedSuites+(s.exitCode===0?1:0),tests:t.tests+(s.counts.tests??0),pass:t.pass+(s.counts.pass??0),fail:t.fail+(s.counts.fail??0)}),{suites:0,passedSuites:0,tests:0,pass:0,fail:0});
 const report={schema:'meri.local-baseline-results.v1',startedAt,finishedAt:new Date().toISOString(),repository:source,selectors:{only:options.only?[...options.only]:null,namePattern:options.namePattern},
  environment:{...host,postgres:version(['/usr/lib/postgresql/16/bin/postgres','--version']),soffice:version(['soffice','--version']),python3:version(['python3','--version']),docker:version(['docker','--version']),subreaper:Boolean(python),tools,scratchRoot,scrubbed:{prefixes:scrubbedPrefixes,keys:[...scrubbedKeys],suffixPattern:scrubbedSuffix.source,removedNames:scrubbedNames},supplied:environmentSelectors},totals,suites:results};
 writeFileSync(join(options.out,'RESULTS.json'),JSON.stringify(report,null,1)+'\n');
 writeChecksums(options.out);
 return report;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){
 let options;try{options=parseArguments(process.argv.slice(2));}catch(error){process.stderr.write((error.message??'invalid arguments')+'\n'+usage);process.exitCode=2;}
 if(options?.help){process.stdout.write(usage);}
 else if(options){try{const report=run(options);process.stdout.write(JSON.stringify({results:join(options.out,'RESULTS.json'),totals:report.totals})+'\n');process.exitCode=report.totals.passedSuites===report.totals.suites?0:1;}catch(error){process.stderr.write((error.code==='USAGE'?error.message:'local-baseline failed: '+(error.message??''))+'\n');process.exitCode=2;}}
}
