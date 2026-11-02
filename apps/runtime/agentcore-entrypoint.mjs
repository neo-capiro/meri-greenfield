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
import {createUploadInspectionApplication,composeUploadInspectionHost} from './uploads/agentcore-http.mjs';
import {UPLOAD_NATIVE_UNAVAILABLE_EVENT,UPLOAD_NATIVE_AVAILABLE_EVENT} from './uploads/control-lifecycle.mjs';
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
  // sandbox and the PINNED store over the signed-definition snapshot baked into this image, observed through
  // `composeUploadNativeHost` -- on this container's own bounded startup budget. The sandbox and the two fixed tool
  // identities are OBSERVED before either port exists; a host that cannot attest them is honestly UNAVAILABLE (503)
  // rather than an unprovisioned scanner, and no request, upload or environment value can name a command, program,
  // image or tool. Nothing is provisioned here or after listen: a one-use session never downloads definitions (see
  // composeUploadInspectionHost), so the startup event records WHICH baked snapshot this container serves -- its
  // public hash, its publication time, or the condition that keeps every scan unavailable until the image is rebuilt.
  stage='agentcore-inspection-host';const inspectionHost=await composeUploadInspectionHost({signal:stop.signal});
  const definitionsState=inspectionHost.host?.definitionsProvisioningState?.()??null;
  const definitions=definitionsState===null?null:{pinned:definitionsState.pinned===true,snapshot:definitionsState.snapshot,reason:definitionsState.reason};
  if(inspectionHost.missing.length)process.stderr.write(JSON.stringify({event:UPLOAD_NATIVE_UNAVAILABLE_EVENT,missing:inspectionHost.missing,
   ...(typeof inspectionHost.reason==='string'?{reason:inspectionHost.reason}:{}),
   ...(Array.isArray(inspectionHost.requirements)&&inspectionHost.requirements.length?{requirements:inspectionHost.requirements}:{}),
   ...(inspectionHost.diagnostic&&typeof inspectionHost.diagnostic==='object'?{diagnostic:inspectionHost.diagnostic}:{})})+'\n');
  else process.stderr.write(JSON.stringify({event:UPLOAD_NATIVE_AVAILABLE_EVENT,boundedBy:inspectionHost.host?.diagnostic?.boundedBy??null,
   ...(inspectionHost.host?.diagnostic?.cgroupHost?{cgroupHost:inspectionHost.host.diagnostic.cgroupHost}:{}),definitions})+'\n');
  const inspection=createUploadInspectionApplication({inspection:inspectionHost.inspection,imageDigest:process.env.MERI_RENDERER_IMAGE_DIGEST,signal:stop.signal});
  application=createAgentCoreApplication({execute,renderer,inspection,signal:stop.signal});
  stage='agentcore-listen';listener=await listenRuntime({configuration:{http:{hostname:'0.0.0.0',port:8080},limits:{requestMs:900000,shutdownMs:15000}},application,readiness:async()=>{},signal:stop.signal,exposeReadiness:false});
  if(!stop.signal.aborted)await new Promise(resolve=>stop.signal.addEventListener('abort',resolve,{once:true}));
  stage='agentcore-shutdown';const [result,query]=await Promise.all([listener.close(),application.close({deadlineMs:Date.now()+15000})]);return result.listenerStopped&&result.pendingRequests===0&&query.settled?0:3;
 }catch(error){reportRuntimeStartupFailure('agentcore',stage,error);process.stderr.write('AGENTCORE_RUNTIME_UNAVAILABLE\n');return listener?3:2;}
  finally{process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);await listener?.close();transport?.close();providerCredentials?.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
