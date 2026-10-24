/** AgentCore owns container lifecycle; this entrypoint owns only HTTP and its active SDK invocation. */
import {pathToFileURL} from 'node:url';
import {listenRuntime} from './http-server.mjs';
import {agentcoreEnvironment,createAgentCoreControlTransport} from './agentcore-control-client.mjs';
import {createAgentCoreWorkspace} from './agentcore-workspace.mjs';
import {createAgentCoreQuery} from './agentcore-query.mjs';
import {createAgentCoreApplication} from './agentcore-http.mjs';
import {createSdkProviderCredentials} from './sdk-provider-credentials.mjs';
export async function main(argv=process.argv.slice(2)){
 if(argv.length===1&&['--help','-h'].includes(argv[0])){process.stdout.write('AgentCore HTTP runtime: /invocations and /ping on8080. Configure MERI_CONTROL_ORIGIN, MERI_CONTROL_CA_BASE64, MERI_CONTROL_CA_SHA256, AWS_REGION. Exit0 graceful;2 configuration;3 unknown shutdown.\n');return 0;}
 if(argv.length)return 2;let transport,listener,application,providerCredentials;const stop=new AbortController(),shutdown=()=>stop.abort();
 try{const configuration=agentcoreEnvironment();transport=createAgentCoreControlTransport(configuration);
  providerCredentials=createSdkProviderCredentials({secretArn:process.env.MERI_CLAUDE_API_SECRET_ARN,region:configuration.region});
  const execute=createAgentCoreQuery({origin:configuration.origin,fetchImpl:transport.fetch,workspace:createAgentCoreWorkspace(),providerCredentials});
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  application=createAgentCoreApplication({execute,signal:stop.signal});
  listener=await listenRuntime({configuration:{http:{hostname:'0.0.0.0',port:8080},limits:{requestMs:900000,shutdownMs:15000}},application,readiness:async()=>{},signal:stop.signal,exposeReadiness:false});
  if(!stop.signal.aborted)await new Promise(resolve=>stop.signal.addEventListener('abort',resolve,{once:true}));
  const [result,query]=await Promise.all([listener.close(),application.close({deadlineMs:Date.now()+15000})]);return result.listenerStopped&&result.pendingRequests===0&&query.settled?0:3;
 }catch{process.stderr.write('AGENTCORE_RUNTIME_UNAVAILABLE\n');return listener?3:2;}
  finally{process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);await listener?.close();transport?.close();providerCredentials?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
