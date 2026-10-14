/** One actual SDK/CLI /status: raw native reader -> canonical registration/mirror.
 * SQL/admission/task authorization below are explicit local fixtures, not genuine authority. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {Transform} from 'node:stream';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createNativeSessionRegistration} from '../../../../../apps/runtime/native-authority/session-registration.mjs';
import {createDurableSdkSessionOwner} from '../../../../../apps/runtime/native-authority/session-owner.mjs';
import {createNativeRunnerGateway} from '../../../../../apps/runtime/native-runner-gateway.mjs';
import {createRuntimeSdkSessionFactory} from '../../../../../apps/runtime/sdk-session-runtime.mjs';
import {createNativeSdkSessionApplication} from '../../../../../apps/runtime/native-authority/session-http.mjs';
import {listenRuntime} from '../../../../../apps/runtime/http-server.mjs';
import {fixture,id} from '../../../../../apps/runtime/native-authority/test/fixture.mjs';
const sdkDir='/workspace/meri-first-session/apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk';
assert.equal(JSON.parse(readFileSync(join(sdkDir,'package.json'),'utf8')).version,'0.3.295');
const cli=realpathSync(join(dirname(sdkDir),'claude-agent-sdk-linux-x64/claude'));
// CLI binary package shares SDK release numbering; native init carries CLI version.
assert.equal(JSON.parse(readFileSync(join(dirname(cli),'package.json'),'utf8')).version,'0.3.295');
const taskRoot=await mkdtemp(join(tmpdir(),'meri-native-registration-')),workspace=join(taskRoot,'workspace'),configDir=join(taskRoot,'config');await mkdir(workspace);await mkdir(configDir);
const abort=new AbortController(),f=fixture(),binding=f.binding,expiresAtMs=Date.now()+30000;
let q,child,childClose,observer,mirror,timer,controlListener,gatewayListener;
let modelSinkRequests=0,spawns=0,relays=0,mirrorBatches=0,authChecks=0,closeObserved=false,forcedKill=false,sourceEnded=false,sourceClosed=false,sourceError=false,queryFailed=false;
const observations=[],results=[],keys=[],nativeInit=[],nativeMirrors=[];
let parserError=false,parserEnded=false,parsedBytes=0;
const stdoutHash=createHash('sha256');
const modelSink=createServer((request,response)=>{modelSinkRequests++;request.resume();response.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify({type:'error',error:{type:'permission_error',message:'No provider transport'}}));});
modelSink.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{modelSink.once('listening',resolve);modelSink.once('error',reject);});
const proxyOrigin='http://127.0.0.1:'+modelSink.address().port;
const rpcConfiguration={http:{hostname:'127.0.0.1',port:0,frontendOrigin:'http://127.0.0.1'},limits:{requestMs:1000,shutdownMs:1000}};
const authority={async verify(input){authChecks++;assert.equal(input.capability,'opaque-native-task');assert.deepEqual(input.binding,binding);return {binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'fixture-native-identity',scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:id(6),policyRevision:'policy'}],selectedClientId:id(6),policyRevision:'policy',authorizationDecisionId:'local-fixture-only',checkedAtMs:Date.now(),expiresAtMs};}};
const admission={withCurrentAllocation(input,effect){return f.admission.withCurrentAllocation(input,({client,current})=>effect({client,current:{...current,deadlineMs:expiresAtMs,checkedAtMs:Date.now()}}));}};
const registration={async read(input){assert.ok(observer,'actual native process must exist');const receipt=await observer.registration.read(input);observations.push(receipt);return receipt;}};
const owner=createDurableSdkSessionOwner({admission,authority,registration,enabled:true,maxRequestMs:1000});
try{
 controlListener=await listenRuntime({configuration:rpcConfiguration,application:createNativeSdkSessionApplication({owner,maxRequestMs:1000}),readiness:async()=>{}});
 const controlOrigin='http://127.0.0.1:'+controlListener.address.port;
 const gateway=createNativeRunnerGateway({controlOrigin:'https://control.local-fixture.invalid',enabled:true,fetchImpl:(url,init)=>{assert.equal(new URL(url).origin,'https://control.local-fixture.invalid');relays++;return fetch(controlOrigin+new URL(url).pathname,init);},limits:{maxRequestMs:1000,maxRequestBytes:9437184,maxResponseBytes:35651584}});
 gatewayListener=await listenRuntime({configuration:rpcConfiguration,application:{async handle(request){return await gateway.handle(request)??Response.json({}, {status:404});}},readiness:async()=>{}});
 const gatewayOrigin='http://127.0.0.1:'+gatewayListener.address.port;
 const factory=createRuntimeSdkSessionFactory({origin:'https://gateway.local-fixture.invalid',credential:'opaque-native-task',binding,fetchImpl:(url,init)=>{assert.equal(new URL(url).origin,'https://gateway.local-fixture.invalid');return fetch(gatewayOrigin+new URL(url).pathname,init);}});
 mirror=await factory({binding,sessionKey:null,runtimeSignal:abort.signal});
 const env={PATH:process.env.PATH,CLAUDE_CONFIG_DIR:configDir,CLAUDE_SECURESTORAGE_CONFIG_DIR:configDir,XDG_CONFIG_HOME:join(taskRoot,'xdg-config'),XDG_CACHE_HOME:join(taskRoot,'xdg-cache'),XDG_STATE_HOME:join(taskRoot,'xdg-state'),XDG_DATA_HOME:join(taskRoot,'xdg-data'),ANTHROPIC_BASE_URL:proxyOrigin,ANTHROPIC_AUTH_TOKEN:'synthetic-local-uncredentialed',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_TELEMETRY:'1',DISABLE_ERROR_REPORTING:'1',CLAUDE_CODE_DISABLE_AUTO_UPDATE:'1'};
 // Isolated probe process only; use supported config resolvers, leave HOME unchanged.
 for(const name of Object.keys(process.env))if(/^(CLAUDE_|ANTHROPIC_|AWS_|GOOGLE_|GCP_|AZURE_|OPENAI_|LITELLM_)/u.test(name))delete process.env[name];
 Object.assign(process.env,env);
 timer=setTimeout(()=>abort.abort(),20000);
 const {query}=await import(pathToFileURL(join(sdkDir,'sdk.mjs')).href);
 abort.signal.throwIfAborted();
 q=query({prompt:'/status',options:{cwd:workspace,env,abortController:abort,pathToClaudeCodeExecutable:cli,settingSources:[],settings:{autoMemoryEnabled:false},skills:[],plugins:[],mcpServers:{},hooks:{},tools:[],allowedTools:[],permissionMode:'default',canUseTool:async()=>({behavior:'deny',message:'No tool admitted'}),model:'meri-local-no-provider',maxTurns:1,maxBudgetUsd:0.000001,persistSession:true,sessionStoreFlush:'eager',sessionStore:{async append(key,entries){mirrorBatches++;if(!keys.some(k=>JSON.stringify(k)===JSON.stringify(key)))keys.push(key);return mirror.store.append(key,entries);},load:mirror.store.load,listSubkeys:mirror.store.listSubkeys},spawnClaudeCodeProcess(options){
  assert.equal(++spawns,1);assert.equal(realpathSync(options.command),cli);assert.equal(options.cwd,workspace);
  for(const name of ['ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY'])assert.ok(!options.env[name]);
  assert.equal(options.env.ANTHROPIC_BASE_URL,proxyOrigin);assert.equal(options.env.CLAUDE_CONFIG_DIR,configDir);assert.equal(options.env.CLAUDE_SECURESTORAGE_CONFIG_DIR,configDir);
  child=spawn(options.command,options.args,{cwd:options.cwd,env:options.env,signal:options.signal,stdio:['pipe','pipe','pipe']});
  childClose=new Promise(resolve=>child.once('close',(code,signal)=>{closeObserved=true;resolve({code,signal});}));
  const source=child.stdout;source.once('end',()=>{sourceEnded=true;});source.once('close',()=>{sourceClosed=true;});source.on('error',()=>{sourceError=true;});
  observer=createNativeSessionRegistration({binding,child,workspace,configDirectory:configDir,versions:{sdk:'0.3.295',cli:'2.1.295'},expiresAtMs,enabled:true,signal:abort.signal});
  // Independent downstream byte witness; new production reader retains first
  // ownership of original stdout. This catches parser tail/overflow/error even
  // if the first registration was valid before a malformed later frame.
  let pending=Buffer.alloc(0);
  const parser=new Transform({transform(chunk,_encoding,callback){try{
   stdoutHash.update(chunk);parsedBytes+=chunk.length;if(parsedBytes>67108864)throw Error('BYTE_BOUND');
   pending=Buffer.concat([pending,chunk]);let at;
   while((at=pending.indexOf(10))>=0){const raw=pending.subarray(0,at);pending=pending.subarray(at+1);if(raw.length>9437184)throw Error('FRAME_BOUND');if(!raw.length)continue;
    const frame=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    if(frame.type==='system'&&frame.subtype==='init')nativeInit.push({sessionId:frame.session_id,cliVersion:frame.claude_code_version,raw:Buffer.from(raw)});
    if(frame.type==='transcript_mirror')nativeMirrors.push({filePath:frame.filePath,raw:Buffer.from(raw)});
   }
   if(pending.length>9437184)throw Error('FRAME_BOUND');callback(null,chunk);
  }catch{parserError=true;abort.abort();callback(Error('LOCAL_NATIVE_FRAME_REFUSED'));}},flush(callback){if(pending.length){parserError=true;abort.abort();callback(Error('LOCAL_NATIVE_TAIL_REFUSED'));}else callback();}});
  parser.once('end',()=>{parserEnded=true;});parser.on('error',()=>{parserError=true;});
  observer.stdout.once('error',()=>{parserError=true;abort.abort();parser.destroy(Error('LOCAL_OBSERVER_REFUSED'));});
  child.stdout=observer.stdout.pipe(parser);child.stdio[1]=child.stdout;
  let stderrBytes=0;child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;if(stderrBytes>65536)abort.abort();});
  return child;
 }} });
 for await(const message of q){if(message.type==='result')results.push({subtype:message.subtype,isError:message.is_error,numTurns:message.num_turns,totalCostUSD:message.total_cost_usd});}
 await mirror.settle();
}catch(error){queryFailed=true;console.error(JSON.stringify({failureCode:typeof error?.code==='string'?error.code:'LOCAL_PROBE_FAILED'}));}finally{
 clearTimeout(timer);try{q?.close();}catch{}
 try{await mirror?.close();}catch{queryFailed=true;}
 abort.abort();observer?.close();
 if(childClose){const outcome=await Promise.race([childClose,new Promise(resolve=>{const t=setTimeout(()=>resolve(null),4000);t.unref();})]);if(outcome===null&&child.exitCode===null&&child.signalCode===null){forcedKill=true;child.kill('SIGKILL');await Promise.race([childClose,new Promise(resolve=>{const t=setTimeout(resolve,1000);t.unref();})]);}}
 await gatewayListener?.close();await controlListener?.close();modelSink.closeAllConnections();await new Promise(resolve=>modelSink.close(resolve));
}
const ownerRow=f.state().owner,mainKeys=keys.filter(k=>k.subpath===undefined),observed=observations[0];
const nativeMain=mainKeys.length===1?nativeMirrors.find(m=>m.filePath===join(configDir,'projects',mainKeys[0].projectKey,mainKeys[0].sessionId+'.jsonl')):undefined;
const rawCorrelated=nativeInit.length===1&&nativeMain!==undefined&&nativeInit[0].sessionId===mainKeys[0].sessionId&&nativeInit[0].cliVersion==='2.1.295';
const eventHash=rawCorrelated?createHash('sha256').update('native-init\n').update(nativeInit[0].raw).update('\nnative-main-mirror\n').update(nativeMain.raw).digest('hex'):null;
const positive=rawCorrelated&&eventHash===observed?.sessionEventSha256&&observations.length===1&&ownerRow!==null&&mainKeys.length===1&&JSON.stringify(ownerRow.owner.key)===JSON.stringify(mainKeys[0])&&ownerRow.owner.observationId===observed.observationId&&ownerRow.owner.sessionEventSha256===observed.sessionEventSha256&&observed.expiresAtMs===expiresAtMs&&f.state().entries.length>0;
console.log(JSON.stringify({scope:'ACTUAL_LOCAL_SDK_REGISTRATION_AND_CANONICAL_MIRROR_WITH_SYNTHETIC_AUTHORITY_SQL',sdkVersion:'0.3.295',cliVersion:'2.1.295',spawns,childPid:child?.pid,closeObserved,forcedKill,sourceEnded,sourceClosed,sourceError,parserError,parserEnded,parsedBytes,stdoutSha256:stdoutHash.digest('hex'),nativeInitCount:nativeInit.length,nativeMirrorCount:nativeMirrors.length,observedEventSha256:observed?.sessionEventSha256,independentEventSha256:eventHash,rawCorrelated,relays,authChecks,mirrorBatches,registrationObservations:observations.length,registeredRows:ownerRow?1:0,storedEntries:f.state().entries.length,storedStreams:f.state().streams.size,mainKeys,originalExpiryPreserved:observed?.expiresAtMs===expiresAtMs,actualInitMainKeyRegistered:positive,observer:observer?.status(),queryFailed,results,modelSinkRequests,providerCalls:0,providerTransportInstalled:false,taskAuthorityQualified:false,productDatabaseQualified:false,independentDeploymentBindingQualified:false,physicalIsolationQualified:false}));
if(!child||closeObserved)await rm(taskRoot,{recursive:true,force:true});
if(queryFailed||!positive||!closeObserved||forcedKill||!sourceEnded||!sourceClosed||sourceError||parserError||!parserEnded||modelSinkRequests!==0||spawns!==1)process.exitCode=1;
