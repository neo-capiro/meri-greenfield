/** Conversation scenarios over the canonical loopback conversations HTTP application. */
import {createScriptedConversationApplication,syntheticPrincipal,syntheticId} from '../../offline-targets/conversation-application.mjs';
import {observedAnswer,observedRefusal} from './envelope.mjs';
const SOURCE='conversations-http';
async function withApplication(principals,run){const target=await createScriptedConversationApplication({principals});try{return await run(target);}finally{target.close();}}
const principal=(tenantId,tag)=>syntheticPrincipal({tenantId,actorId:`actor-${tag}`,tag});
const call=async(target,credential,route,body)=>(await target.app.handle(target.request({route,credential,body}))).json();
async function submitted(target,p,tag,prompt){const credential=await target.issue(p);const accepted=await call(target,credential,'submit',{requestId:syntheticId(tag,900),prompt});return {credential,accepted};}
export async function conversationHistory(view){const {tenantId,tag}=view.scenario,p=principal(tenantId,tag);
 return withApplication([p],async target=>{const {credential}=await submitted(target,p,tag,view.prompt);return observedAnswer(view,{source:SOURCE,observed:await call(target,credential,'history',{})});});}
export async function conversationForeignHistory(view){const s=view.scenario,owner=principal(s.ownerTenantId,s.ownerTag),foreign=principal(s.foreignTenantId,s.foreignTag);
 return withApplication([owner,foreign],async target=>{await submitted(target,owner,s.ownerTag,s.ownerPrompt);const body=await call(target,await target.issue(foreign),'history',{});
  return body.error?observedRefusal(view,body.error.code,body):observedAnswer(view,{source:SOURCE,observed:body});});}
export async function conversationSubmitReplay(view){const {tenantId,tag}=view.scenario,p=principal(tenantId,tag);
 return withApplication([p],async target=>{const {credential,accepted:first}=await submitted(target,p,tag,view.prompt);
  const second=await call(target,credential,'submit',{requestId:first.requestId,prompt:view.prompt});
  return observedAnswer(view,{source:SOURCE,observed:{first:{requestId:first.requestId,replayed:first.replayed},second:{requestId:second.requestId,replayed:second.replayed},distinctRuns:new Set(target.state.starts).size}});});}
