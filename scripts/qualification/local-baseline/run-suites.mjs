#!/usr/bin/env node
/** Reproducible local source-check runner. Records every suite outcome; failures are retained, never hidden. */
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,globSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {userInfo} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),defaultRoot=resolve(here,'../../..');
const usage='Usage: node scripts/qualification/local-baseline/run-suites.mjs --out DIR [--repo DIR] [--only name,name] [--allow-root] [--no-subreaper]\nExit: 0 every suite passed; 1 at least one suite failed (results written); 2 usage/configuration.\n';
export function parseArguments(argv){
 const options={repo:defaultRoot,out:null,only:null,allowRoot:false,subreaper:true};
 for(let i=0;i<argv.length;i++){const a=argv[i];
  if(a==='--help'||a==='-h')return {help:true};
  if(a==='--repo')options.repo=resolve(argv[++i]??'');else if(a==='--out')options.out=resolve(argv[++i]??'');else if(a==='--only')options.only=new Set((argv[++i]??'').split(',').filter(Boolean));
  else if(a==='--allow-root')options.allowRoot=true;else if(a==='--no-subreaper')options.subreaper=false;else throw Object.assign(Error('unknown argument: '+a),{code:'USAGE'});}
 if(!options.out)throw Object.assign(Error('--out is required'),{code:'USAGE'});
 return options;
}
/** Ambient credentials and host overrides are removed; the runtime refuses several of them outright. */
const scrubbedPrefixes=['AWS_','ANTHROPIC_','CLAUDE','CCR_','TEMPORAL_','PG','NPM_CONFIG_','GH_','GITHUB_','CLOUDSDK_','GIT_CONFIG_','GIT_ASKPASS','GLOBAL_AGENT_'];
const scrubbedKeys=new Set(['DATABASE_URL','NODE_OPTIONS','NODE_PATH','NODE_EXTRA_CA_CERTS','MERI_NATIVE_ADMIN_TOKEN','HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy','ALL_PROXY','all_proxy','NO_PROXY','no_proxy']);
// Any credential-shaped key is removed regardless of prefix; test processes receive no host tokens.
const scrubbedSuffix=/(TOKEN|SECRET|PASSWORD|PASSPHRASE|CREDENTIALS?|API_KEY|ACCESS_KEY|_PROXY)$/iu;
/** Writable artifact roots the existing skill pipeline tests require without a default. */
const scratchSelectors=['MERI_PIPELINE_ARTIFACT_ROOT','MERI_ASSOCIATION_ARTIFACT_ROOT'];
export function scrubbedEnvironment(source,root,{scratchRoot,python3,soffice}={}){
 const env={};for(const [key,value] of Object.entries(source)){if(scrubbedKeys.has(key)||scrubbedSuffix.test(key)||scrubbedPrefixes.some(p=>key.startsWith(p)))continue;env[key]=value;}
 env.MERI_REVIEW_SOURCE_ROOT=root;
 // Canonical local fixture selectors used by the existing PostgreSQL-backed tests (see provision-postgres.sh).
 env.MERI_INSPECTION_TEST_SOCKET??='/tmp/meri-prepared-kickoff-pg-20261014/socket';env.MERI_INSPECTION_TEST_DATABASE??='meri_inspection_final';env.MERI_PREPARED_LAUNCH_DATABASE??='meri_prepared_launch';
 if(scratchRoot)for(const key of scratchSelectors)env[key]??=join(scratchRoot,key.toLowerCase());
 // Only the tests that already honor these selectors use them; the others keep their hard-coded host paths.
 if(python3){env.MERI_DOCUMENT_PYTHON??=python3;env.MERI_PYTHON??=python3;}if(soffice)env.MERI_SOFFICE??=soffice;
 return env;
}
function locate(name){try{return execFileSync('sh',['-c','command -v '+name],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','ignore']}).trim()||null;}catch{return null;}}
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Parse the Node spec reporter summary and failing-test section. */
export function parseSpecOutput(text){
 const counts={};for(const key of ['tests','suites','pass','fail','cancelled','skipped','todo']){const m=new RegExp('^ℹ '+key+' (\\d+)$','mu').exec(text);if(m)counts[key]=Number(m[1]);}
 const failures=[];const lines=text.split('\n');let i=lines.findIndex(l=>/^✖ failing tests:/u.test(l));
 if(i>=0)for(i++;i<lines.length;i++){const m=/^✖ (.*?)(?: \((\d+(?:\.\d+)?)ms\))?$/u.exec(lines[i]);if(!m)continue;let detail=null;for(let j=i+1;j<lines.length&&!/^(✖|test at )/u.test(lines[j]);j++){const t=lines[j].trim();if(t&&!/^\}$/u.test(t)){detail=t.slice(0,300);break;}}failures.push({name:m[1],detail});}
 return {counts,failures};
}
function command(root,suite){
 if(suite.kind==='npm')return {cwd:root,argv:['npm','run',suite.script,'--prefix',suite.prefix??'.','--silent']};
 const cwd=resolve(root,suite.cwd??'.');const files=(suite.files??[]).flatMap(pattern=>globSync(pattern,{cwd}).filter(f=>!f.includes('node_modules'))).sort();
 if(!files.length)throw Object.assign(Error('no test files for suite '+suite.name),{code:'USAGE'});
 return {cwd,argv:[process.execPath,...(suite.nodeFlags??[]),'--test','--test-reporter=spec','--test-reporter-destination=stdout',...(suite.concurrency?['--test-concurrency='+suite.concurrency]:[]),...files]};
}
function version(argv){try{return execFileSync(argv[0],argv.slice(1),{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim().split('\n')[0];}catch{return null;}}
// Read-only; the safe.directory override only lets a differently owned checkout be read, never written.
function git(root,args){try{return execFileSync('git',['-c','safe.directory='+root,'-C',root,...args],{encoding:'utf8',timeout:10000}).trim();}catch{return null;}}
export function run(options){
 const root=options.repo,definitions=JSON.parse(readFileSync(join(here,'suites.json'),'utf8'));
 if(definitions.schema!=='meri.local-baseline-suites.v1')throw Object.assign(Error('unknown suites schema'),{code:'USAGE'});
 const uid=typeof process.getuid==='function'?process.getuid():null;
 if(uid===0&&!options.allowRoot)throw Object.assign(Error('refusing to run as root: runner workspace checks require a non-root UID (pass --allow-root to record root results anyway)'),{code:'USAGE'});
 const python=options.subreaper?version(['python3','--version'])?'python3':null:null;
 mkdirSync(options.out,{recursive:true});
 // Only the parent exists: the association control creates its own directory and refuses an existing one.
 const scratchRoot=join(options.out,'scratch'),tools={python3:locate('python3'),soffice:locate('soffice')};mkdirSync(scratchRoot,{recursive:true});
 const env=scrubbedEnvironment(process.env,root,{scratchRoot,...tools}),selected=definitions.suites.filter(s=>!options.only||options.only.has(s.name));
 if(options.only&&selected.length!==options.only.size)throw Object.assign(Error('unknown suite name in --only'),{code:'USAGE'});
 const results=[];const startedAt=new Date().toISOString();
 for(const suite of selected){
  const c=command(root,suite),wrapped=python?['python3','-I',join(here,'subreaper.py'),'--',...c.argv]:c.argv,began=Date.now();
  process.stderr.write(`[local-baseline] ${suite.name}\n`);
  const r=spawnSync(wrapped[0],wrapped.slice(1),{cwd:c.cwd,env,encoding:'buffer',maxBuffer:256*1024*1024,timeout:suite.timeoutMs??1800000});
  const stdout=r.stdout??Buffer.alloc(0),stderr=r.stderr??Buffer.alloc(0),text=stdout.toString('utf8');
  writeFileSync(join(options.out,suite.name+'.stdout.txt'),stdout);writeFileSync(join(options.out,suite.name+'.stderr.txt'),stderr);
  const parsed=suite.kind==='npm'?{counts:{},failures:[]}:parseSpecOutput(text);
  results.push({name:suite.name,purpose:suite.purpose??null,kind:suite.kind??'node-test',cwd:relative(root,c.cwd)||'.',command:c.argv.map(a=>a===process.execPath?'node':a),subreaper:Boolean(python),exitCode:r.status,signal:r.signal??null,timedOut:Boolean(r.error&&r.error.code==='ETIMEDOUT'),durationMs:Date.now()-began,...parsed,stdout:{bytes:stdout.length,sha256:sha256(stdout)},stderr:{bytes:stderr.length,sha256:sha256(stderr)},knownHostRequirements:suite.knownHostRequirements??[]});
  process.stderr.write(`[local-baseline] ${suite.name}: exit ${r.status}${parsed.counts.tests!==undefined?` tests ${parsed.counts.tests} pass ${parsed.counts.pass} fail ${parsed.counts.fail}`:''}\n`);
 }
 const totals=results.reduce((t,s)=>({suites:t.suites+1,passedSuites:t.passedSuites+(s.exitCode===0?1:0),tests:t.tests+(s.counts.tests??0),pass:t.pass+(s.counts.pass??0),fail:t.fail+(s.counts.fail??0)}),{suites:0,passedSuites:0,tests:0,pass:0,fail:0});
 const report={schema:'meri.local-baseline-results.v1',startedAt,finishedAt:new Date().toISOString(),repository:{root,head:git(root,['rev-parse','HEAD']),tree:git(root,['rev-parse','HEAD^{tree}']),branch:git(root,['branch','--show-current']),uncommittedPaths:(git(root,['status','--porcelain'])??'').split('\n').filter(Boolean).length},
  environment:{node:process.version,platform:process.platform,kernel:version(['uname','-r']),uid,user:(()=>{try{return userInfo().username;}catch{return null;}})(),postgres:version(['/usr/lib/postgresql/16/bin/postgres','--version']),soffice:version(['soffice','--version']),python3:version(['python3','--version']),docker:version(['docker','--version']),subreaper:Boolean(python),tools,scratchRoot,scrubbed:{prefixes:scrubbedPrefixes,keys:[...scrubbedKeys],suffixPattern:scrubbedSuffix.source},supplied:Object.fromEntries(['MERI_REVIEW_SOURCE_ROOT','MERI_INSPECTION_TEST_SOCKET','MERI_INSPECTION_TEST_DATABASE','MERI_PREPARED_LAUNCH_DATABASE',...scratchSelectors,'MERI_DOCUMENT_PYTHON','MERI_PYTHON','MERI_SOFFICE'].map(k=>[k,env[k]??null]))},totals,suites:results};
 writeFileSync(join(options.out,'RESULTS.json'),JSON.stringify(report,null,1)+'\n');
 return report;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){
 let options;try{options=parseArguments(process.argv.slice(2));}catch(error){process.stderr.write((error.message??'invalid arguments')+'\n'+usage);process.exitCode=2;}
 if(options?.help){process.stdout.write(usage);}
 else if(options){try{const report=run(options);process.stdout.write(JSON.stringify({results:join(options.out,'RESULTS.json'),totals:report.totals})+'\n');process.exitCode=report.totals.passedSuites===report.totals.suites?0:1;}catch(error){process.stderr.write((error.code==='USAGE'?error.message:'local-baseline failed: '+(error.message??''))+'\n');process.exitCode=2;}}
}
