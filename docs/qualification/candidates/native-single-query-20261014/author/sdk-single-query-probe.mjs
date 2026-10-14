/** Actual SDK source+fork component probe. Concrete PREEXEC review is required. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {realpathSync,readFileSync} from 'node:fs';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {prepareNativeSdkQuery} from '../../../../../apps/runtime/native-authority/sdk-query-preparation.mjs';
import {createIndependentNativeTask} from '../../../../../apps/runtime/native-authority/independent-task.mjs';
import {createExecutionBinding} from '../../../../../apps/control/conversations/execution-boundary.mjs';
import {continuationFixture} from '../../../../../apps/worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),base=process.cwd()+'/apps/worker/conversation/node_modules/',sdk=base+'@anthropic-ai/claude-agent-sdk',cli=realpathSync(base+'@anthropic-ai/claude-agent-sdk-linux-x64/claude');
assert.equal(JSON.parse(readFileSync(sdk+'/package.json')).version,'0.3.295');assert.equal(JSON.parse(readFileSync(base+'@anthropic-ai/claude-agent-sdk-linux-x64/package.json')).version,'0.3.295');
const sdkSha256=sha(readFileSync(sdk+'/sdk.mjs')),cliSha256=sha(readFileSync(cli)),f=continuationFixture('fork');
const controller=new AbortController(),sinkMetadata=[],results=[],states=[],tasks=[],queries=[],witnesses=[],cleanupErrors=[];
let ownedRoot,sink,timer,completed=false,phase='setup',spawns=0,cleanupFailed=false;
const abort=()=>controller.abort();process.once('SIGTERM',abort);process.once('SIGINT',abort);
try{
 timer=setTimeout(abort,50000);ownedRoot=await mkdtemp(join(tmpdir(),'meri-single-query-sdk-'));
 sink=createServer((request,response)=>{sinkMetadata.push({method:request.method,path:new URL(request.url,'http://127.0.0.1').pathname,status:403});response.writeHead(403,{'content-type':'application/json'});response.end('{}');});
 await new Promise(resolve=>sink.listen(0,'127.0.0.1',resolve));
 for(const key of Object.keys(process.env))if(!['PATH','HOME','LANG','LC_ALL','TZ','TMPDIR'].includes(key))delete process.env[key];
 process.env.TMPDIR=ownedRoot;
 const {InMemorySessionStore}=await import(new URL(sdk+'/sdk.mjs','file:').href);controller.signal.throwIfAborted();
 const sourceStore=new InMemorySessionStore(),targetStore=new InMemorySessionStore(),sourceId=f.continuation.checkpoint.sessionId,targetId=f.continuation.targetSessionId;
 async function run(label,binding,sessionId,store,extra={}){
  phase=label;controller.signal.throwIfAborted();const workspace=join(ownedRoot,label+'-workspace'),config=join(ownedRoot,label+'-secure-config');await mkdir(workspace,{mode:0o700});await mkdir(config,{mode:0o700});
  const key={projectKey:workspace.replace(/[^a-zA-Z0-9]/gu,'-'),sessionId};
  if(label==='fork'){
   const sourceKey={projectKey:join(ownedRoot,'source-workspace').replace(/[^a-zA-Z0-9]/gu,'-'),sessionId:sourceId};
   await store.append({...key,sessionId:sourceId},await sourceStore.load(sourceKey));
   for(const subpath of await sourceStore.listSubkeys(sourceKey))await store.append({...key,sessionId:sourceId,subpath},await sourceStore.load({...sourceKey,subpath}));
  }
  let task,witness;const expiresAtMs=Date.now()+35000;
  const env={CLAUDE_CONFIG_DIR:config,CLAUDE_SECURESTORAGE_CONFIG_DIR:config,ANTHROPIC_BASE_URL:'http://127.0.0.1:'+sink.address().port,ANTHROPIC_AUTH_TOKEN:'synthetic-refusing-proxy',CLAUDE_CODE_DISABLE_AUTO_UPDATE:'1',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'};
  Object.assign(process.env,env);
  const mirror={load:k=>store.load(k),listSubkeys:k=>store.listSubkeys(k),async append(k,entries){
   if(!witness){assert.deepEqual(k,key);witness=await task.registration.read({binding,key,signal:controller.signal,deadlineMs:expiresAtMs});assert.equal(task.status().closed,false,'genuine witness is observed during first target append, before exit');witnesses.push({phase:label,observationId:witness.observationId});}
   return store.append(k,entries);
  }};
  const prepared=await prepareNativeSdkQuery({prompt:'/status',options:{abortController:controller,pathToClaudeCodeExecutable:cli,cwd:workspace,env,settingSources:[],settings:{autoMemoryEnabled:false},skills:[],plugins:[],mcpServers:{},hooks:{},tools:[],allowedTools:[],permissionMode:'default',canUseTool:async()=>({behavior:'deny',message:'No tools admitted'}),model:'meri-local-no-provider',maxTurns:1,maxBudgetUsd:0.000001,persistSession:true,sessionStoreFlush:'eager',sessionStore:mirror,sessionId,...extra},bindLaunch(request){
   spawns++;assert.equal(realpathSync(request.command),cli);assert.equal(request.cwd,workspace);
   for(const name of Object.keys(request.env))assert.ok(!/^(AWS_|GOOGLE_|GCP_|AZURE_|OPENAI_)/.test(name));
   for(const name of ['ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','DATABASE_URL','PGPASSWORD','TEMPORAL_API_KEY'])assert.equal(request.env[name],undefined);
   const descriptor={command:request.command,args:request.args,cwd:request.cwd,env:request.env};
   const original=createExecutionBinding({binding,versions:f.target.versions,plan:{kind:'single-query-'+label,descriptorSha256:hash(descriptor),sdkSha256,cliSha256},expiresAtMs});
   const launchConfiguration={binding,workspace,configDirectory:request.env.CLAUDE_CONFIG_DIR,secureStorageDirectory:request.env.CLAUDE_SECURESTORAGE_CONFIG_DIR,versions:{sdk:'0.3.295',cli:'2.1.295'},expiresAtMs,executableSha256:cliSha256,launch:{command:request.command,args:request.args,env:request.env},enabled:true,shutdownMs:1000};
   task=createIndependentNativeTask({original,launchConfiguration,deferredSpawn:true,maxRequestMs:8000});tasks.push(task);
   return {process:task.spawnClaudeCodeProcess(request),async start(){await task.launch({...original,signal:controller.signal});await task.startPreparedProcess();},close:()=>task.close()};
  }});queries.push(prepared);
  try{for await(const message of prepared.messages)if(message.type==='result')results.push({phase:label,subtype:message.subtype,is_error:message.is_error,num_turns:message.num_turns,total_cost_usd:message.total_cost_usd});
   assert.ok(witness);assert.deepEqual(results.at(-1),{phase:label,subtype:'success',is_error:false,num_turns:0,total_cost_usd:0});
   assert.ok((await store.load(key))?.length);
  }finally{try{await prepared.close();await task.close();assert.equal(task.status().physicalStopProven,true);}finally{states.push({phase:label,...task.status()});}}
 }
 await run('source',f.binding,sourceId,sourceStore);await run('fork',f.target.binding,targetId,targetStore,{resume:sourceId,forkSession:true});
 assert.equal(spawns,2);assert.equal(witnesses.length,2);assert.notEqual(witnesses[0].observationId,witnesses[1].observationId);
 assert.equal(sinkMetadata.filter(x=>x.path!=='/api/hello'||x.method!=='HEAD').length,0,'no provider/model request attempted');completed=true;phase='completed';
}finally{
 clearTimeout(timer);controller.abort();for(const q of queries.reverse())try{await q.close();}catch(error){cleanupFailed=true;cleanupErrors.push({owner:'query',code:error.code??error.message});}
 for(const task of tasks.reverse())try{await task.close();assert.equal(task.status().physicalStopProven,true);}catch(error){cleanupFailed=true;cleanupErrors.push({owner:'task',code:error.code??error.message,status:task.status()});}
 if(sink){sink.closeAllConnections();await new Promise(resolve=>sink.close(resolve));}
 if(ownedRoot&&!cleanupFailed)await rm(ownedRoot,{recursive:true,force:true});
 process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort);
 process.stdout.write(JSON.stringify({completed,phase,spawns,results,witnesses,states,sinkMetadata,providerRequests:sinkMetadata.filter(x=>x.path!=='/api/hello'||x.method!=='HEAD').length,cleanupProven:!cleanupFailed,cleanupErrors,retainedWorkspace:cleanupFailed?ownedRoot:null,sdkSha256,cliSha256,scope:'ACTUAL_SDK_SOURCE_FORK_SINGLE_QUERY_INDEPENDENT_PROCESSES_IN_MEMORY_SESSION_STORE_SYNTHETIC_BINDINGS_NO_PG_BROKER_DEPLOYED_ACCEPTANCE'},null,2)+'\n');
 if(cleanupFailed)throw Error('OWNED_CLEANUP_UNKNOWN');
}
