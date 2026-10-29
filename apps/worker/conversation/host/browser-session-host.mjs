/** Trusted D005 host composition. Native relay/process/hold ports remain their owners.
 * No host allocation or browser activation is performed here. */
import {createPinnedBrowserSession} from '../browser/session/connection.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateBrowserPolicy} from '../browser/policy.mjs';
import {validateBrowserInstallation,playwrightServerConfig} from '../browser/server.mjs';
import {browserPaths} from '../browser/workspace.mjs';
import {validateSiteWorkflowManifest} from '../browser/site-workflows/manifest.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createBrowserSessionHost({binding,cwd,installation,upstream,contexts,relay,controls,current,hold,processes,dispose,now}){
 const installed=validateBrowserInstallation(installation,binding),bound=canonicalSha256(binding),paths=browserPaths(cwd);
 for(const [port,name]of [[contexts,'create'],[relay,'bind'],[controls,'bind'],[processes,'waitForExit']])
  if(typeof port?.[name]!=='function')fail('BROWSER_CONFIGURATION');
 if(typeof current!=='function'||typeof hold!=='function'||typeof dispose!=='function'||typeof now!=='function')fail('BROWSER_CONFIGURATION');
 let opened=false;
 return Object.freeze({async open(raw){
  const q=data(own(raw,['binding','policy','deadlineMs','manifest']));
  if(opened||canonicalSha256(q.binding)!==bound||!Number.isSafeInteger(q.deadlineMs)||q.deadlineMs<=now())fail('BROWSER_HOST_BINDING_REFUSED');
  opened=true;const policy=validateBrowserPolicy(q.policy),manifest=q.manifest===null?null:validateSiteWorkflowManifest(q.manifest,{platformMaximumOrigins:policy.allowedOrigins});
  if(manifest?.logoutUrl&&typeof contexts.logout!=='function')fail('BROWSER_CONFIGURATION');
  let context,session,modelRelay,userRelay,closing;
  const close=({trigger})=>closing??=(async()=>{
   // Both native input channels are revoked before teardown. Relay acknowledgements
   // do not stand in for the host's actual process-absence and filesystem proofs.
   let refusal;for(const port of [modelRelay,userRelay])try{await port?.close();}catch(error){refusal??=error;}
   let receipt;try{receipt=await session.destroy({trigger});}catch(error){refusal??=error;}
   if(refusal)throw refusal;return receipt;
  })();
  try{
   await current({binding:q.binding,signal:undefined});
   context=await contexts.create({binding:q.binding,policy,paths,installation:installed,deadlineMs:q.deadlineMs});
   session=await createPinnedBrowserSession({upstream,context,policy,manifest,now,deadlineMs:q.deadlineMs,
    current:signal=>current({binding:q.binding,signal}),hold:signal=>hold({binding:q.binding,signal}),
    ports:{async waitForExit({signal}){return processes.waitForExit({binding:q.binding,profile:paths.profile},{signal});},
     dispose:({signal})=>dispose({paths,signal}),...(manifest?.logoutUrl?{logout:(input,{signal})=>contexts.logout({context,...input,signal})}:{})}});
   modelRelay=await relay.bind({binding:q.binding,installation:installed,call:session.call,tools:session.tools});
   const expected={meri_browser:playwrightServerConfig(policy,installed,paths)};
   if(canonicalSha256(modelRelay.mcpServers)!==canonicalSha256(expected)||typeof modelRelay.close!=='function')fail('BROWSER_RELAY_REFUSED');
   // Controls are bound only by a native host viewer relay. They are never MCP tools.
   userRelay=await controls.bind({binding:q.binding,controls:{takeover:session.takeover,userInput:session.userInput,
    handBack:session.handBack,endLease:session.endLease,resume:session.resume,destroy:close}});
   if(typeof userRelay?.close!=='function')fail('BROWSER_RELAY_REFUSED');
   await current({binding:q.binding,signal:undefined});
   return Object.freeze({mcpServers:expected,destroy:close});
  }catch(error){
   if(session)try{await close({trigger:'disconnect'});}catch{fail('BROWSER_DISPOSE_INCOMPLETE');}
   else if(context)await context.close();throw error;
  }
 }});
}
