/** One isolated task, one run, canonical SDK activity. No Temporal or DB credentials. */
import {createConversationActivity} from '../worker/conversation/activity.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readSecret,fault} from './config.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
export function assembleConversationRunner({configuration,native,query}){
 const binding=configuration.binding,call=(operation,input,signal)=>native.call(operation,{binding,...input},{signal});
 const runOwner={load:({binding:b,signal})=>{if(canonicalSha256(b)!==canonicalSha256(binding))throw fault('RUNNER_BINDING_REFUSED');return call('runner/load',{},signal);},append:({binding:b,event,signal})=>{if(canonicalSha256(b)!==canonicalSha256(binding))throw fault('RUNNER_BINDING_REFUSED');return call('runner/publish',{event},signal);}};
 const prepareRuntime=async({binding:b,versions,signal})=>{const r=await call('runner/runtime',{versions},signal);own(r,['binding','versions','proxyUrl','proxyCredential','model','deadlineMs','maxTurns','maxCostMicroUSD','maxOutputBytes']);if(canonicalSha256(r.binding)!==canonicalSha256(b)||canonicalSha256(r.versions)!==canonicalSha256(versions)||new URL(r.proxyUrl).origin!==configuration.proxyOrigin)throw fault('RUNNER_RUNTIME_REFUSED');return {...r,cwd:configuration.workspace,sessionStore:{load:key=>call('runner/session/load',{key}).then(v=>{own(v,['entries']);return v.entries;}),append:(key,entries)=>call('runner/session/append',{key,entries}).then(v=>{own(v,['committed']);if(v.committed!==true)throw fault('SESSION_PERSISTENCE_FAILED');})}};};
 // No selected-skills/lifecycle adapter is silently invented. Canonical activity
 // refuses selected originals against their preservation catalog until mounted.
 return createConversationActivity({runOwner,prepareRuntime,...(query?{query}:{}),heartbeat:()=>{}});
}
export async function runConversation(configuration,{signal}={}){const bytes=await readSecret(configuration.native.capabilityFile),native=createNativeCapabilityClient({configuration:configuration.native,credential:bytes.toString('utf8').trim()});return assembleConversationRunner({configuration,native})({binding:configuration.binding,signal});}
