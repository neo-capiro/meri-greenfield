import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtemp,mkdir,copyFile,chmod,chown,readFile,writeFile,readlink,rmdir,rm,stat} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {isAbsolute} from 'node:path';
// Opt-in CLI, never loaded by an application or by the ordinary test suite.
// Usage: unshare --mount --net --propagation private node browser-sdk-broker.mjs LAUNCHER SHIM SDK_CLI
assert.equal(process.platform,'linux');assert.equal(process.getuid(),0);
const [launcher,shim,binary]=process.argv.slice(2);
assert.equal(process.argv.length,5);
assert.ok([launcher,shim,binary].every(path=>typeof path==='string'&&isAbsolute(path)));
for(const path of [launcher,shim,binary])assert.ok((await stat(path)).isFile());
assert.notEqual(await readlink('/proc/self/ns/net'),await readlink('/proc/1/ns/net'));
assert.notEqual(await readlink('/proc/self/ns/mnt'),await readlink('/proc/1/ns/mnt'));
assert.equal((await readFile('/proc/net/route','utf8')).trim().split('\n').length,1);
// Make propagation private even if the caller omitted unshare's propagation option.
execFileSync('/bin/mount',['--make-rprivate','/']);
const repo=fileURLToPath(new URL('../..',import.meta.url));
assert.equal(JSON.parse(await readFile(repo+'/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/package.json','utf8')).version,'0.3.295');
assert.equal(execFileSync(binary,['--version'],{env:{},timeout:5000,encoding:'utf8'}).trim(),'2.1.295 (Claude Code)');
const {query}=await import(repo+'/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs');
const {createNativeBrowserModelRelay}=await import(repo+'/apps/worker/conversation/host/browser-model-relay.mjs');
const {binding:baseBinding,installationFor,enabledPolicy}=await import(repo+'/apps/worker/conversation/browser/test/fixtures.mjs');
const {validateBrowserPolicy}=await import(repo+'/apps/worker/conversation/browser/policy.mjs');
const {browserPaths}=await import(repo+'/apps/worker/conversation/browser/workspace.mjs');
const {canonicalSha256}=await import(repo+'/packages/contracts/validate.mjs');
const {READINESS_MODEL_ENV}=await import(repo+'/apps/worker/conversation/sandbox-readiness/readiness.mjs');
const root=await mkdtemp('/tmp/meri-sdk-broker-');await chmod(root,0o755);
const created=[],mounted=[];let broker,child,sdk,server,consumer,timer,stage='prepare',shutdown=false,toolLists=0,toolCalls=0,sdkMessages=0;
const released=Promise.withResolvers(),abort=new AbortController();
const report={sdk:'0.3.295',cli:'2.1.295',userMessagesSent:0,scope:'LOCAL_ACTUAL_SDK_DIRECT_SHIM: synthetic authority; no active model turn, joined browser confinement or production acceptance'};
const exitOf=child=>new Promise(resolve=>{child.once('exit',(code,signal)=>resolve({code,signal}));child.once('error',()=>resolve({spawnFailed:true}));});
let brokerExit,childExit,group;
try{
 assert.notEqual(await readlink('/proc/self/ns/net'),await readlink('/proc/1/ns/net'));
 assert.notEqual(await readlink('/proc/self/ns/mnt'),await readlink('/proc/1/ns/mnt'));
 assert.equal((await readFile('/proc/net/route','utf8')).trim().split('\n').length,1);
 report.emptyNetworkNamespace=true;report.privateMountNamespace=true;
 for(const path of ['opt/meri/bin','run/meri-launch','workspace','config'])await mkdir(root+'/'+path,{recursive:true});
 await copyFile(shim,root+'/opt/meri/bin/meri-mcp-shim');await chmod(root+'/opt/meri/bin/meri-mcp-shim',0o755);
 await chown(root+'/run/meri-launch',0,2001);await chmod(root+'/run/meri-launch',0o710);
 for(const path of ['workspace','config']){await chown(root+'/'+path,2001,2001);await chmod(root+'/'+path,0o700);}
 for(const path of ['opt','run']){execFileSync('/bin/mount',['--bind',root+'/'+path,'/'+path]);mounted.push('/'+path);}
 const binding={...baseBinding,runId:randomUUID(),attemptId:randomUUID()},digest=canonicalSha256(binding),host=randomUUID();
 const installation={...installationFor(binding),launch:{...installationFor(binding).launch,nonce:randomBytes(32).toString('hex')}};
 const parent='/sys/fs/cgroup/meri/hosts/'+host+'-1',run=parent+'/'+digest;group=run+'/sdk';
 for(const path of ['/sys/fs/cgroup/meri','/sys/fs/cgroup/meri/hosts',parent,run,group]){
  try{await mkdir(path);created.push(path);}catch(error){if(error.code!=='EEXIST')throw error;}
 }
 const deadline=Promise.withResolvers();deadline.promise.catch(()=>{});
 timer=setTimeout(()=>{deadline.reject(Error('native SDK broker deadline'));abort.abort();},25000);
 const bounded=promise=>Promise.race([promise,deadline.promise]);
 broker=spawn(launcher,['broker',installation.launch.socketPath,'2001','2001',installation.launch.nonce,installation.launch.shimPath,host,'1',digest],{env:{},stdio:['ignore','ignore','pipe','pipe','pipe','pipe','pipe']});
 brokerExit=exitOf(broker);const listening=Promise.withResolvers(),authenticated=Promise.withResolvers();
 listening.promise.catch(()=>{});authenticated.promise.catch(()=>{});
 createInterface({input:broker.stdio[3]}).on('line',line=>{
  if(line==='L')listening.resolve();else if(line==='A'){report.nativePeerAuthenticated=true;authenticated.resolve();broker.stdio[4].end('G');}
 });
 brokerExit.then(()=>{if(!shutdown){listening.reject(Error('broker ended'));authenticated.reject(Error('broker authentication refused'));}});
 stage='listen';await bounded(listening.promise);
 server=await createNativeBrowserModelRelay({binding,installation,policy:validateBrowserPolicy(enabledPolicy()),paths:browserPaths('/workspace/'+binding.conversationId),readable:broker.stdio[6],writable:broker.stdio[6],onDisconnect:()=>{report.relayDisconnected=true;}}).bind({binding,installation,
  tools:async()=>{toolLists++;return [{name:'browser_snapshot',description:'Synthetic filtered snapshot',inputSchema:{type:'object',properties:{}}}];},
  call:async()=>{toolCalls++;throw Error('No model tools are permitted in this fixture');}});
 const wrapper='import os,sys;open(sys.argv[1]+"/cgroup.procs","w").write(str(os.getpid()));os.write(3,b"R");assert os.read(4,1)==b"G";os.close(3);os.close(4);os.setgroups([]);os.setgid(2001);os.setuid(2001);os.execve(sys.argv[2],sys.argv[2:],dict(os.environ))';
 sdk=query({prompt:(async function*(){await released.promise;})(),options:{cwd:root+'/workspace',pathToClaudeCodeExecutable:binary,abortController:abort,settingSources:[],settings:{autoMemoryEnabled:false},tools:[],allowedTools:[],mcpServers:server.mcpServers,strictMcpConfig:true,permissionMode:'default',maxTurns:1,
  env:{...READINESS_MODEL_ENV,HOME:root+'/config',CLAUDE_CONFIG_DIR:root+'/config',PATH:'/usr/bin:/bin',CLAUDE_AGENT_SDK_CLIENT_APP:'meri-local-no-model-probe'},
  spawnClaudeCodeProcess(descriptor){assert.equal(descriptor.command,binary);assert.equal(child,undefined);
   child=spawn('/usr/bin/python3',['-c',wrapper,group,descriptor.command,...descriptor.args],{cwd:descriptor.cwd,env:descriptor.env,stdio:['pipe','pipe','pipe','pipe','pipe']});childExit=exitOf(child);
   child.stdio[3].once('data',data=>{assert.equal(data.toString(),'R');broker.stdio[5].end(String(child.pid)+'\n');child.stdio[4].end('G');});return child;}}});
 consumer=(async()=>{try{for await(const message of sdk){sdkMessages++;assert.notEqual(message.type,'result');}}catch(error){if(!shutdown&&!abort.signal.aborted)throw error;}})();consumer.catch(()=>{});
 stage='initialize';await bounded(sdk.initializationResult());
 stage='native-authentication';await bounded(authenticated.promise);
 stage='connected-status';let statuses;
 for(let n=0;n<40;n++){statuses=await bounded(sdk.mcpServerStatus());if(statuses.some(s=>s.name==='meri_browser'&&s.status==='connected'))break;await new Promise(r=>setTimeout(r,100));}
 const status=statuses.find(s=>s.name==='meri_browser');assert.equal(status?.status,'connected');assert.ok(toolLists>0);assert.equal(toolCalls,0);
 assert.deepEqual(status.tools?.map(tool=>tool.name),['browser_snapshot']);
 report.sdkReportsConnected=true;report.canonicalRelayToolsListed=true;
 const leader=await readFile('/proc/'+child.pid+'/status','utf8');assert.match(leader,/^Uid:\s+2001\s+2001\s+2001\s+2001$/m);report.sdkNonrootUidVerified=true;
 const members=(await readFile(group+'/cgroup.procs','utf8')).trim().split('\n').map(Number);let direct=0;
 for(const pid of members){if((await readlink('/proc/'+pid+'/exe').catch(()=>''))!=='/opt/meri/bin/meri-mcp-shim')continue;
  const info=await readFile('/proc/'+pid+'/status','utf8');assert.match(info,new RegExp('^PPid:\\s+'+child.pid+'$','m'));direct++;}
 assert.equal(direct,1);report.exactShimDirectChildVerified=true;
 assert.deepEqual(await bounded(sdk.interrupt()),{still_queued:[]});await bounded(sdk.setPermissionMode('default'));report.sameSdkQueryRetained=true;
 assert.equal(sdkMessages,0);report.passed=true;
}catch(error){report.failureStage=stage;report.failure=error.name+': '+error.message.slice(0,200);process.exitCode=1;}
finally{
 shutdown=true;clearTimeout(timer);released.resolve();sdk?.close();abort.abort();
 try{
  if(group)await writeFile(group+'/cgroup.kill','1');child?.kill('SIGKILL');broker?.kill('SIGKILL');
  await Promise.all([childExit,brokerExit,consumer]);await server?.close();
  if(group){for(let n=0;;n++){if(/^populated 0$/m.test(await readFile(group+'/cgroup.events','utf8')))break;assert.ok(n<100);await new Promise(r=>setTimeout(r,20));}report.kernelProcessAbsenceObserved=true;}
  for(const path of created.reverse())await rmdir(path);report.createdCgroupsRemoved=true;
  for(const path of mounted.reverse())execFileSync('/bin/umount',[path]);
  await rm(root,{recursive:true,force:true});report.taskDirectoryRemoved=true;
 }catch(error){report.cleanupFailure=error.message.slice(0,200);process.exitCode=1;}
 report.toolLists=toolLists;report.toolCalls=toolCalls;report.sdkMessages=sdkMessages;
 console.log(JSON.stringify(report));
}
