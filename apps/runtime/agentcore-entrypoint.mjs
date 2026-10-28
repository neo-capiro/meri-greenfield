/** AgentCore owns container lifecycle; this entrypoint owns only HTTP and its active SDK invocation. */
import {pathToFileURL} from 'node:url';
import {listenRuntime} from './http-server.mjs';
import {agentcoreEnvironment,createAgentCoreControlTransport} from './agentcore-control-client.mjs';
import {createAgentCoreWorkspace} from './agentcore-workspace.mjs';
import {createAgentCoreQuery} from './agentcore-query.mjs';
import {createAgentCoreApplication} from './agentcore-http.mjs';
import {createSdkProviderCredentials} from './sdk-provider-credentials.mjs';
import {reportRuntimeStartupFailure} from './runner-runtime-diagnostics.mjs';
import {createRuntimeRendererApplication} from './artifacts/renderer-http.mjs';
import {createUploadInspectionApplication,composeUploadInspectionHost,uploadInspectionHostConfiguration} from './uploads/agentcore-http.mjs';
import {beginUploadNativeProvisioning,UPLOAD_NATIVE_UNAVAILABLE_EVENT} from './uploads/control-lifecycle.mjs';
export async function main(argv=process.argv.slice(2)){
 if(argv.length===1&&['--help','-h'].includes(argv[0])){process.stdout.write('AgentCore HTTP runtime: /invocations and /ping on8080. Configure MERI_CONTROL_ORIGIN, MERI_CONTROL_CA_BASE64, MERI_CONTROL_CA_SHA256, AWS_REGION. Exit0 graceful;2 configuration;3 unknown shutdown.\n');return 0;}
 if(argv.length)return 2;let transport,listener,application,providerCredentials,stage='agentcore-config';const stop=new AbortController(),shutdown=()=>stop.abort();
 try{const configuration=agentcoreEnvironment();stage='agentcore-transport';transport=createAgentCoreControlTransport(configuration);
  stage='agentcore-clients';providerCredentials=createSdkProviderCredentials({secretArn:process.env.MERI_CLAUDE_API_SECRET_ARN,region:configuration.region});
  const execute=createAgentCoreQuery({origin:configuration.origin,fetchImpl:transport.fetch,workspace:createAgentCoreWorkspace(),providerCredentials});
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
  const renderer=createRuntimeRendererApplication({imageDigest:process.env.MERI_RENDERER_IMAGE_DIGEST,signal:stop.signal});
  // The custody-mediated native inspection purpose runs in this SAME runtime image, so its declared expectation is
  // the same declaration. Its host is composed here, before it serves, from the accepted owners -- the fixed native
  // sandbox and the signed-definition store, observed through `composeUploadNativeHost` -- on this container's own
  // bounded startup budget. The sandbox and the two fixed tool identities are OBSERVED before either port exists; a
  // host that cannot attest them, or cannot resolve a signed snapshot, is honestly UNAVAILABLE (503) rather than an
  // unprovisioned scanner, and no request, upload or environment value can name a command, program, image or tool.
  stage='agentcore-inspection-host';const inspectionHost=await composeUploadInspectionHost({signal:stop.signal});
  if(inspectionHost.missing.length)process.stderr.write(JSON.stringify({event:UPLOAD_NATIVE_UNAVAILABLE_EVENT,missing:inspectionHost.missing})+'\n');
  const inspection=createUploadInspectionApplication({inspection:inspectionHost.inspection,imageDigest:process.env.MERI_RENDERER_IMAGE_DIGEST,signal:stop.signal});
  application=createAgentCoreApplication({execute,renderer,inspection,signal:stop.signal});
  stage='agentcore-listen';listener=await listenRuntime({configuration:{http:{hostname:'0.0.0.0',port:8080},limits:{requestMs:900000,shutdownMs:15000}},application,readiness:async()=>{},signal:stop.signal,exposeReadiness:false});
  // The ONE bounded provisioning attempt runs after listen under its own absolute deadline, through the SAME
  // serialized refresh owner the scans use: started and never awaited, not a timer, daemon, scheduler or job, and
  // aborted by shutdown through the runtime signal. A cold signed-definition download does not belong on the startup
  // path and a short-lived inspection session cannot host it, which is why it is here and not in the request. There
  // is no retry and no loop, and an integrity, cancellation or configuration condition is never re-provisioned as
  // though it were merely stale (`UPLOAD_NATIVE_PROVISIONABLE` is the closed list, and it is the same one CONTROL
  // uses). When the host could not be composed at all there is nothing to provision and this stays idle.
  stage='agentcore-inspection-provisioning';beginUploadNativeProvisioning({handle:inspectionHost,configuration:uploadInspectionHostConfiguration(process.env),now:Date.now,signal:stop.signal});
  if(!stop.signal.aborted)await new Promise(resolve=>stop.signal.addEventListener('abort',resolve,{once:true}));
  stage='agentcore-shutdown';const [result,query]=await Promise.all([listener.close(),application.close({deadlineMs:Date.now()+15000})]);return result.listenerStopped&&result.pendingRequests===0&&query.settled?0:3;
 }catch(error){reportRuntimeStartupFailure('agentcore',stage,error);process.stderr.write('AGENTCORE_RUNTIME_UNAVAILABLE\n');return listener?3:2;}
  finally{process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);await listener?.close();transport?.close();providerCredentials?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
