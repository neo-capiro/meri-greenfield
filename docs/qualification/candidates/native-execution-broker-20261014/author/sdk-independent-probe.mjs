/** Actual zero-provider /status, isolated PG, independent supervisor. */
import assert from 'node:assert/strict';import {createServer} from 'node:http';import {realpathSync,readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {fixture,sha} from '../../../../../apps/runtime/native-authority/test/broker-pg-fixture.mjs';
import {createNativeBrokerStack} from '../../../../../apps/runtime/native-authority/broker-stack.mjs';import {createIndependentNativeTask} from '../../../../../apps/runtime/native-authority/independent-task.mjs';
import {createNativeSdkSessionApplication} from '../../../../../apps/runtime/native-authority/session-http.mjs';import {createNativeSdkSessionClient} from '../../../../../apps/runtime/native-authority/session-client.mjs';import {createFirstRuntimeSdkSession} from '../../../../../apps/runtime/sdk-first-session.mjs';
import {listenFetch} from '../../../../../apps/runtime/native-authority/test/task-verifier-fixture.mjs';import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
const root=process.cwd(),sdk=root+'/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk',cli=realpathSync(root+'/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude');
assert.equal(JSON.parse(readFileSync(sdk+'/package.json')).version,'0.3.295');assert.equal(JSON.parse(readFileSync(root+'/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/package.json')).version,'0.3.295');
const callbacks=[],abort=new AbortController();let x,sink,stack,sessionListener,q,mirror,timer,sinkRequests=0,spawns=0,descriptor,keepWorkspace=false;const results=[],sinkMetadata=[],cleanupFailures=[];
try{
timer=setTimeout(()=>abort.abort(),20000);
x=await fixture({after:fn=>callbacks.push(fn)});sink=createServer((request,response)=>{sinkRequests++;sinkMetadata.push({method:request.method,path:new URL(request.url,'http://127.0.0.1').pathname,replyStatus:403});response.writeHead(403,{'content-type':'application/json'});response.end('{}');});await new Promise(r=>sink.listen(0,'127.0.0.1',r));
const env={CLAUDE_CONFIG_DIR:x.configDirectory,CLAUDE_SECURESTORAGE_CONFIG_DIR:x.configDirectory,ANTHROPIC_BASE_URL:'http://127.0.0.1:'+sink.address().port,ANTHROPIC_AUTH_TOKEN:'synthetic-refusing-proxy',CLAUDE_CODE_DISABLE_AUTO_UPDATE:'1'};
for(const name of Object.keys(process.env))if(!['PATH','HOME','LANG','LC_ALL','TZ','TMPDIR'].includes(name))delete process.env[name];Object.assign(process.env,env);
const {query}=await import(pathToFileURL(sdk+'/sdk.mjs').href);
abort.signal.throwIfAborted();
const options={cwd:x.workspace,env,abortController:abort,pathToClaudeCodeExecutable:cli,settingSources:[],settings:{autoMemoryEnabled:false},skills:[],plugins:[],mcpServers:{},hooks:{},tools:[],allowedTools:[],permissionMode:'default',canUseTool:async()=>({behavior:'deny',message:'No tool admitted'}),model:'meri-local-no-provider',maxTurns:1,maxBudgetUsd:0.000001,persistSession:true,sessionStoreFlush:'eager',sessionId:'11111111-1111-4111-8111-000000000099'};
 // SDK descriptor planning deliberately refuses at spawn; no process/model allocation.
 const descriptorAbort=new AbortController(),stopDescriptor=()=>descriptorAbort.abort();abort.signal.addEventListener('abort',stopDescriptor,{once:true});if(abort.signal.aborted)stopDescriptor();
 let planQuery;try{planQuery=query({prompt:'/status',options:{...options,abortController:descriptorAbort,sessionStore:{load:async()=>null,append:async()=>{throw Error('PLAN_MUST_NOT_WRITE');},listSubkeys:async()=>[]},spawnClaudeCodeProcess(request){descriptor={command:request.command,args:request.args,cwd:request.cwd,env:request.env};throw Error('SDK_PLAN_NO_ALLOCATION');}}});for await(const _ of planQuery)throw Error('PLAN_EXECUTED');}catch{assert.ok(descriptor);}finally{planQuery?.close();abort.signal.removeEventListener('abort',stopDescriptor);}
 assert.equal(realpathSync(descriptor.command),cli);assert.equal(descriptor.cwd,x.workspace);
 abort.signal.throwIfAborted();
 for(const name of ['ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY'])assert.ok(!descriptor.env[name]);
 const launchConfiguration={...x.launchConfiguration,executableSha256:sha(readFileSync(cli)),launch:{command:cli,args:descriptor.args,env:descriptor.env}};
 stack=createNativeBrokerStack({...x.config,launchConfiguration,plan:{...x.config.plan,cliSha256:launchConfiguration.executableSha256,argvSha256:hash(descriptor.args)},tasksFactory:createIndependentNativeTask});
 abort.signal.throwIfAborted();await stack.broker.start({binding:x.binding,executionKey:hash(x.binding),signal:abort.signal});
 sessionListener=await listenFetch(createNativeSdkSessionApplication({owner:stack.productPorts.sdkSessionOwner,maxRequestMs:5000}));
 const client=createNativeSdkSessionClient({origin:'https://local-session.synthetic.invalid',credential:x.f.credential,binding:x.binding,maxRequestMs:5000,fetchImpl:(url,init)=>fetch(sessionListener.origin+new URL(url).pathname,init)});
 mirror=createFirstRuntimeSdkSession({client,binding:x.binding});
 const status=(state,n)=>stack.store.append(x.binding,{eventId:`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},()=>{});
 await status('starting',100);await status('running',101);
 q=query({prompt:'/status',options:{...options,sessionStore:mirror.store,spawnClaudeCodeProcess(request){assert.equal(++spawns,1);return stack.tasks.spawnClaudeCodeProcess(request);}}});
 for await(const message of q)if(message.type==='result')results.push({subtype:message.subtype,is_error:message.is_error,num_turns:message.num_turns,total_cost_usd:message.total_cost_usd});
 await mirror.settle();assert.deepEqual(results,[{subtype:'success',is_error:false,num_turns:0,total_cost_usd:0}]);
 // Denying sink has no upstream client/transport. Retain attempted route facts;
 // zero successful model turns/cost is distinct from zero local requests.
 const owners=(await x.pool.query('SELECT owner FROM meri_conversations.sdk_sessions')).rows;assert.equal(owners.length,1);assert.equal(owners[0].owner.expiresAtMs,x.expiry);
 const entries=Number((await x.pool.query('SELECT count(*) FROM meri_conversations.sdk_session_entries')).rows[0].count);assert.ok(entries>0);
 await status('completed',102);assert.equal((await stack.broker.poll({binding:x.binding,executionId:hash(x.binding)})).state,'completed');assert.equal(stack.tasks.status().physicalStopProven,true);
 process.stdout.write(JSON.stringify({spawns,results,sinkRequests,sinkMetadata,entries,ownerWitness:owners[0].owner.observationId,expiresAtMs:x.expiry,taskStatus:stack.tasks.status(),pins:{sdkSha256:sha(readFileSync(sdk+'/sdk.mjs')),cliSha256:launchConfiguration.executableSha256},scope:'ACTUAL_SDK_REAL_TASK_OWNED_PG_INDEPENDENT_PROCESS_SYNTHETIC_AUTHORITY_NO_DEPLOYED_ISOLATION'},null,2)+'\n');
}finally{
 clearTimeout(timer);const clean=async fn=>{try{await fn();}catch{cleanupFailures.push('OWNED_CLEANUP_UNKNOWN');}};
 await clean(()=>q?.close());await clean(()=>mirror?.close());abort.abort();await clean(()=>sessionListener?.close());await clean(async()=>{try{await stack?.close();}catch(error){keepWorkspace=true;throw error;}});
 await clean(async()=>{if(sink){sink.closeAllConnections();await new Promise(r=>sink.close(r));}});
 if(keepWorkspace)await clean(()=>x?.pool.end());else for(const fn of callbacks.reverse())await clean(fn);
 if(cleanupFailures.length){process.stderr.write(JSON.stringify({cleanupFailures,retainedWorkspace:keepWorkspace?x?.root:null})+'\n');throw Error('OWNED_CLEANUP_UNKNOWN');}
}
