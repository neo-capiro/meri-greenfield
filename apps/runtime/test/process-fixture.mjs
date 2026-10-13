/** Synthetic native/SQL/Temporal dependencies only; never loaded by the product CLI. */
import {assembleControl} from '../control.mjs';
import {listenRuntime} from '../http-server.mjs';
import {validateConfiguration} from '../config.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {storeFixture,binding,scopes,versions} from '../../control/conversations/test/store-fixture.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
const limits={startupMs:5000,shutdownMs:1000,requestMs:1000,requestBytes:131072},http={hostname:'127.0.0.1',port:0,frontendOrigin:'http://127.0.0.1'},configuration={version:1,profile:'isolated-preview',sourceEnabled:false,limits,http,native:{origin:'http://127.0.0.1',capabilityFile:'/tmp/synthetic-not-read',loopback:true,maxResponseBytes:2097152},database:{connectionFile:'/tmp/synthetic-not-read'},temporal:{address:'temporal.invalid:7233',namespace:'meri-preview',taskQueue:'meri-conversations-v1',tls:{caFile:'/tmp/ca',certFile:'/tmp/cert',keyFile:'/tmp/key'}},sessions:{mode:'process-local',replicas:1,maxSessions:20,maxTtlMs:30000},versions};
let revoked=false,starts=0,ready=true,controlOrigin;
const nativeServer=await listenRuntime({configuration,readiness:async()=>{},application:{async handle(request){
 if(request.headers.get('authorization')!=='Bearer synthetic-service-cap')return Response.json({}, {status:403});const route=new URL(request.url).pathname,input=await request.json(),at=Date.now();if(revoked)return Response.json({}, {status:403});
 let value;if(route==='/v1/readiness')value={service:'meri-native-capability-provider/1',ready};
 else if(route==='/v1/identity/verify')value={principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'identity1',checkedAtMs:at,expiresAtMs:at+30000};
 else if(route==='/v1/context/resolve')value={identitySha256:canonicalSha256(input.identity),binding,scopes,selectedClientId:scopes[0].resourceId,contextRevision:'context1',checkedAtMs:at,expiresAtMs:at+30000};
 else if(route==='/v1/worker/authorize'){if(input.capability!=='synthetic-task-cap'||canonicalSha256(input.binding)!==canonicalSha256(binding))return Response.json({}, {status:403});value={binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:scopes[0].resourceId,policyRevision:'policy1',authorizationDecisionId:'synthetic-decision',checkedAtMs:at,expiresAtMs:at+30000};}
 else if(route==='/v1/runner/load'||route==='/v1/runner/publish'){return fetch(controlOrigin+'/internal/conversations/'+route.split('/').at(-1),{method:'POST',headers:{authorization:'Bearer synthetic-task-cap','content-type':'application/json'},body:JSON.stringify(input)});}
 else if(route==='/v1/runner/runtime')value={binding,versions,proxyUrl:'https://proxy.example.invalid',proxyCredential:'synthetic-proxy-cap',model:'synthetic-test-model',deadlineMs:at+3000,maxTurns:2,maxCostMicroUSD:1,maxOutputBytes:1024};
 else return Response.json({}, {status:404});return Response.json(value);
}}});configuration.native.origin='http://127.0.0.1:'+nativeServer.address.port;const config=validateConfiguration(configuration,'control'),f=storeFixture(),client={workflow:{async start(){starts++;},getHandle(){return {async cancel(){}};}}},native=createNativeCapabilityClient({configuration:config.native,credential:'synthetic-service-cap'}),assembly=assembleControl({configuration:config,pool:f.pool,client,native});
const listener=await listenRuntime({configuration:config,application:assembly.application,readiness:async({signal})=>native.readiness({signal})});
controlOrigin='http://127.0.0.1:'+listener.address.port;
process.send({type:'ready',port:listener.address.port,binding,versions});
let closing;async function close(){closing??=(async()=>{await listener.close();assembly.close();await nativeServer.close();process.disconnect();})();await closing;}
process.on('message',async value=>{if(value==='revoke')revoked=true;if(value==='not-ready')ready=false;if(value==='state')process.send({type:'state',starts,runs:f.state.runs.size,events:f.state.events.size});if(value==='execute'){try{const execute=assembleConversationRunner({configuration:{binding,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid'},native,query(){return {async *[Symbol.asyncIterator](){yield {type:'assistant',message:{id:'synthetic-message',content:[{type:'text',text:'Synthetic process answer'}]}};yield {type:'result',subtype:'success',is_error:false};},close(){}};}});process.send({type:'execution',result:await execute({binding})});}catch(error){process.send({type:'execution-error',code:error.message});}}if(value==='close')void close();});process.once('SIGTERM',()=>{void close();});process.once('SIGINT',()=>{void close();});
