/** Actual pinned SDK/CLI observation only; no provider transport, credentials or product authority. */
import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {spawn} from 'node:child_process';import {Transform} from 'node:stream';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash,randomUUID} from 'node:crypto';
import {observeNativeStdout} from '../../../../../apps/worker/qualification/probes/native-stream-observer.mjs';
import {scopedSessionKey,copySessionEntries} from '../../../../../apps/worker/qualification/checkpoint/bound-session-store.mjs';
import {createNativeRunnerGateway} from '../../../../../apps/runtime/native-runner-gateway.mjs';
import {createNativeSdkSessionClient} from '../../../../../apps/runtime/native-authority/session-client.mjs';
import {createNativeSdkSessionApplication} from '../../../../../apps/runtime/native-authority/session-http.mjs';
import {listenRuntime} from '../../../../../apps/runtime/http-server.mjs';
import {binding} from '../../../../../apps/control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as canonicalHash} from '../../../../../packages/contracts/validate.mjs';
import {assertSdkSessionRequestHeaders} from '../../../../../packages/contracts/runtime-0.2/session.mjs';
const sdkDir='/workspace/meri-first-session/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk';
assert.equal(JSON.parse(readFileSync(join(sdkDir,'package.json'),'utf8')).version,'0.3.295');
const cli=realpathSync(join(dirname(sdkDir),'claude-agent-sdk-linux-x64/claude'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const taskRoot=await mkdtemp(join(tmpdir(),'meri-sdk-zero-provider-')),workspace=join(taskRoot,'workspace'),configDir=join(taskRoot,'config');await mkdir(workspace);await mkdir(configDir);
let query,q,child,childClose,timer,localRequests=0,spawns=0,mirrorBatches=0;const keys=[],nativeInit=[],nativeMirrors=[],results=[],record={};const abort=new AbortController();
const server=createServer((request,response)=>{localRequests++;request.resume();response.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify({type:'error',error:{type:'permission_error',message:'Local probe has no provider transport'}}));});
server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const origin='http://127.0.0.1:'+server.address().port;
// Scripted ACK receiver only: no product task verifier/registration/admission or durable storage.
let relays=0,acks=0;const offsets=new Map(),countedOffsets=new Map();
const rpcConfiguration={http:{hostname:'127.0.0.1',port:0,frontendOrigin:'http://127.0.0.1'},limits:{requestMs:1000,shutdownMs:1000}};
const refused=async()=>{throw Error('MECHANICAL_APPEND_ONLY');};
const rpcOwner={register:refused,load:refused,listSubkeys:refused,async append({credential,request}){
 assert.equal(credential,'synthetic-sdk-transport-only');const h=assertSdkSessionRequestHeaders('append',request),entries=copySessionEntries(request.entries);assert.deepEqual(h.binding,binding);assert.equal(canonicalHash(entries),h.entriesSha256);
 const name=JSON.stringify(h.key),before=countedOffsets.get(name)??0;assert.equal(h.expectedOffset,before);countedOffsets.set(name,before+entries.length);acks++;
 return {binding,key:h.key,appendId:h.appendId,entriesSha256:h.entriesSha256,requestSha256:canonicalHash(request),committed:true,offset:before+entries.length,added:entries.length};
}};
const controlApp=createNativeSdkSessionApplication({owner:rpcOwner,maxRequestMs:1000});
let controlListener,gatewayListener,rpcClient;
try{
 controlListener=await listenRuntime({configuration:rpcConfiguration,application:controlApp,readiness:async()=>{}});
 const controlBase='http://127.0.0.1:'+controlListener.address.port;
 const gateway=createNativeRunnerGateway({controlOrigin:'https://control.mechanical.invalid',enabled:true,fetchImpl:(url,init)=>{assert.equal(new URL(url).origin,'https://control.mechanical.invalid');relays++;return fetch(controlBase+new URL(url).pathname,init);},limits:{maxRequestMs:1000,maxRequestBytes:9437184,maxResponseBytes:35651584}});
 gatewayListener=await listenRuntime({configuration:rpcConfiguration,application:{async handle(request){return await gateway.handle(request)??Response.json({}, {status:404});}},readiness:async()=>{}});
 const gatewayBase='http://127.0.0.1:'+gatewayListener.address.port;
 rpcClient=createNativeSdkSessionClient({origin:'https://gateway.mechanical.invalid',credential:'synthetic-sdk-transport-only',binding,fetchImpl:(url,init)=>{assert.equal(new URL(url).origin,'https://gateway.mechanical.invalid');return fetch(gatewayBase+new URL(url).pathname,init);},maxRequestMs:1000});
}catch(error){await gatewayListener?.close();await controlListener?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(taskRoot,{recursive:true,force:true});throw error;}

const env={PATH:process.env.PATH,CLAUDE_CONFIG_DIR:configDir,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDir,XDG_CONFIG_HOME:join(taskRoot,'xdg-config'),XDG_CACHE_HOME:join(taskRoot,'xdg-cache'),XDG_STATE_HOME:join(taskRoot,'xdg-state'),XDG_DATA_HOME:join(taskRoot,'xdg-data'),ANTHROPIC_BASE_URL:origin,ANTHROPIC_AUTH_TOKEN:'synthetic-local-uncredentialed',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_TELEMETRY:'1',DISABLE_ERROR_REPORTING:'1',CLAUDE_CODE_DISABLE_AUTO_UPDATE:'1'};
// Use the SDK's supported config resolvers in both parent and subprocess.
// This is this probe process only; HOME and persistent configuration remain unchanged.
for(const name of Object.keys(process.env))if(/^(CLAUDE_|ANTHROPIC_|AWS_|GOOGLE_|GCP_|AZURE_|OPENAI_|LITELLM_)/u.test(name))delete process.env[name];
Object.assign(process.env,env);
({query}=await import(pathToFileURL(join(sdkDir,'sdk.mjs')).href));
let failure=false,closeObserved=false,forcedKill=false,nativeFrameError=false;
try{
 timer=setTimeout(()=>abort.abort(),20000);
 q=query({prompt:'/status',options:{cwd:workspace,env,abortController:abort,pathToClaudeCodeExecutable:cli,settingSources:[],settings:{autoMemoryEnabled:false},skills:[],plugins:[],mcpServers:{},hooks:{},tools:[],allowedTools:[],permissionMode:'default',canUseTool:async()=>({behavior:'deny',message:'No tool admitted'}),model:'meri-local-no-provider',maxTurns:1,maxBudgetUsd:0.000001,persistSession:true,sessionStoreFlush:'eager',sessionStore:{async append(key,entries){const k=scopedSessionKey(key,key);copySessionEntries(entries);mirrorBatches++;const name=JSON.stringify(k),expectedOffset=offsets.get(name)??0;const ack=await rpcClient.append({key:k,appendId:randomUUID(),expectedOffset,entriesSha256:canonicalHash(entries),entries});offsets.set(name,ack.offset);if(!keys.some(v=>JSON.stringify(v)===JSON.stringify(k)))keys.push(k);},async load(){throw Error('FRESH_LOAD_REFUSED');},async listSubkeys(){throw Error('FRESH_LOAD_REFUSED');}},spawnClaudeCodeProcess(options){
  assert.equal(++spawns,1);assert.equal(realpathSync(options.command),cli);assert.equal(options.cwd,workspace);
  for(const name of ['ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY'])assert.ok(!options.env[name]);
  assert.equal(options.env.ANTHROPIC_BASE_URL,origin);assert.equal(options.env.CLAUDE_CONFIG_DIR,configDir);assert.equal(options.env.CLAUDE_SECURESTORAGE_CONFIG_DIR,configDir);
  child=spawn(options.command,options.args,{cwd:options.cwd,env:options.env,signal:options.signal,stdio:['pipe','pipe','pipe']});
  childClose=new Promise(resolve=>child.once('close',(code,signal)=>{closeObserved=true;resolve({code,signal});}));
  observeNativeStdout(child,record,()=>abort.abort());
  const decoder=new TextDecoder('utf-8',{fatal:true});let pending='';
  const tap=new Transform({transform(chunk,_encoding,callback){try{pending+=decoder.decode(chunk,{stream:true});if(Buffer.byteLength(pending)>1048576)throw Error('FRAME_BOUND');let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);if(!line)continue;const frame=JSON.parse(line);if(frame.type==='system'&&frame.subtype==='init')nativeInit.push({sessionId:frame.session_id,cliVersion:frame.claude_code_version,sha256:sha(line)});if(frame.type==='transcript_mirror')nativeMirrors.push({filePath:frame.filePath,entriesSha256:sha(JSON.stringify(frame.entries))});}callback(null,chunk);}catch{nativeFrameError=true;abort.abort();callback(Error('NATIVE_FRAME_REFUSED'));}},flush(callback){try{pending+=decoder.decode();if(pending.length)throw Error('NATIVE_FRAME_TAIL');callback();}catch{nativeFrameError=true;abort.abort();callback(Error('NATIVE_FRAME_REFUSED'));}}});
  child.stdout=child.stdout.pipe(tap);child.stdio[1]=child.stdout;
  let stderrBytes=0;child.stderr.on('data',chunk=>{stderrBytes+=chunk.byteLength;if(stderrBytes>65536)abort.abort();});
  return child;
 }} });
 for await(const message of q){if(message.type==='result')results.push({subtype:message.subtype,isError:message.is_error,numTurns:message.num_turns,totalCostUSD:message.total_cost_usd});}
}catch{failure=true;}finally{
 clearTimeout(timer);abort.abort();try{q?.close();}catch{}
 if(childClose){const status=await Promise.race([childClose,new Promise(resolve=>setTimeout(()=>resolve(null),4000))]);if(status===null&&child.exitCode===null&&child.signalCode===null){forcedKill=true;child.kill('SIGKILL');await Promise.race([childClose,new Promise(resolve=>setTimeout(resolve,1000))]);}}
 await gatewayListener?.close();await controlListener?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
const streamComplete=record.stdoutEnded===true&&record.stdoutClosed===true&&!record.stdoutReadError&&!record.stdoutOverflow&&!nativeFrameError;
const main=keys.filter(key=>key.subpath===undefined),correlated=main.length===1&&nativeInit.some(m=>m.sessionId===main[0].sessionId&&m.cliVersion==='2.1.295')&&nativeMirrors.some(m=>m.filePath===join(configDir,'projects',main[0].projectKey,main[0].sessionId+'.jsonl'));
const receipt={scope:'ACTUAL_LOCAL_SDK_GATEWAY_TRANSPORT_WITH_SCRIPTED_ACK_NOT_TASK_AUTHORITY',sdkVersion:'0.3.295',cliPackageVersion:JSON.parse(readFileSync(join(dirname(cli),'package.json'),'utf8')).version,cliPath:cli,relays,acks,transportAckMatches:relays===acks&&acks===mirrorBatches,registrationQualified:false,durableStorageQualified:false,spawns,childPid:child?.pid,closeObserved,forcedKill,streamComplete,nativeFrameError,stdoutError:record.stdoutReadError===true||record.stdoutOverflow===true,localRefusedRequests:localRequests,providerCalls:0,providerTransportInstalled:false,mirrorBatches,mainKeys:main,nativeInit,nativeMirrorFrameCount:nativeMirrors.length,actualInitMainKeyCorrelated:correlated,results,queryFailed:failure,stdoutBytes:record.stdoutTotalBytes,stdoutSha256:record.stdoutSha256,physicalIsolationQualified:false,productTaskVerifierInstalled:false,productRegistrationReaderInstalled:false};
console.log(JSON.stringify(receipt));if(closeObserved)await rm(taskRoot,{recursive:true,force:true});
if(!correlated||!closeObserved||!streamComplete||forcedKill||acks!==mirrorBatches||relays!==acks||acks===0)process.exitCode=1;
