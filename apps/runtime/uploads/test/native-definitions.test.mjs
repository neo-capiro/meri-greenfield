/** Signed-definition owner: immutable content-addressed snapshots, atomic pointer publication, real FreshClam formats,
 * exact database-byte validation and concurrent-scan isolation. The process port is injected and only synthesises
 * fixture bytes; nothing here is evidence that a real freshclam/sigtool run, image or corpus qualifies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join,relative,sep} from 'node:path';
import {mkdtemp,rm,mkdir,readFile,readdir,writeFile,symlink,realpath,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {UPLOAD_DEFINITIONS_MAX_AGE_MS,UPLOAD_DEFINITIONS_SCHEMA,UPLOAD_DEFINITIONS_FORMATS,createSignedDefinitionUpdater,
 createSignedDefinitionStore,freshclamConfiguration,freshclamArguments,cvdVerificationArguments,
 pruneSnapshots,definitionsSnapshotId,runDefinitionProgram} from '../native-definitions.mjs';
import * as definitionsModule from '../native-definitions.mjs';

const T0=1_700_000_000_000,DEADLINE=T0+30000;
const bytes=text=>Buffer.from(text);
const sha=value=>createHash('sha256').update(value).digest('hex');
const DEFAULTS={'main.cvd':bytes('main-cvd-body'),'daily.cvd':bytes('daily-cvd-body'),'bytecode.cvd':bytes('bytecode-cvd-body')};
/** Injected fixed process port: freshclam writes the staged database into the DatabaseDirectory its own generated
 * configuration names (so the test also proves configuration and port agree), sigtool records its verification form. */
function port({files=DEFAULTS,freshclamExit=0,sigtoolExit=0}={}){
 const calls=[];
 const fail=(name,exitCode)=>Object.assign(Error(name),{code:'ARTIFACT_PROCESS_FAILED',receipt:{exitCode},stdout:Buffer.alloc(0)});
 const run=async(command,args,options)=>{
  calls.push({command,args,cwd:options.cwd});
  if(command==='freshclam'){
   if(freshclamExit!==0)throw fail('freshclam',freshclamExit);
   const conf=await readFile(args[0].replace('--config-file=',''),'utf8');
   const line=conf.split('\n').find(row=>row.startsWith('DatabaseDirectory '));
   const database=line.slice('DatabaseDirectory '.length);
   await mkdir(database,{recursive:true,mode:0o700});
   for(const [name,content] of Object.entries(files))await(content===null?mkdir(join(database,name),{recursive:true}):writeFile(join(database,name),content));
   return {stdout:Buffer.from('Database updated')};
  }
  if(command==='sigtool'){
   if(sigtoolExit!==0)throw fail('sigtool',sigtoolExit);
   return {stdout:Buffer.from('Database information')};
  }
  throw fail(command,127);
 };
 return {run,calls,sigtool:calls.filter(call=>call.command==='sigtool'),freshclam:calls.filter(call=>call.command==='freshclam')};
}
async function withRoot(body){
 const root=await mkdtemp(join(await realpath(tmpdir()),'meri-defs-'));
 try{return await body(root);}finally{await rm(root,{recursive:true,force:true});}
}
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const snapshotDirs=async root=>(await readdir(join(root,'snapshots'),{withFileTypes:true}).catch(()=>[])).filter(e=>e.isDirectory()).map(e=>e.name);
const stagingDirs=async root=>await readdir(join(root,'staging')).catch(()=>[]);
const pointer=async root=>await readFile(join(root,'current'),'utf8').catch(()=>null);
const store=(root,options={})=>createSignedDefinitionStore({root,now:()=>T0,run:async()=>({stdout:Buffer.alloc(0)}),...options});

test('the freshclam configuration and verification forms are the supported vendor forms',()=>{
 const conf=freshclamConfiguration('/srv/staging'),lines=conf.split('\n');
 assert.equal(lines.some(line=>line.startsWith('DatabaseDirectory ')&&line.includes('staging')&&line.endsWith('database')),true);
 assert.equal(lines.some(line=>line.startsWith('UpdateLogFile ')&&line.endsWith('freshclam.log')),true);
 assert.equal(lines.includes('ScriptedUpdates no'),true,'a refresh is a full signed .cvd download, not an unsigned local .cld');
 assert.equal(lines.some(line=>line.startsWith('CompressLocalDatabase')),false,
  'CompressLocalDatabase only compresses a locally built .cld, so it is never configured as if it retained a signed container');
 assert.equal(lines.includes('DatabaseMirror database.clamav.net'),true);
 assert.deepEqual(UPLOAD_DEFINITIONS_FORMATS,['cvd'],'only the signed container is a publishable database format');
 assert.throws(()=>freshclamConfiguration('relative'),{code:'UPLOAD_DEFINITIONS_CONFIGURATION'});
 assert.deepEqual(freshclamArguments('/srv/staging/freshclam.conf'),['--config-file=/srv/staging/freshclam.conf','--foreground','--no-warnings']);
 assert.deepEqual(cvdVerificationArguments('/srv/d/main.cvd'),['--info','/srv/d/main.cvd']);
 assert.deepEqual(cvdVerificationArguments('/srv/d/daily.cvd'),['--info','/srv/d/daily.cvd']);
 // F7: the dead verification dispatchers are gone, and no form admits a delta or a detached signature.
 for(const dead of ['verificationArguments','cdiffVerificationArguments'])
  assert.equal(dead in definitionsModule,false,`${dead} is not exported: no delta or detached-signature path exists`);
 for(const file of ['/srv/d/main.cvd','/srv/d/daily.cvd'])
  assert.equal(cvdVerificationArguments(file).includes('--verify-cdiff'),false,'no delta form is admitted at all');
 assert.equal(typeof pruneSnapshots,'function','bounded storage disposition is on the resolve owner');
});

test('a verified refresh publishes an immutable content-addressed snapshot and moves the pointer atomically',async()=>{
 await withRoot(async root=>{
  const {run,calls}=port(),updater=createSignedDefinitionUpdater({root,run,now:()=>T0});
  const snapshot=await updater.provision({deadlineMs:DEADLINE});
  const id=definitionsSnapshotId(['main.cvd','daily.cvd','bytecode.cvd'].map(name=>({name,format:'cvd',sha256:sha(DEFAULTS[name])})));
  assert.equal(snapshot.sha256,id);
  assert.match(id,/^[a-f0-9]{64}$/u);
  assert.equal(snapshot.databaseDirectory,join(root,'snapshots',id,'database'));
  assert.deepEqual(await pointer(root),id,'the current pointer names the published snapshot');
  assert.deepEqual(await snapshotDirs(root),[id]);
  assert.deepEqual((await readdir(snapshot.databaseDirectory)).sort(),['bytecode.cvd','daily.cvd','main.cvd']);
  const manifest=await readJson(join(root,'snapshots',id,'snapshot.json'));
  assert.equal(manifest.schema,UPLOAD_DEFINITIONS_SCHEMA);
  assert.equal(manifest.signatureVerified,true);
  assert.equal(calls[0].command,'freshclam');
  assert.deepEqual(calls.map(call=>call.command),['freshclam','sigtool','sigtool','sigtool'],'every signed CVD is verified once');
  const published=await readdir(snapshot.databaseDirectory);
  for(const call of calls.filter(c=>c.command==='sigtool')){
   assert.equal(call.args[0],'--info');
   assert.match(call.args[1],/\.cvd$/u);
   assert.equal(published.includes(call.args[1].slice(call.args[1].search(/[^\\/]+$/u))),true,'verification names a file in the published snapshot');
  }
  assert.deepEqual(await stagingDirs(root),[],'no staging state survives a successful refresh');
  const resolved=await store(root).snapshot();
  assert.equal(resolved.sha256,id);assert.equal(resolved.databaseDirectory,snapshot.databaseDirectory);
  assert.deepEqual(resolved.files.map(f=>[f.name,f.format]),[['bytecode.cvd','cvd'],['daily.cvd','cvd'],['main.cvd','cvd']]);
 });
});

test('an unpacked .cld or an unapplied .cdiff is refused, even beside a verified signed .cvd',async()=>{
 // ClamAV's loader prefers a same-stem .cld whose version is higher and refuses the older .cvd, so an unauthenticated
 // .cld beside a verified container can be the database the engine actually reads. It is never published.
 const cases=[
  [{'main.cvd':bytes('main'),'daily.cld':bytes('daily-unpacked'),'bytecode.cvd':bytes('bytecode')},'an unpacked database alone'],
  [{'main.cvd':bytes('main'),'daily.cvd':bytes('daily'),'daily.cld':bytes('tampered-or-unrelated'),'bytecode.cvd':bytes('bytecode')},
   'a tampered or unrelated .cld beside its verified signed container'],
  [{...DEFAULTS,'daily.cdiff':bytes('delta')},'an unapplied delta']];
 for(const [files,why] of cases)await withRoot(async root=>{
  const {run,calls}=port({files});
  await assert.rejects(()=>createSignedDefinitionUpdater({root,run,now:()=>T0}).provision({deadlineMs:DEADLINE}),
   {code:'UPLOAD_DEFINITIONS_UNVERIFIED'},why);
  assert.equal(await pointer(root),null,why);
  assert.deepEqual(await snapshotDirs(root),[],why);
  assert.deepEqual(await stagingDirs(root),[],'a failed refresh leaves no staging state');
  for(const call of calls.filter(c=>c.command==='sigtool'))assert.match(call.args[1],/\.cvd$/u,'unsigned bytes are never handed to the verification tool');
 });
 await withRoot(async root=>{
  const published=await createSignedDefinitionUpdater({root,run:port().run,now:()=>T0}).provision({deadlineMs:DEADLINE});
  const {run}=port({files:{...DEFAULTS,'daily.cld':bytes('tampered-or-unrelated')}});
  await assert.rejects(()=>createSignedDefinitionUpdater({root,run,now:()=>T0}).provision({deadlineMs:DEADLINE}),
   {code:'UPLOAD_DEFINITIONS_UNVERIFIED'},'a later refresh cannot downgrade to an unsigned database');
  assert.equal(await pointer(root),published.sha256,'the previous signed snapshot stays current');
  assert.deepEqual(await snapshotDirs(root),[published.sha256]);
 });
});

test('normal freshclam output publishes only verified database bytes, with sidecars strictly separated',async()=>{
 const staged={'main.cvd':bytes('main'),'daily.cvd':bytes('daily'),'bytecode.cvd':bytes('bytecode'),
  'freshclam.dat':bytes('bookkeeping'),'mirrors.dat':bytes('mirrors'),'daily-27850.cvd.sign':bytes('detached-signature')};
 await withRoot(async root=>{
  const {run,calls}=port({files:staged});
  const snapshot=await createSignedDefinitionUpdater({root,run,now:()=>T0}).provision({deadlineMs:DEADLINE});
  assert.deepEqual(snapshot.files.map(f=>f.name),['bytecode.cvd','daily.cvd','main.cvd'],'only signed containers are published');
  assert.deepEqual((await readdir(snapshot.databaseDirectory)).sort(),['bytecode.cvd','daily.cvd','main.cvd'],
   'the published database directory holds only verified database bytes');
  const manifest=await readJson(join(root,'snapshots',snapshot.sha256,'snapshot.json'));
  for(const name of ['freshclam.dat','mirrors.dat','daily-27850.cvd.sign'])
   assert.equal(JSON.stringify(manifest).includes(name),false,name+' is a sidecar, never a published database byte');
  assert.deepEqual(calls.map(call=>call.command),['freshclam','sigtool','sigtool','sigtool'],'every container is verified once');
  for(const call of calls.filter(c=>c.command==='sigtool'))assert.match(call.args[1],/\.cvd$/u,'no sidecar is verified as a database');
  assert.equal((await store(root).snapshot()).sha256,snapshot.sha256);
  assert.deepEqual(await stagingDirs(root),[],'no staging state survives a successful refresh');
 });
});

test('an unsupported or incomplete staged set fails closed instead of silently omitting a database',async()=>{
 const cases=[
  [{'main.cvd':bytes('main'),'bytecode.cvd':bytes('bytecode')},'UPLOAD_DEFINITIONS_INCOMPLETE','the current daily database is never silently omitted'],
  [{'main.cvd':bytes('main')},'UPLOAD_DEFINITIONS_INCOMPLETE','the current main database is never silently omitted'],
  [{'freshclam.dat':bytes('x'),'mirrors.dat':bytes('y')},'UPLOAD_DEFINITIONS_INCOMPLETE','bookkeeping sidecars are not a database'],
  [{'main.cvd':bytes('main'),'daily.cvd':bytes('daily'),'notes.txt':bytes('x')},'UPLOAD_DEFINITIONS_FORMAT_UNSUPPORTED','an unknown file type is refused'],
  [{'main.cvd':bytes('main'),'daily.cvd':bytes('daily'),'extra':null},'UPLOAD_DEFINITIONS_FORMAT_UNSUPPORTED','a directory in the database is refused']];
 for(const [files,code,why] of cases)await withRoot(async root=>{
  const {run}=port({files});
  await assert.rejects(()=>createSignedDefinitionUpdater({root,run,now:()=>T0}).provision({deadlineMs:DEADLINE}),{code},why);
  assert.equal(await pointer(root),null,why);
  assert.deepEqual(await snapshotDirs(root),[],why);
  assert.deepEqual(await stagingDirs(root),[],why);
 });
});

test('a failed refresh or unverified signature preserves the previous valid snapshot',async()=>{
 await withRoot(async root=>{
  const published=await createSignedDefinitionUpdater({root,run:port().run,now:()=>T0}).provision({deadlineMs:DEADLINE});
  assert.equal((await store(root).snapshot()).sha256,published.sha256);
  const refreshed={...DEFAULTS,'daily.cvd':bytes('newer-daily')};
  await assert.rejects(()=>createSignedDefinitionUpdater({root,run:port({freshclamExit:3}).run,now:()=>T0}).provision({deadlineMs:DEADLINE}),{code:'UPLOAD_DEFINITIONS_REFRESH_FAILED'});
  await assert.rejects(()=>createSignedDefinitionUpdater({root,run:port({files:refreshed,sigtoolExit:1}).run,now:()=>T0}).provision({deadlineMs:DEADLINE}),{code:'UPLOAD_DEFINITIONS_UNVERIFIED'});
  await assert.rejects(()=>createSignedDefinitionUpdater({root,run:port().run,now:()=>T0}).provision({deadlineMs:T0}),{code:'UPLOAD_DEFINITIONS_EXPIRED'});
  assert.equal((await store(root).snapshot()).sha256,published.sha256,'the previous signed snapshot stays current');
  assert.deepEqual(await snapshotDirs(root),[published.sha256]);
  assert.deepEqual(await stagingDirs(root),[],'no staging state survives any failed refresh');
 });
});

test('the store validates the real database bytes and refuses forged, symlinked, added or missing files',async()=>{
 await withRoot(async root=>{
  const {run}=port(),updater=createSignedDefinitionUpdater({root,run,now:()=>T0});
  const published=await updater.provision({deadlineMs:DEADLINE}),id=published.sha256,database=published.databaseDirectory;
  const expect=async code=>await assert.rejects(()=>store(root).snapshot(),{code});
  await writeFile(join(database,'main.cvd'),bytes('tampered'));
  await expect('UPLOAD_DEFINITIONS_CORRUPT');
  await writeFile(join(database,'main.cvd'),DEFAULTS['main.cvd']);
  await writeFile(join(database,'extra.cvd'),bytes('not-listed'));
  await expect('UPLOAD_DEFINITIONS_CORRUPT');
  await rm(join(database,'extra.cvd'));
  await rm(join(database,'bytecode.cvd'));
  await expect('UPLOAD_DEFINITIONS_CORRUPT');
  await writeFile(join(database,'bytecode.cvd'),DEFAULTS['bytecode.cvd']);
  await rm(join(database,'main.cvd'));await symlink(join(root,'elsewhere'),join(database,'main.cvd'));
  await expect('UPLOAD_DEFINITIONS_CORRUPT');
  await rm(join(database,'main.cvd'));await writeFile(join(database,'main.cvd'),DEFAULTS['main.cvd']);
  const manifest=await readJson(join(root,'snapshots',id,'snapshot.json'));
  await writeFile(join(root,'snapshots',id,'snapshot.json'),JSON.stringify({...manifest,signatureVerified:false}));
  await expect('UPLOAD_DEFINITIONS_CORRUPT');
  await writeFile(join(root,'snapshots',id,'snapshot.json'),JSON.stringify({...manifest,publishedAtMs:T0+5000}));
  await expect('UPLOAD_DEFINITIONS_CORRUPT');
  await writeFile(join(root,'snapshots',id,'snapshot.json'),JSON.stringify({...manifest,files:manifest.files.map(f=>f.name==='main.cvd'?{...f,format:'cld'}:f)}));
  await expect('UPLOAD_DEFINITIONS_CORRUPT');
  await writeFile(join(root,'snapshots',id,'snapshot.json'),JSON.stringify({...manifest,sha256:'0'.repeat(64)}));
  await expect('UPLOAD_DEFINITIONS_CORRUPT');
  await writeFile(join(root,'snapshots',id,'snapshot.json'),'{not json');
  await expect('UPLOAD_DEFINITIONS_UNAVAILABLE');
  await rm(join(root,'snapshots',id),{recursive:true,force:true});
  await expect('UPLOAD_DEFINITIONS_UNAVAILABLE');
  await mkdir(join(root,'snapshots',id),{recursive:true});
  await writeFile(join(root,'snapshots',id,'snapshot.json'),JSON.stringify(manifest));
  await assert.rejects(()=>store(root).snapshot(),{code:'UPLOAD_DEFINITIONS_UNAVAILABLE'},'a snapshot directory without its database is unusable');
 });
});

test('the pointer is validated, so traversal, absence and expiry close distinctly',async()=>{
 await withRoot(async root=>{
  await assert.rejects(()=>store(root).snapshot(),{code:'UPLOAD_DEFINITIONS_UNAVAILABLE'});
  const published=await createSignedDefinitionUpdater({root,run:port().run,now:()=>T0}).provision({deadlineMs:DEADLINE});
  for(const value of ['../../etc/passwd','deadbeef','',published.sha256+'\n'+published.sha256])await withWrittenPointer(root,value,async()=>
   await assert.rejects(()=>store(root).snapshot(),{code:'UPLOAD_DEFINITIONS_CORRUPT'},JSON.stringify(value)));
  await assert.rejects(()=>store(root,{now:()=>T0-1}).snapshot(),{code:'UPLOAD_DEFINITIONS_CORRUPT'},'a future-dated snapshot is not admitted');
  await assert.rejects(()=>store(root,{now:()=>T0+2,maxAgeMs:1}).snapshot(),{code:'UPLOAD_DEFINITIONS_STALE'});
  assert.equal(UPLOAD_DEFINITIONS_MAX_AGE_MS,72*60*60*1000);
  const aborted=new AbortController();aborted.abort();
  await assert.rejects(()=>store(root).snapshot({signal:aborted.signal}),{code:'UPLOAD_DEFINITIONS_CANCELLED'});
  assert.throws(()=>createSignedDefinitionStore({root:'relative'}),{code:'UPLOAD_DEFINITIONS_CONFIGURATION'});
  assert.throws(()=>createSignedDefinitionUpdater({root:'relative',run:port().run}),{code:'UPLOAD_DEFINITIONS_CONFIGURATION'});
 });
});
async function withWrittenPointer(root,value,body){await writeFile(join(root,'current'),value);try{return await body();}finally{await createSignedDefinitionUpdater({root,run:port().run,now:()=>T0}).provision({deadlineMs:DEADLINE});}}

test('a published snapshot is never deleted or rewritten by a later refresh, and concurrent refreshes do not collide',async()=>{
 await withRoot(async root=>{
  const first=await createSignedDefinitionUpdater({root,run:port().run,now:()=>T0}).provision({deadlineMs:DEADLINE});
  const held=await store(root).snapshot();
  const newer={...DEFAULTS,'daily.cvd':bytes('next-daily')};
  const second=await createSignedDefinitionUpdater({root,run:port({files:newer}).run,now:()=>T0}).provision({deadlineMs:DEADLINE});
  assert.notEqual(second.sha256,first.sha256);
  assert.equal((await store(root).snapshot()).sha256,second.sha256,'a new refresh moves the pointer');
  const reread=await readFile(join(held.databaseDirectory,'daily.cvd'));
  assert.equal(sha(reread),first.files.find(f=>f.name==='daily.cvd').sha256,'an in-flight reader keeps the exact bytes it resolved');
  assert.deepEqual((await snapshotDirs(root)).sort(),[first.sha256,second.sha256].sort(),'no published snapshot is deleted');
 });
 await withRoot(async root=>{
  const refreshed=await Promise.all(Array.from({length:8},()=>port())
   .map(spec=>createSignedDefinitionUpdater({root,run:spec.run,now:()=>T0}).provision({deadlineMs:DEADLINE})));
  assert.equal(new Set(refreshed.map(snapshot=>snapshot.sha256)).size,1,'identical content-addresses converge on one published snapshot');
  assert.deepEqual(await snapshotDirs(root),[refreshed[0].sha256]);
  assert.equal(await pointer(root),refreshed[0].sha256);
  assert.deepEqual(await stagingDirs(root),[],'concurrent refreshes leave no staging state');
 });
});

test('ACCESS: exact owner paths only, applied in creation order, never before they exist', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-access-'));
 const recorded=[];
 const chmodPort=async(path,mode)=>{await lstat(path);recorded.push({path,mode:mode.toString(8)});};
 const chownPort=async(path,uid,gid)=>{await lstat(path);recorded.push({path,owner:`${uid}:${gid}`});};
 const run=async(program,args)=>{
  if(program==='sigtool')return {stdout:Buffer.alloc(0),receipt:{exitCode:0}};
  assert.equal(program,'freshclam');
  const conf=await readFile(args[0].slice('--config-file='.length),'utf8');
  const database=conf.split('\n').find(line=>line.startsWith('DatabaseDirectory ')).slice('DatabaseDirectory '.length);
  await writeFile(join(database,'main.cvd'),Buffer.from('main CVD'));
  await writeFile(join(database,'daily.cvd'),Buffer.from('daily CVD'));
  return {stdout:Buffer.alloc(0),receipt:{exitCode:0}};
 };
 try{
  const updater=createSignedDefinitionUpdater({root,run,chmod:chmodPort,chown:chownPort});
  await updater.provision({deadlineMs:Date.now()+5000});
  const first=recorded.findIndex(entry=>entry.path===join(root,'staging'));
  const writer=[...new Set(recorded.filter(entry=>entry.owner!==undefined)
   .map(entry=>relative(root,entry.path).split(sep).join('/')))];
  // ONLY the unique staging directory and its database are handed to UID1000; the root, the staging parent and every
  // published path stay root-owned.
  assert.equal(writer.length,2,JSON.stringify(writer));
  assert.ok(writer.every(path=>/^staging\/refresh-[A-Za-z0-9]{6}(\/database)?$/u.test(path)),JSON.stringify(writer));
  assert.equal(writer.some(path=>path==='staging'||path.startsWith('snapshots')),false);
  assert.ok(first>=0&&recorded[first].mode==='755','the staging parent stays root-owned and non-writable');
  assert.ok(recorded.some(entry=>entry.path===join(root,'snapshots')&&entry.mode==='555'));
  const published=recorded.filter(entry=>entry.path.includes(`${sep}snapshots${sep}`)&&entry.mode!==undefined);
  assert.ok(published.length>=4,'the published snapshot is narrowed after publication');
  assert.ok(published.every(entry=>entry.mode==='444'||entry.mode==='555'),'published data is read-only to the child');
  assert.equal(recorded.at(-1).path,join(root,'current'),'the pointer is narrowed LAST, after the atomic rename');
  assert.equal(recorded.at(-1).mode,'444');
  // A second refresh works on the same namespace (no mode blocks the owner's own write path).
  await updater.provision({deadlineMs:Date.now()+5000});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('PROGRAM FORMS: only the host-generated argument forms reach a spawn port', async () => {
 let spawns=0,reached=[];
 const ports={spawn:(command,args)=>{spawns+=1;reached.push({command,args});throw Error('INERT_SPAWN');},
  kill:()=>{throw Error('unexpected kill');}};
 const cwd='/srv/staging',config=cwd+'/freshclam.conf',cvd=cwd+'/database/main.cvd';
 const refused=[
  ['freshclam',['--daemon']],
  ['freshclam',['--config-file='+config]],                              // one-arg arbitrary form is not owner-generated
  ['freshclam',['--config-file=/tmp/arbitrary','--foreground','--no-warnings']],
  ['sigtool',['/tmp/not-a-cvd']],
  ['sigtool',['--datadir=/tmp/not-a-cvd']],
  ['sigtool',['/tmp/a','/tmp/b']],
  ['sigtool',['--info','/tmp/not-a-cvd']],                              // not a .cvd in this cwd's database
  ['sigtool',['--info',cwd+'/database/main.cld']],                       // unsupported published name form
 ];
 for(const [program,args] of refused)
  await assert.rejects(runDefinitionProgram(program,args,{cwd,deadlineMs:Date.now()+1000,ports}),
   e=>e?.code==='UPLOAD_DEFINITIONS_PROGRAM_REFUSED',`${program} ${JSON.stringify(args)}`);
 assert.equal(spawns,0,'no unsupported form reached the spawn port');
 // The two forms the host itself generates DO reach the (inert) spawn port.
 for(const [program,args] of [['freshclam',freshclamArguments(config)],['sigtool',cvdVerificationArguments(cvd)]])
  await assert.rejects(runDefinitionProgram(program,args,{cwd,deadlineMs:Date.now()+1000,ports}),
   e=>e?.message==='INERT_SPAWN',`${program} should reach spawn`);
 assert.equal(spawns,2,'both generated forms reached the inert spawn port');
});
