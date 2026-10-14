/** Actual pinned SDK/CLI observation only; no provider transport, credentials or product authority. */
import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {spawn} from 'node:child_process';import {Transform} from 'node:stream';import {StringDecoder} from 'node:string_decoder';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {observeNativeStdout} from '../../../../../apps/worker/qualification/probes/native-stream-observer.mjs';
import {scopedSessionKey,copySessionEntries} from '../../../../../apps/worker/qualification/checkpoint/bound-session-store.mjs';
const sdkDir='/workspace/meri-first-session/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk';
assert.equal(JSON.parse(readFileSync(join(sdkDir,'package.json'),'utf8')).version,'0.3.295');
const cli=realpathSync(join(dirname(sdkDir),'claude-agent-sdk-linux-x64/claude'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const {query}=await import(pathToFileURL(join(sdkDir,'sdk.mjs')).href);
const taskRoot=await mkdtemp(join(tmpdir(),'meri-sdk-zero-provider-')),workspace=join(taskRoot,'workspace'),configDir=join(taskRoot,'config');await mkdir(workspace);await mkdir(configDir);
let q,child,childClose,timer,localRequests=0,spawns=0,mirrorBatches=0;const keys=[],nativeInit=[],nativeMirrors=[],results=[],record={};const abort=new AbortController();
const server=createServer((request,response)=>{localRequests++;request.resume();response.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify({type:'error',error:{type:'permission_error',message:'Local probe has no provider transport'}}));});
server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const origin='http://127.0.0.1:'+server.address().port;
const env={PATH:process.env.PATH,CLAUDE_CONFIG_DIR:configDir,ANTHROPIC_BASE_URL:origin,ANTHROPIC_AUTH_TOKEN:'synthetic-local-uncredentialed',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_TELEMETRY:'1',DISABLE_ERROR_REPORTING:'1',CLAUDE_CODE_DISABLE_AUTO_UPDATE:'1'};
let failure=false,closeObserved=false;
try{
 timer=setTimeout(()=>abort.abort(),20000);
 q=query({prompt:'/status',options:{cwd:workspace,env,abortController:abort,pathToClaudeCodeExecutable:cli,settingSources:[],settings:{autoMemoryEnabled:false},skills:[],plugins:[],mcpServers:{},hooks:{},tools:[],allowedTools:[],permissionMode:'default',canUseTool:async()=>({behavior:'deny',message:'No tool admitted'}),model:'meri-local-no-provider',maxTurns:1,maxBudgetUsd:0.000001,persistSession:true,sessionStoreFlush:'eager',sessionStore:{async append(key,entries){const k=scopedSessionKey(key,key);copySessionEntries(entries);mirrorBatches++;if(!keys.some(v=>JSON.stringify(v)===JSON.stringify(k)))keys.push(k);},async load(){throw Error('FRESH_LOAD_REFUSED');},async listSubkeys(){throw Error('FRESH_LOAD_REFUSED');}},spawnClaudeCodeProcess(options){
  assert.equal(++spawns,1);assert.equal(realpathSync(options.command),cli);assert.equal(options.cwd,workspace);
  for(const name of ['ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY'])assert.ok(!options.env[name]);
  assert.equal(options.env.ANTHROPIC_BASE_URL,origin);assert.equal(options.env.CLAUDE_CONFIG_DIR,configDir);
  child=spawn(options.command,options.args,{cwd:options.cwd,env:options.env,signal:options.signal,stdio:['pipe','pipe','pipe']});
  childClose=new Promise(resolve=>child.once('close',(code,signal)=>{closeObserved=true;resolve({code,signal});}));
  observeNativeStdout(child,record,()=>abort.abort());
  const decoder=new StringDecoder('utf8');let pending='';
  const tap=new Transform({transform(chunk,_encoding,callback){try{pending+=decoder.write(chunk);if(Buffer.byteLength(pending)>1048576)throw Error('FRAME_BOUND');let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);if(!line)continue;const frame=JSON.parse(line);if(frame.type==='system'&&frame.subtype==='init')nativeInit.push({sessionId:frame.session_id,sha256:sha(line)});if(frame.type==='transcript_mirror')nativeMirrors.push({filePath:frame.filePath,entriesSha256:sha(JSON.stringify(frame.entries))});}callback(null,chunk);}catch{abort.abort();callback(Error('NATIVE_FRAME_REFUSED'));}}});
  child.stdout=child.stdout.pipe(tap);child.stdio[1]=child.stdout;
  let stderrBytes=0;child.stderr.on('data',chunk=>{stderrBytes+=chunk.byteLength;if(stderrBytes>65536)abort.abort();});
  return child;
 }} });
 for await(const message of q){if(message.type==='result')results.push({subtype:message.subtype,isError:message.is_error,numTurns:message.num_turns,totalCostUSD:message.total_cost_usd});}
}catch{failure=true;}finally{
 clearTimeout(timer);abort.abort();try{q?.close();}catch{}
 if(childClose){const status=await Promise.race([childClose,new Promise(resolve=>setTimeout(()=>resolve(null),4000))]);if(status===null){child.kill('SIGTERM');await Promise.race([childClose,new Promise(resolve=>setTimeout(resolve,1000))]);}}
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
const main=keys.filter(key=>key.subpath===undefined),correlated=main.length===1&&nativeInit.some(m=>m.sessionId===main[0].sessionId)&&nativeMirrors.some(m=>m.filePath===join(configDir,'projects',main[0].projectKey,main[0].sessionId+'.jsonl'));
const receipt={scope:'ACTUAL_LOCAL_SDK_CLI_MECHANICS_NOT_TASK_AUTHORITY',sdkVersion:'0.3.295',cliPackageVersion:JSON.parse(readFileSync(join(dirname(cli),'package.json'),'utf8')).version,cliPath:cli,spawns,childPid:child?.pid,closeObserved,localRefusedRequests:localRequests,providerCalls:0,providerTransportInstalled:false,mirrorBatches,mainKeys:main,nativeInit,nativeMirrorFrameCount:nativeMirrors.length,actualInitMainKeyCorrelated:correlated,results,queryFailed:failure,stdoutBytes:record.stdoutTotalBytes,stdoutSha256:record.stdoutSha256,physicalIsolationQualified:false,productTaskVerifierInstalled:false,productRegistrationReaderInstalled:false};
console.log(JSON.stringify(receipt));await rm(taskRoot,{recursive:true,force:true});
if(!correlated||!closeObserved)process.exitCode=1;
