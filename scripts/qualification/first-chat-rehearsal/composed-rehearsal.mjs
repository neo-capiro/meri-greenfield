/** Composed first-chat rehearsal: real PostgreSQL 16, the real controller/remote-task/supervisor composition and the
 * real pinned CLI 2.1.295 launched through the product option builder and the remote launch gates, with zero model
 * turns (the accepted request is the CLI-local `/status`). Synthetic: ECS/identity/authority facts, proxy origin, model
 * string, the proxy credential. Requires the gap 2 runner derivation (apps/runtime/conversation-runner.mjs patched)
 * and a launch template that carries the synthetic proxy credential (gap 3). It is not collected by the suite globs;
 * run it explicitly as a non-root user with the local clusters started:
 *   MERI_REHEARSAL_RECEIPT=/path/receipt.json node --test scripts/qualification/first-chat-rehearsal/composed-rehearsal.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync,chmodSync} from 'node:fs';
import {join,resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..');
const load=p=>import(pathToFileURL(join(root,p)).href);
const {fixture,sha,control}=await load('apps/runtime/native-authority/test/broker-pg-fixture.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
const {compileNativeBrokerPlan}=await load('apps/runtime/native-authority/broker-stack.mjs');
const {createRemoteNativeController,createRemoteNativeWorker}=await load('apps/runtime/native-authority/remote-composition.mjs');
const {createNativeCapabilityClient}=await load('apps/runtime/native-client.mjs');
const {assembleConversationRunner,assertRunnerWorkspace}=await load('apps/runtime/conversation-runner.mjs');
const {createRuntimeSdkSessionFactory}=await load('apps/runtime/sdk-session-runtime.mjs');
const {buildConversationOptions}=await load('apps/worker/conversation/options.mjs');
const {projectNativeSdkOptions}=await load('apps/runtime/native-authority/sdk-option-projection.mjs');
const {query:sdkQuery}=await load('apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs');
const {redactEnvironment}=await load('scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.mjs');
const PR86_RUNNER_SHA256='ff9a037395eef3d89f62573e53c26c2c038dc5b5ffb59c37266a7c873cc48794';
async function listener(t,handle){const server=createServer(async(req,res)=>{try{const body=await Array.fromAsync(req).then(parts=>Buffer.concat(parts));const reply=await handle(new Request('https://logical.invalid'+req.url,{method:req.method,headers:req.headers,body}));res.writeHead(reply?.status??404,Object.fromEntries(reply?.headers??[]));res.end(reply?Buffer.from(await reply.arrayBuffer()):'');}catch{res.writeHead(500);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port,transport=(url,options)=>fetch('http://127.0.0.1:'+port+new URL(url).pathname,options);transport.close=()=>new Promise(resolve=>server.close(resolve));return transport;}
function git(...args){try{return execFileSync('git',['-c','safe.directory=*','-C',root,...args],{encoding:'utf8'}).trim();}catch{return null;}}
function tree(directory){const rows=[];const walk=d=>{for(const name of readdirSync(d).sort()){const p=join(d,name),s=statSync(p);if(s.isDirectory()){rows.push({path:relative(directory,p)+'/',mode:(s.mode&0o777).toString(8)});walk(p);}else rows.push({path:relative(directory,p),bytes:s.size,mode:(s.mode&0o777).toString(8)});}};walk(directory);return rows;}
function makeReceipt(name){const receipt={schema:'meri.composed-first-chat-rehearsal.v1',rehearsal:name,startedAt:new Date().toISOString(),repository:{root,head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),uncommittedPaths:(git('status','--porcelain')??'').split('\n').filter(Boolean).length},runnerModule:{path:'apps/runtime/conversation-runner.mjs',sha256:sha(readFileSync(join(root,'apps/runtime/conversation-runner.mjs'))),pr86Sha256:PR86_RUNNER_SHA256},outcome:'FAILED',steps:[]};
 receipt.runnerModule.gap2PatchApplied=receipt.runnerModule.sha256!==PR86_RUNNER_SHA256;const patch=join(root,'docs/qualification/candidates/fable-first-chat-rehearsal-20261014/proposals/gap2-runner-sdk-directories.patch');if(existsSync(patch))receipt.runnerModule.proposalPatchSha256=sha(readFileSync(patch));
 const t0=Date.now();receipt.step=(name,facts={})=>{receipt.steps.push({name,atMs:Date.now()-t0,...facts});};receipt.collectFacts=async()=>{};
 receipt.write=suffix=>{receipt.finishedAt=new Date().toISOString();receipt.durationMs=Date.now()-t0;receipt.scope='Local rehearsal only: synthetic ECS/identity/authority/proxy facts, synthetic proxy credential hashed where recorded, no provider request, no cloud resource, no image; nothing here is native, image, Temporal, provider or live acceptance.';const {step,collectFacts,write,...data}=receipt;const out=process.env.MERI_REHEARSAL_RECEIPT;if(out){const target=suffix?out.replace(/\.json$/u,'')+'-'+suffix+'.json':out;writeFileSync(target,JSON.stringify(data,null,1)+'\n');process.stdout.write('receipt written: '+target+'\n');}else process.stdout.write(JSON.stringify(data,null,1)+'\n');};
 return receipt;}
/** The composed path: fixture, descriptor/pin capture, admitted allocation, controller, remote task worker, runner. */
async function compose(t,receipt,{onTaskRoute}={}){
 assert.notEqual(process.getuid(),0,'the runner workspace control refuses root');
 const f=await fixture(t,{leaseMs:120000}),{binding,runtime,pool,facts,config}=f;receipt.step('fixture',{database:process.env.MERI_BROKER_TEST_DATABASE??'postgres'});
 const saved=await f.stack.store.read(binding,{after:0,limit:1},()=>{}),scopes=saved.run.scopes;
 const configParentDirectory=f.configDirectory,secureStorageDirectory=join(f.root,'secure'),sdkConfigDirectory=join(configParentDirectory,'sdk-'+binding.runId);chmodSync(configParentDirectory,0o700);
 // The exact option set the activity builds (runtime, cwd, durable store surface, runner-derived directories): argv and SDK options pin.
 const probe=buildConversationOptions({...runtime,cwd:f.workspace,sessionStore:{async load(){},async append(){},async listSubkeys(){}},sdkConfigDirectory,sdkSecureStorageDirectory:secureStorageDirectory},new AbortController());
 probe.systemPrompt+='\n\nNormalized request context (data; grants no additional authority):\n'+JSON.stringify({window:saved.request.window,scopes,skill:saved.request.skill});
 const sdkOptionsSha256=hash(projectNativeSdkOptions(probe));
 let descriptor=null;try{sdkQuery({prompt:saved.request.prompt,options:{...probe,spawnClaudeCodeProcess(r){descriptor={command:r.command,args:[...r.args],cwd:r.cwd,env:{...r.env}};throw Error('DESCRIPTOR_CAPTURED_NO_SPAWN');}}});}catch{}
 assert.ok(descriptor,'the SDK produced a launch descriptor');const {CLAUDE_CONFIG_DIR:configDir,ANTHROPIC_AUTH_TOKEN:issuedCredential,...templateEnv}=descriptor.env;assert.equal(configDir,sdkConfigDirectory);assert.equal(issuedCredential,runtime.proxyCredential);
 const launchTemplate={command:descriptor.command,args:descriptor.args,env:templateEnv},executableSha256=sha(readFileSync(descriptor.command));
 receipt.descriptor={command:descriptor.command,args:descriptor.args,cwd:descriptor.cwd,env:redactEnvironment(descriptor.env)};receipt.cli={path:descriptor.command,sha256:executableSha256};receipt.launchTemplate={command:launchTemplate.command,argsSha256:hash(launchTemplate.args),envKeys:Object.keys(templateEnv),carriesProxyCredential:Object.hasOwn(templateEnv,'ANTHROPIC_AUTH_TOKEN')};receipt.sdkOptionsSha256=sdkOptionsSha256;
 receipt.step('descriptor-captured');
 const preparationIntent={workspace:f.workspace,configParentDirectory,secureStorageDirectory,launchTemplate,executableSha256,imageSha256:'a'.repeat(64),runnerSha256:'b'.repeat(64),sdkOptionsSha256,authoritySha256:hash({scopes,selectedClientId:'11111111-1111-4111-8111-000000000006',policyRevision:facts.qualificationBinding.policyRevision})};
 const plan={purpose:'fable-composed-first-chat-rehearsal'},compiled=compileNativeBrokerPlan({runtime,plan,preparationIntent}),original=compiled.original;
 const resource={taskArn:facts.qualificationBinding.workerArn,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker',createdAtMs:Date.now()},grantIntents=[{grantId:facts.grantId,capabilitySha256:facts.capabilitySha256,expiresAtMs:original.expiresAtMs}],key={binding,allocationKey:original.executionKey},intent={...key,original,allocationSha256:facts.allocationSha256,qualification:{attempt:1,policyRevision:facts.qualificationBinding.policyRevision},grantIntents,taskRequestSha256:'c'.repeat(64),expiresAtMs:original.expiresAtMs};
 await f.stack.store.allocations.claim(intent,()=>{});await f.stack.store.allocations.record({...key,state:'ALLOCATED',resource},()=>{});const admitted={original,resource:{...resource,grantFactsJsons:[JSON.stringify(facts)]}};await f.stack.store.allocations.record({...key,state:'ADMITTED',resource:admitted.resource},()=>{});receipt.step('allocation-admitted');
 let worker,controller,allocations=0,retirements=0;const routes=new Map();const count=p=>routes.set(p,(routes.get(p)??0)+1);receipt.routes=null;
 receipt.collectFacts=async()=>{receipt.routes=Object.fromEntries([...routes.entries()].sort());receipt.counters={allocations,retirements};try{const h=await f.stack.store.read(binding,{after:0,limit:100},()=>{});receipt.conversation={runState:h.run.state,events:h.events.map(e=>({sequence:e.sequence,type:e.type,data:e.type==='message.delta'?{text:e.data.text}:e.data}))};}catch{}try{const bound=(await f.stack.store.allocations.read(key,()=>{})).record.resource.launchBinding;receipt.launchBinding=bound?{state:bound.state,descriptorSha256:bound.descriptorSha256,configTreeSha256:bound.configTreeSha256}:null;}catch{}};
 const taskFetch=await listener(t,async r=>{const path=new URL(r.url).pathname;count(path);const reply=await worker.application.handle(r);onTaskRoute?.(path,reply);return reply;});
 const controlFetch=await listener(t,async r=>{const path=new URL(r.url).pathname;count(path);
  if(path==='/v1/runner/load'||path==='/v1/runner/publish'){if(r.headers.get('authorization')!=='Bearer '+f.f.credential)return Response.json({error:{code:'REFUSED'}},{status:403});const body=await r.json();if(hash(body.binding)!==hash(binding))return Response.json({error:{code:'BINDING_REFUSED'}},{status:403});
   if(path==='/v1/runner/load'){const s=await f.stack.store.read(binding,{after:0,limit:1},()=>{});return Response.json({run:s.run,request:s.request});}
   await f.stack.store.append(binding,body.event,()=>{});return Response.json({published:true});}
  return controller.application.handle(r);});
 controller=createRemoteNativeController({runtimeConfiguration:{pool,store:f.stack.store,allocator:{async allocate(){allocations++;return admitted;},async stop(){retirements++;}},supervisor:config.supervisor,runtime,plan,preparationIntent,taskCapability:f.f.credential,controlCapabilitySha256:sha(control),verifyTask:async()=>({taskArn:resource.taskArn,imageSha256:preparationIntent.imageSha256,runnerSha256:preparationIntent.runnerSha256,checkedAtMs:Date.now(),expiresAtMs:original.expiresAtMs}),enabled:true,maxRequestMs:12000},transport:{original,origin:'https://synthetic-task.invalid',credential:control,fetchImpl:taskFetch,limits:{maxRequestMs:12000}}});
 const native=createNativeCapabilityClient({configuration:{origin:'https://synthetic-controller.invalid',maxResponseBytes:2097152},credential:f.f.credential,fetch:controlFetch});
 worker=createRemoteNativeWorker({original,preparationIntent,controlCapabilitySha256:sha(control),taskCapabilitySha256:facts.capabilitySha256,taskArn:resource.taskArn,native,processTransport:{original,origin:'https://synthetic-task.invalid',credential:f.f.credential,fetchImpl:taskFetch},enabled:true,limits:{maxRequestMs:12000}});
 t.after(async()=>{try{await worker.close();await controller.close();}finally{await taskFetch.close();await controlFetch.close();}});
 await controller.allocate();receipt.step('controller-allocated',{allocations});
 const sessionFactory=createRuntimeSdkSessionFactory({origin:'https://synthetic-controller.invalid',credential:f.f.credential,binding,fetchImpl:controlFetch});
 const configuration={binding,versions:runtime.versions,workspace:f.workspace,proxyOrigin:new URL(runtime.proxyUrl).origin,sourceEnabled:false,limits:{shutdownMs:1000},remoteTask:{preparationIntent}};
 await assertRunnerWorkspace(configuration);
 const query=input=>{try{return worker.query(input);}catch(error){receipt.queryRefusal={code:error?.code??null,message:String(error?.message??error)};throw error;}};
 const execute=assembleConversationRunner({configuration,native,query,sessionFactory});receipt.step('runner-assembled');
 const history=()=>f.stack.store.read(binding,{after:0,limit:100},()=>{});
 return {f,binding,pool,key,original,controller,get worker(){return worker;},execute,history,routes,sdkConfigDirectory,secureStorageDirectory,counters:()=>({allocations,retirements})};
}
test('composed first chat: the real CLI answers a zero-turn request through controller, remote task, supervisor and runner',async t=>{
 const receipt=makeReceipt('first-chat');
 try{
  const c=await compose(t,receipt),{binding,pool,key,original,controller}=c;
  const result=await c.execute({binding});receipt.step('activity-returned',{result});
  assert.deepEqual(result,{state:'completed'});
  const h=await c.history();
  assert.equal(h.run.state,'completed');assert.deepEqual(h.events.filter(e=>e.type==='run.status').map(e=>e.data.state),['queued','starting','running','completed']);
  const text=h.events.filter(e=>e.type==='message.delta').map(e=>e.data.text).join('');assert.ok(text.length>0,'the CLI produced display text');
  const sessions=await pool.query('SELECT session_id,project_key,entries_count,bytes FROM meri_conversations.sdk_sessions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[binding.tenantId,binding.conversationId,binding.runId]);
  const entries=await pool.query('SELECT count(*)::int AS n FROM meri_conversations.sdk_session_entries WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[binding.tenantId,binding.conversationId,binding.runId]);
  receipt.durableSdkSession={registered:sessions.rows.length,rows:sessions.rows.map(r=>({sessionId:r.session_id,projectKey:r.project_key,entriesCount:r.entries_count,bytes:r.bytes})),entryRows:entries.rows[0].n};
  assert.equal(sessions.rows.length,1,'exactly one durable SDK session registered for the run');assert.ok(entries.rows[0].n>0,'transcript entries were durably appended');
  const native1=await controller.remote.inspect(original);receipt.nativeAfterActivity={state:native1.state,physicalStopProven:native1.physicalStopProven};
  receipt.sdkConfigDirectoryTree=tree(c.sdkConfigDirectory);receipt.secureStorageDirectoryEntries=readdirSync(c.secureStorageDirectory).length;
  receipt.cleanupStatus=c.execute.cleanupStatus();await receipt.collectFacts();receipt.conversation.assistantText=text;
  assert.equal(receipt.launchBinding.state,'STARTED');assert.equal(native1.physicalStopProven,true,'the owned CLI process was physically stopped after the single query');
  // A replayed activity for the same (now terminal) run cannot start a second query or launch.
  const launches=c.routes.get('/v1/native-task/launch');await assert.rejects(c.execute({binding}),/EXECUTION_FAILED/);assert.equal(c.routes.get('/v1/native-task/launch'),launches);assert.equal((await c.history()).run.state,'completed');receipt.replayedActivity={refused:true,launchRouteCount:launches};
  await c.worker.close();const native2=await controller.remote.inspect(original);receipt.nativeAfterWorkerClose={state:native2.state,physicalStopProven:native2.physicalStopProven};assert.equal(native2.physicalStopProven,true);
  await receipt.collectFacts();receipt.conversation.assistantText=text;receipt.outcome='PASSED';
 }catch(error){receipt.error={code:error?.code??null,message:String(error?.message??error),errors:error?.errors?.map(e=>String(e?.message??e))};try{await receipt.collectFacts();}catch{}throw error;}
 finally{receipt.write();}
});
test('cancellation after launch stops the live CLI physically and records a cancelled run without a second dispatch',async t=>{
 const receipt=makeReceipt('cancellation-after-launch'),abort=new AbortController();
 try{
  const c=await compose(t,receipt,{onTaskRoute(path,reply){if(path==='/v1/native-task/start'&&reply?.status===200&&!abort.signal.aborted){receipt.step('abort-after-start');setImmediate(()=>abort.abort(Error('REHEARSAL_CANCEL')));}}}),{binding,original,controller}=c;
  await assert.rejects(c.execute({binding,signal:abort.signal}),/EXECUTION_STOPPED/);receipt.step('activity-rejected');
  const h=await c.history();assert.equal(h.run.state,'cancelled');const statuses=h.events.filter(e=>e.type==='run.status').map(e=>e.data);assert.deepEqual(statuses.at(-1),{state:'cancelled',reasonCode:'EXECUTION_STOPPED'});assert.equal(h.events.filter(e=>e.type==='message.delta').length,0,'no display text is published after cancellation');
  const native1=await controller.remote.inspect(original);receipt.nativeAfterActivity={state:native1.state,physicalStopProven:native1.physicalStopProven};assert.equal(native1.physicalStopProven,true,'the live CLI was physically stopped by the cancellation');
  await receipt.collectFacts();assert.equal(receipt.launchBinding.state,'STARTED');assert.equal(c.routes.get('/v1/native-task/launch'),1);assert.ok(c.routes.get('/v1/native-task/stop')>=1);
  const pins={original,descriptorSha256:receipt.launchBinding.descriptorSha256,configTreeSha256:receipt.launchBinding.configTreeSha256,preparationId:(await c.f.stack.store.allocations.read(c.key,()=>{})).record.resource.launchBinding.preparationId};
  // The durable journal is the dispatch authority: a consumed launch never dispatches again, whatever a later caller asks.
  const outcome=async work=>{try{const value=await work();return {dispatch:value.dispatch===true};}catch(error){return {refused:error?.code??String(error)};}};
  const journal=await outcome(()=>c.f.stack.store.allocations.consumeLaunch({...c.key,descriptorSha256:pins.descriptorSha256,configTreeSha256:pins.configTreeSha256,preparationId:pins.preparationId},()=>{})),authorizer=await outcome(()=>controller.prepared.preparationAuthorizer.start(pins));receipt.secondDispatch={journal,authorizer};
  assert.notEqual(journal.dispatch,true,'the durable journal never dispatches the consumed launch again');assert.notEqual(authorizer.dispatch,true,'the preparation authorizer never dispatches the consumed launch again');
  receipt.cleanupStatus=c.execute.cleanupStatus();await c.worker.close();const native2=await controller.remote.inspect(original);receipt.nativeAfterWorkerClose={state:native2.state,physicalStopProven:native2.physicalStopProven};assert.equal(native2.physicalStopProven,true);
  receipt.outcome='PASSED';
 }catch(error){receipt.error={code:error?.code??null,message:String(error?.message??error),errors:error?.errors?.map(e=>String(e?.message??e))};try{await receipt.collectFacts();}catch{}throw error;}
 finally{receipt.write('cancellation');}
});
