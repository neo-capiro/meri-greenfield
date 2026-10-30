import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtemp,mkdir,copyFile,chmod,chown,readFile,writeFile,readlink,rmdir,rm,stat} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {isAbsolute} from 'node:path';
// Opt-in CLI, never loaded by an application or by the ordinary test suite.
// Usage: unshare --mount --net --propagation private node browser-retained-context.mjs LAUNCHER SHIM SDK_CLI PLAYWRIGHT_CLI BROWSERS LIBS
assert.equal(process.platform,'linux');assert.equal(process.getuid(),0);
const [launcher,shim,binary,cliPath,browsersPath,libraryPath]=process.argv.slice(2);
assert.equal(process.argv.length,8);
assert.ok([launcher,shim,binary,cliPath,browsersPath,libraryPath].every(path=>typeof path==='string'&&isAbsolute(path)));
for(const path of [launcher,shim,binary])assert.ok((await stat(path)).isFile());
assert.notEqual(await readlink('/proc/self/ns/net'),await readlink('/proc/1/ns/net'));
assert.notEqual(await readlink('/proc/self/ns/mnt'),await readlink('/proc/1/ns/mnt'));
assert.equal((await readFile('/proc/net/route','utf8')).trim().split('\n').length,1);
// Make propagation private even if the caller omitted unshare's propagation option.
execFileSync('/bin/mount',['--make-rprivate','/']);
// Chromium's private CDP bridge needs loopback; the namespace still has no external route.
execFileSync('/usr/sbin/ip',['link','set','lo','up']);
const repo=fileURLToPath(new URL('../..',import.meta.url));
assert.equal(JSON.parse(await readFile(repo+'/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/package.json','utf8')).version,'0.3.295');
assert.equal(execFileSync(binary,['--version'],{env:{},timeout:5000,encoding:'utf8'}).trim(),'2.1.295 (Claude Code)');
const {query}=await import(repo+'/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs');
const {createBrowserSessionHost}=await import(repo+'/apps/worker/conversation/host/browser-session-host.mjs');
const {createConfinedContextPort,pinnedBrowserUpstream}=await import(repo+'/apps/worker/conversation/host/launcher/context-port.mjs');
const {createSdkChildQuiescenceObserver}=await import(repo+'/apps/worker/conversation/host/launcher/sdk-quiescence.mjs');
const {binding:baseBinding,installationFor,enabledPolicy}=await import(repo+'/apps/worker/conversation/browser/test/fixtures.mjs');
const {validateBrowserPolicy}=await import(repo+'/apps/worker/conversation/browser/policy.mjs');
const {browserPaths,disposeBrowserState}=await import(repo+'/apps/worker/conversation/browser/workspace.mjs');
const {canonicalSha256}=await import(repo+'/packages/contracts/validate.mjs');
const {READINESS_MODEL_ENV}=await import(repo+'/apps/worker/conversation/sandbox-readiness/readiness.mjs');
const root=await mkdtemp('/tmp/meri-retained-browser-');await chmod(root,0o755);
const created=[],mounted=[];let broker,child,browserChild,sdk,server,consumer,timer,contexts,context,user,observer,retainedHost,paths,custody,stage='prepare',diagnostic='',shutdown=false,retiring=false,applied=false,sdkMessages=0;
const released=Promise.withResolvers(),abort=new AbortController();
let canonicalHandoff;
const report={sdk:'0.3.295',cli:'2.1.295',userMessagesSent:0,scope:'LOCAL_ACTUAL_SDK_RETAINED_CHROMIUM_SUCCESSOR: synthetic canonical authority; real native brokers, two SDK processes, SDK cgroup absence and retained session owner; no active model turn, full D005 mount/network confinement, production composition or deployed acceptance'};
const exitOf=child=>new Promise(resolve=>{child.once('exit',(code,signal)=>resolve({code,signal}));child.once('error',()=>resolve({spawnFailed:true}));});
let brokerExit,childExit,browserExit,group,browserGroup;
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
 const installation={...installationFor(binding),nodePath:process.execPath,cliPath,browsersPath,launch:{...installationFor(binding).launch,nonce:randomBytes(32).toString('hex')}};
 const parent='/sys/fs/cgroup/meri/hosts/'+host+'-1',run=parent+'/'+digest;group=run+'/sdk';browserGroup=run+'/browser';
 for(const path of ['/sys/fs/cgroup/meri','/sys/fs/cgroup/meri/hosts',parent,run,group,browserGroup]){
  try{await mkdir(path);created.push(path);}catch(error){if(error.code!=='EEXIST')throw error;}
 }
 const deadline=Promise.withResolvers();deadline.promise.catch(()=>{});
 timer=setTimeout(()=>{deadline.reject(Error('native SDK broker deadline'));abort.abort();},60000);
 const bounded=promise=>Promise.race([promise,deadline.promise]);
 broker=spawn(launcher,['broker',installation.launch.socketPath,'2001','2001',installation.launch.nonce,installation.launch.shimPath,host,'1',digest],{env:{},stdio:['ignore','ignore','pipe','pipe','pipe','pipe','pipe']});
 brokerExit=exitOf(broker);const listening=Promise.withResolvers(),authenticated=Promise.withResolvers();
 listening.promise.catch(()=>{});authenticated.promise.catch(()=>{});
 createInterface({input:broker.stdio[3]}).on('line',line=>{
  if(line==='L')listening.resolve();else if(line==='A'){report.nativePeerAuthenticated=true;authenticated.resolve();broker.stdio[4].end('G');}
 });
 brokerExit.then(()=>{if(!shutdown){listening.reject(Error('broker ended'));authenticated.reject(Error('broker authentication refused'));}});
 stage='listen';await bounded(listening.promise);
 const policy=validateBrowserPolicy(enabledPolicy({tools:['browser_snapshot']})),cwd=root+'/workspace/'+binding.conversationId;
 await mkdir(cwd);await chmod(root+'/workspace',0o755);await chmod(cwd,0o755);
 paths=browserPaths(cwd);for(const path of Object.values(paths)){await mkdir(path,{recursive:true});await chown(path,2002,2002);await chmod(path,0o700);}
 const browserWrapper='import os,sys;open(sys.argv[1]+"/cgroup.procs","w").write(str(os.getpid()));os.setgroups([]);os.setgid(2002);os.setuid(2002);os.execve(sys.argv[2],sys.argv[2:],dict(os.environ))';
 browserChild=spawn('/usr/bin/python3',['-c',browserWrapper,browserGroup,process.execPath,repo+'/apps/worker/conversation/host/launcher/context-child.mjs',cliPath,paths.profile,installation.egressProxy,'5000','30000'],
  {cwd:paths.home,env:{HOME:paths.home,PATH:'/usr/bin:/bin',PLAYWRIGHT_BROWSERS_PATH:browsersPath,LD_LIBRARY_PATH:libraryPath},stdio:['pipe','pipe','pipe']});
 browserExit=exitOf(browserChild);browserChild.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk.toString()).slice(-3000);});
 contexts=createConfinedContextPort({native:{readable:browserChild.stdout,writable:browserChild.stdin,close:async()=>{browserChild.kill('SIGKILL');await browserExit;}},binding,policy,installation,paths});
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,hostId:host,imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+55000};
 const hostIdentity={schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef0',bootId:(await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim(),conversationId:binding.conversationId,hostId:host};
 const fixtureCurrent=async()=>{assert.ok(Date.now()<allocation.leaseDeadlineMs);return {browserHandoff:canonicalHandoff};};
 const awaitEmpty=async path=>{for(let n=0;;n++){if(/^populated 0$/m.test(await readFile(path+'/cgroup.events','utf8')))return;assert.ok(n<150);await new Promise(r=>setTimeout(r,20));}};
 const sessionHost=createBrowserSessionHost({binding,cwd,installation,allocation,ownerInstanceId:randomUUID(),upstream:pinnedBrowserUpstream(installation),now:Date.now,
  contexts:{async create(input){context=await contexts.create(input);return context;}},current:fixtureCurrent,hold:async()=>({outcome:applied?'APPLIED':'PENDING'}),
  modelTransport:{readable:broker.stdio[6],writable:broker.stdio[6]},controls:{async bind(input){user=input.controls;return {async close(){try{input.controls.endLease('viewer-disconnect');}catch{}}};}},
  processes:{async waitForExit(){await contexts.close();await writeFile(browserGroup+'/cgroup.kill','1');await awaitEmpty(browserGroup);return {exited:true};}},
  dispose:input=>disposeBrowserState(input.paths,{signal:input.signal}),
  retirement:{async prepare(){observer=createSdkChildQuiescenceObserver({allocation,binding,hostIdentity,timeoutMs:5000});await observer.arm({sdkLeaderPid:child.pid});},
   async wait(){broker.kill('SIGKILL');await brokerExit;const proof=await observer.waitQuiescent();assert.equal(proof.quiescent,true);report.exactSdkSubtreeAbsent=true;},
   async retain(){assert.equal(report.exactSdkSubtreeAbsent,true);await fixtureCurrent();}}});
 retainedHost=sessionHost;
 stage='browser-open';server=await bounded(retainedHost.open({binding,policy,deadlineMs:allocation.leaseDeadlineMs,manifest:null}));
 assert.equal(child,undefined);report.contextCreatedBeforeSdk=true;
 assert.match(await readFile('/proc/'+browserChild.pid+'/status','utf8'),/^Uid:\s+2002\s+2002\s+2002\s+2002$/m);
 const page=context.pages()[0];await page.setViewportSize({width:1000,height:700});
 await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Retained native context</h1><input type="password" value="SYNTHETIC_CUSTODY_SECRET"><p>SYNTHETIC_CUSTODY_SECRET</p>'}));
 await page.goto('https://records.example/');
 let nativeBrowser;
 for(const pid of (await readFile(browserGroup+'/cgroup.procs','utf8')).trim().split('\n')){try{
  const status=await readFile('/proc/'+pid+'/status','utf8'),args=(await readFile('/proc/'+pid+'/cmdline','utf8')).split('\0');
  if(new RegExp('^PPid:\\s+'+browserChild.pid+'$','m').test(status)&&args.some(arg=>arg.startsWith('--user-data-dir='))){assert.match(status,/^Uid:\s+2002\s+2002\s+2002\s+2002$/m);nativeBrowser=args;}
 }catch(error){if(error.code!=='ENOENT')throw error;}}
 assert.ok(nativeBrowser);assert.equal(nativeBrowser.includes('--no-sandbox'),false);report.chromiumNonrootSandboxEnabled=true;
 assert.ok(nativeBrowser.includes('--proxy-server='+installation.egressProxy));assert.ok(nativeBrowser.includes('--proxy-bypass-list=<-loopback>'));report.proxyAndLoopbackPinned=true;
 report.browser=context.browser().version();
 const wrapper='import os,sys;open(sys.argv[1]+"/cgroup.procs","w").write(str(os.getpid()));os.write(3,b"R");assert os.read(4,1)==b"G";os.close(3);os.close(4);os.setgroups([]);os.setgid(2001);os.setuid(2001);os.execve(sys.argv[2],sys.argv[2:],dict(os.environ))';
 sdk=query({prompt:(async function*(){await released.promise;})(),options:{cwd:root+'/workspace',pathToClaudeCodeExecutable:binary,abortController:abort,settingSources:[],settings:{autoMemoryEnabled:false},tools:[],allowedTools:[],mcpServers:server.mcpServers,strictMcpConfig:true,permissionMode:'default',maxTurns:1,
  env:{...READINESS_MODEL_ENV,HOME:root+'/config',CLAUDE_CONFIG_DIR:root+'/config',PATH:'/usr/bin:/bin',CLAUDE_AGENT_SDK_CLIENT_APP:'meri-local-no-model-probe'},
  spawnClaudeCodeProcess(descriptor){assert.equal(descriptor.command,binary);assert.equal(child,undefined);
   child=spawn('/usr/bin/python3',['-c',wrapper,group,descriptor.command,...descriptor.args],{cwd:descriptor.cwd,env:descriptor.env,stdio:['pipe','pipe','pipe','pipe','pipe']});childExit=exitOf(child);
   child.stdio[3].once('data',data=>{assert.equal(data.toString(),'R');broker.stdio[5].end(String(child.pid)+'\n');child.stdio[4].end('G');});return child;}}});
 consumer=(async()=>{try{for await(const message of sdk){sdkMessages++;assert.notEqual(message.type,'result');}}catch(error){if(!shutdown&&!retiring&&!abort.signal.aborted)throw error;}})();consumer.catch(()=>{});
 stage='initialize';await bounded(sdk.initializationResult());
 stage='native-authentication';await bounded(authenticated.promise);
 stage='connected-status';let statuses;
 for(let n=0;n<40;n++){statuses=await bounded(sdk.mcpServerStatus());if(statuses.some(s=>s.name==='meri_browser'&&s.status==='connected'&&s.tools?.length))break;await new Promise(r=>setTimeout(r,100));}
 const status=statuses.find(s=>s.name==='meri_browser');assert.equal(status?.status,'connected');
 assert.deepEqual(status.tools?.map(tool=>tool.name),['browser_snapshot']);
 report.sdkReportsConnected=true;report.realBrowserToolListed=true;
 const leader=await readFile('/proc/'+child.pid+'/status','utf8');assert.match(leader,/^Uid:\s+2001\s+2001\s+2001\s+2001$/m);report.sdkNonrootUidVerified=true;
 const members=(await readFile(group+'/cgroup.procs','utf8')).trim().split('\n').map(Number);let direct=0;
 for(const pid of members){if((await readlink('/proc/'+pid+'/exe').catch(()=>''))!=='/opt/meri/bin/meri-mcp-shim')continue;
  const info=await readFile('/proc/'+pid+'/status','utf8');assert.match(info,new RegExp('^PPid:\\s+'+child.pid+'$','m'));direct++;}
 assert.equal(direct,1);report.exactShimDirectChildVerified=true;
 assert.deepEqual(await bounded(sdk.interrupt()),{still_queued:[]});await bounded(sdk.setPermissionMode('default'));report.emptySdkInterruptAcknowledged=true;
 stage='retention';const controlId=randomUUID();await bounded(server.prepareTakeover({controlId}));
 assert.equal((await user.readState()).state,'drained');
 retiring=true;sdk.close();await bounded(childExit);custody=await bounded(server.captureTakeover({controlId}));
 applied=true;await bounded(server.retainTakeover({receipt:{controlId,intent:'takeover.begin',sourceBinding:binding,inputSha256:'b'.repeat(64),state:'APPLIED',checkpointId:binding.runId,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false}}));
 assert.equal((await user.readState()).state,'user');assert.equal(browserChild.exitCode,null);assert.equal(browserChild.signalCode,null);
 assert.match(await readFile(browserGroup+'/cgroup.events','utf8'),/^populated 1$/m);report.browserRetainedAfterSdkAbsence=true;
 const frame=await bounded(user.view({leaseEpoch:custody.leaseEpoch,page}));assert.ok(frame.image.data.length>100);report.retainedNativeFrame=true;
 stage='filtered-return';const returned=await bounded(retainedHost.prepareResume({binding,custody}));assert.equal(returned.leaseEpoch,custody.leaseEpoch+1);assert.match(returned.snapshotSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(await bounded(retainedHost.prepareResume({binding,custody})),returned);assert.equal((await user.readState()).state,'returning');
 assert.equal(user.resume,undefined);report.returnSnapshotRetainedAndModelFenced=true;
 await assert.rejects(user.view({leaseEpoch:custody.leaseEpoch,page}));report.oldViewerLeaseRefused=true;
 stage='successor-broker';
 await bounded(consumer);await observer.close();
 const previousUser=user,previousChild=child,physicalBrowserPid=browserChild.pid;
 const target={...binding,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:binding.writerFence+1};
 canonicalHandoff={custody,returned,targetBinding:target,controlId:randomUUID()};
 const nextInstallation={...installation,launch:{...installationFor(target).launch,nonce:randomBytes(32).toString('hex')}};
 const targetRun=parent+'/'+canonicalSha256(target);group=targetRun+'/sdk';
 for(const path of [targetRun,group]){await mkdir(path);created.push(path);}
 broker=spawn(launcher,['broker',nextInstallation.launch.socketPath,'2001','2001',nextInstallation.launch.nonce,nextInstallation.launch.shimPath,host,'1',canonicalSha256(target)],
  {env:{},stdio:['ignore','ignore','pipe','pipe','pipe','pipe','pipe']});brokerExit=exitOf(broker);
 const nextListening=Promise.withResolvers(),nextAuthenticated=Promise.withResolvers();nextListening.promise.catch(()=>{});nextAuthenticated.promise.catch(()=>{});
 createInterface({input:broker.stdio[3]}).on('line',line=>{if(line==='L')nextListening.resolve();else if(line==='A'){nextAuthenticated.resolve();broker.stdio[4].end('G');}});
 brokerExit.then(()=>{nextListening.reject(Error('successor broker ended'));nextAuthenticated.reject(Error('successor broker ended'));});
 await bounded(nextListening.promise);
 stage='successor-adoption';
 server=await retainedHost.adopt({binding:target,policy,deadlineMs:custody.expiresAtMs,manifest:null,handoff:canonicalHandoff},{
  installation:nextInstallation,modelTransport:{readable:broker.stdio[6],writable:broker.stdio[6]},
  controls:{async bind(input){user=input.controls;return {async close(){try{input.controls.endLease('viewer-disconnect');}catch{}}};}},hold:async()=>({outcome:'APPLIED'}),
  retirement:{async prepare(){observer=createSdkChildQuiescenceObserver({allocation,binding:target,hostIdentity,timeoutMs:5000});await observer.arm({sdkLeaderPid:child.pid});},
   async wait(){broker.kill('SIGKILL');await brokerExit;assert.equal((await observer.waitQuiescent()).quiescent,true);},async retain(){await fixtureCurrent();}}});
 assert.equal(canonicalSha256(server.resumeSnapshot),returned.snapshotSha256);
 assert.doesNotMatch(JSON.stringify(server.resumeSnapshot),/SYNTHETIC_CUSTODY_SECRET/);report.exactFilteredSnapshotDelivered=true;
 assert.equal((await user.readState()).state,'returning');assert.throws(()=>previousUser.readState(),/BROWSER_CUSTODY_REFUSED/);
 stage='successor-sdk';retiring=false;child=undefined;
 sdk=query({prompt:(async function*(){await released.promise;})(),options:{cwd:root+'/workspace',pathToClaudeCodeExecutable:binary,abortController:abort,settingSources:[],settings:{autoMemoryEnabled:false},tools:[],allowedTools:[],mcpServers:server.mcpServers,strictMcpConfig:true,permissionMode:'default',maxTurns:1,
  env:{...READINESS_MODEL_ENV,HOME:root+'/config',CLAUDE_CONFIG_DIR:root+'/config',PATH:'/usr/bin:/bin',CLAUDE_AGENT_SDK_CLIENT_APP:'meri-local-no-model-probe'},
  spawnClaudeCodeProcess(descriptor){assert.equal(descriptor.command,binary);assert.equal(child,undefined);
   child=spawn('/usr/bin/python3',['-c',wrapper,group,descriptor.command,...descriptor.args],{cwd:descriptor.cwd,env:descriptor.env,stdio:['pipe','pipe','pipe','pipe','pipe']});childExit=exitOf(child);
   child.stdio[3].once('data',data=>{assert.equal(data.toString(),'R');broker.stdio[5].end(String(child.pid)+'\n');child.stdio[4].end('G');});return child;}}});
 consumer=(async()=>{try{for await(const message of sdk){sdkMessages++;assert.notEqual(message.type,'result');}}catch(error){if(!shutdown&&!retiring&&!abort.signal.aborted)throw error;}})();consumer.catch(()=>{});
 await bounded(sdk.initializationResult());await bounded(nextAuthenticated.promise);
 for(let n=0;n<40;n++){statuses=await bounded(sdk.mcpServerStatus());if(statuses.some(s=>s.name==='meri_browser'&&s.status==='connected'&&s.tools?.length))break;await new Promise(r=>setTimeout(r,100));}
 assert.deepEqual(statuses.find(s=>s.name==='meri_browser')?.tools?.map(tool=>tool.name),['browser_snapshot']);
 assert.notEqual(child.pid,previousChild.pid);assert.equal(browserChild.pid,physicalBrowserPid);
 assert.equal(context.pages()[0],page);assert.match(await page.locator('h1').textContent(),/Retained native context/);
 assert.equal((await user.readState()).state,'agent');report.successorNativeSdkAuthenticated=true;report.sameNativeContextRetained=true;report.returnFenceReleasedAfterTargetAttachment=true;
 stage='successor-retirement';const nextControl=randomUUID();await server.prepareTakeover({controlId:nextControl});retiring=true;sdk.close();await bounded(childExit);
 const nextCustody=await server.captureTakeover({controlId:nextControl});assert.deepEqual(nextCustody.binding,target);assert.equal(nextCustody.ownerInstanceId,custody.ownerInstanceId);
 await server.retainTakeover({receipt:{controlId:nextControl,intent:'takeover.begin',sourceBinding:target,inputSha256:'b'.repeat(64),state:'APPLIED',checkpointId:target.runId,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false}});
 assert.equal((await user.readState()).state,'user');assert.equal(browserChild.signalCode,null);report.secondNativeTakeoverPassed=true;
 assert.equal(sdkMessages,0);report.passed=true;
}catch(error){report.failureStage=stage;report.diagnostic=diagnostic;report.failure=error.name+': '+error.message.slice(0,200);process.exitCode=1;}
finally{
 shutdown=true;clearTimeout(timer);released.resolve();sdk?.close();abort.abort();
 try{
  if(group)await writeFile(group+'/cgroup.kill','1');child?.kill('SIGKILL');broker?.kill('SIGKILL');
  await Promise.all([childExit,brokerExit,consumer]);await observer?.close();await retainedHost?.destroy({trigger:'conversation-end'});await contexts?.close();
  if(browserGroup){await writeFile(browserGroup+'/cgroup.kill','1');await browserExit;for(let n=0;;n++){if(/^populated 0$/m.test(await readFile(browserGroup+'/cgroup.events','utf8')))break;assert.ok(n<100);await new Promise(r=>setTimeout(r,20));}report.browserSubtreeAbsent=true;}
  if(group){for(let n=0;;n++){if(/^populated 0$/m.test(await readFile(group+'/cgroup.events','utf8')))break;assert.ok(n<100);await new Promise(r=>setTimeout(r,20));}report.kernelProcessAbsenceObserved=true;}
  for(const path of created.reverse())await rmdir(path);report.createdCgroupsRemoved=true;
  for(const path of mounted.reverse())execFileSync('/bin/umount',[path]);
  await rm(root,{recursive:true,force:true});report.taskDirectoryRemoved=true;
 }catch(error){report.cleanupFailure=error.message.slice(0,200);process.exitCode=1;}
 report.sdkMessages=sdkMessages;
 console.log(JSON.stringify(report));
}
